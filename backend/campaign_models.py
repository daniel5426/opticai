"""Campaign delivery and messaging finance. Money is stored in micro-ILS, never floats."""
import uuid
from datetime import UTC, datetime
from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, Text, JSON, ForeignKey, UniqueConstraint
from database import Base

def uid():
    return uuid.uuid4().hex

def now():
    return datetime.now(UTC)

class MessagingAccount(Base):
    __tablename__ = 'messaging_accounts'
    company_id = Column(Integer, ForeignKey('companies.id'), primary_key=True)
    balance = Column(BigInteger, nullable=False, default=0)
    reserved = Column(BigInteger, nullable=False, default=0)
    allowance = Column(Integer, nullable=False, default=0)
    used = Column(Integer, nullable=False, default=0)
    held = Column(Integer, nullable=False, default=0)
    period_start = Column(DateTime(timezone=True))
    period_end = Column(DateTime(timezone=True))
    manual_anchor = Column(DateTime(timezone=True))
    allowance_override = Column(Integer)
    sms_allowance_override = Column(Integer)
    low_balance = Column(BigInteger, nullable=False, default=20_000_000)

class MessagingCatalog(Base):
    __tablename__ = 'messaging_catalog'
    id = Column(Integer, primary_key=True, default=1)
    revision = Column(Integer, nullable=False, default=1)
    allowances = Column(JSON, nullable=False, default=dict)  # Legacy plan values; retained for old clients.
    email_per_clinic = Column(Integer, nullable=False, default=1000)
    sms_per_clinic = Column(Integer, nullable=False, default=200)
    email_rate = Column(BigInteger)  # micro-ILS per recipient
    sms_rate = Column(BigInteger)  # micro-ILS per purchased provider unit (+972 only)
    packs = Column(JSON, nullable=False, default=lambda: [10000, 25000, 50000])  # agorot
    enabled = Column(Boolean, nullable=False, default=False)
    effective_at = Column(DateTime(timezone=True))
    pending_config = Column(JSON)
    worker_heartbeat = Column(DateTime(timezone=True))

class MessagingPeriod(Base):
    __tablename__ = 'messaging_periods'
    company_id = Column(Integer, ForeignKey('companies.id'), primary_key=True)
    period_start = Column(DateTime(timezone=True), primary_key=True)
    period_end = Column(DateTime(timezone=True), nullable=False)
    eligible_clinics = Column(Integer, nullable=False, default=0)
    email_per_clinic = Column(Integer, nullable=False, default=1000)
    sms_per_clinic = Column(Integer, nullable=False, default=200)
    email_limit = Column(Integer, nullable=False, default=0)
    email_used = Column(Integer, nullable=False, default=0)
    email_held = Column(Integer, nullable=False, default=0)
    sms_limit = Column(Integer, nullable=False, default=0)
    sms_used = Column(Integer, nullable=False, default=0)
    sms_held = Column(Integer, nullable=False, default=0)


class MessagingConsent(Base):
    __tablename__ = 'messaging_consents'
    company_id = Column(Integer, ForeignKey('companies.id'), primary_key=True)
    channel = Column(String(12), primary_key=True)
    destination = Column(String(320), primary_key=True)
    granted = Column(Boolean, nullable=False, default=False)
    evidence = Column(String(1000), nullable=False)
    actor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    recorded_at = Column(DateTime(timezone=True), nullable=False, default=now)


class MessagingProviderState(Base):
    __tablename__ = 'messaging_provider_states'
    provider = Column(String(40), primary_key=True)
    credit_units = Column(BigInteger)
    usage = Column(JSON)
    checked_at = Column(DateTime(timezone=True))
    error = Column(String(100))
    next_request_at = Column(DateTime(timezone=True))
    blocked_until = Column(DateTime(timezone=True))
    blocked_reason = Column(String(100))
    last_callback_at = Column(DateTime(timezone=True))


class MessagingClinic(Base):
    __tablename__ = 'messaging_clinics'
    clinic_id = Column(Integer, ForeignKey('clinics.id'), primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False, index=True)
    budget = Column(BigInteger)
    reply_to = Column(String(320))
    timezone = Column(String(64), nullable=False, default='Asia/Jerusalem')

class MessagingLedger(Base):
    __tablename__ = 'messaging_ledger'
    id = Column(String(32), primary_key=True, default=uid)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), index=True)
    key = Column(String(180), nullable=False, unique=True)
    kind = Column(String(32), nullable=False)
    amount = Column(BigInteger, nullable=False, default=0)
    reference = Column(String(100))
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)

