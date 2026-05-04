from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import (
    Appointment,
    Billing,
    Campaign,
    Chat,
    Client,
    Clinic,
    ContactLensOrder,
    Family,
    File,
    MedicalLog,
    Order,
    OrderLineItem,
    Referral,
    Settings,
    User,
)


MANAGER_LEVEL = 3
CEO_LEVEL = 4


def require_company_id(current_user: User) -> int:
    if current_user.company_id is None:
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user.company_id


def assert_company_scope(current_user: User, company_id: int) -> None:
    if company_id != require_company_id(current_user):
        raise HTTPException(status_code=403, detail="Access denied")


def assert_clinic_belongs_to_company(db: Session, clinic_id: int, company_id: int) -> None:
    row = (
        db.query(Clinic.id)
        .filter(Clinic.id == clinic_id)
        .filter(Clinic.company_id == company_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=403, detail="Access denied")


def get_user_company_id(db: Session, user: User) -> int:
    if user.company_id is not None:
        return user.company_id
    if user.clinic_id is None:
        raise HTTPException(status_code=403, detail="Access denied")
    clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=403, detail="Access denied")
    return clinic.company_id


def assert_company_access(db: Session, current_user: User, company_id: int) -> None:
    if company_id != get_user_company_id(db, current_user):
        raise HTTPException(status_code=403, detail="Access denied")


def require_company_admin(db: Session, current_user: User, company_id: int) -> None:
    assert_company_access(db, current_user, company_id)
    if (current_user.role_level or 1) < CEO_LEVEL:
        raise HTTPException(status_code=403, detail="Access denied")


def list_company_clinic_ids(db: Session, company_id: int) -> list[int]:
    rows = db.query(Clinic.id).filter(Clinic.company_id == company_id).all()
    return [r[0] for r in rows]


def user_belongs_to_company(db: Session, user: User, company_id: int) -> bool:
    if user.company_id == company_id:
        return True
    if user.clinic_id is None:
        return False
    row = (
        db.query(Clinic.id)
        .filter(Clinic.id == user.clinic_id)
        .filter(Clinic.company_id == company_id)
        .first()
    )
    return bool(row)


def normalize_clinic_id_for_company(
    db: Session,
    current_user: User,
    clinic_id: Optional[int],
) -> int:
    if clinic_id is None:
        if current_user.clinic_id is None:
            raise HTTPException(status_code=400, detail="clinic_id is required")
        clinic_id = current_user.clinic_id
    assert_clinic_scope(db, current_user, clinic_id)
    return clinic_id


def resolve_company_id(db: Session, current_user: User) -> int:
    return get_user_company_id(db, current_user)


def assert_clinic_scope(db: Session, current_user: User, clinic_id: Optional[int]) -> None:
    if clinic_id is None:
        raise HTTPException(status_code=403, detail="Access denied")
    company_id = resolve_company_id(db, current_user)
    assert_clinic_belongs_to_company(db, clinic_id, company_id)
    if (current_user.role_level or 1) < CEO_LEVEL and current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")


def get_allowed_clinic_ids(db: Session, current_user: User, clinic_id: Optional[int] = None) -> list[int]:
    company_id = resolve_company_id(db, current_user)
    if clinic_id is not None:
        assert_clinic_belongs_to_company(db, clinic_id, company_id)
        if (current_user.role_level or 1) < CEO_LEVEL and current_user.clinic_id != clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
        return [clinic_id]
    if (current_user.role_level or 1) >= CEO_LEVEL:
        return list_company_clinic_ids(db, company_id)
    if current_user.clinic_id is None:
        raise HTTPException(status_code=403, detail="Access denied")
    return [current_user.clinic_id]


def normalize_user_id(db: Session, current_user: User, user_id: Optional[int]) -> int:
    if user_id is None or user_id <= 0:
        return current_user.id
    return get_assignable_user(db, current_user, user_id).id


def get_assignable_user(db: Session, current_user: User, user_id: int) -> User:
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    company_id = resolve_company_id(db, current_user)
    if not user_belongs_to_company(db, target, company_id):
        raise HTTPException(status_code=403, detail="Access denied")

    if (current_user.role_level or 1) >= CEO_LEVEL:
        return target

    if (target.role_level or 1) >= CEO_LEVEL:
        return target

    if target.clinic_id is None:
        return target

    if current_user.clinic_id is not None and target.clinic_id == current_user.clinic_id:
        return target

    raise HTTPException(status_code=403, detail="Access denied")


def get_visible_user(db: Session, current_user: User, user_id: int) -> User:
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    company_id = resolve_company_id(db, current_user)
    if not user_belongs_to_company(db, target, company_id):
        raise HTTPException(status_code=403, detail="Access denied")

    if (current_user.role_level or 1) >= CEO_LEVEL:
        return target

    if target.id == current_user.id:
        return target

    if (target.role_level or 1) >= CEO_LEVEL:
        return target

    if current_user.clinic_id is not None and target.clinic_id == current_user.clinic_id:
        return target

    raise HTTPException(status_code=403, detail="Access denied")


