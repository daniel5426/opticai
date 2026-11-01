from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import or_, exists, false, select, literal, union_all, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from auth import get_current_user
from models import User, OrderGroup, OrderGroupEntry, Order, ContactLensOrder, Billing, Client
from security.scope import get_allowed_clinic_ids, get_scoped_order, get_scoped_contact_lens_order, get_scoped_client
from services.order_group_service import get_group, group_dict, group_dicts, save_group, group_for_order, ensure_standalone_group, check_revision, group_write, row_dict, order_groups_available
from schemas import BillingPaymentCreate, OrderGroupSave
from utils.column_filters import ColumnFilter, build_column_filter_conditions, parse_column_filters
from utils.table_search import spaced_concat

router = APIRouter(prefix="/order-groups", tags=["order-groups"])


@router.get("/capabilities")
def capabilities(db: Session = Depends(get_db)):
    available = order_groups_available(db)
    return {"available": available, "workspace_enabled": available, "creation_enabled": available}


@router.get("/resolve/{kind}/{order_id}")
def resolve_group(kind: str, order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if kind not in {"regular", "contact"}:
        raise HTTPException(422, "Unknown order kind")
    order = (get_scoped_order if kind == "regular" else get_scoped_contact_lens_order)(db, user, order_id)
    group = group_for_order(db, order_id, kind == "contact")
    # Imported records created outside the API can be opened without mutating a GET.
    if not group:
        return {"legacy_order": True, "kind": kind, "order": {column.name: getattr(order, column.name) for column in order.__table__.columns}}
    return group_dict(db, group)



def _option_values(column_filters: dict, key: str) -> list[str]:
    value = column_filters.get(key)
    values = [value] if isinstance(value, str) else value or []
    if not isinstance(values, list) or not all(isinstance(item, str) for item in values):
        raise HTTPException(400, f"Invalid column filters: '{key}' expects a list of options")
    return [item for item in values if item]

@router.get("")
def list_groups(client_id: int | None = None, clinic_id: int | None = None, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0), q: str | None = None, kind: str | None = None, status: str | None = None, order: str = "date_desc",
                db: Session = Depends(get_db), user: User = Depends(get_current_user),
                filters: str | None = None):  # JSON column filters: date|clients|kinds|status|payer
    allowed = get_allowed_clinic_ids(db, user, clinic_id)
    if kind not in (None, "all", "regular", "contact"):
        raise HTTPException(422, "Unknown order kind")
    # Toolbar selects and column filters narrow the same sets; both must match.
    kinds = {kind} if kind in ("regular", "contact") else {"regular", "contact"}
    statuses = {status} if status and status != "all" else None
    column_filters = parse_column_filters(filters)
    filter_kinds = set(_option_values(column_filters, "kinds"))
    if filter_kinds:
        kinds &= filter_kinds
    filter_statuses = set(_option_values(column_filters, "status"))
    if filter_statuses:
        statuses = filter_statuses if statuses is None else statuses & filter_statuses
    name_filter = lambda key: build_column_filter_conditions(
        filters, {key: ColumnFilter(spaced_concat(Client.first_name, Client.last_name))})
    client_names, payer_names = name_filter("clients"), name_filter("payer")
    named_clients = db.query(Client.id).filter(*client_names) if client_names else None
    named_payers = db.query(Client.id).filter(*payer_names) if payer_names else None
    query = db.query(OrderGroup).filter(OrderGroup.clinic_id.in_(allowed))
    if client_id:
        get_scoped_client(db, user, client_id)
        matches = exists().where(OrderGroupEntry.group_id == OrderGroup.id).where(or_(
            OrderGroupEntry.order_id.in_(db.query(Order.id).filter(Order.client_id == client_id, Order.deleted_at.is_(None))),
            OrderGroupEntry.contact_lens_id.in_(db.query(ContactLensOrder.id).filter(ContactLensOrder.client_id == client_id, ContactLensOrder.deleted_at.is_(None)))))
        query = query.filter(or_(OrderGroup.payer_client_id == client_id, matches))
    if q:
        matched_clients = db.query(Client.id).filter(or_(Client.first_name.ilike(f"%{q}%"), Client.last_name.ilike(f"%{q}%")))
        matched_entries = db.query(OrderGroupEntry.group_id).outerjoin(Order, OrderGroupEntry.order_id == Order.id).outerjoin(ContactLensOrder, OrderGroupEntry.contact_lens_id == ContactLensOrder.id).filter(or_(Order.client_id.in_(matched_clients), ContactLensOrder.client_id.in_(matched_clients), Order.type.ilike(f"%{q}%"), ContactLensOrder.type.ilike(f"%{q}%")))
        query = query.filter(or_(OrderGroup.payer_client_id.in_(matched_clients), OrderGroup.id.in_(matched_entries)))
    if named_clients is not None:
        named_entries = db.query(OrderGroupEntry.group_id).outerjoin(Order, OrderGroupEntry.order_id == Order.id).outerjoin(ContactLensOrder, OrderGroupEntry.contact_lens_id == ContactLensOrder.id).filter(or_(Order.client_id.in_(named_clients), ContactLensOrder.client_id.in_(named_clients)))
        query = query.filter(OrderGroup.id.in_(named_entries))
    if named_payers is not None:
        query = query.filter(OrderGroup.payer_client_id.in_(named_payers))
    query = query.filter(*build_column_filter_conditions(filters, {"date": ColumnFilter(OrderGroup.opened_date, "date")}))
    if kinds != {"regular", "contact"} or statuses is not None:
        regular = db.query(OrderGroupEntry.group_id).join(Order, OrderGroupEntry.order_id == Order.id)
        contact = db.query(OrderGroupEntry.group_id).join(ContactLensOrder, OrderGroupEntry.contact_lens_id == ContactLensOrder.id)
        if statuses is not None:
            regular = regular.filter(Order.order_data["details"]["order_status"].as_string().in_(statuses))
            contact = contact.filter(ContactLensOrder.order_status.in_(statuses))
        choices = []
        if "regular" in kinds: choices.append(OrderGroup.id.in_(regular))
        if "contact" in kinds: choices.append(OrderGroup.id.in_(contact))
        query = query.filter(or_(*choices) if choices else false())
    # Imports and older installations may contain orders without group entries.
    # Include them in the same SQL page; reading history must not write records.
    candidates = [query.with_entities(OrderGroup.id.label("id"), OrderGroup.opened_date.label("opened_date"), literal("group").label("kind")).statement]
    for model, entry_column, order_kind in ((Order, OrderGroupEntry.order_id, "regular"), (ContactLensOrder, OrderGroupEntry.contact_lens_id, "contact")):
        if order_kind not in kinds:
            continue
        legacy = select(model.id.label("id"), model.order_date.label("opened_date"), literal(order_kind).label("kind")).where(
            model.clinic_id.in_(allowed), model.deleted_at.is_(None),
            ~exists().where(entry_column == model.id))
        if client_id:
            legacy = legacy.where(model.client_id == client_id)
        if q:
            legacy = legacy.where(or_(model.client_id.in_(matched_clients), model.type.ilike(f"%{q}%")))
        if statuses is not None:
            legacy = legacy.where((model.order_data["details"]["order_status"].as_string() if order_kind == "regular" else model.order_status).in_(statuses))
        # A standalone order's client is both its participant and its payer.
        for named in (named_clients, named_payers):
            if named is not None:
                legacy = legacy.where(model.client_id.in_(named))
        legacy = legacy.where(*build_column_filter_conditions(filters, {"date": ColumnFilter(model.order_date, "date")}))
        candidates.append(legacy)
    combined = union_all(*candidates).subquery()
    total = db.execute(select(func.count()).select_from(combined)).scalar_one()
    dates = combined.c.opened_date.asc() if order == "date_asc" else combined.c.opened_date.desc()
    page = db.execute(select(combined).order_by(dates.nulls_last(), combined.c.kind, combined.c.id.desc()).offset(offset).limit(limit)).all()
    # Load everything the page needs in a few batched queries rather than several per row.
    ids_of = lambda kind: [row.id for row in page if row.kind == kind]
    groups = {group.id: group for group in db.query(OrderGroup).filter(OrderGroup.id.in_(ids_of("group"))).all()} if ids_of("group") else {}
    group_items = dict(zip(groups, group_dicts(db, list(groups.values()))))
    records = {kind: {record.id: record for record in db.query(model).filter(model.id.in_(ids_of(kind))).all()} if ids_of(kind) else {}
               for kind, model in (("regular", Order), ("contact", ContactLensOrder))}
    client_ids = {record.client_id for kind_records in records.values() for record in kind_records.values()}
    clients = {client.id: client for client in db.query(Client).filter(Client.id.in_(client_ids)).all()} if client_ids else {}
    billings = {}
    for kind, anchor in (("regular", Billing.order_id), ("contact", Billing.contact_lens_id)):
        if ids_of(kind):
            for billing in db.query(Billing).filter(anchor.in_(ids_of(kind))).order_by(Billing.id).all():
                billings.setdefault((kind, getattr(billing, anchor.key)), billing)
    items = []
    for row in page:
        if row.kind == "group":
            items.append(group_items[row.id])
            continue
        record = records[row.kind][row.id]
        client = clients.get(record.client_id)
        billing = billings.get((row.kind, row.id))
        items.append({"id": row.id, "clinic_id": record.clinic_id, "payer_client_id": record.client_id,
                      "opened_date": record.order_date, "revision": 1,
                      "legacy_order": {"kind": row.kind, "id": row.id},
                      "entries": [{"kind": row.kind, "position": 0, "order": row_dict(record)}],
                      "clients": [{key: getattr(client, key) for key in ("id", "first_name", "last_name", "clinic_id")}] if client else [],
                      "billing": row_dict(billing) if billing else None, "line_items": []})
    return {"items": items, "total": total}


