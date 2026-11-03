"""Application-side ownership checks for all writers; Alembic owns schema state."""
from fastapi import HTTPException
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session


def install_ownership_validation():
    if not event.contains(Session, "before_flush", validate_ownership):
        event.listen(Session, "before_flush", validate_ownership)


def validate_ownership(db, flush_context, instances):
    validate_records(db, list(db.new) + list(db.dirty))


def validate_records(db, rows):
    from models import (Appointment, Client, Clinic, ContactLensOrder, Family, File,
                        MedicalLog, OpticalExam, Order, OrderGroup, Referral, User, Billing, BillingPayment,
                        OrderGroupEntry, OrderLineItem, ExamLayoutInstance, ExamLayout, ReferralEye)
    from agent.models import FollowupTask
    roots = (Client, Family, Appointment, ContactLensOrder, File, MedicalLog, OpticalExam, Order, OrderGroup, Referral, FollowupTask)
    rows = list(rows)
    cache = {}
    def load(model, key):
        if not key:
            return None
        identity = (model, key)
        if identity not in cache:
            cache[identity] = db.query(model).execution_options(include_deleted=True).filter(model.id == key).first()
        return cache[identity]
    # Bulk imports bypass ORM events. Batch their reference reads rather than
    # performing remote round trips for every imported record.
    with db.no_autoflush:
        if len(rows) > 50:
            references = ((Clinic, ('clinic_id',)), (Client, ('client_id', 'payer_client_id', 'merged_into_client_id')),
                (Family, ('family_id',)), (User, ('user_id', 'assigned_user_id', 'created_by_user_id', 'uploaded_by')),
                (OpticalExam, ('exam_id',)), (ExamLayout, ('layout_id',)), (Order, ('order_id',)),
                (ContactLensOrder, ('contact_lens_id',)), (OrderGroup, ('group_id', 'order_group_id')),
                (OrderGroupEntry, ('source_entry_id',)), (Billing, ('billing_id', 'billings_id')))
            for model, fields in references:
                ids = {getattr(row, field, None) for row in rows for field in fields} - {None}
                if ids:
                    for key in ids:
                        cache[model, key] = None
                    for parent in db.query(model).execution_options(include_deleted=True).filter(model.id.in_(ids)).all():
                        cache[model, parent.id] = parent
        for row in rows:
            if not isinstance(row, roots):
                def scope(parent):
                    if parent is None:
                        raise HTTPException(422, "companyClients.invalidParent")
                    clinic = db.get(Clinic, parent.clinic_id) if parent.clinic_id else None
                    return (parent.company_id or (clinic.company_id if clinic else None), parent.clinic_id)
                def billing_scope(billing):
                    if billing is None:
                        raise HTTPException(422, "companyClients.invalidBilling")
                    parents = [parent for parent in (
                        billing.order_group or load(OrderGroup, billing.order_group_id),
                        load(Order, billing.order_id), load(ContactLensOrder, billing.contact_lens_id)) if parent is not None]
                    scopes = {scope(parent) for parent in parents}
                    if len(scopes) != 1:
                        raise HTTPException(403, "companyClients.billingCompany")
                    return next(iter(scopes))
                if isinstance(row, OrderGroupEntry):
                    group = row.group or load(OrderGroup, row.group_id)
                    order = load(Order, row.order_id) if row.order_id else load(ContactLensOrder, row.contact_lens_id)
                    if scope(group) != scope(order):
                        raise HTTPException(403, "companyClients.groupClinic")
                elif isinstance(row, Billing):
                    billing_scope(row)
                elif isinstance(row, (BillingPayment, OrderLineItem)):
                    billing = load(Billing, row.billing_id if isinstance(row, BillingPayment) else row.billings_id)
                    owner = billing_scope(billing)
                    if isinstance(row, OrderLineItem) and row.source_entry_id:
                        entry = load(OrderGroupEntry, row.source_entry_id)
                        if not entry or entry.group_id != billing.order_group_id:
                            raise HTTPException(409 if inspect(row).persistent else 403, "companyClients.lineSource")
                elif isinstance(row, ExamLayoutInstance):
                    exam = load(OpticalExam, row.exam_id)
                    if not exam:
                        raise HTTPException(422, "companyClients.invalidExam")
                    if row.layout_id:
                        layout = load(ExamLayout, row.layout_id)
                        clinic = db.get(Clinic, layout.clinic_id) if layout and layout.clinic_id else None
                        if not layout or clinic and clinic.company_id != scope(exam)[0]:
                            raise HTTPException(403, "companyClients.layoutCompany")
                elif isinstance(row, ReferralEye) and not load(Referral, row.referral_id):
                    raise HTTPException(422, "companyClients.invalidReferral")
                continue
            state = inspect(row)
            if state.persistent:
                for key in ("company_id", "clinic_id"):
                    if state.attrs[key].history.has_changes():
                        raise HTTPException(422, "companyClients.ownershipImmutable")
                references = ('client_id', 'payer_client_id', 'family_id', 'user_id', 'assigned_user_id', 'created_by_user_id', 'uploaded_by', 'merged_into_client_id')
                if not any(key in state.attrs and state.attrs[key].history.has_changes() for key in references):
                    continue
            clinic = load(Clinic, row.clinic_id)
            client_id = getattr(row, 'client_id', None) or getattr(row, 'payer_client_id', None)
            client = load(Client, client_id)
            company_id = row.company_id or (clinic.company_id if clinic else None) or (client.company_id if client else None)
            if company_id is None:
                raise HTTPException(422, "companyClients.companyRequired")
            if clinic and clinic.company_id != company_id or client and client.company_id != company_id:
                raise HTTPException(403, "companyClients.sameCompany")
            if row.clinic_id and not clinic or client_id and not client:
                raise HTTPException(422, "companyClients.invalidReference")
            row.company_id = company_id
            merged_id = getattr(row, 'merged_into_client_id', None)
            if merged_id:
                target = load(Client, merged_id)
                if not target or target.company_id != company_id:
                    raise HTTPException(403, "companyClients.sameCompany")
            family_id = getattr(row, 'family_id', None)
            if family_id:
                family = load(Family, family_id)
                if not family or family.company_id != company_id:
                    raise HTTPException(403, "companyClients.familyCompany")
            for key in ('user_id', 'assigned_user_id', 'created_by_user_id', 'uploaded_by'):
                user_id = getattr(row, key, None)
                if user_id:
                    user = load(User, user_id)
                    user_clinic = db.get(Clinic, user.clinic_id) if user and user.company_id is None and user.clinic_id else None
                    if not user or (user.company_id or (user_clinic.company_id if user_clinic else None)) != company_id:
                        raise HTTPException(403, "companyClients.staffCompany")