def normalize_client_id(db: Session, current_user: User, client_id: int, clinic_id: Optional[int] = None) -> int:
    client = get_scoped_client(db, current_user, client_id)
    if clinic_id is not None and client.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Client does not belong to clinic")
    return client.id


def apply_clinic_user_scope(
    db: Session,
    current_user: User,
    data: dict,
    *,
    require_clinic: bool = True,
    validate_client: bool = True,
    validate_user: bool = True,
) -> dict:
    scoped = dict(data)
    scoped.pop("company_id", None)

    if require_clinic or scoped.get("clinic_id") is not None:
        scoped["clinic_id"] = normalize_clinic_id_for_company(db, current_user, scoped.get("clinic_id"))

    if validate_client and scoped.get("client_id") is not None:
        scoped["client_id"] = normalize_client_id(db, current_user, scoped["client_id"], scoped.get("clinic_id"))

    if validate_user and "user_id" in scoped:
        scoped["user_id"] = normalize_user_id(db, current_user, scoped.get("user_id"))

    return scoped


def get_scoped_client(db: Session, current_user: User, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    assert_clinic_scope(db, current_user, client.clinic_id)
    return client


def get_scoped_family(db: Session, current_user: User, family_id: int) -> Family:
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    assert_clinic_scope(db, current_user, family.clinic_id)
    return family


def get_scoped_medical_log(db: Session, current_user: User, medical_log_id: int) -> MedicalLog:
    medical_log = db.query(MedicalLog).filter(MedicalLog.id == medical_log_id).first()
    if not medical_log:
        raise HTTPException(status_code=404, detail="Medical log not found")
    assert_clinic_scope(db, current_user, medical_log.clinic_id)
    return medical_log


def get_scoped_referral(db: Session, current_user: User, referral_id: int) -> Referral:
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    assert_clinic_scope(db, current_user, referral.clinic_id)
    return referral


def get_scoped_settings(db: Session, current_user: User, settings_id: int) -> Settings:
    settings = db.query(Settings).filter(Settings.id == settings_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    assert_clinic_scope(db, current_user, settings.clinic_id)
    return settings


def get_scoped_campaign(db: Session, current_user: User, campaign_id: int) -> Campaign:
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    assert_clinic_scope(db, current_user, campaign.clinic_id)
    return campaign


def get_scoped_chat(db: Session, current_user: User, chat_id: int) -> Chat:
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    assert_clinic_scope(db, current_user, chat.clinic_id)
    return chat


def get_scoped_file(db: Session, current_user: User, file_id: int) -> File:
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    assert_clinic_scope(db, current_user, file.clinic_id)
    return file


def get_scoped_user(db: Session, current_user: User, user_id: int) -> User:
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    company_id = resolve_company_id(db, current_user)
    if not user_belongs_to_company(db, target, company_id):
        raise HTTPException(status_code=403, detail="Access denied")
    if (current_user.role_level or 1) >= CEO_LEVEL:
        return target
    elif (current_user.role_level or 1) >= MANAGER_LEVEL:
        if target.id == current_user.id or (target.clinic_id and target.clinic_id == current_user.clinic_id):
            return target
    elif target.id == current_user.id:
        return target
    raise HTTPException(status_code=403, detail="Access denied")


def get_scoped_order(db: Session, current_user: User, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    assert_clinic_scope(db, current_user, order.clinic_id)
    return order


def get_scoped_contact_lens_order(db: Session, current_user: User, order_id: int) -> ContactLensOrder:
    order = db.query(ContactLensOrder).filter(ContactLensOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Contact lens order not found")
    assert_clinic_scope(db, current_user, order.clinic_id)
    return order


def get_scoped_appointment(db: Session, current_user: User, appointment_id: int) -> Appointment:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    assert_clinic_scope(db, current_user, appointment.clinic_id)
    return appointment


def get_scoped_billing(db: Session, current_user: User, billing_id: int) -> Billing:
    billing = db.query(Billing).filter(Billing.id == billing_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    assert_billing_scope(db, current_user, billing)
    return billing


def assert_billing_scope(db: Session, current_user: User, billing: Billing) -> None:
    if billing.order_id:
        order = db.query(Order).filter(Order.id == billing.order_id).first()
        if order:
            assert_clinic_scope(db, current_user, order.clinic_id)
            return
    if billing.contact_lens_id:
        order = db.query(ContactLensOrder).filter(ContactLensOrder.id == billing.contact_lens_id).first()
        if order:
            assert_clinic_scope(db, current_user, order.clinic_id)
            return
    raise HTTPException(status_code=403, detail="Access denied")


def get_scoped_order_line_item(db: Session, current_user: User, item_id: int) -> OrderLineItem:
    item = db.query(OrderLineItem).filter(OrderLineItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order line item not found")
    get_scoped_billing(db, current_user, item.billings_id)
    return item
