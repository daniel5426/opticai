from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, Date, JSON, Index, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import declared_attr, relationship, backref
from sqlalchemy.sql import func, false
from database import Base

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_full_name = Column(String, nullable=False)
    contact_email = Column(String)
    contact_phone = Column(String)
    logo_path = Column(String)
    address = Column(String)
    primary_theme_color = Column(String)
    secondary_theme_color = Column(String)
    
    # WhatsApp Settings
    whatsapp_access_token = Column(String)
    whatsapp_phone_number_id = Column(String)
    whatsapp_business_account_id = Column(String)
    whatsapp_verify_token = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    clinics = relationship("Clinic", back_populates="company")

class Clinic(Base):
    __tablename__ = "clinics"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String, nullable=False)
    location = Column(String)
    phone_number = Column(String)
    email = Column(String)
    clinic_name = Column(String)
    clinic_position = Column(String)
    clinic_address = Column(String)
    clinic_city = Column(String)
    clinic_postal_code = Column(String)
    clinic_directions = Column(String)
    clinic_website = Column(String)
    manager_name = Column(String)
    license_number = Column(String)
    unique_id = Column(String, unique=True, nullable=False)
    entry_pin_hash = Column(String)
    entry_pin_version = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, default=True)
    maintenance_mode = Column(Boolean, nullable=False, default=False)
    maintenance_reason = Column(String)
    maintenance_job_id = Column(String)
    maintenance_started_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    company = relationship("Company", back_populates="clinics")
    users = relationship("User", back_populates="clinic")
    clients = relationship("Client", back_populates="clinic")
    families = relationship("Family", back_populates="clinic")
    settings = relationship("Settings", back_populates="clinic")
    holiday_overrides = relationship("ClinicHolidayOverride", back_populates="clinic", cascade="all, delete-orphan")

    @property
    def has_entry_pin(self):
        return bool(self.entry_pin_hash)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    full_name = Column(String)
    username = Column(String, nullable=False, unique=True)
    email = Column(String)
    phone = Column(String)
    password_hash = Column(String)
    role_level = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, default=True)
    profile_picture = Column(String)
    primary_theme_color = Column(String)
    secondary_theme_color = Column(String)
    theme_preference = Column(String, default="system")
    google_account_connected = Column(Boolean, default=False)
    google_account_email = Column(String)
    google_access_token = Column(String)
    google_refresh_token = Column(String)
    google_calendar_sync_enabled = Column(Boolean, default=False)
    va_format = Column(String, default="meter") # "meter" or "decimal"
    cyl_format = Column(String, default="minus") # "minus" or "plus"
    system_vacation_dates = Column(JSON, default=list)
    added_vacation_dates = Column(JSON, default=list)
    sync_subjective_to_final_subjective = Column(Boolean, default=False)
    import_order_to_old_refraction_default = Column(Boolean, default=False)
    clinical_auto_advance_enabled = Column(Boolean, nullable=False, default=True)
    auth_provider = Column(String, default="email") # "email", "google"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    clinic = relationship("Clinic", back_populates="users")

    @property
    def has_password(self):
        return bool(self.password_hash and self.password_hash.strip())


class ClinicHolidayOverride(Base):
    __tablename__ = "clinic_holiday_overrides"
    __table_args__ = (
        UniqueConstraint("clinic_id", "holiday_date", name="uq_clinic_holiday_overrides_clinic_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    holiday_date = Column(Date, nullable=False)
    name = Column(String(160), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    clinic = relationship("Clinic", back_populates="holiday_overrides")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), index=True)
    refresh_token_hash = Column(String, nullable=False, unique=True, index=True)
    device_id = Column(String)
    user_agent = Column(String)
    ip_address = Column(String)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True))
    last_seen_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")

class ClinicDeviceTrust(Base):
    __tablename__ = "clinic_device_trusts"
    __table_args__ = (
        UniqueConstraint("clinic_id", "device_id", name="uq_clinic_device_trusts_clinic_device"),
    )

    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    device_id = Column(String, nullable=False)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    entry_pin_version = Column(Integer, nullable=False, default=1)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True))
    last_used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    clinic = relationship("Clinic")

