"""Public Artifact SDK exports backed by authenticated clinic services."""
import logging
from anyio import CapacityLimiter, to_thread
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from fastapi import HTTPException
from agents24.artifacts import tool, toolset
from agents24.server import ArtifactInvocationError, create_artifact_server
from agents24.server_adapters import create_artifact_fastapi_app
from database import SessionLocal
from .authority import resolve_artifact
from . import records, reports, changes
from .config import setting
from .models import AgentJob
from . import search as record_search, report_definitions
from services import prescription_matching

logger = logging.getLogger(__name__)


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Search(Input):
    text: str = Field(min_length=1, max_length=300)


class DocumentSearch(Search):
    limit: int = Field(default=10, ge=1, le=25)


class Patient(Input):
    client_id: int = Field(gt=0)


class Records(Input):
    kind: Literal['clients', 'appointments', 'exams', 'orders', 'contact_lens_orders', 'referrals', 'medical_logs', 'files', 'tasks']
    client_id: int | None = Field(default=None, gt=0)
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=100)


class Comparison(Patient):
    first_instance: int = Field(gt=0)
    second_instance: int = Field(gt=0)


class OrderCheck(Patient):
    order_id: int = Field(gt=0)
    layout_instance_id: int = Field(gt=0)
    prescription_key: str = Field(min_length=1, max_length=100)
    contact: bool = False


class Change(Input):
    kind: Literal['clients', 'appointments', 'exams', 'orders', 'contact_lens_orders', 'referrals', 'medical_logs', 'tasks', 'exam_measurements']
    action: Literal['create', 'update']
    fields: dict
    record_id: int | str | None = None


class ChangeId(Input):
    change_id: str = Field(min_length=36, max_length=36)


class Slots(Input):
    start_date: str
    end_date: str
    user_id: int | None = Field(default=None, gt=0)
    duration: int = Field(default=30, ge=1, le=240)


class Report(Input):
    definition: reports.ReportDefinition


class Export(Report):
    request_key: str = Field(min_length=1, max_length=80)


class JobId(Input):
    job_id: str = Field(min_length=36, max_length=36)


class ReportRun(Input):
    definition: report_definitions.ReportDefinitionV2
    request_key: str = Field(min_length=1, max_length=80)


class ReportPage(JobId):
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=25, ge=1, le=100)


SavedReportInput = report_definitions.SavedReportRequest


def parse(model, inputs):
    try:
        return model.model_validate(inputs)
    except (ValueError, TypeError):
        raise ArtifactInvocationError('Invalid clinic tool input.', code='CLINIC_INPUT_INVALID') from None


_invocation_limiter = CapacityLimiter(16)


async def invoke(context, operation):
    # SQLAlchemy sessions stay inside the worker; health and relay traffic stay responsive.
    return await to_thread.run_sync(_invoke, context, operation, limiter=_invocation_limiter)


def _invoke(context, operation):
    try:
        with SessionLocal() as db:
            auth = resolve_artifact(db, context)
            return records.json_value(operation(db, auth))
    except HTTPException as error:
        import re
        code = error.detail if isinstance(error.detail, str) and re.fullmatch(r'agent\.[A-Za-z][A-Za-z0-9]*', error.detail) else 'agent.operationFailed'
        raise ArtifactInvocationError('Clinic request was rejected.', code=code) from None
    except (ValueError, TypeError):
        raise ArtifactInvocationError('Invalid clinic tool fields.', code='agent.invalidFields') from None
    except Exception:
        logger.warning('prysm_artifact_failed code=agent.operationFailed')
        raise ArtifactInvocationError('Clinic operation could not be completed.', code='CLINIC_OPERATION_FAILED') from None


@tool(name='clinic_context', description='Read the trusted current clinic/patient scope, acting staff ID, language and current Israel business date. Use first for this patient, my records, or relative dates.', input_schema=Input)
async def clinic_context(inputs, config, context):
    from zoneinfo import ZoneInfo
    from .config import now
    locale = (context.get('embed_metadata') or {}).get('app.locale')
    return await invoke(context, lambda db, auth: {'clinic_id': auth.clinic_id, 'client_id': auth.patient_id,
        'current_user_id': auth.user.id, 'business_date': now().astimezone(ZoneInfo('Asia/Jerusalem')).date().isoformat(),
        'timezone': 'Asia/Jerusalem', 'locale': locale if locale in {'he', 'en', 'fr'} else None, 'read_only': auth.read_only})


