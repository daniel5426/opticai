from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, Date, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
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
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
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
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    log_date = Column(Date)
    log = Column(Text)

class OpticalExam(Base):
    __tablename__ = "optical_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    clinic = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
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
    type = Column(String, default="exam")
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ExamLayoutInstance(Base):
    __tablename__ = "exam_layout_instances"
    
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("optical_exams.id"), nullable=False)
    layout_id = Column(Integer, ForeignKey("exam_layouts.id"), nullable=False)
    is_active = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ExamData(Base):
    __tablename__ = "exam_data"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False, unique=True)
    exam_data = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class NotesExam(Base):
    __tablename__ = "notes_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    card_instance_id = Column(String)
    title = Column(String, default="הערות")
    note = Column(Text)

class OldRefractionExam(Base):
    __tablename__ = "old_refraction_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Integer)
    l_ax = Column(Integer)
    r_pris = Column(Float)
    l_pris = Column(Float)
    r_base = Column(Float)
    l_base = Column(Float)
    r_va = Column(Float)
    l_va = Column(Float)
    r_ad = Column(Float)
    l_ad = Column(Float)
    comb_va = Column(Float)

class OldRefractionExtensionExam(Base):
    __tablename__ = "old_refraction_extension_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Integer)
    l_ax = Column(Integer)
    r_pr_h = Column(Float)
    l_pr_h = Column(Float)
    r_base_h = Column(String)
    l_base_h = Column(String)
    r_pr_v = Column(Float)
    l_pr_v = Column(Float)
    r_base_v = Column(String)
    l_base_v = Column(String)
    r_va = Column(Float)
    l_va = Column(Float)
    r_ad = Column(Float)
    l_ad = Column(Float)
    r_j = Column(Integer)
    l_j = Column(Integer)
    r_pd_far = Column(Float)
    l_pd_far = Column(Float)
    r_pd_close = Column(Float)
    l_pd_close = Column(Float)
    comb_va = Column(Float)
    comb_pd_far = Column(Float)
    comb_pd_close = Column(Float)

class ObjectiveExam(Base):
    __tablename__ = "objective_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Integer)
    l_ax = Column(Integer)
    r_se = Column(Float)
    l_se = Column(Float)

class SubjectiveExam(Base):
    __tablename__ = "subjective_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_fa = Column(Float)
    l_fa = Column(Float)
    r_fa_tuning = Column(Float)
    l_fa_tuning = Column(Float)
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Integer)
    l_ax = Column(Integer)
    r_pris = Column(Float)
    l_pris = Column(Float)
    r_base = Column(Float)
    l_base = Column(Float)
    r_va = Column(Float)
    l_va = Column(Float)
    r_ph = Column(Float)
    l_ph = Column(Float)
    r_pd_close = Column(Float)
    l_pd_close = Column(Float)
    r_pd_far = Column(Float)
    l_pd_far = Column(Float)
    comb_va = Column(Float)
    comb_fa = Column(Float)
    comb_fa_tuning = Column(Float)
    comb_pd_close = Column(Float)
    comb_pd_far = Column(Float) 

class AdditionExam(Base):
    __tablename__ = "addition_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_fcc = Column(Float)
    l_fcc = Column(Float)
    r_read = Column(Float)
    l_read = Column(Float)
    r_int = Column(Float)
    l_int = Column(Float)
    r_bif = Column(Float)
    l_bif = Column(Float)
    r_mul = Column(Float)
    l_mul = Column(Float)
    r_j = Column(Integer)
    l_j = Column(Integer)
    r_iop = Column(Float)
    l_iop = Column(Float)

class RetinoscopExam(Base):
    __tablename__ = "retinoscop_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Integer)
    l_ax = Column(Integer)
    r_reflex = Column(String)
    l_reflex = Column(String)

class RetinoscopDilationExam(Base):
    __tablename__ = "retinoscop_dilation_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Integer)
    l_ax = Column(Integer)
    r_reflex = Column(String)
    l_reflex = Column(String)

