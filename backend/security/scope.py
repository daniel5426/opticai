from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import (
    Appointment,
    Billing,
    Client,
    Clinic,
    ContactLensOrder,
    Order,
    OrderLineItem,
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


def normalize_clinic_id_for_company(
    db: Session,
    current_user: User,
    clinic_id: Optional[int],
) -> int:
    company_id = require_company_id(current_user)
    if clinic_id is None:
        if current_user.clinic_id is None:
            raise HTTPException(status_code=400, detail="clinic_id is required")
        clinic_id = current_user.clinic_id
    assert_clinic_belongs_to_company(db, clinic_id, company_id)
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


def get_scoped_client(db: Session, current_user: User, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    assert_clinic_scope(db, current_user, client.clinic_id)
    return client


def get_scoped_user(db: Session, current_user: User, user_id: int) -> User:
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if (current_user.role_level or 1) >= CEO_LEVEL:
        if target.company_id == resolve_company_id(db, current_user):
            return target
        if target.clinic_id:
            assert_clinic_belongs_to_company(db, target.clinic_id, resolve_company_id(db, current_user))
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
