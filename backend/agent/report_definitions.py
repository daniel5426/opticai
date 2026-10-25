"""Versioned report contracts and private, reusable definitions."""
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, Field
from fastapi import HTTPException
from services.clinic_catalog import catalog as data_catalog, expressions
from services.clinic_query import FilterGroup, compile_where
from .reports import ReportDefinition, compile_report
from .models import SavedReport, AgentJob
from .config import now
from .report_presentation import ReportPresentation, validate_presentation


class DerivedMetric(BaseModel):
    model_config = ConfigDict(extra='forbid')
    key: str = Field(pattern=r'^[a-z][a-z0-9_]{0,63}$')
    label: str = Field(min_length=1, max_length=80)
    operation: Literal['ratio', 'percent', 'difference']
    numerator: str = Field(min_length=1, max_length=180)
    denominator: str = Field(min_length=1, max_length=180)


class ReportDefinitionV2(ReportDefinition):
    model_config = ConfigDict(extra='forbid')
    version: Literal[2] = 2
    dataset: Literal['clients', 'families', 'appointments', 'exams', 'orders', 'contact_lens_orders',
        'referrals', 'medical_logs', 'files', 'tasks', 'billing', 'payments', 'inventory', 'measurements', 'campaigns'] = 'clients'
    preset: Literal['custom', 'business_health'] = 'custom'
    where: FilterGroup | None = None
    start_date: date | None = None
    end_date: date | None = None
    comparison: bool = True
    date_field: str | None = Field(default=None, max_length=160)
    relative_period: bool = False
    derived_metrics: list[DerivedMetric] = Field(default_factory=list, max_length=20)
    presentation: ReportPresentation | None = None


class SavedReportRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    action: Literal['list', 'save', 'rename', 'delete', 'run']
    report_id: str | None = Field(default=None, max_length=36)
    title: str | None = Field(default=None, max_length=200)
    definition: ReportDefinitionV2 | None = None
    revision: int | None = Field(default=None, ge=1)
    request_key: str | None = Field(default=None, max_length=80)


def resolve(raw):
    definition = ReportDefinitionV2.model_validate(raw)
    if definition.preset == 'business_health':
        relative = definition.relative_period or (definition.start_date is None and definition.end_date is None)
        end = now().astimezone(ZoneInfo('Asia/Jerusalem')).date() - timedelta(days=1) if relative else definition.end_date or now().astimezone(ZoneInfo('Asia/Jerusalem')).date() - timedelta(days=1)
        start = end - timedelta(days=89) if relative else definition.start_date or end - timedelta(days=89)
        if start > end or (end - start).days > 1095:
            raise HTTPException(422, 'agent.invalidDate')
        definition = definition.model_copy(update={'start_date': start, 'end_date': end, 'as_of': end, 'relative_period': relative})
    elif definition.start_date or definition.end_date or definition.date_field:
        if not definition.start_date or not definition.end_date or not definition.date_field or definition.start_date > definition.end_date:
            raise HTTPException(422, 'agent.invalidDate')
    return definition


def compile_definition(db, authority, definition):
    # Reuse aggregation, currency and stable ordering rules for both versions.
    query, columns = compile_report(db, authority, definition)
    if definition.where:
        _, fields = expressions(db, authority, definition.dataset, definition.as_of)
        query = query.filter(compile_where(db, authority, definition.dataset, fields, definition.where, definition.as_of))
    if definition.date_field:
        from services.clinic_query import Predicate, predicate
        _, fields = expressions(db, authority, definition.dataset, definition.as_of)
        if definition.date_field not in fields:
            raise HTTPException(422, 'agent.unsupportedReportField')
        field = fields[definition.date_field]
        if field.type.python_type not in {date, datetime}:
            raise HTTPException(422, 'agent.unsupportedReportField')
        start, end, end_operator = definition.start_date, definition.end_date, 'lte'
        if field.type.python_type is datetime:
            zone = ZoneInfo('Asia/Jerusalem')
            start = datetime.combine(start, time.min, zone).astimezone(timezone.utc)
            end = datetime.combine(end + timedelta(days=1), time.min, zone).astimezone(timezone.utc)
            if not getattr(field.type, 'timezone', False):
                start, end = start.replace(tzinfo=None), end.replace(tzinfo=None)
            end_operator = 'lt'
        query = query.filter(predicate(field, Predicate(field=definition.date_field, operator='gte', value=start.isoformat())),
            predicate(field, Predicate(field=definition.date_field, operator=end_operator, value=end.isoformat())))
    from decimal import Decimal
    numeric_columns = {metric.key for metric in definition.derived_metrics}
    numeric_columns.update(f'{aggregate.operation}_{aggregate.field}' for aggregate in definition.aggregates
        if aggregate.operation in {'sum', 'avg', 'count', 'count_distinct'})
    for column in query.column_descriptions:
        try:
            if column['type'].python_type in {int, float, Decimal}:
                numeric_columns.add(column['name'])
        except (AttributeError, NotImplementedError):
            pass
    validate_presentation(definition, columns, numeric_columns)
    return query, columns