@tool(name='search_catalog', description='Discover searchable authorized datasets, typed fields and registered relationships. File contents have a separate search tool; numeric prescription similarity uses search_prescriptions.', input_schema=Input, result_handling={'strategy': 'artifact', 'limit_chars': 48000})
async def search_catalog(inputs, config, context):
    from services.clinic_catalog import catalog
    return await invoke(context, lambda db, auth: {'datasets': catalog(db, auth), 'query_schema': record_search.SearchQuery.model_json_schema()})


@tool(name='search_records', description='Search clinic records using keywords or typed nested filters. Returns paginated record evidence and source links. Patient chat remains restricted to its patient.', input_schema=record_search.SearchQuery, result_handling={'strategy': 'artifact', 'limit_chars': 48000})
async def search_records(inputs, config, context):
    args = parse(record_search.SearchQuery, inputs)
    return await invoke(context, lambda db, auth: record_search.search(db, auth, args.model_dump(mode='json')))


@tool(name='search_prescriptions', description='Find patients from partial right/left SPH, CYL, AX, ADD, PD or VA values, including extracted screenshot values. Results rank exact/equivalent then closest recorded prescriptions, with original values and differences. Identify the eye; never invent missing values. index_ready=false means coverage is incomplete.', input_schema=prescription_matching.PrescriptionQuery, result_handling={'strategy': 'artifact', 'limit_chars': 48000})
async def search_prescriptions(inputs, config, context):
    args = parse(prescription_matching.PrescriptionQuery, inputs)
    return await invoke(context, lambda db, auth: prescription_matching.search(db, [auth.clinic_id], args.model_dump(mode='json'), auth.patient_id))


@tool(name='search_documents', description='Search permanent patient-file contents through native Agents24 retrieval. Every evidence source is reauthorized. Coverage reports pending/failed files and disabled staging; do not claim all files were searched when coverage is incomplete.', input_schema=DocumentSearch, result_handling={'strategy': 'artifact', 'limit_chars': 48000})
async def search_documents(inputs, config, context):
    from .document_library import search
    args = parse(DocumentSearch, inputs)
    return await invoke(context, lambda db, auth: search(db, auth, args.text, args.limit))


@tool(name='search_patients', description='Find authorized patients by name, phone or national ID. Resolve ambiguity before acting.', input_schema=Search)
async def search_patients(inputs, config, context):
    args = parse(Search, inputs)
    return await invoke(context, lambda db, auth: records.search_clients(db, auth, args.text))


@tool(name='find_staff', description='Resolve staff by the name supplied by the user, within the selected clinic. Returns IDs and ambiguity without account or Google profile data.', input_schema=Search)
async def find_staff(inputs, config, context):
    from models import User
    from sqlalchemy import or_
    args = parse(Search, inputs)
    def read(db, auth):
        escaped = '%' + args.text.replace('%', r'\%').replace('_', r'\_') + '%'
        rows = db.query(User).filter(User.company_id == auth.user.company_id, User.clinic_id == auth.clinic_id,
            User.is_active.is_(True), or_(User.full_name.ilike(escaped), User.username.ilike(escaped))).limit(21).all()
        return {'matches': [{'id': row.id, 'requested_label': args.text} for row in rows[:20]], 'ambiguous': len(rows) > 1, 'has_more': len(rows) > 20}
    return await invoke(context, read)


@tool(name='patient_history', description='Patient history with actual exam layout measurements, orders, medical logs and source links. Paginated lists expose next_offset.', input_schema=Patient)
async def patient_history(inputs, config, context):
    args = parse(Patient, inputs)
    return await invoke(context, lambda db, auth: records.history(db, auth, args.client_id))


