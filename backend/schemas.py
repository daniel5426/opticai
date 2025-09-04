from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Date, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

# Base schemas
class CompanyBase(BaseModel):
    name: str
    owner_full_name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    logo_path: Optional[str] = None
    address: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(CompanyBase):
    name: Optional[str] = None
    owner_full_name: Optional[str] = None

class Company(CompanyBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ClinicBase(BaseModel):
    name: str
    location: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    clinic_position: Optional[str] = None
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    clinic_city: Optional[str] = None
    clinic_postal_code: Optional[str] = None
    clinic_directions: Optional[str] = None
    clinic_website: Optional[str] = None
    manager_name: Optional[str] = None
    license_number: Optional[str] = None
    unique_id: str
    is_active: bool = True

class ClinicCreate(ClinicBase):
    company_id: int

class ClinicUpdate(ClinicBase):
    name: Optional[str] = None
    unique_id: Optional[str] = None
    company_id: Optional[int] = None

class Clinic(ClinicBase):
    id: int
    company_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserBase(BaseModel):
    company_id: Optional[int] = None
    full_name: Optional[str] = None
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    is_active: bool = True
    profile_picture: Optional[str] = None
    primary_theme_color: Optional[str] = None
    secondary_theme_color: Optional[str] = None
    theme_preference: str = "system"
    google_account_connected: bool = False
    google_account_email: Optional[str] = None
    system_vacation_dates: Optional[List[str]] = None
    added_vacation_dates: Optional[List[str]] = None

class UserCreate(UserBase):
    password: Optional[str] = None
    clinic_id: Optional[int] = None

class UserUpdate(UserBase):
    username: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    clinic_id: Optional[int] = None
    company_id: Optional[int] = None

class User(UserBase):
    id: int
    clinic_id: Optional[int] = None
    password: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserPublic(UserBase):
    id: int
    clinic_id: Optional[int] = None
    has_password: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserSelectItem(BaseModel):
    id: int
    full_name: Optional[str] = None
    username: str
    role: str
    clinic_id: Optional[int] = None
    is_active: bool

class FamilyBase(BaseModel):
    name: str
    notes: Optional[str] = None

class FamilyCreate(FamilyBase):
    clinic_id: int

class FamilyUpdate(FamilyBase):
    name: Optional[str] = None
    clinic_id: Optional[int] = None

class Family(FamilyBase):
    id: int
    clinic_id: int
    created_date: date
    
    class Config:
        from_attributes = True

class ClientBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    national_id: Optional[str] = None
    date_of_birth: Optional[date] = None
    health_fund: Optional[str] = None
    address_city: Optional[str] = None
    address_street: Optional[str] = None
    address_number: Optional[str] = None
    postal_code: Optional[str] = None
    phone_home: Optional[str] = None
    phone_work: Optional[str] = None
    phone_mobile: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    service_center: Optional[str] = None
    file_creation_date: Optional[date] = None
    membership_end: Optional[date] = None
    service_end: Optional[date] = None
    price_list: Optional[str] = None
    discount_percent: Optional[int] = None
    blocked_checks: Optional[bool] = None
    blocked_credit: Optional[bool] = None
    sorting_group: Optional[str] = None
    referring_party: Optional[str] = None
    file_location: Optional[str] = None
    occupation: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    profile_picture: Optional[str] = None
    family_id: Optional[int] = None
    family_role: Optional[str] = None

class ClientCreate(ClientBase):
    clinic_id: int

class ClientUpdate(ClientBase):
    clinic_id: Optional[int] = None

class Client(ClientBase):
    id: int
    clinic_id: int
    ai_updated_date: Optional[datetime] = None
    client_updated_date: datetime
    ai_exam_state: Optional[str] = None
    ai_order_state: Optional[str] = None
    ai_referral_state: Optional[str] = None
    ai_contact_lens_state: Optional[str] = None
    ai_appointment_state: Optional[str] = None
    ai_file_state: Optional[str] = None
    ai_medical_state: Optional[str] = None
    
    class Config:
        from_attributes = True

class SettingsBase(BaseModel):
    clinic_logo_path: Optional[str] = None
    primary_theme_color: Optional[str] = None
    secondary_theme_color: Optional[str] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    appointment_duration: Optional[int] = None
    send_email_before_appointment: Optional[bool] = None
    email_days_before: Optional[int] = None
    email_time: Optional[str] = None
    working_days: Optional[str] = None
    break_start_time: Optional[str] = None
    break_end_time: Optional[str] = None
    max_appointments_per_day: Optional[int] = None
    email_provider: Optional[str] = None
    email_smtp_host: Optional[str] = None
    email_smtp_port: Optional[int] = None
    email_smtp_secure: Optional[bool] = None
    email_username: Optional[str] = None
    email_password: Optional[str] = None
    email_from_name: Optional[str] = None

class SettingsCreate(SettingsBase):
    clinic_id: int

class SettingsUpdate(SettingsBase):
    clinic_id: Optional[int] = None

class Settings(SettingsBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Unified save request/response
class SaveAllRequest(BaseModel):
    clinic_id: Optional[int] = None
    clinic: Optional[ClinicUpdate] = None
    settings_id: Optional[int] = None
    settings: Optional[SettingsUpdate] = None
    user_id: Optional[int] = None
    user: Optional[UserUpdate] = None
    company_id: Optional[int] = None
    company: Optional[CompanyUpdate] = None

class SaveAllResponse(BaseModel):
    clinic: Optional[Clinic] = None
    settings: Optional[Settings] = None
    user: Optional[User] = None
    company: Optional[Company] = None

# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserLoginNoPassword(BaseModel):
    username: str

# Appointment schemas
class AppointmentBase(BaseModel):
    client_id: int
    clinic_id: Optional[int] = None
    user_id: Optional[int] = None
    date: Optional[datetime] = None
    time: Optional[str] = None
    duration: Optional[int] = 30
    exam_name: Optional[str] = None
    note: Optional[str] = None
    google_calendar_event_id: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(AppointmentBase):
    client_id: Optional[int] = None

class Appointment(AppointmentBase):
    id: int
    client_full_name: Optional[str] = None
    examiner_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Medical Log schemas
class MedicalLogBase(BaseModel):
    client_id: int
    clinic_id: Optional[int] = None
    user_id: Optional[int] = None
    log_date: Optional[date] = None
    log: Optional[str] = None

class MedicalLogCreate(MedicalLogBase):
    pass

class MedicalLogUpdate(MedicalLogBase):
    client_id: Optional[int] = None

class MedicalLog(MedicalLogBase):
    id: int
    
    class Config:
        from_attributes = True

# Order schemas
class OrderBase(BaseModel):
    client_id: int
    clinic_id: Optional[int] = None
    order_date: Optional[date] = None
    type: Optional[str] = None
    dominant_eye: Optional[str] = None
    user_id: Optional[int] = None
    lens_id: Optional[int] = None
    frame_id: Optional[int] = None
    order_data: Optional[Dict[str, Any]] = {}

class OrderCreate(OrderBase):
    pass

class OrderUpdate(OrderBase):
    client_id: Optional[int] = None

class Order(OrderBase):
    id: int
    
    class Config:
        from_attributes = True

class ContactLensOrderBase(BaseModel):
    client_id: int
    clinic_id: Optional[int] = None
    user_id: Optional[int] = None
    order_date: Optional[date] = None
    type: Optional[str] = None

    l_lens_type: Optional[str] = None
    l_model: Optional[str] = None
    l_supplier: Optional[str] = None
    l_material: Optional[str] = None
    l_color: Optional[str] = None
    l_quantity: Optional[int] = None
    l_order_quantity: Optional[int] = None
    l_dx: Optional[bool] = None

    r_lens_type: Optional[str] = None
    r_model: Optional[str] = None
    r_supplier: Optional[str] = None
    r_material: Optional[str] = None
    r_color: Optional[str] = None
    r_quantity: Optional[int] = None
    r_order_quantity: Optional[int] = None
    r_dx: Optional[bool] = None

    supply_in_clinic_id: Optional[int] = None
    order_status: Optional[str] = None
    advisor: Optional[str] = None
    deliverer: Optional[str] = None
    delivery_date: Optional[date] = None
    priority: Optional[str] = None
    guaranteed_date: Optional[date] = None
    approval_date: Optional[date] = None
    cleaning_solution: Optional[str] = None
    disinfection_solution: Optional[str] = None
    rinsing_solution: Optional[str] = None
    notes: Optional[str] = None
    supplier_notes: Optional[str] = None

    order_data: Optional[Dict[str, Any]] = {}

class ContactLensOrderCreate(ContactLensOrderBase):
    pass

class ContactLensOrderUpdate(ContactLensOrderBase):
    client_id: Optional[int] = None

class ContactLensOrder(ContactLensOrderBase):
    id: int
    class Config:
        from_attributes = True

# Referral schemas
class ReferralBase(BaseModel):
    client_id: int
    clinic_id: Optional[int] = None
    user_id: Optional[int] = None
    referral_notes: str
    prescription_notes: Optional[str] = None
    date: Optional[date]
    type: Optional[str] = None
    urgency_level: Optional[str] = None
    recipient: Optional[str] = None
    referral_data: Optional[Dict[str, Any]] = {}

class ReferralCreate(ReferralBase):
    pass

class ReferralUpdate(ReferralBase):
    client_id: Optional[int] = None
    referral_notes: Optional[str] = None

class Referral(ReferralBase):
    id: int
    
    class Config:
        from_attributes = True

# File schemas
class FileBase(BaseModel):
    client_id: int
    clinic_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    uploaded_by: Optional[int] = None
    notes: Optional[str] = None

class FileCreate(FileBase):
    pass

class FileUpdate(FileBase):
    client_id: Optional[int] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None

class File(FileBase):
    id: int
    upload_date: datetime
    
    class Config:
        from_attributes = True

# Work Shift schemas
class WorkShiftBase(BaseModel):
    user_id: int
    start_time: str
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    date: str
    status: str = "active"

class WorkShiftCreate(WorkShiftBase):
    pass

class WorkShiftUpdate(WorkShiftBase):
    user_id: Optional[int] = None
    start_time: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None

class WorkShift(WorkShiftBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Campaign schemas
class CampaignBase(BaseModel):
    clinic_id: Optional[int] = None
    name: str
    filters: Optional[str] = None
    email_enabled: bool = False
    email_content: Optional[str] = None
    sms_enabled: bool = False
    sms_content: Optional[str] = None
    active: bool = False
    active_since: Optional[datetime] = None
    mail_sent: bool = False
    sms_sent: bool = False
    emails_sent_count: int = 0
    sms_sent_count: int = 0
    cycle_type: str = "daily"
    cycle_custom_days: Optional[int] = None
    last_executed: Optional[datetime] = None
    execute_once_per_client: bool = False

class CampaignCreate(CampaignBase):
    pass

class CampaignUpdate(CampaignBase):
    clinic_id: Optional[int] = None
    name: Optional[str] = None

class Campaign(CampaignBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Contact Lens schemas
class ContactLensBase(BaseModel):
    client_id: int
    exam_date: Optional[date] = None
    type: Optional[str] = None
    user_id: Optional[int] = None
    comb_va: Optional[float] = None
    pupil_diameter: Optional[float] = None
    corneal_diameter: Optional[float] = None
    eyelid_aperture: Optional[float] = None
    notes: Optional[str] = None
    notes_for_supplier: Optional[str] = None

class ContactLensCreate(ContactLensBase):
    pass

class ContactLensUpdate(ContactLensBase):
    client_id: Optional[int] = None

class ContactLens(ContactLensBase):
    id: int
    
    class Config:
        from_attributes = True

# Billing schemas
class OrderLineItemBase(BaseModel):
    billings_id: int
    sku: Optional[str] = None
    description: Optional[str] = None
    supplied_by: Optional[str] = None
    supplied: Optional[bool] = None
    price: Optional[float] = None
    quantity: Optional[float] = None
    discount: Optional[float] = None
    line_total: Optional[float] = None

class OrderLineItemCreate(OrderLineItemBase):
    pass

class OrderLineItemUpdate(BaseModel):
    billings_id: Optional[int] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    supplied_by: Optional[str] = None
    supplied: Optional[bool] = None
    price: Optional[float] = None
    quantity: Optional[float] = None
    discount: Optional[float] = None
    line_total: Optional[float] = None

class OrderLineItem(OrderLineItemBase):
    id: int
    
    class Config:
        from_attributes = True

class BillingBase(BaseModel):
    order_id: Optional[int] = None
    contact_lens_id: Optional[int] = None
    total_before_discount: Optional[float] = None
    discount_amount: Optional[float] = None
    discount_percent: Optional[float] = None
    total_after_discount: Optional[float] = None
    prepayment_amount: Optional[float] = None
    installment_count: Optional[int] = None
    notes: Optional[str] = None

class BillingCreate(BillingBase):
    line_items: Optional[List[OrderLineItemCreate]] = None

class BillingUpdate(BillingBase):
    line_items: Optional[List[OrderLineItemUpdate]] = None

class Billing(BillingBase):
    id: int
    
    class Config:
        from_attributes = True

# Chat schemas
class ChatBase(BaseModel):
    clinic_id: Optional[int] = None
    title: str

class ChatCreate(ChatBase):
    pass

class ChatUpdate(ChatBase):
    title: Optional[str] = None

class Chat(ChatBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Email Log schemas
class EmailLogBase(BaseModel):
    appointment_id: int
    email_address: str
    success: bool
    error_message: Optional[str] = None

class EmailLogCreate(EmailLogBase):
    pass

class EmailLogUpdate(EmailLogBase):
    appointment_id: Optional[int] = None
    email_address: Optional[str] = None
    success: Optional[bool] = None

class EmailLog(EmailLogBase):
    id: int
    sent_at: datetime
    
    class Config:
        from_attributes = True

# Optical Exam schemas
class OpticalExamBase(BaseModel):
    client_id: int
    clinic_id: Optional[int] = None
    user_id: Optional[int] = None
    exam_date: Optional[date] = None
    type: Optional[str] = None
    dominant_eye: Optional[str] = None
    test_name: Optional[str] = None

class OpticalExamCreate(OpticalExamBase):
    pass

class OpticalExamUpdate(OpticalExamBase):
    client_id: Optional[int] = None

class OpticalExam(OpticalExamBase):
    id: int
    
    class Config:
        from_attributes = True

# Exam Layout schemas
class ExamLayoutBase(BaseModel):
    clinic_id: Optional[int] = None
    name: str
    layout_data: str
    is_default: bool = False

class ExamLayoutCreate(ExamLayoutBase):
    pass

class ExamLayoutUpdate(ExamLayoutBase):
    name: Optional[str] = None
    layout_data: Optional[str] = None

class ExamLayout(ExamLayoutBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ExamDataBase(BaseModel):
    layout_instance_id: int
    exam_data: Dict[str, Any] = {}

class ExamDataCreate(ExamDataBase):
    pass

class ExamDataUpdate(ExamDataBase):
    layout_instance_id: Optional[int] = None
    exam_data: Optional[Dict[str, Any]] = None

class ExamData(ExamDataBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True 