class FinalSubjectiveExam(Base):
    __tablename__ = "final_subjective_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"))
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Integer)
    l_ax = Column(Integer)
    r_pr_h = Column(Float)
    l_pr_h = Column(Float)
    r_base_h = Column(String)
    l_base_h = Column(String)
    r_pr_v = Column(Float)
    l_pr_v = Column(Float)
    r_base_v = Column(String)
    l_base_v = Column(String)
    r_va = Column(Float)
    l_va = Column(Float)
    r_j = Column(Integer)
    l_j = Column(Integer)
    r_pd_far = Column(Float)
    l_pd_far = Column(Float)
    r_pd_close = Column(Float)
    l_pd_close = Column(Float)
    comb_pd_far = Column(Float)
    comb_pd_close = Column(Float)
    comb_va = Column(Float)

class FinalPrescriptionExam(Base):
    __tablename__ = "final_prescription_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"))
    order_id = Column(Integer, ForeignKey("orders.id"))
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Integer)
    l_ax = Column(Integer)
    r_pris = Column(Float)
    l_pris = Column(Float)
    r_base = Column(String)
    l_base = Column(String)
    r_va = Column(Float)
    l_va = Column(Float)
    r_ad = Column(Float)
    l_ad = Column(Float)
    r_pd = Column(Float)
    l_pd = Column(Float)
    r_high = Column(Float)
    l_high = Column(Float)
    r_diam = Column(Integer)
    l_diam = Column(Integer)
    comb_va = Column(Float)
    comb_pd = Column(Float)
    comb_high = Column(Float)

class CompactPrescriptionExam(Base):
    __tablename__ = "compact_prescription_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"))
    referral_id = Column(Integer, ForeignKey("referrals.id"))
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Integer)
    l_ax = Column(Integer)
    r_pris = Column(Float)
    l_pris = Column(Float)
    r_base = Column(Float)
    l_base = Column(Float)
    r_va = Column(Float)
    l_va = Column(Float)
    r_ad = Column(Float)
    l_ad = Column(Float)
    r_pd = Column(Float)
    l_pd = Column(Float)
    comb_va = Column(Float)
    comb_pd = Column(Float)

class ContactLens(Base):
    __tablename__ = "contact_lens"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    exam_date = Column(Date)
    type = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    comb_va = Column(Float)
    pupil_diameter = Column(Float)
    corneal_diameter = Column(Float)
    eyelid_aperture = Column(Float)
    notes = Column(Text)
    notes_for_supplier = Column(Text)

class ContactLensOrder(Base):
    __tablename__ = "contact_lens_order"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    branch = Column(String)
    supply_in_branch = Column(String)
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

class Billing(Base):
    __tablename__ = "billings"
    
    id = Column(Integer, primary_key=True, index=True)
    contact_lens_id = Column(Integer, ForeignKey("contact_lens.id"))
    optical_exams_id = Column(Integer, ForeignKey("optical_exams.id"))
    order_id = Column(Integer, ForeignKey("orders.id"))
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
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    order_date = Column(Date)
    type = Column(String)
    dominant_eye = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    lens_id = Column(Integer)
    frame_id = Column(Integer)
    comb_va = Column(Float)
    comb_high = Column(Float)
    comb_pd = Column(Float)

class OrderEye(Base):
    __tablename__ = "order_eyes"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    eye = Column(String)
    sph = Column(Float)
    cyl = Column(Float)
    ax = Column(Integer)
    pris = Column(Float)
    base = Column(Float)
    va = Column(Float)
    ad = Column(Float)
    diam = Column(Float)
    s_base = Column(Float)
    high = Column(Float)
    pd = Column(Float)

class OrderLens(Base):
    __tablename__ = "order_lens"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    right_model = Column(String)
    left_model = Column(String)
    color = Column(String)
    coating = Column(String)
    material = Column(String)
    supplier = Column(String)

class Frame(Base):
    __tablename__ = "frames"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    color = Column(String)
    supplier = Column(String)
    model = Column(String)
    manufacturer = Column(String)
    supplied_by = Column(String)
    bridge = Column(Float)
    width = Column(Float)
    height = Column(Float)
    length = Column(Float)

