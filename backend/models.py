from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, Date, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
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
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    company = relationship("Company", back_populates="clinics")
    users = relationship("User", back_populates="clinic")
    clients = relationship("Client", back_populates="clinic")
    families = relationship("Family", back_populates="clinic")
    settings = relationship("Settings", back_populates="clinic")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    full_name = Column(String)
    username = Column(String, nullable=False, unique=True)
    email = Column(String)
    phone = Column(String)
    password = Column(String)
    role = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    profile_picture = Column(String)
    primary_theme_color = Column(String)
    secondary_theme_color = Column(String)
    theme_preference = Column(String, default="system")
    google_account_connected = Column(Boolean, default=False)
    google_account_email = Column(String)
    google_access_token = Column(String)
    google_refresh_token = Column(String)
    system_vacation_dates = Column(JSON, default=list)
    added_vacation_dates = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    clinic = relationship("Clinic", back_populates="users")

class Family(Base):
    __tablename__ = "families"
    
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    name = Column(String, nullable=False)
    created_date = Column(Date, server_default=func.current_date())
    notes = Column(Text)
    
    clinic = relationship("Clinic", back_populates="families")
    clients = relationship("Client", back_populates="family")

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
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
    profile_picture = Column(String)
    family_id = Column(Integer, ForeignKey("families.id"))
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
    
    clinic = relationship("Clinic", back_populates="clients")
    family = relationship("Family", back_populates="clients")

# Indexes to speed up common client list queries
class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    log_date = Column(Date)
    log = Column(Text)

class OpticalExam(Base):
    __tablename__ = "optical_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    clinic = Column(String)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ExamLayoutInstance(Base):
    __tablename__ = "exam_layout_instances"
    
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("optical_exams.id", ondelete="CASCADE"), nullable=False)
    layout_id = Column(Integer, ForeignKey("exam_layouts.id", ondelete="RESTRICT"), nullable=False)
    is_active = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    exam_data = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
 


class Billing(Base):
    __tablename__ = "billings"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    contact_lens_id = Column(Integer, ForeignKey("contact_lens_orders.id"))
    total_before_discount = Column(Float)
    discount_amount = Column(Float)
    discount_percent = Column(Float)
    total_after_discount = Column(Float)
    prepayment_amount = Column(Float)
    installment_count = Column(Integer)
    notes = Column(Text)

class OrderLineItem(Base):
    __tablename__ = "order_line_item"
    
    id = Column(Integer, primary_key=True, index=True)
    billings_id = Column(Integer, ForeignKey("billings.id"), nullable=False)
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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    lens_id = Column(Integer)
    frame_id = Column(Integer)
    comb_va = Column(Float)
    comb_high = Column(Float)
    comb_pd = Column(Float)
    order_data = Column(JSON, nullable=False, default={})

 
class ContactLensOrder(Base):
    __tablename__ = "contact_lens_orders"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
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


class Referral(Base):
    __tablename__ = "referrals"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    referral_notes = Column(Text, nullable=False)
    prescription_notes = Column(Text)
    date = Column(Date)
    type = Column(String)
    branch = Column(String)
    recipient = Column(String)
    referral_data = Column(JSON, nullable=False, default={})

class ReferralEye(Base):
    __tablename__ = "referral_eye"
    
    id = Column(Integer, primary_key=True, index=True)
    referral_id = Column(Integer, ForeignKey("referrals.id"), nullable=False)
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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    date = Column(Date)
    time = Column(String)
    duration = Column(Integer, default=30)
    exam_name = Column(String)
    note = Column(Text)
    google_calendar_event_id = Column(String)

class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    file_type = Column(String)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    notes = Column(Text)

class Chat(Base):
    __tablename__ = "chats"
    
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    title = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    data = Column(Text)

