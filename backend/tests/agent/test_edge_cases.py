from datetime import date, timedelta
from uuid import uuid4
import pytest
from fastapi import HTTPException
from agent import changes, records, reports
from agent.authority import Authority, positive, resolve_artifact
from agent.config import now
from agent.models import PreparedChange, AgentJob
from agent.documents import submit_document
from EndPoints.agent import owned_job, download, original
from models import AuthSession, Settings, Appointment
from services.appointment_schedule import available, find_slots


@pytest.mark.parametrize('value', [True, False, 0, -1, '01', '1.0', '1e3', None, {}, [], 'x', 1.2])
def test_identifiers_cannot_coerce_to_another_scope(value):
    with pytest.raises(HTTPException):
        positive(value)


@pytest.mark.parametrize('field', ['company_id', 'clinic_id', 'user_id', 'hidden_note',
    'google_calendar_event_id', 'ai_exam_state', 'deleted_at', 'password_hash'])
def test_protected_fields_never_create_a_draft(clinic, field):
    db, auth, clients, _ = clinic
    with pytest.raises(HTTPException):
        changes.prepare(db, auth, 'clients', 'update', {field: 'forged'}, clients[0].id)
    assert db.query(PreparedChange).count() == 0


@pytest.mark.parametrize('action', ['delete', 'bulk_update', 'execute_sql', ''])
def test_unavailable_actions_never_create_a_draft(clinic, action):
    db, auth, clients, _ = clinic
    with pytest.raises(HTTPException):
        changes.prepare(db, auth, 'clients', action, {'notes': 'test'}, clients[0].id)
    assert db.query(PreparedChange).count() == 0


@pytest.mark.parametrize('stage', ['approve', 'commit'])
def test_expired_proposal_cannot_be_used(clinic, stage):
    db, auth, clients, _ = clinic
    draft = changes.prepare(db, auth, 'clients', 'update', {'notes': 'unsaved'}, clients[0].id)
    if stage == 'commit':
        changes.approve(db, auth, draft['change_id'])
    db.get(PreparedChange, draft['change_id']).expires_at = now() - timedelta(seconds=1)
    db.commit()
    with pytest.raises(HTTPException) as failure:
        getattr(changes, stage)(db, auth, draft['change_id'])
    assert failure.value.status_code == 409 and clients[0].notes is None


def test_fixed_patient_scope_cannot_approve_clinic_wide_proposal(clinic):
    db, auth, clients, _ = clinic
    draft = changes.prepare(db, auth, 'clients', 'update', {'notes': 'unsaved'}, clients[0].id)
    auth.patient_id = clients[0].id
    with pytest.raises(HTTPException):
        changes.approve(db, auth, draft['change_id'])
    assert clients[0].notes is None


@pytest.mark.parametrize('mode', ['expired', 'inactive'])
def test_signed_tools_recheck_current_session_and_staff(clinic, mode):
    db, auth, _, _ = clinic
    if mode == 'expired':
        db.query(AuthSession).first().expires_at = now() - timedelta(seconds=1)
    else:
        auth.user.is_active = False
    db.commit()
    with pytest.raises(HTTPException):
        resolve_artifact(db, {'external_session_id': auth.context_id})


@pytest.mark.parametrize('value', [True, '400', {}, [], None])
def test_numeric_report_filters_reject_ambiguous_values(clinic, value):
    db, auth, *_ = clinic
    with pytest.raises((HTTPException, ValueError)):
        reports.preview(db, auth, {'dataset': 'clients', 'filters': [
            {'field': 'outstanding', 'operator': 'gt', 'value': value}]})


@pytest.mark.parametrize('clock,duration,expected', [
    ('07:59', 30, False), ('08:00', 30, True), ('11:30', 30, True),
    ('11:31', 30, False), ('12:00', 30, False), ('13:00', 30, True),
    ('17:30', 30, True), ('17:31', 30, False), ('23:30', 60, False),
    ('09:00', 0, False), ('09:00', -1, False)])
def test_scheduling_exact_open_break_close_boundaries(clinic, clock, duration, expected):
    db, auth, *_ = clinic
    assert available(db, auth.clinic_id, auth.user.id, date(2026, 11, 8), clock, duration) is expected


def test_vacation_and_existing_appointment_exclusion(clinic):
    db, auth, clients, _ = clinic
    day = date(2026, 11, 8)
    auth.user.added_vacation_dates = [day.isoformat()]
    db.commit()
    assert find_slots(db, auth, day.isoformat(), day.isoformat())['slots'] == []
    auth.user.added_vacation_dates = []
    booked = Appointment(client_id=clients[0].id, clinic_id=auth.clinic_id, user_id=auth.user.id,
                         date=day, time='09:00', duration=30)
    db.add(booked); db.commit()
    assert not available(db, auth.clinic_id, auth.user.id, day, '09:00', 30)
    assert available(db, auth.clinic_id, auth.user.id, day, '09:00', 30, exclude=booked.id)
    assert available(db, auth.clinic_id, auth.user.id, day, '09:30', 30)


