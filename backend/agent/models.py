"""Additive app-owned context, action, task and result persistence."""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, Date, DateTime, JSON, ForeignKey, UniqueConstraint
from database import Base
from .config import now


def identifier():
    return str(uuid.uuid4())


class AgentContext(Base):
    __tablename__ = 'prysm_agent_contexts'
    __table_args__ = (UniqueConstraint('session_id', 'clinic_id', 'patient_scope', name='uq_agent_context_scope'),)
    id = Column(String(36), primary_key=True, default=identifier)
    session_id = Column(String(36), ForeignKey('auth_sessions.id', ondelete='CASCADE'), nullable=False)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    patient_scope = Column(Integer, nullable=False, default=0)
    platform_principal_ref = Column(String(255), index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)


class PreparedChange(Base):
    __tablename__ = 'prysm_agent_changes'
    id = Column(String(36), primary_key=True, default=identifier)
    context_id = Column(String(36), ForeignKey('prysm_agent_contexts.id'), nullable=False)
    kind = Column(String(40), nullable=False)
    action = Column(String(20), nullable=False)
    payload = Column(JSON, nullable=False)
    expected = Column(JSON, nullable=False)
    result = Column(JSON)
    status = Column(String(20), nullable=False, default='prepared')
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
    expires_at = Column(DateTime(timezone=True), nullable=False)


class FollowupTask(Base):
    __tablename__ = 'prysm_followup_tasks'
    id = Column(String(36), primary_key=True, default=identifier)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey('clients.id'))
    assigned_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    title = Column(String(300), nullable=False)
    notes = Column(String)
    due_date = Column(Date, nullable=False, index=True)
    source = Column(JSON, nullable=False, default=dict)
    status = Column(String(20), nullable=False, default='open')
    revision = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now)


class TaskEvent(Base):
    __tablename__ = 'prysm_followup_events'
    id = Column(String(36), primary_key=True, default=identifier)
    task_id = Column(String(36), ForeignKey('prysm_followup_tasks.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    change = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)


class AgentJob(Base):
    __tablename__ = 'prysm_agent_jobs'
    id = Column(String(36), primary_key=True, default=identifier)
    unique_key = Column(String(200), unique=True, nullable=False)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    context_id = Column(String(36), ForeignKey('prysm_agent_contexts.id'))
    kind = Column(String(30), nullable=False, index=True)
    status = Column(String(20), nullable=False, default='queued', index=True)
    locale = Column(String(2), nullable=False, default='he')
    business_date = Column(Date)
    definition = Column(JSON, nullable=False, default=dict)
    result = Column(JSON)
    run_id = Column(String(36))
    thread_id = Column(String(36))
    worker = Column(String(100))
    lease_until = Column(DateTime(timezone=True))
    file_name = Column(String(200))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now)


class InsightCache(Base):
    __tablename__ = 'prysm_insight_cache'
    __table_args__ = (UniqueConstraint('client_id', 'locale', name='uq_insight_client_locale'),)
    id = Column(String(36), primary_key=True, default=identifier)
    client_id = Column(Integer, ForeignKey('clients.id', ondelete='CASCADE'), nullable=False)
    locale = Column(String(2), nullable=False)
    fingerprint = Column(String(64), nullable=False)
    sections = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)


class SavedReport(Base):
    __tablename__ = 'prysm_saved_reports'
    id = Column(String(36), primary_key=True, default=identifier)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    patient_scope = Column(Integer, nullable=False, default=0)
    title = Column(String(200), nullable=False)
    definition = Column(JSON, nullable=False)
    revision = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now)


class DocumentIndex(Base):
    __tablename__ = 'prysm_document_indexes'
    __table_args__ = (UniqueConstraint('file_id', 'revision', name='uq_document_index_revision'),)
    id = Column(String(36), primary_key=True, default=identifier)
    file_id = Column(Integer, ForeignKey('files.id', ondelete='CASCADE'), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey('clients.id'), nullable=False, index=True)
    revision = Column(String(64), nullable=False)
    status = Column(String(24), nullable=False, default='queued')
    job_id = Column(String(36), ForeignKey('prysm_agent_jobs.id'), nullable=True)
    metadata_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now)


class PrescriptionIndexState(Base):
    __tablename__ = 'prysm_prescription_index_state'
    clinic_id = Column(Integer, ForeignKey('clinics.id'), primary_key=True)
    ready = Column(Boolean, nullable=False, default=False)
    checkpoint = Column(JSON, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now)