class PendingCompanySetup(Base):
    __tablename__ = "pending_company_setups"

    id = Column(String, primary_key=True)
    setup_token_hash = Column(String, nullable=False, unique=True, index=True)
    email = Column(String, nullable=False, index=True)
    full_name = Column(String)
    password_hash = Column(String)
    auth_provider = Column(String, nullable=False, default="email")
    google_account_email = Column(String)
    google_access_token = Column(Text)
    google_refresh_token = Column(Text)
    selected_plan_code = Column(String(32))
    email_verified_at = Column(DateTime(timezone=True))
    wizard_state = Column(String(32), nullable=False, default="account")
    company_payload = Column(JSON)
    clinic_payload = Column(JSON)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        UniqueConstraint("company_id", name="uq_subscriptions_company_id"),
        CheckConstraint(
            "status IN ('pending_checkout','trialing','active','legacy_active','past_due','read_only','cancelled')",
            name="ck_subscriptions_status",
        ),
    )

    id = Column(String, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    stripe_customer_id = Column(String, unique=True, index=True)
    stripe_subscription_id = Column(String, unique=True, index=True)
    stripe_price_id = Column(String)
    plan_code = Column(String(32), nullable=False)
    pending_plan_code = Column(String(32))
    status = Column(String(32), nullable=False, default="pending_checkout", index=True)
    clinic_limit = Column(Integer)
    staff_limit = Column(Integer)
    trial_starts_at = Column(DateTime(timezone=True))
    trial_ends_at = Column(DateTime(timezone=True))
    current_period_starts_at = Column(DateTime(timezone=True))
    current_period_ends_at = Column(DateTime(timezone=True))
    grace_ends_at = Column(DateTime(timezone=True))
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    cancelled_at = Column(DateTime(timezone=True))
    pending_change_at = Column(DateTime(timezone=True))
    trial_consumed_at = Column(DateTime(timezone=True))
    enterprise_clinic_limit = Column(Integer)
    enterprise_staff_limit = Column(Integer)
    stripe_event_created_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class BillingWebhookEvent(Base):
    __tablename__ = "billing_webhook_events"

    id = Column(String, primary_key=True)
    stripe_event_id = Column(String, nullable=False, unique=True, index=True)
    event_type = Column(String, nullable=False)
    processing_state = Column(String(24), nullable=False, default="processing")
    stripe_created_at = Column(DateTime(timezone=True))
    processed_at = Column(DateTime(timezone=True))
    error_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class TermsAcceptance(Base):
    __tablename__ = "terms_acceptances"

    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    terms_version = Column(String(64), nullable=False)
    privacy_version = Column(String(64), nullable=False)
    accepted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ip_address = Column(String)
    user_agent = Column(Text)


class AuthActionToken(Base):
    __tablename__ = "auth_action_tokens"

    id = Column(String, primary_key=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    purpose = Column(String(32), nullable=False, index=True)
    pending_setup_id = Column(String, ForeignKey("pending_company_setups.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    consumed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class MigrationSourceLink(Base):
    __tablename__ = "migration_source_links"
    __table_args__ = (
        UniqueConstraint(
            "source_system",
            "target_model",
            "clinic_id",
            "raw_row_ref",
            name="uq_migration_source_links_source_target",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_system = Column(String, nullable=False)
    source_table = Column(String, nullable=False)
    raw_row_ref = Column(String, nullable=False)
    source_primary_key_parts = Column(JSON, nullable=False)
    source_per_id = Column(Integer)
    source_user_id = Column(Integer)
    target_model = Column(String, nullable=False)
    target_id = Column(Integer, nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    payload = Column(JSON, nullable=False, default=dict)
    # Exact parsed migration-source rows. These remain separate from the editable
    # clinical/profile data and are intentionally nullable for pre-feature links.
    migration_job_id = Column(
        String,
        ForeignKey("softoptic_migration_jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    raw_payload = Column(JSON, nullable=True)
    raw_payload_sha256 = Column(String, nullable=True)
    raw_captured_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class SoftOpticMigrationJob(Base):
    __tablename__ = "softoptic_migration_jobs"

    id = Column(String, primary_key=True)
    source_system = Column(String, nullable=False, default="softoptic", index=True)
    bundle_format_version = Column(Integer)
    source_fingerprint = Column(String, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String, nullable=False, default="queued", index=True)
    step = Column(String, nullable=False, default="queued")
    progress = Column(Integer, nullable=False, default=0)
    include_documents = Column(Boolean, nullable=False, default=False)
    client_import_limit = Column(Integer)
    source_metadata = Column(JSON, nullable=False, default=dict)
    export_summary = Column(JSON, nullable=False, default=dict)
    validation_summary = Column(JSON, nullable=False, default=dict)
    import_summary = Column(JSON, nullable=False, default=dict)
    checkpoint = Column(JSON, nullable=False, default=dict)
    warnings = Column(JSON, nullable=False, default=list)
    errors = Column(JSON, nullable=False, default=list)
    error = Column(Text)
    bundle_path = Column(Text)
    bundle_storage_bucket = Column(String)
    bundle_storage_key = Column(Text)
    locked_by = Column(String, index=True)
    lease_until = Column(DateTime(timezone=True), index=True)
    heartbeat_at = Column(DateTime(timezone=True))
    pause_requested = Column(Boolean, nullable=False, default=False)
    attempt_count = Column(Integer, nullable=False, default=0)
    last_error_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    finished_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# The physical table name is intentionally retained for rolling compatibility
# with already deployed SoftOptic API and worker processes.
MigrationJob = SoftOpticMigrationJob


class ClinicDataPruneJob(Base):
    __tablename__ = "clinic_data_prune_jobs"

    id = Column(String, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String, nullable=False, default="queued", index=True)
    step = Column(String, nullable=False, default="queued")
    progress = Column(Integer, nullable=False, default=0)
    checkpoint = Column(JSON, nullable=False, default=dict)
    preview_counts = Column(JSON, nullable=False, default=dict)
    deleted_counts = Column(JSON, nullable=False, default=dict)
    warnings = Column(JSON, nullable=False, default=list)
    error = Column(Text)
    locked_by = Column(String, index=True)
    lease_until = Column(DateTime(timezone=True), index=True)
    heartbeat_at = Column(DateTime(timezone=True))
    attempt_count = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime(timezone=True))
    finished_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ClinicDataPruneStorageObject(Base):
    __tablename__ = "clinic_data_prune_storage_objects"
    __table_args__ = (
        UniqueConstraint("job_id", "bucket", "storage_key", name="uq_prune_storage_job_object"),
    )

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, ForeignKey("clinic_data_prune_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    bucket = Column(String, nullable=False)
    storage_key = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="pending", index=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    error = Column(Text)
    deleted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Family(Base):
    __tablename__ = "families"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    name = Column(String, nullable=False)
    created_date = Column(Date, server_default=func.current_date())
    notes = Column(Text)
    
    clinic = relationship("Clinic", back_populates="families")
    clients = relationship("Client", back_populates="family")

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    first_name = Column(String)
    last_name = Column(String)
    gender = Column(String)
    national_id = Column(String)
    date_of_birth = Column(Date)
    health_fund = Column(String)
    address_city = Column(String)
    address_street = Column(String)
    address_number = Column(String)
    postal_code = Column(String)
    phone_home = Column(String)
    phone_work = Column(String)
    phone_mobile = Column(String)
    additional_phone = Column(String)
    fax = Column(String)
    email = Column(String)
    service_center = Column(String)
    file_creation_date = Column(Date)
    membership_end = Column(Date)
    service_end = Column(Date)
    price_list = Column(String)
    discount_percent = Column(Integer)
    blocked_checks = Column(Boolean)
    blocked_credit = Column(Boolean)
    sorting_group = Column(String)
    referring_party = Column(String)
    file_location = Column(String)
    occupation = Column(String)
    status = Column(String)
    notes = Column(Text)
    hidden_note = Column(Text)
    profile_picture = Column(String)
    family_id = Column(Integer, ForeignKey("families.id", ondelete="SET NULL"))
    family_role = Column(String)
    ai_updated_date = Column(DateTime(timezone=True))
    client_updated_date = Column(DateTime(timezone=True), server_default=func.now())
    ai_exam_state = Column(String)
    ai_order_state = Column(String)
    ai_referral_state = Column(String)
    ai_contact_lens_state = Column(String)
    ai_appointment_state = Column(String)
    ai_file_state = Column(String)
    ai_medical_state = Column(String)
    merged_into_client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    merged_at = Column(DateTime(timezone=True), nullable=True)
    merged_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    merge_snapshot = Column(JSON, nullable=True)
    
    clinic = relationship("Clinic", back_populates="clients")
    family = relationship("Family", back_populates="clients")

class RecentClientVisit(Base):
    __tablename__ = "recent_client_visits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    visited_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class PrescriptionSearchIndex(Base):
    __tablename__ = "prescription_search_index"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String, nullable=False)
    source_id = Column(Integer, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False)
    exam_id = Column(Integer, ForeignKey("optical_exams.id", ondelete="CASCADE"), nullable=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id", ondelete="CASCADE"), nullable=True)
    card_type = Column(String)
    source_date = Column(Date)
    eye = Column(String, nullable=False)
    sph = Column(Float)
    cyl = Column(Float)
    ax = Column(Integer)
    add = Column(Float)
    va = Column(String)
    pd = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    clinic_name = Column(String)
    clinic_position = Column(String)
    clinic_email = Column(String)
    clinic_phone = Column(String)
    clinic_address = Column(String)
    clinic_city = Column(String)
    clinic_postal_code = Column(String)
    clinic_directions = Column(String)
    clinic_website = Column(String)
    manager_name = Column(String)
    license_number = Column(String)
    clinic_logo_path = Column(String)
    primary_theme_color = Column(String)
    secondary_theme_color = Column(String)
    work_start_time = Column(String)
    work_end_time = Column(String)
    appointment_duration = Column(Integer)
    send_email_before_appointment = Column(Boolean)
    email_days_before = Column(Integer)
    email_time = Column(String)
    working_days = Column(String)
    break_start_time = Column(String)
    break_end_time = Column(String)
    max_appointments_per_day = Column(Integer)
    va_test_distance = Column(Integer, nullable=False, default=6)
    email_provider = Column(String)
    email_smtp_host = Column(String)
    email_smtp_port = Column(Integer)
    email_smtp_secure = Column(Boolean)
    email_username = Column(String)
    email_password = Column(String)
    email_from_name = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    clinic = relationship("Clinic", back_populates="settings")

class MedicalLog(Base):
    __tablename__ = "medical_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    log_date = Column(Date)
    log = Column(Text)

class OpticalExam(Base):
    __tablename__ = "optical_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    clinic = Column(String)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    exam_date = Column(Date)
    test_name = Column(String)
    dominant_eye = Column(String)
    type = Column(String, default="exam")

class ExamLayout(Base):
    __tablename__ = "exam_layouts"
    
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    name = Column(String, nullable=False)
    layout_data = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    sort_index = Column(Integer, nullable=False, default=0)
    parent_layout_id = Column(Integer, ForeignKey("exam_layouts.id", ondelete="SET NULL"))
    is_group = Column(Boolean, default=False)
    type = Column(String, nullable=True) # "contact lens", "glass", "global"
    seed_key = Column(String, nullable=True)
    seed_version = Column(Integer, nullable=True)
    is_seeded_default = Column(Boolean, nullable=False, default=False, server_default=false())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    children = relationship(
        "ExamLayout",
        backref=backref("parent", remote_side=[id])
    )

class ExamLayoutInstance(Base):
    __tablename__ = "exam_layout_instances"
    
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("optical_exams.id", ondelete="CASCADE"), nullable=False)
    layout_id = Column(Integer, ForeignKey("exam_layouts.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    exam_data = Column(JSON, nullable=False, default={})
    layout_data = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# exam_data is a JSON field that contains all the exam data for the layout instance (prescription, cover test, etc.)
# so to understand the structure of the exam data read the file docs/exam_data.md

 


class Billing(Base):
    __tablename__ = "billings"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"))
    contact_lens_id = Column(Integer, ForeignKey("contact_lens_orders.id", ondelete="CASCADE"))
    total_before_discount = Column(Float)
    discount_amount = Column(Float)
    discount_percent = Column(Float)
    total_after_discount = Column(Float)
    prepayment_amount = Column(Float)
    installment_count = Column(Integer)
    notes = Column(Text)


class BillingPayment(Base):
    __tablename__ = "billing_payments"

    id = Column(Integer, primary_key=True, index=True)
    billing_id = Column(Integer, ForeignKey("billings.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    paid_at = Column(Date, nullable=False)
    kind = Column(String, nullable=False, default="payment")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OrderLineItem(Base):
    __tablename__ = "order_line_item"
    
    id = Column(Integer, primary_key=True, index=True)
    billings_id = Column(Integer, ForeignKey("billings.id", ondelete="CASCADE"), nullable=False)
    sku = Column(String)
    description = Column(String)
    supplied_by = Column(String)
    supplied = Column(Boolean)
    price = Column(Float)
    quantity = Column(Float)
    discount = Column(Float)
    line_total = Column(Float)

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    order_date = Column(Date)
    type = Column(String)
    dominant_eye = Column(String)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    lens_id = Column(Integer)
    frame_id = Column(Integer)
    order_data = Column(JSON, nullable=False, default={})

# order_data is a JSON field that contains all the order data for the order
# so to understand the structure of the order data read the file docs/exam_data.md

 
class ContactLensOrder(Base):
    __tablename__ = "contact_lens_orders"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    order_date = Column(Date)
    type = Column(String)

    l_lens_type = Column(String)
    l_model = Column(String)
    l_supplier = Column(String)
    l_material = Column(String)
    l_color = Column(String)
    l_quantity = Column(Integer)
    l_order_quantity = Column(Integer)
    l_dx = Column(Boolean)

    r_lens_type = Column(String)
    r_model = Column(String)
    r_supplier = Column(String)
    r_material = Column(String)
    r_color = Column(String)
    r_quantity = Column(Integer)
    r_order_quantity = Column(Integer)
    r_dx = Column(Boolean)

    supply_in_clinic_id = Column(Integer, ForeignKey("clinics.id"))
    order_status = Column(String)
    advisor = Column(String)
    deliverer = Column(String)
    delivery_date = Column(Date)
    priority = Column(String)
    guaranteed_date = Column(Date)
    approval_date = Column(Date)
    cleaning_solution = Column(String)
    disinfection_solution = Column(String)
    rinsing_solution = Column(String)
    notes = Column(Text)
    supplier_notes = Column(Text)

    order_data = Column(JSON, nullable=False, default={})

# order_data is a JSON field that contains all the order data for the contact lens order
# so to understand the structure of the order data read the file docs/exam_data.md


class CatalogProduct(Base):
    __tablename__ = "catalog_products"
    __table_args__ = (
        UniqueConstraint("company_id", "category", "normalized_key", name="uq_catalog_products_company_category_key"),
        CheckConstraint("category IN ('frame', 'contact_lens')", name="ck_catalog_products_category"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(32), nullable=False, index=True)
    brand = Column(String(160))
    model = Column(String(160), nullable=False)
    product_type = Column(String(120))
    material = Column(String(120))
    preferred_supplier = Column(String(160))
    replacement_schedule = Column(String(120))
    normalized_key = Column(String(512), nullable=False)
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    variants = relationship("CatalogVariant", back_populates="product")


class CatalogVariant(Base):
    __tablename__ = "catalog_variants"
    __table_args__ = (
        UniqueConstraint("company_id", "normalized_fingerprint", name="uq_catalog_variants_company_fingerprint"),
        UniqueConstraint("company_id", "sku", name="uq_catalog_variants_company_sku"),
        UniqueConstraint("company_id", "barcode", name="uq_catalog_variants_company_barcode"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("catalog_products.id", ondelete="RESTRICT"), nullable=False, index=True)
    attributes = Column(JSON, nullable=False, default=dict)
    normalized_fingerprint = Column(String(1024), nullable=False)
    sku = Column(String(120))
    barcode = Column(String(160))
    default_cost = Column(Float)
    default_retail = Column(Float)
    currency = Column(String(3), nullable=False, default="ILS", server_default="ILS")
    is_stockable = Column(Boolean, nullable=False, default=True, server_default="true")
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    product = relationship("CatalogProduct", back_populates="variants")


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"
    __table_args__ = (
        UniqueConstraint("clinic_id", "variant_id", name="uq_inventory_balances_clinic_variant"),
        CheckConstraint("on_hand >= 0", name="ck_inventory_balances_on_hand_nonnegative"),
        CheckConstraint("reserved >= 0", name="ck_inventory_balances_reserved_nonnegative"),
        CheckConstraint("reserved <= on_hand", name="ck_inventory_balances_reserved_not_above_on_hand"),
        CheckConstraint("reorder_point >= 0", name="ck_inventory_balances_reorder_nonnegative"),
        CheckConstraint("target_quantity >= 0", name="ck_inventory_balances_target_nonnegative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("catalog_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    on_hand = Column(Integer, nullable=False, default=0, server_default="0")
    reserved = Column(Integer, nullable=False, default=0, server_default="0")
    reorder_point = Column(Integer, nullable=False, default=0, server_default="0")
    target_quantity = Column(Integer, nullable=False, default=0, server_default="0")
    version = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    __table_args__ = (
        UniqueConstraint("company_id", "idempotency_key", name="uq_inventory_movements_company_idempotency"),
        CheckConstraint("on_hand_delta <> 0 OR reserved_delta <> 0", name="ck_inventory_movements_nonzero_delta"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("catalog_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    balance_id = Column(Integer, ForeignKey("inventory_balances.id", ondelete="RESTRICT"), nullable=False, index=True)
    movement_type = Column(String(40), nullable=False, index=True)
    on_hand_delta = Column(Integer, nullable=False, default=0, server_default="0")
    reserved_delta = Column(Integer, nullable=False, default=0, server_default="0")
    reason = Column(Text, nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), index=True)
    contact_lens_order_id = Column(Integer, ForeignKey("contact_lens_orders.id", ondelete="SET NULL"), index=True)
    idempotency_key = Column(String(160))
    movement_metadata = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class OrderInventoryAllocation(Base):
    __tablename__ = "order_inventory_allocations"
    __table_args__ = (
        UniqueConstraint("order_id", "component", name="uq_order_inventory_allocations_order_component"),
        UniqueConstraint("contact_lens_order_id", "component", name="uq_order_inventory_allocations_contact_component"),
        CheckConstraint(
            "(order_id IS NOT NULL AND contact_lens_order_id IS NULL) OR "
            "(order_id IS NULL AND contact_lens_order_id IS NOT NULL)",
            name="ck_order_inventory_allocations_one_order",
        ),
        CheckConstraint("quantity > 0", name="ck_order_inventory_allocations_quantity_positive"),
        CheckConstraint("fulfillment_source IN ('inventory', 'supplier_ordered')", name="ck_order_inventory_allocations_source"),
        CheckConstraint(
            "lifecycle_state IN ('reserved', 'supplier_ordered', 'consumed', 'released', 'detached')",
            name="ck_order_inventory_allocations_state",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("catalog_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    contact_lens_order_id = Column(Integer, ForeignKey("contact_lens_orders.id", ondelete="CASCADE"), index=True)
    component = Column(String(32), nullable=False)
    quantity = Column(Integer, nullable=False, default=1, server_default="1")
    fulfillment_source = Column(String(32), nullable=False)
    lifecycle_state = Column(String(32), nullable=False)
    snapshot_fingerprint = Column(String(1024))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    consumed_at = Column(DateTime(timezone=True))
    released_at = Column(DateTime(timezone=True))


class CatalogDiscoveryRun(Base):
    __tablename__ = "catalog_discovery_runs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    status = Column(String(32), nullable=False, default="review", server_default="review")
    summary = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    confirmed_at = Column(DateTime(timezone=True))


class CatalogDiscoveryCandidate(Base):
    __tablename__ = "catalog_discovery_candidates"
    __table_args__ = (
        UniqueConstraint("run_id", "normalized_fingerprint", name="uq_catalog_discovery_candidates_run_fingerprint"),
    )

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("catalog_discovery_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(32), nullable=False)
    product_data = Column(JSON, nullable=False, default=dict)
    variant_attributes = Column(JSON, nullable=False, default=dict)
    normalized_fingerprint = Column(String(1024), nullable=False)
    occurrence_count = Column(Integer, nullable=False, default=0, server_default="0")
    source_summary = Column(JSON, nullable=False, default=dict)
    needs_details = Column(Boolean, nullable=False, default=False, server_default="false")
    selected = Column(Boolean, nullable=False, default=False, server_default="false")
    suggested_variant_id = Column(Integer, ForeignKey("catalog_variants.id", ondelete="SET NULL"))
    confirmed_variant_id = Column(Integer, ForeignKey("catalog_variants.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CatalogOrderObservation(Base):
    __tablename__ = "catalog_order_observations"
    __table_args__ = (
        UniqueConstraint("order_id", "component", name="uq_catalog_observations_order_component"),
        UniqueConstraint("contact_lens_order_id", "component", name="uq_catalog_observations_contact_component"),
        CheckConstraint(
            "(order_id IS NOT NULL AND contact_lens_order_id IS NULL) OR "
            "(order_id IS NULL AND contact_lens_order_id IS NOT NULL)",
            name="ck_catalog_observations_one_order",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("catalog_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    contact_lens_order_id = Column(Integer, ForeignKey("contact_lens_orders.id", ondelete="CASCADE"), index=True)
    component = Column(String(32), nullable=False)
    observed_on = Column(Date)
    quantity = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class InventoryCompanySettings(Base):
    __tablename__ = "inventory_company_settings"
    __table_args__ = (
        UniqueConstraint("company_id", name="uq_inventory_company_settings_company"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    discovery_intro_acknowledged_at = Column(DateTime(timezone=True))
    default_reorder_point = Column(Integer, nullable=False, default=0, server_default="0")
    default_target_quantity = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Referral(Base):
    __tablename__ = "referrals"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    referral_notes = Column(Text, nullable=False)
    prescription_notes = Column(Text)
    date = Column(Date)
    type = Column(String)
    urgency_level = Column(String)
    recipient = Column(String)
    referral_data = Column(JSON, nullable=False, default={})

class ReferralEye(Base):
    __tablename__ = "referral_eye"
    
    id = Column(Integer, primary_key=True, index=True)
    referral_id = Column(Integer, ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False)
    eye = Column(String)
    sph = Column(Float)
    cyl = Column(Float)
    ax = Column(Integer)
    pris = Column(Float)
    base = Column(Float)
    va = Column(Float)
    add_power = Column(Float)
    decent = Column(Float)
    s_base = Column(Float)
    high = Column(Float)
    pd = Column(Float)

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    date = Column(Date)
    time = Column(String)
    duration = Column(Integer, default=30)
    exam_name = Column(String)
    exam_layout_id = Column(Integer, ForeignKey("exam_layouts.id", ondelete="SET NULL"), nullable=True)
    note = Column(Text)
    google_calendar_event_id = Column(String)

class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    file_name = Column(String, nullable=False)
    original_file_name = Column(String)
    storage_bucket = Column(String)
    storage_key = Column(String)
    file_size = Column(Integer)
    file_type = Column(String)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    notes = Column(Text)

class Chat(Base):
    __tablename__ = "chats"
    
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    title = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    data = Column(Text)

class EmailLog(Base):
    __tablename__ = "email_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    email_address = Column(String, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, nullable=False)
    error_message = Column(Text)

class WorkShift(Base):
    __tablename__ = "work_shifts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String)
    duration_minutes = Column(Integer)
    date = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Campaign(Base):
    __tablename__ = "campaigns"
    
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    name = Column(String, nullable=False)
    filters = Column(Text)
    email_enabled = Column(Boolean, default=False)
    email_content = Column(Text)
    sms_enabled = Column(Boolean, default=False)
    sms_content = Column(Text)
    whatsapp_enabled = Column(Boolean, default=False)
    whatsapp_template_name = Column(String)
    whatsapp_content = Column(Text)
    active = Column(Boolean, default=False)
    active_since = Column(DateTime(timezone=True))
    mail_sent = Column(Boolean, default=False)
    sms_sent = Column(Boolean, default=False)
    whatsapp_sent = Column(Boolean, default=False)
    emails_sent_count = Column(Integer, default=0)
    sms_sent_count = Column(Integer, default=0)
    whatsapp_sent_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cycle_type = Column(String, default="daily")
    cycle_custom_days = Column(Integer)
    last_executed = Column(DateTime(timezone=True))
    execute_once_per_client = Column(Boolean, default=False)

class CampaignClientExecution(Base):
    __tablename__ = "campaign_client_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="success")  # success, failed
    error_message = Column(Text)
    channel = Column(String)  # email, sms, whatsapp

class ClinicScopedLookupMixin:
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @declared_attr
    def clinic_id(cls):
        return Column(Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)

    @declared_attr
    def __table_args__(cls):
        table_name = cls.__tablename__
        return (
            UniqueConstraint("clinic_id", "name", name=f"uq_{table_name}_clinic_name"),
            Index(f"ix_{table_name}_clinic_name", "clinic_id", "name"),
            Index(f"ix_{table_name}_clinic_id_id", "clinic_id", "id"),
        )


class LookupSupplier(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_supplier"


class LookupClinic(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_clinic"


class LookupOrderType(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_order_type"


class LookupReferralType(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_referral_type"


class LookupLensModel(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_lens_model"


class LookupColor(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_color"


class LookupMaterial(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_material"


class LookupCoating(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_coating"


class LookupManufacturer(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_manufacturer"


class LookupFrameModel(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_frame_model"


class LookupContactLensType(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_contact_lens_type"


class LookupContactEyeLensType(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_contact_eye_lens_type"


class LookupContactEyeMaterial(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_contact_eye_material"


class LookupContactLensModel(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_contact_lens_model"


class LookupCleaningSolution(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_cleaning_solution"


class LookupDisinfectionSolution(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_disinfection_solution"


class LookupRinsingSolution(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_rinsing_solution"


class LookupManufacturingLab(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_manufacturing_lab"


class LookupAdvisor(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_advisor"


class LookupVAMeter(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_va_meter"


class LookupVADecimal(ClinicScopedLookupMixin, Base):
    __tablename__ = "lookup_va_decimal"


# Indexes to speed up common client list queries
Index('ix_families_company_clinic_id', Family.company_id, Family.clinic_id, Family.id)
Index('ix_families_company_clinic_name', Family.company_id, Family.clinic_id, Family.name)
Index('ix_families_clinic_name', Family.clinic_id, Family.name)
Index('ix_clients_clinic_id', Client.clinic_id)
Index('ix_clients_clinic_id_id_desc', Client.clinic_id, Client.id.desc())
Index('ix_clients_clinic_file_creation_date', Client.clinic_id, Client.file_creation_date)
Index('ix_clients_family_id', Client.family_id)
Index('ix_clients_family_id_id', Client.family_id, Client.id)
Index('ix_clients_merged_into_client_id', Client.merged_into_client_id)
Index('ix_recent_client_visits_user_clinic_visited', RecentClientVisit.user_id, RecentClientVisit.clinic_id, RecentClientVisit.visited_at.desc())
Index('uq_recent_client_visits_user_clinic_client', RecentClientVisit.user_id, RecentClientVisit.clinic_id, RecentClientVisit.client_id, unique=True)
Index('ix_prescription_search_client', PrescriptionSearchIndex.client_id)
Index('ix_prescription_search_clinic_eye_values', PrescriptionSearchIndex.clinic_id, PrescriptionSearchIndex.eye, PrescriptionSearchIndex.sph, PrescriptionSearchIndex.cyl, PrescriptionSearchIndex.ax)
Index('ix_prescription_search_source', PrescriptionSearchIndex.source_type, PrescriptionSearchIndex.source_id)
Index('ix_prescription_search_exam_id', PrescriptionSearchIndex.exam_id)
Index('ix_prescription_search_layout_instance_id', PrescriptionSearchIndex.layout_instance_id)

# Indexes for referrals table
Index('ix_referrals_clinic_id', Referral.clinic_id)
Index('ix_referrals_client_id', Referral.client_id)
Index('ix_referrals_user_id', Referral.user_id)
Index('ix_referrals_clinic_date', Referral.clinic_id, Referral.date.desc())

# Indexes for orders table
Index('ix_orders_clinic_id', Order.clinic_id)
Index('ix_orders_client_id', Order.client_id)
Index('ix_orders_clinic_date', Order.clinic_id, Order.order_date.desc())
Index('ix_orders_user_id', Order.user_id)
Index('ix_contact_lens_orders_clinic_id', ContactLensOrder.clinic_id)
Index('ix_contact_lens_orders_client_id', ContactLensOrder.client_id)
Index('ix_contact_lens_orders_user_id', ContactLensOrder.user_id)
Index('ix_contact_lens_orders_clinic_date', ContactLensOrder.clinic_id, ContactLensOrder.order_date.desc())

# Indexes for files table
Index('ix_files_clinic_id', File.clinic_id)
Index('ix_files_client_id', File.client_id)
Index('ix_files_clinic_upload_date', File.clinic_id, File.upload_date.desc())
Index('ix_files_storage_key', File.storage_bucket, File.storage_key)

# Indexes for appointments table
Index('ix_appointments_clinic_id', Appointment.clinic_id)
Index('ix_appointments_client_id', Appointment.client_id)
Index('ix_appointments_clinic_date', Appointment.clinic_id, Appointment.date.desc())
Index('ix_appointments_clinic_date_time', Appointment.clinic_id, Appointment.date, Appointment.time)
Index('ix_appointments_user_id', Appointment.user_id)
Index('ix_billing_payments_paid_at_billing_id', BillingPayment.paid_at, BillingPayment.billing_id)
Index('ix_work_shifts_user_date', WorkShift.user_id, WorkShift.date)
Index('ix_inventory_movements_clinic_type_created', InventoryMovement.clinic_id, InventoryMovement.movement_type, InventoryMovement.created_at)
Index('ix_catalog_observations_clinic_date_variant', CatalogOrderObservation.clinic_id, CatalogOrderObservation.observed_on, CatalogOrderObservation.variant_id)

# Indexes for families table
Index('ix_families_clinic_id', Family.clinic_id)
Index('ix_families_clinic_created', Family.clinic_id, Family.created_date.desc())

# Indexes for users table
Index('ix_users_clinic_id', User.clinic_id)
Index('ix_users_is_active', User.is_active)
Index('ix_settings_clinic_id', Settings.clinic_id)
Index('ix_migration_source_links_source', MigrationSourceLink.source_system, MigrationSourceLink.source_table, MigrationSourceLink.clinic_id)
Index('ix_migration_source_links_target', MigrationSourceLink.target_model, MigrationSourceLink.target_id)
Index('ix_softoptic_migration_jobs_clinic_created', SoftOpticMigrationJob.clinic_id, SoftOpticMigrationJob.created_at.desc())
Index('ix_softoptic_migration_jobs_source_status', SoftOpticMigrationJob.source_system, SoftOpticMigrationJob.status)
Index('ix_clinic_data_prune_jobs_clinic_created', ClinicDataPruneJob.clinic_id, ClinicDataPruneJob.created_at.desc())

Index('ix_exam_layout_instances_exam_id', ExamLayoutInstance.exam_id)
Index('ix_exam_layout_instances_exam_id_is_active', ExamLayoutInstance.exam_id, ExamLayoutInstance.is_active)
Index('ix_exam_layout_instances_exam_id_order', ExamLayoutInstance.exam_id, ExamLayoutInstance.order)
Index('ix_exam_layouts_clinic_seed_key', ExamLayout.clinic_id, ExamLayout.seed_key, unique=True)

# Indexes to speed up common filters and sorting on exams list
Index('ix_optical_exams_clinic_id', OpticalExam.clinic_id)
Index('ix_optical_exams_type', OpticalExam.type)
Index('ix_optical_exams_clinic_type_date', OpticalExam.clinic_id, OpticalExam.type, OpticalExam.exam_date)