def catalog(db, authority):
    return {'datasets': data_catalog(db, authority), 'definition_schema': ReportDefinitionV2.model_json_schema(),
        'presets': ['custom', 'business_health'], 'notes': [
            'Relationship filters use EXISTS semantics and preserve the root grain.',
            'Client balance rows are per currency; count distinct patient IDs.',
            'Business health defaults to the last 90 completed Israel-local days versus the preceding 90.',
            'Profitability is unavailable without historical costs and expenses.']}


def queue(db, authority, raw, request_key):
    from .reports import queue_export
    definition = resolve(raw)
    if definition.preset == 'custom':
        compile_definition(db, authority, definition)
    elif authority.patient_id:
        raise HTTPException(403, 'agent.patientContextMismatch')
    else:
        validate_presentation(definition, ['week', 'currency', 'sales', 'collected', 'billed_orders'], {'sales', 'collected', 'billed_orders'})
    key = f'report:{authority.context_id}:{request_key}'
    existing = db.query(AgentJob).filter_by(unique_key=key).first()
    payload = definition.model_dump(mode='json')
    if existing:
        def comparable(value):
            return {k: v for k, v in value.items() if not (value.get('relative_period') and k in {'start_date', 'end_date', 'as_of'})}
        if comparable(ReportDefinitionV2.model_validate(existing.definition).model_dump(mode='json')) != comparable(payload):
            raise HTTPException(409, 'agent.requestKeyConflict')
        return {'type': 'report_run', 'job_id': existing.id, 'status': existing.status}
    from sqlalchemy.exc import IntegrityError
    row = AgentJob(unique_key=key, company_id=authority.company_id or authority.user.company_id,
        clinic_id=authority.clinic_id, user_id=authority.user.id, context_id=authority.context_id,
        kind='report', definition=payload, locale='en', expires_at=now() + timedelta(days=7))
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return queue(db, authority, raw, request_key)
    return {'type': 'report_run', 'job_id': row.id, 'status': row.status}


def saved_query(db, authority):
    return db.query(SavedReport).filter_by(user_id=authority.user.id, clinic_id=authority.clinic_id, patient_scope=authority.patient_id or 0)


def saved(db, authority, action, report_id=None, title=None, definition=None, revision=None, request_key=None):
    if authority.read_only:
        raise HTTPException(403, 'agent.readOnly')
    if action == 'list':
        return {'items': [{'id': row.id, 'title': row.title, 'revision': row.revision, 'definition': row.definition}
            for row in saved_query(db, authority).order_by(SavedReport.updated_at.desc()).limit(100)]}
    row = saved_query(db, authority).filter_by(id=report_id).with_for_update().first() if report_id else None
    if action != 'save' and not row:
        raise HTTPException(404, 'agent.recordNotFound')
    if action == 'run':
        if not request_key:
            raise HTTPException(422, 'agent.missingFields')
        return queue(db, authority, row.definition, request_key)
    if action == 'save':
        if not title or not title.strip() or not definition:
            raise HTTPException(422, 'agent.missingFields')
        parsed = ReportDefinitionV2.model_validate(definition)
        if parsed.preset == 'custom':
            compile_definition(db, authority, parsed)
        elif authority.patient_id:
            raise HTTPException(403, 'agent.patientContextMismatch')
        else:
            validate_presentation(parsed, ['week', 'currency', 'sales', 'collected', 'billed_orders'], {'sales', 'collected', 'billed_orders'})
        stored = parsed.model_dump(mode='json', exclude_unset=True)
        if parsed.relative_period:
            stored = {k: v for k, v in stored.items() if k not in {'start_date', 'end_date', 'as_of'}}
        row = SavedReport(clinic_id=authority.clinic_id, user_id=authority.user.id,
            patient_scope=authority.patient_id or 0, title=title[:200], definition=stored)
        db.add(row)
    elif action == 'rename':
        if not title or not title.strip() or revision != row.revision:
            raise HTTPException(409, 'agent.staleChange')
        row.title, row.revision, row.updated_at = title[:200], row.revision + 1, now()
    elif action == 'delete':
        if revision != row.revision:
            raise HTTPException(409, 'agent.staleChange')
        db.delete(row)
        db.commit()
        return {'status': 'deleted'}
    else:
        raise HTTPException(422, 'agent.invalidAction')
    db.commit()
    return {'id': row.id, 'title': row.title, 'revision': row.revision, 'definition': row.definition}
