"""Host sessions are authority; model arguments never choose the acting user."""
from dataclasses import dataclass
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_
from sqlalchemy.orm import aliased
from models import AuthSession, User, Clinic, Client
from auth import access_session_id, validate_auth_session, validate_current_user, is_expired
from security.scope import assert_clinic_scope, get_scoped_client, validate_loaded_clinic_scope
from .models import AgentContext, AgentJob, PreparedChange


@dataclass
class Authority:
    user: User
    clinic_id: int
    context_id: str
    patient_id: int | None = None
    read_only: bool = False
    platform_principal_ref: str | None = None
    company_id: int | None = None


def positive(value):
    if isinstance(value, bool):
        raise HTTPException(422, 'agent.invalidIdentifier')
    try:
        result = int(value)
    except (ValueError, TypeError):
        raise HTTPException(422, 'agent.invalidIdentifier') from None
    if result <= 0 or str(result) != str(value):
        raise HTTPException(422, 'agent.invalidIdentifier')
    return result


def resolve_request(db, request):
    bearer = request.headers.get('authorization', '')
    if not bearer.startswith('Bearer '):
        raise HTTPException(401, 'agent.sessionRequired')
    session_id = access_session_id(HTTPAuthorizationCredentials(scheme='Bearer', credentials=bearer[7:]))
    loaded = db.query(AuthSession, User).join(User, User.id == AuthSession.user_id).filter(AuthSession.id == session_id).first()
    session = validate_auth_session(loaded[0] if loaded else None)
    user = validate_current_user(loaded[1] if loaded else None)
    clinic_id = positive(request.headers.get('x-prysm-clinic-id') or session.clinic_id or user.clinic_id)
    patient_id = request.headers.get('x-prysm-client-id')
    patient_id = positive(patient_id) if patient_id else 0
    assigned = aliased(Clinic)
    loaded = db.query(Clinic, AgentContext, Client, assigned.company_id).select_from(Clinic).outerjoin(
        AgentContext, and_(AgentContext.session_id == session.id, AgentContext.clinic_id == clinic_id,
                           AgentContext.patient_scope == patient_id)).outerjoin(
        Client, and_(Client.id == patient_id, Client.deleted_at.is_(None))).outerjoin(
        assigned, assigned.id == user.clinic_id).filter(Clinic.id == clinic_id).first()
    clinic, binding, patient, assigned_company = loaded if loaded else (None, None, None, None)
    company_id = user.company_id if user.company_id is not None else assigned_company
    if session.company_id != company_id:
        raise HTTPException(403, 'agent.scopeDenied')
    validate_loaded_clinic_scope(user, clinic, company_id)
    if patient_id and not patient:
        raise HTTPException(404, 'Client not found')
    if patient_id and patient.clinic_id != clinic_id:
        raise HTTPException(403, 'agent.scopeDenied')
    if binding and (binding.user_id != user.id or binding.company_id != company_id):
        raise HTTPException(403, 'agent.scopeDenied')
    if not binding:
        binding = AgentContext(session_id=session.id, user_id=user.id, company_id=company_id,
                               clinic_id=clinic_id, patient_scope=patient_id)
        db.add(binding)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            binding = db.query(AgentContext).filter_by(session_id=session_id, clinic_id=clinic_id, patient_scope=patient_id).one()
    return Authority(user, clinic_id, binding.id, patient_id or None, platform_principal_ref=binding.platform_principal_ref, company_id=company_id)


def register_principal(db, authority, principal_ref):
    binding = db.query(AgentContext).filter_by(id=authority.context_id).with_for_update().one()
    if binding.platform_principal_ref and binding.platform_principal_ref != principal_ref:
        raise HTTPException(403, 'agent.scopeDenied')
    binding.platform_principal_ref = principal_ref
    db.commit()


def owned_change(db, authority, change_id, lock=False):
    query = db.query(PreparedChange).join(AgentContext, AgentContext.id == PreparedChange.context_id).filter(
        PreparedChange.id == change_id, AgentContext.user_id == authority.user.id,
        AgentContext.company_id == authority.user.company_id, AgentContext.clinic_id == authority.clinic_id,
        AgentContext.patient_scope == (authority.patient_id or 0))
    return (query.with_for_update(of=PreparedChange) if lock else query).first()


def resolve_artifact(db, context):
    context_id = context.get('external_session_id')
    if not context_id:
        # Identity and chat_scope are supplied by the signed platform envelope.
        # Conversation ownership survives login; authorization still needs a
        # freshly validated active staff session registered by the BFF.
        principal = context.get('external_user_id')
        import re
        scope = re.fullmatch(r'clinic:([1-9][0-9]*):patient:(0|[1-9][0-9]*)', str(context.get('chat_scope') or ''))
        if not principal or not scope:
            raise HTTPException(403, 'agent.scopeDenied')
        bindings = db.query(AgentContext).join(AuthSession, AuthSession.id == AgentContext.session_id).filter(
            AgentContext.platform_principal_ref == principal, AgentContext.clinic_id == int(scope[1]),
            AgentContext.patient_scope == int(scope[2]), AuthSession.revoked_at.is_(None)).order_by(AgentContext.created_at.desc()).all()
        binding = next((row for row in bindings if not is_expired(db.get(AuthSession, row.session_id).expires_at)), None)
        if not binding:
            raise HTTPException(401, 'agent.sessionRequired')
        context_id = binding.id
    if context_id.startswith('brief:'):
        job = db.get(AgentJob, context_id[6:])
        if not job or job.kind != 'brief' or job.status != 'running':
            raise HTTPException(403, 'agent.scopeDenied')
        user = db.get(User, job.user_id)
        if not user or not user.is_active:
            raise HTTPException(403, 'agent.scopeDenied')
        assert_clinic_scope(db, user, job.clinic_id)
        return Authority(user, job.clinic_id, context_id, read_only=True)
    binding = db.get(AgentContext, context_id)
    session = db.get(AuthSession, binding.session_id) if binding else None
    if not session or session.revoked_at is not None or is_expired(session.expires_at):
        raise HTTPException(401, 'agent.sessionRequired')
    user = db.get(User, binding.user_id)
    if not user or not user.is_active or user.company_id != binding.company_id or session.user_id != user.id or session.company_id != binding.company_id:
        raise HTTPException(403, 'agent.scopeDenied')
    assert_clinic_scope(db, user, binding.clinic_id)
    return Authority(user, binding.clinic_id, binding.id, binding.patient_scope or None)


def patient(db, authority, client_id):
    client_id = positive(client_id)
    if authority.patient_id and client_id != authority.patient_id:
        raise HTTPException(403, 'agent.patientContextMismatch')
    row = get_scoped_client(db, authority.user, client_id)
    if row.clinic_id != authority.clinic_id:
        raise HTTPException(403, 'agent.scopeDenied')
    return row


def writable(authority):
    if authority.read_only:
        raise HTTPException(403, 'agent.readOnly')


def rotate_session_contexts(db, previous_session, next_session_id):
    """Refresh continues the same trusted session; logout still revokes it."""
    successor = db.get(AuthSession, next_session_id)
    if not successor or successor.user_id != previous_session.user_id or successor.company_id != previous_session.company_id:
        raise HTTPException(403, 'agent.scopeDenied')
    db.query(AgentContext).filter(AgentContext.session_id == previous_session.id).update(
        {'session_id': next_session_id}, synchronize_session='fetch')