@tool(name='list_records', description='Read paginated clinic/patient records, including follow-up tasks. Continue pagination for complete answers.', input_schema=Records)
async def list_records(inputs, config, context):
    args = parse(Records, inputs)
    return await invoke(context, lambda db, auth: records.list_records(db, auth, **args.model_dump()))


@tool(name='exam_layout_catalog', description='Discover active clinic exam templates and their measurement component structure. Ask staff to select the template; create measured layout instances through reviewed exam_measurements changes.', input_schema=Input)
async def exam_layout_catalog(inputs, config, context):
    from models import ExamLayout
    import json
    def read(db, auth):
        rows = db.query(ExamLayout).filter_by(clinic_id=auth.clinic_id, is_active=True, is_group=False).order_by(ExamLayout.sort_index, ExamLayout.id).all()
        return {'layouts': [{'id': row.id, 'name': row.name, 'structure': records.json_value(json.loads(row.layout_data))} for row in rows]}
    return await invoke(context, read)


@tool(name='compare_exams', description='Return two authorized exam layouts for a sourced comparison; do not infer clinical diagnoses.', input_schema=Comparison)
async def compare_exams(inputs, config, context):
    args = parse(Comparison, inputs)
    return await invoke(context, lambda db, auth: records.compare(db, auth, **args.model_dump()))


@tool(name='check_order', description='Compare one order with the explicitly staff-selected exam prescription component, including cylinder transposition and missing measurements. Never choose a prescription.', input_schema=OrderCheck)
async def check_order(inputs, config, context):
    args = parse(OrderCheck, inputs)
    return await invoke(context, lambda db, auth: records.check_order(db, auth, **args.model_dump()))


@tool(name='find_appointments', description='Find available duration-aware clinic slots using opening hours, breaks, holidays, staff vacations and existing bookings.', input_schema=Slots)
async def find_appointments(inputs, config, context):
    from services.appointment_schedule import find_slots
    args = parse(Slots, inputs)
    return await invoke(context, lambda db, auth: find_slots(db, auth, **args.model_dump()))


@tool(name='change_catalog', description='Discover supported editable fields for patient, exam, appointment, referral, order and follow-up drafts.', input_schema=Input)
async def change_catalog(inputs, config, context):
    return await invoke(context, lambda db, auth: changes.editable_catalog())


@tool(name='prepare_change', description='Prepare an immutable, reviewable create/update proposal. Does not change business records. Clinical conclusions and due dates must come from staff instructions.', input_schema=Change)
async def prepare_change(inputs, config, context):
    args = parse(Change, inputs)
    return await invoke(context, lambda db, auth: changes.prepare(db, auth, **args.model_dump()))


@tool(name='commit_change', description='Save ONE prepared change after explicit staff approval. Always invoke the platform tool-review gate; never claim success before the receipt.', input_schema=ChangeId, side_effects=['write'])
async def commit_change(inputs, config, context):
    args = parse(ChangeId, inputs)
    return await invoke(context, lambda db, auth: changes.commit(db, auth, args.change_id))


@tool(name='report_catalog', description='List supported reporting datasets, fields and relationships. Never invent a field or issue SQL.', input_schema=Input, result_handling={'strategy': 'artifact', 'limit_chars': 48000})
async def report_catalog(inputs, config, context):
    return await invoke(context, report_definitions.catalog)


@tool(name='run_report', description='Execute a version-2 report as a durable immutable result with tables, charts and complete Excel/CSV exports. Supports nested relationship filters and business_health. Reuse request_key after uncertain delivery; read_report retrieves the result.', input_schema=ReportRun)
async def run_report(inputs, config, context):
    args = parse(ReportRun, inputs)
    return await invoke(context, lambda db, auth: report_definitions.queue(db, auth, args.definition.model_dump(mode='json'), args.request_key))