class OrderDetails(Base):
    __tablename__ = "order_details"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    branch = Column(String)
    supplier_status = Column(String)
    bag_number = Column(String)
    advisor = Column(String)
    delivered_by = Column(String)
    technician = Column(String)
    delivered_at = Column(Date)
    warranty_expiration = Column(Date)
    delivery_location = Column(String)
    manufacturing_lab = Column(String)
    order_status = Column(String)
    priority = Column(String)
    promised_date = Column(Date)
    approval_date = Column(Date)
    notes = Column(Text)
    lens_order_notes = Column(Text) 

class Referral(Base):
    __tablename__ = "referrals"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    referral_notes = Column(Text, nullable=False)
    prescription_notes = Column(Text)
    date = Column(Date)
    type = Column(String)
    branch = Column(String)
    recipient = Column(String)

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
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date)
    time = Column(String)
    duration = Column(Integer, default=30)
    exam_name = Column(String)
    note = Column(Text)
    google_calendar_event_id = Column(String)

class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    file_type = Column(String)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by = Column(Integer, ForeignKey("users.id"))
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())

class UncorrectedVAExam(Base):
    __tablename__ = "uncorrected_va_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_fv = Column(String)
    l_fv = Column(String)
    r_iv = Column(String)
    l_iv = Column(String)
    r_nv_j = Column(String)
    l_nv_j = Column(String)

class KeratometerExam(Base):
    __tablename__ = "keratometer_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_k1 = Column(Float)
    r_k2 = Column(Float)
    r_axis = Column(Integer)
    l_k1 = Column(Float)
    l_k2 = Column(Float)
    l_axis = Column(Integer)

class KeratometerFullExam(Base):
    __tablename__ = "keratometer_full_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_dpt_k1 = Column(Float)
    r_dpt_k2 = Column(Float)
    l_dpt_k1 = Column(Float)
    l_dpt_k2 = Column(Float)
    r_mm_k1 = Column(Float)
    r_mm_k2 = Column(Float)
    l_mm_k1 = Column(Float)
    l_mm_k2 = Column(Float)
    r_mer_k1 = Column(Float)
    r_mer_k2 = Column(Float)
    l_mer_k1 = Column(Float)
    l_mer_k2 = Column(Float)
    r_astig = Column(Boolean)
    l_astig = Column(Boolean)

class CornealTopographyExam(Base):
    __tablename__ = "corneal_topography_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    l_note = Column(Text)
    r_note = Column(Text)
    title = Column(String)

class AnamnesisExam(Base):
    __tablename__ = "anamnesis_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    medications = Column(Text)
    allergies = Column(Text)
    family_history = Column(Text)
    previous_treatments = Column(Text)
    lazy_eye = Column(Text)
    contact_lens_wear = Column(Boolean, default=False)
    started_wearing_since = Column(String)
    stopped_wearing_since = Column(String)
    additional_notes = Column(Text)

class CoverTestExam(Base):
    __tablename__ = "cover_test_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    card_instance_id = Column(String)
    card_id = Column(String)
    tab_index = Column(Integer)
    deviation_type = Column(String)
    deviation_direction = Column(String)
    fv_1 = Column(Float)
    fv_2 = Column(Float)
    nv_1 = Column(Float)
    nv_2 = Column(Float)

class SchirmerTestExam(Base):
    __tablename__ = "schirmer_test_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_mm = Column(Float)
    l_mm = Column(Float)
    r_but = Column(Float)
    l_but = Column(Float)

class OldRefExam(Base):
    __tablename__ = "old_ref_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    role = Column(String)
    source = Column(String)
    contacts = Column(Text)

class ContactLensDiameters(Base):
    __tablename__ = "contact_lens_diameters"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    pupil_diameter = Column(Float)
    corneal_diameter = Column(Float)
    eyelid_aperture = Column(Float)

class ContactLensDetails(Base):
    __tablename__ = "contact_lens_details"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
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

class KeratometerContactLens(Base):
    __tablename__ = "keratometer_contact_lens"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    l_rh = Column(Float)
    l_rv = Column(Float)
    l_avg = Column(Float)
    l_cyl = Column(Float)
    l_ax = Column(Integer)
    l_ecc = Column(Float)
    r_rh = Column(Float)
    r_rv = Column(Float)
    r_avg = Column(Float)
    r_cyl = Column(Float)
    r_ax = Column(Integer)
    r_ecc = Column(Float)