class MessagingTopup(Base):
    __tablename__ = 'messaging_topups'
    id = Column(String(32), primary_key=True, default=uid)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False, index=True)
    request_key = Column(String(80), nullable=False)
    amount_minor = Column(Integer, nullable=False)
    status = Column(String(24), nullable=False, default='pending')
    provider_login = Column(String(100))
    checkout_mode = Column(String(20), nullable=False, default='hosted_fields')
    test_mode = Column(Boolean, nullable=False)
    payment_url = Column(Text)
    receipt_url = Column(Text)
    reversed = Column(BigInteger, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (UniqueConstraint('company_id', 'request_key', name='uq_messaging_topup_request'),)

class CampaignDetails(Base):
    __tablename__ = 'campaign_details'
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), primary_key=True)
    revision = Column(Integer, nullable=False, default=1)
    subject = Column(String(300), nullable=False, default='')
    locale = Column(String(2), nullable=False, default='he')
    all_clients = Column(Boolean, nullable=False, default=False)
    status = Column(String(24), nullable=False, default='needs_review')
    schedule = Column(JSON, nullable=False, default=dict)
    next_run = Column(DateTime(timezone=True), index=True)
    approved_catalog = Column(Integer)
    max_cost = Column(BigInteger)
    actor_id = Column(Integer, ForeignKey('users.id'))
    last_error = Column(String(80))

class CampaignRun(Base):
    __tablename__ = 'campaign_runs'
    id = Column(String(32), primary_key=True, default=uid)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False, index=True)
    request_key = Column(String(180), nullable=False)
    status = Column(String(24), nullable=False, default='queued')
    snapshot = Column(JSON, nullable=False)
    actor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (UniqueConstraint('campaign_id', 'request_key', name='uq_campaign_run_request'),)

class CampaignDelivery(Base):
    __tablename__ = 'campaign_deliveries'
    id = Column(String(32), primary_key=True, default=uid)
    run_id = Column(String(32), ForeignKey('campaign_runs.id'), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey('clients.id'))
    channel = Column(String(12), nullable=False)
    destination = Column(String(320), nullable=False)
    content = Column(Text, nullable=False)
    subject = Column(String(300), nullable=False, default='')
    status = Column(String(24), nullable=False, default='queued', index=True)
    segments = Column(Integer, nullable=False, default=1)
    billing_units = Column(Integer, nullable=False, default=1)
    billing_policy = Column(JSON)
    cost = Column(BigInteger, nullable=False, default=0)
    allowance = Column(Integer, nullable=False, default=0)
    period_start = Column(DateTime(timezone=True))
    provider = Column(String(40))
    provider_id = Column(String(160), index=True)
    provider_cost = Column(JSON)
    error = Column(String(80))
    attempts = Column(Integer, nullable=False, default=0)
    lease_until = Column(DateTime(timezone=True), index=True)
    next_attempt = Column(DateTime(timezone=True))
    settled = Column(Boolean, nullable=False, default=False)
    test = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (UniqueConstraint('run_id', 'channel', 'destination', name='uq_campaign_delivery_destination'),)

class CampaignContactClaim(Base):
    __tablename__ = 'campaign_contact_claims'
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), primary_key=True)
    client_id = Column(Integer, ForeignKey('clients.id'), primary_key=True)
    channel = Column(String(12), primary_key=True)
    delivery_id = Column(String(32), ForeignKey('campaign_deliveries.id'), nullable=False)

class MessagingSuppression(Base):
    __tablename__ = 'messaging_suppressions'
    id = Column(String(32), primary_key=True, default=uid)
    scope = Column(Integer, nullable=False)  # company ID, zero for provider-wide rejection
    channel = Column(String(12), nullable=False)
    destination = Column(String(320), nullable=False)
    reason = Column(String(40), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (UniqueConstraint('scope', 'channel', 'destination', name='uq_messaging_suppression'),)

class MessagingEvent(Base):
    __tablename__ = 'messaging_events'
    key = Column(String(200), primary_key=True)
    delivery_id = Column(String(32), ForeignKey('campaign_deliveries.id'))
    kind = Column(String(40), nullable=False)
    payload = Column(JSON)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)

class MessagingRefund(Base):
    __tablename__ = 'messaging_refunds'
    id = Column(String(32), primary_key=True, default=uid)
    topup_id = Column(String(32), ForeignKey('messaging_topups.id'), nullable=False, index=True)
    amount_minor = Column(Integer, nullable=False)
    reversed_before = Column(BigInteger, nullable=False)
    status = Column(String(24), nullable=False, default='submitted')
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)