@tool(name='read_report', description='Read an authorized completed report execution, including metrics, charts and a page of rows. Does not rerun the query. Pending/expired reports are explicit.', input_schema=ReportPage, result_handling={'strategy': 'artifact', 'limit_chars': 48000})
async def read_report(inputs, config, context):
    args = parse(ReportPage, inputs)
    def read(db, auth):
        from EndPoints.agent import owned_job, require_live_report
        from .report_runs import page
        job = owned_job(db, auth, args.job_id)
        require_live_report(job)
        if job.status != 'completed':
            return {'type': 'report_run', 'job_id': job.id, 'status': job.status}
        return {**(job.result or {}), **page(job, args.offset, args.limit)}
    from anyio import sleep
    for attempt in range(20):
        result = await invoke(context, read)
        if result.get('status') not in {'queued', 'running'} or attempt == 19:
            return result
        await sleep(1)


@tool(name='saved_reports', description='List, save, rename, delete or rerun the current staff member’s private report definitions in this clinic/patient scope. Save only when asked; rename/delete require the current revision. Reruns need a fresh request_key.', input_schema=SavedReportInput)
async def saved_reports(inputs, config, context):
    args = parse(SavedReportInput, inputs)
    return await invoke(context, lambda db, auth: report_definitions.saved(db, auth, **args.model_dump(mode='json')))


@tool(name='preview_report', description='Compile a report definition, return exact result count and first 25 rows. Monetary totals remain separate per currency.', input_schema=Report)
async def preview_report(inputs, config, context):
    args = parse(Report, inputs)
    return await invoke(context, lambda db, auth: reports.preview(db, auth, args.definition.model_dump(mode="json")))


@tool(name='export_report', description='Queue a complete Excel or CSV export of a validated report, including all matches beyond the preview. Reuse request_key after uncertain delivery.', input_schema=Export)
async def export_report(inputs, config, context):
    args = parse(Export, inputs)
    return await invoke(context, lambda db, auth: reports.queue_export(db, auth, args.definition.model_dump(mode="json"), args.request_key))


@tool(name='job_status', description='Read an authorized report/document job; when a report completes provide its protected download path.', input_schema=JobId)
async def job_status(inputs, config, context):
    args = parse(JobId, inputs)
    def read(db, auth):
        job = db.get(AgentJob, args.job_id)
        from .models import AgentContext
        binding = db.get(AgentContext, job.context_id) if job and job.context_id else None
        if not job or job.user_id != auth.user.id or job.clinic_id != auth.clinic_id or auth.patient_id and (not binding or binding.patient_scope != auth.patient_id):
            raise HTTPException(403, 'agent.scopeDenied')
        if job.kind == 'report' and job.definition.get('version') == 2:
            from EndPoints.agent import require_live_report
            require_live_report(job)
            return {'type': 'report_run', 'job_id': job.id, 'status': job.status, 'read_tool': 'read_report'}
        return {'id': job.id, 'kind': job.kind, 'status': job.status, 'result': job.result,
                'download_path': f'/api/v1/agent/jobs/{job.id}/download' if job.file_name else None}
    return await invoke(context, read)


exports = [clinic_context, search_catalog, search_records, search_prescriptions, search_documents, search_patients, find_staff, patient_history, list_records, exam_layout_catalog, compare_exams, check_order, find_appointments,
           change_catalog, prepare_change, commit_change, report_catalog, run_report, read_report, saved_reports, preview_report, export_report, job_status]
toolsets = [
    toolset(key='records', name='Prysm patient records', description='Authorized patient history and exam comparisons.', tools=[clinic_context, search_catalog, search_records, search_prescriptions, search_documents, search_patients, find_staff, patient_history, list_records, exam_layout_catalog, compare_exams, check_order]),
    toolset(key='workflow', name='Prysm clinic workflows', description='Scheduling and approval-gated record, order, referral and follow-up changes.', tools=[find_appointments, change_catalog, prepare_change, commit_change]),
    toolset(key='reporting', name='Prysm reporting', description='Custom reports, full exports and asynchronous result tracking.', tools=[report_catalog, run_report, read_report, saved_reports, preview_report, export_report, job_status]),
]


def artifact_app():
    server = create_artifact_server(exports=exports, toolsets=toolsets, signing_secret=setting('AGENTS24_ARTIFACT_SIGNING_SECRET'))
    return create_artifact_fastapi_app(server=server)