class ContactLensExam(Base):
    __tablename__ = "contact_lens_exam"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    comb_va = Column(Float)
    l_bc = Column(Float)
    l_bc_2 = Column(Float)
    l_oz = Column(Float)
    l_diam = Column(Float)
    l_sph = Column(Float)
    l_cyl = Column(Float)
    l_ax = Column(Integer)
    l_read_ad = Column(Float)
    l_va = Column(Float)
    l_j = Column(Float)
    r_bc = Column(Float)
    r_bc_2 = Column(Float)
    r_oz = Column(Float)
    r_diam = Column(Float)
    r_sph = Column(Float)
    r_cyl = Column(Float)
    r_ax = Column(Integer)
    r_read_ad = Column(Float)
    r_va = Column(Float)
    r_j = Column(Float)

class OldContactLenses(Base):
    __tablename__ = "old_contact_lenses"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_lens_type = Column(String)
    l_lens_type = Column(String)
    r_model = Column(String)
    l_model = Column(String)
    r_supplier = Column(String)
    l_supplier = Column(String)
    l_bc = Column(Float)
    l_diam = Column(Float)
    l_sph = Column(Float)
    l_cyl = Column(Float)
    l_ax = Column(Float)
    l_va = Column(Float)
    l_j = Column(Float)
    r_bc = Column(Float)
    r_diam = Column(Float)
    r_sph = Column(Float)
    r_cyl = Column(Float)
    r_ax = Column(Float)
    r_va = Column(Float)
    r_j = Column(Float)
    comb_va = Column(Float)
    comb_j = Column(Float)

class OverRefraction(Base):
    __tablename__ = "over_refraction"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_sph = Column(Float)
    l_sph = Column(Float)
    r_cyl = Column(Float)
    l_cyl = Column(Float)
    r_ax = Column(Float)
    l_ax = Column(Float)
    r_va = Column(Float)
    l_va = Column(Float)
    r_j = Column(Float)
    l_j = Column(Float)
    comb_va = Column(Float)
    comb_j = Column(Float)
    l_add = Column(Float)
    r_add = Column(Float)
    l_florescent = Column(String)
    r_florescent = Column(String)
    l_bio_m = Column(String)
    r_bio_m = Column(String)

class SensationVisionStabilityExam(Base):
    __tablename__ = "sensation_vision_stability_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    r_sensation = Column(Text)
    l_sensation = Column(Text)
    r_vision = Column(Text)
    l_vision = Column(Text)
    r_stability = Column(Text)
    l_stability = Column(Text)
    r_movement = Column(Text)
    l_movement = Column(Text)
    r_recommendations = Column(Text)
    l_recommendations = Column(Text)

class DiopterAdjustmentPanel(Base):
    __tablename__ = "diopter_adjustment_panel"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    right_diopter = Column(Float)
    left_diopter = Column(Float)

class FusionRangeExam(Base):
    __tablename__ = "fusion_range_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    fv_base_in = Column(Float)
    fv_base_in_recovery = Column(Float)
    fv_base_out = Column(Float)
    fv_base_out_recovery = Column(Float)
    nv_base_in = Column(Float)
    nv_base_in_recovery = Column(Float)
    nv_base_out = Column(Float)
    nv_base_out_recovery = Column(Float)

class MaddoxRodExam(Base):
    __tablename__ = "maddox_rod_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    c_r_h = Column(Float)
    c_r_v = Column(Float)
    c_l_h = Column(Float)
    c_l_v = Column(Float)
    wc_r_h = Column(Float)
    wc_r_v = Column(Float)
    wc_l_h = Column(Float)
    wc_l_v = Column(Float)

class StereoTestExam(Base):
    __tablename__ = "stereo_test_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    fly_result = Column(Boolean)
    circle_score = Column(Integer)
    circle_max = Column(Integer)

class OcularMotorAssessmentExam(Base):
    __tablename__ = "ocular_motor_assessment_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    ocular_motility = Column(Text)
    acc_od = Column(Float)
    acc_os = Column(Float)
    npc_break = Column(Float)
    npc_recovery = Column(Float)

class RGExam(Base):
    __tablename__ = "rg_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_instance_id = Column(Integer, ForeignKey("exam_layout_instances.id"), nullable=False)
    rg_status = Column(String)
    suppressed_eye = Column(String)

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