class EmailLog(Base):
    __tablename__ = "email_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
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
    active = Column(Boolean, default=False)
    active_since = Column(DateTime(timezone=True))
    mail_sent = Column(Boolean, default=False)
    sms_sent = Column(Boolean, default=False)
    emails_sent_count = Column(Integer, default=0)
    sms_sent_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cycle_type = Column(String, default="daily")
    cycle_custom_days = Column(Integer)
    last_executed = Column(DateTime(timezone=True))
    execute_once_per_client = Column(Boolean, default=False)

class CampaignClientExecution(Base):
    __tablename__ = "campaign_client_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupSupplier(Base):
    __tablename__ = "lookup_supplier"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupClinic(Base):
    __tablename__ = "lookup_clinic"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupOrderType(Base):
    __tablename__ = "lookup_order_type"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupReferralType(Base):
    __tablename__ = "lookup_referral_type"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupLensModel(Base):
    __tablename__ = "lookup_lens_model"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupColor(Base):
    __tablename__ = "lookup_color"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupMaterial(Base):
    __tablename__ = "lookup_material"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupCoating(Base):
    __tablename__ = "lookup_coating"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupManufacturer(Base):
    __tablename__ = "lookup_manufacturer"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupFrameModel(Base):
    __tablename__ = "lookup_frame_model"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupContactLensType(Base):
    __tablename__ = "lookup_contact_lens_type"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupContactEyeLensType(Base):
    __tablename__ = "lookup_contact_eye_lens_type"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupContactEyeMaterial(Base):
    __tablename__ = "lookup_contact_eye_material"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupCleaningSolution(Base):
    __tablename__ = "lookup_cleaning_solution"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupDisinfectionSolution(Base):
    __tablename__ = "lookup_disinfection_solution"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupRinsingSolution(Base):
    __tablename__ = "lookup_rinsing_solution"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupManufacturingLab(Base):
    __tablename__ = "lookup_manufacturing_lab"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LookupAdvisor(Base):
    __tablename__ = "lookup_advisor"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) 

# Indexes to speed up common filters and sorting on exams list
Index('ix_optical_exams_clinic_id', OpticalExam.clinic_id)
Index('ix_optical_exams_type', OpticalExam.type)
Index('ix_optical_exams_clinic_type_date', OpticalExam.clinic_id, OpticalExam.type, OpticalExam.exam_date)

Index('ix_exam_layout_instances_exam_id', ExamLayoutInstance.exam_id)
Index('ix_exam_layout_instances_exam_id_is_active', ExamLayoutInstance.exam_id, ExamLayoutInstance.is_active)
Index('ix_exam_layout_instances_exam_id_order', ExamLayoutInstance.exam_id, ExamLayoutInstance.order)

Index('ix_clients_clinic_id', Client.clinic_id)
Index('ix_clients_clinic_id_id_desc', Client.clinic_id, Client.id.desc())

# Indexes for referrals table
Index('ix_referrals_clinic_id', Referral.clinic_id)
Index('ix_referrals_client_id', Referral.client_id)
Index('ix_referrals_clinic_date', Referral.clinic_id, Referral.date.desc())

# Indexes for orders table
Index('ix_orders_clinic_id', Order.clinic_id)
Index('ix_orders_client_id', Order.client_id)
Index('ix_orders_clinic_date', Order.clinic_id, Order.order_date.desc())

# Indexes for files table
Index('ix_files_clinic_id', File.clinic_id)
Index('ix_files_client_id', File.client_id)
Index('ix_files_clinic_upload_date', File.clinic_id, File.upload_date.desc())

# Indexes for appointments table
Index('ix_appointments_clinic_id', Appointment.clinic_id)
Index('ix_appointments_client_id', Appointment.client_id)
Index('ix_appointments_clinic_date', Appointment.clinic_id, Appointment.date.desc())

# Indexes for families table
Index('ix_families_clinic_id', Family.clinic_id)
Index('ix_families_clinic_created', Family.clinic_id, Family.created_date.desc())

# Indexes for users table
Index('ix_users_clinic_id', User.clinic_id)
Index('ix_users_is_active', User.is_active)