@pytest.mark.parametrize('first,last', [('2026-11-09', '2026-11-08'), ('2026-01-01', '2026-12-31')])
def test_slot_search_rejects_invalid_or_unbounded_range(clinic, first, last):
    db, auth, *_ = clinic
    with pytest.raises(HTTPException):
        find_slots(db, auth, first, last)


@pytest.mark.parametrize('mime,data', [('text/plain', b''), ('application/x-executable', b'fake'),
                                      ('text/plain', b'x' * (25 * 1024 * 1024 + 1))])
def test_document_rejection_precedes_remote_upload(clinic, monkeypatch, mime, data):
    db, auth, *_ = clinic
    def forbidden():
        pytest.fail('Invalid document reached the platform')
    monkeypatch.setattr('agent.documents.client', forbidden)
    with pytest.raises(HTTPException) as failure:
        submit_document(db, auth, 'test', mime, data)
    assert failure.value.status_code == 422 and db.query(AgentJob).count() == 0


def test_job_authority_and_expired_downloads(clinic):
    db, auth, clients, _ = clinic
    job = AgentJob(unique_key=str(uuid4()), company_id=auth.user.company_id, clinic_id=auth.clinic_id,
        user_id=auth.user.id, context_id=auth.context_id, kind='report', status='completed',
        file_name='unavailable.xlsx', expires_at=now() - timedelta(seconds=1), definition={})
    db.add(job); db.commit()
    with pytest.raises(HTTPException) as failure:
        download(job.id, auth, db)
    assert failure.value.status_code == 410
    auth.patient_id = clients[0].id
    with pytest.raises(HTTPException):
        owned_job(db, auth, job.id)
    auth.patient_id = None
    auth.clinic_id = clients[2].clinic_id
    with pytest.raises(HTTPException) as failure:
        owned_job(db, auth, job.id)
    assert failure.value.status_code == 404


@pytest.mark.parametrize('kind,fields,patch', [
    ('clients', {'first_name': 'New', 'last_name': 'Synthetic'}, {'notes': 'Reviewed'}),
    ('exams', {'exam_date': '2026-11-08', 'test_name': 'Synthetic exam'}, {'test_name': 'Reviewed exam'}),
    ('appointments', {'date': '2026-11-08', 'time': '09:00', 'duration': 30}, {'time': '10:00'}),
    ('medical_logs', {'log_date': '2026-11-08', 'log': 'Synthetic finding'}, {'log': 'Reviewed finding'}),
    ('referrals', {'date': '2026-11-08', 'referral_notes': 'Synthetic referral'}, {'referral_notes': 'Reviewed referral'}),
    ('orders', {'order_date': '2026-11-08', 'order_data': {'details': {'notes': 'Synthetic'}}}, {'dominant_eye': 'right'}),
    ('contact_lens_orders', {'order_date': '2026-11-08', 'notes': 'Synthetic contact order'}, {'notes': 'Reviewed contact order'}),
])
def test_each_supported_record_creates_updates_and_replays_without_duplicates(clinic, kind, fields, patch):
    db, auth, clients, _ = clinic
    model = records.MODELS[kind]
    fields = dict(fields)
    if kind != 'clients':
        fields['client_id'] = clients[0].id
    before = db.query(model).count()
    draft = changes.prepare(db, auth, kind, 'create', fields)
    assert db.query(model).count() == before
    changes.approve(db, auth, draft['change_id'])
    receipt = changes.commit(db, auth, draft['change_id'])
    assert changes.commit(db, auth, draft['change_id']) == receipt
    assert db.query(model).count() == before + 1
    row = db.query(model).order_by(model.id.desc()).first()
    assert row.clinic_id == auth.clinic_id
    if hasattr(row, 'company_id'):
        assert row.company_id == auth.user.company_id
    update = dict(patch)
    if kind != 'clients':
        update['client_id'] = clients[0].id
    draft = changes.prepare(db, auth, kind, 'update', update, row.id)
    changes.approve(db, auth, draft['change_id'])
    receipt = changes.commit(db, auth, draft['change_id'])
    assert changes.commit(db, auth, draft['change_id']) == receipt
    db.refresh(row)
    for key, value in patch.items():
        assert getattr(row, key) == value
    assert db.query(model).count() == before + 1