@router.post("/resolve/{kind}/{order_id}")
def link_imported_order(kind: str, order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if kind not in {"regular", "contact"}:
        raise HTTPException(422, "Unknown order kind")
    order = (get_scoped_order if kind == "regular" else get_scoped_contact_lens_order)(db, user, order_id)
    group = ensure_standalone_group(db, order, kind == "contact")
    db.commit()
    return group_dict(db, group)


@router.delete("/client/{client_id}")
def delete_group_client(client_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from services.trash_service import move_to_trash
    from services.order_group_service import protect_group
    client = get_scoped_client(db, user, client_id)
    groups = db.query(OrderGroup).outerjoin(OrderGroupEntry).outerjoin(Order, OrderGroupEntry.order_id == Order.id).outerjoin(ContactLensOrder, OrderGroupEntry.contact_lens_id == ContactLensOrder.id).filter(
        or_(Order.client_id == client.id, ContactLensOrder.client_id == client.id, OrderGroup.payer_client_id == client.id)).distinct().all()
    with group_write(db):
        for group in groups:
            protect_group(db, group)
            group.revision += 1
        item = move_to_trash(db, user, "client", client.id)
    return {"message": "Client moved to Trash", "trash_item_id": item.id, "expires_at": item.expires_at, "side_effects": "backend"}


@router.post("/restore/{trash_id}")
def restore_group_records(trash_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from services.trash_service import _scoped_item, restore_item
    from models import TrashMember
    item = _scoped_item(db, user, trash_id, lock=True)
    members = db.query(TrashMember).filter(TrashMember.trash_item_id == item.id).all()
    group_ids = set()
    for member in members:
        if member.entity_type == "order_group":
            group_ids.add(member.entity_id)
        elif member.entity_type in {"order", "contact_lens_order"}:
            column = OrderGroupEntry.order_id if member.entity_type == "order" else OrderGroupEntry.contact_lens_id
            group_ids.update(row[0] for row in db.query(OrderGroupEntry.group_id).filter(column == member.entity_id).all())
    with group_write(db):
        for group in db.query(OrderGroup).execution_options(include_deleted=True).filter(OrderGroup.id.in_(group_ids)).with_for_update().all():
            group.revision += 1
        return restore_item(db, user, trash_id)


@router.get("/{group_id}")
def read_group(group_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return group_dict(db, get_group(db, user, group_id))


@router.post("")
def create_group(payload: OrderGroupSave, idempotency_key: str = Header(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    payload = payload.model_dump(exclude_unset=True) if isinstance(payload, OrderGroupSave) else payload
    try:
        return save_group(db, user, payload, creation_key=idempotency_key)
    except IntegrityError:
        db.rollback()
        existing = db.query(OrderGroup).filter(OrderGroup.creation_key == idempotency_key).first()
        if existing:
            return group_dict(db, get_group(db, user, existing.id))
        raise
    except Exception:
        db.rollback()
        raise


@router.put("/{group_id}")
def update_group(group_id: int, payload: OrderGroupSave, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    payload = payload.model_dump(exclude_unset=True) if isinstance(payload, OrderGroupSave) else payload
    try:
        return save_group(db, user, payload, group_id=group_id)
    except Exception:
        db.rollback()
        raise


@router.delete("/{group_id}/entries/{entry_id}")
def remove_entry(group_id: int, entry_id: int, revision: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return save_group(db, user, {"revision": revision, "removed_entry_ids": [entry_id]}, group_id=group_id)


@router.delete("/{group_id}")
def remove_group(group_id: int, revision: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from services.trash_service import move_to_trash
    group = get_group(db, user, group_id, lock=True)
    check_revision(group, revision)
    with group_write(db):
        item = move_to_trash(db, user, "order_group", group.id)
    return {"trash_item_id": item.id}


@router.get("/{group_id}/payments")
def payments(group_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from EndPoints.billing import get_billing_payments
    get_group(db, user, group_id)
    billing = db.query(Billing).filter(Billing.order_group_id == group_id).first()
    return get_billing_payments(billing.id, db, user) if billing else []


@router.post("/{group_id}/payments")
def add_payment(group_id: int, payment: BillingPaymentCreate, revision: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from EndPoints.billing import create_billing_payment
    if (user.role_level or 1) < 2:
        raise HTTPException(403, "Editing permission is required")
    group = get_group(db, user, group_id, lock=True)
    check_revision(group, revision)
    billing = db.query(Billing).filter(Billing.order_group_id == group.id).first()
    if not billing:
        raise HTTPException(409, "Save billing before adding a payment")
    with group_write(db):
        group.revision += 1
        result = create_billing_payment(billing.id, payment, db, user)
    return {"payment": result, "group": group_dict(db, group)}


@router.delete("/{group_id}/payments/{payment_id}")
def remove_payment(group_id: int, payment_id: int, revision: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from EndPoints.billing import delete_billing_payment
    if (user.role_level or 1) < 2:
        raise HTTPException(403, "Editing permission is required")
    group = get_group(db, user, group_id, lock=True)
    check_revision(group, revision)
    billing = db.query(Billing).filter(Billing.order_group_id == group.id).first()
    if not billing:
        raise HTTPException(404, "Billing not found")
    with group_write(db):
        group.revision += 1
        delete_billing_payment(billing.id, payment_id, db, user)
    return group_dict(db, group)
