"""Order-group transactions. Billing is owned by the group, never by a tab."""
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from contextlib import contextmanager
from fastapi import HTTPException
from sqlalchemy import event, inspect, or_
from sqlalchemy.orm import Session
from models import Billing, BillingPayment, Client, Order, ContactLensOrder, OrderGroup, OrderGroupEntry, OrderLineItem
from security.scope import assert_clinic_scope, get_scoped_client, resolve_company_id
from currency import normalize_currency


def order_groups_available(db):
    """Check rollout readiness without creating or changing database schema."""
    if "order_groups_available" not in db.info:
        inspector = inspect(db.connection())
        required = {
            "order_groups": {"id", "clinic_id", "payer_client_id", "revision"},
            "order_group_entries": {"group_id", "order_id", "contact_lens_id"},
            "billings": {"order_group_id"},
            "order_line_item": {"source_entry_id", "source_slot", "manually_edited"},
            "contact_lens_orders": {"dominant_eye"},
        }
        db.info["order_groups_available"] = all(
            inspector.has_table(table) and columns.issubset({column["name"] for column in inspector.get_columns(table)})
            for table, columns in required.items())
    return db.info["order_groups_available"]


def entry_order(db, entry, include_deleted=False):
    model = Order if entry.order_id else ContactLensOrder
    query = db.query(model)
    if include_deleted:
        query = query.execution_options(include_deleted=True)
    return query.filter(model.id == (entry.order_id or entry.contact_lens_id)).first()


def group_for_order(db, order_id, contact=False, include_deleted=False):
    column = OrderGroupEntry.contact_lens_id if contact else OrderGroupEntry.order_id
    query = db.query(OrderGroup).join(OrderGroupEntry).filter(column == order_id)
    if include_deleted:
        query = query.execution_options(include_deleted=True)
    return query.first()


def billing_for_order(db, order_id, contact=False):
    group = group_for_order(db, order_id, contact)
    if group:
        billing = db.query(Billing).filter(Billing.order_group_id == group.id).first()
        if billing:
            return billing
    column = Billing.contact_lens_id if contact else Billing.order_id
    return db.query(Billing).filter(column == order_id).first()


def ensure_standalone_group(db, order, contact=False):
    db.flush()
    if any(isinstance(row, OrderGroupEntry) for row in db.new):
        db.flush()
    group = group_for_order(db, order.id, contact, include_deleted=True)
    if not group:
        group = OrderGroup(clinic_id=order.clinic_id, payer_client_id=order.client_id, opened_date=order.order_date,
                           deleted_at=order.deleted_at, deleted_by_user_id=order.deleted_by_user_id, trash_item_id=order.trash_item_id)
        db.add(group)
        db.flush()
        entry = OrderGroupEntry(group_id=group.id, position=0, **({"contact_lens_id": order.id} if contact else {"order_id": order.id}))
        db.add(entry)
        db.flush()
    billing = billing_for_order(db, order.id, contact)
    if billing and billing.order_group_id is None:
        billing.order_group_id = group.id
    return group


@contextmanager
def group_write(db):
    previous = db.info.get("order_group_write", False)
    db.info["order_group_write"] = True
    try:
        yield
    finally:
        db.info["order_group_write"] = previous


def protect_group(db, group):
    group.legacy_write_protected = True
    billing = db.query(Billing).filter(Billing.order_group_id == group.id).first()
    if billing:
        # The old anchors cascade on physical deletion. A shared invoice must not.
        billing.order_id = None
        billing.contact_lens_id = None


def get_group(db, user, group_id, lock=False):
    query = db.query(OrderGroup).filter(OrderGroup.id == group_id)
    if lock:
        query = query.populate_existing().with_for_update()
    group = query.first()
    if not group:
        raise HTTPException(404, "Order group not found")
    assert_clinic_scope(db, user, group.clinic_id)
    return group


def check_revision(group, revision):
    if revision != group.revision:
        raise HTTPException(409, {"code": "order_group_conflict", "message": "Order group changed. Reload before saving.", "revision": group.revision})


def row_dict(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def group_dict(db, group):
    entries = db.query(OrderGroupEntry).filter(OrderGroupEntry.group_id == group.id).order_by(OrderGroupEntry.position, OrderGroupEntry.id).all()
    items = []
    clients = {}
    for entry in entries:
        order = entry_order(db, entry)
        if not order:
            continue
        client = db.query(Client).filter(Client.id == order.client_id).first()
        if client:
            clients[client.id] = {key: getattr(client, key) for key in ("id", "first_name", "last_name", "clinic_id")}
        items.append({"id": entry.id, "position": entry.position, "kind": "regular" if entry.order_id else "contact", "order": row_dict(order)})
    payer = db.query(Client).filter(Client.id == group.payer_client_id).first()
    if payer:
        clients[payer.id] = {key: getattr(payer, key) for key in ("id", "first_name", "last_name", "clinic_id")}
    billing = db.query(Billing).filter(Billing.order_group_id == group.id).first()
    return {**row_dict(group), "entries": items, "clients": list(clients.values()), "billing": row_dict(billing) if billing else None,
            "line_items": [row_dict(row) for row in db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing.id).order_by(OrderLineItem.id).all()] if billing else []}


def validate_client(db, user, client_id, clinic_id):
    client = get_scoped_client(db, user, client_id)
    if client.clinic_id != clinic_id:
        raise HTTPException(422, "All clients must belong to the group's clinic")
    return client


def save_group(db, user, payload, group_id=None, creation_key=None, *, commit=True):
    if (user.role_level or 1) < 2:
        raise HTTPException(403, "Editing permission is required")
    from EndPoints.orders import _prepare_model_payload, _prepare_update_payload, _default_currency_for_clinic
    from services.inventory_service import reconcile_order_allocations
    from services.prescription_search_index import rebuild_order_index, rebuild_contact_lens_order_index
    from services.trash_service import move_to_trash
    if group_id is None:
        if not creation_key or len(creation_key) > 64:
            raise HTTPException(422, "A creation idempotency key is required")
        existing = db.query(OrderGroup).filter(OrderGroup.creation_key == creation_key).first()
        if existing:
            assert_clinic_scope(db, user, existing.clinic_id)
            return group_dict(db, existing)
        clinic_id = payload.get("clinic_id")
        assert_clinic_scope(db, user, clinic_id)
        payer_id = payload.get("payer_client_id")
        validate_client(db, user, payer_id, clinic_id)
        group = OrderGroup(clinic_id=clinic_id, payer_client_id=payer_id, creation_key=creation_key, opened_date=date.today())
        db.add(group)
        db.flush()
    else:
        group = get_group(db, user, group_id, lock=True)
        check_revision(group, payload.get("revision"))
    with group_write(db):
        payer_id = payload.get("payer_client_id", group.payer_client_id)
        validate_client(db, user, payer_id, group.clinic_id)
        if payer_id != group.payer_client_id:
            protect_group(db, group)
        group.payer_client_id = payer_id
        entries = {entry.id: entry for entry in db.query(OrderGroupEntry).filter(OrderGroupEntry.group_id == group.id).all()}
        removed = set(payload.get("removed_entry_ids", []))
        if not removed.issubset(entries):
            raise HTTPException(422, "Removed entry does not belong to this group")
        client_keys = {}
        seen = set()
        for index, incoming in enumerate(payload.get("entries", [])):
            kind = incoming.get("kind")
            if kind not in {"regular", "contact"}:
                raise HTTPException(422, "Unknown order kind")
            model = Order if kind == "regular" else ContactLensOrder
            data = incoming.get("order", {})
            validate_client(db, user, data.get("client_id"), group.clinic_id)
            entry_id = incoming.get("id")
            if entry_id:
                if entry_id in seen or entry_id not in entries or entry_id in removed:
                    raise HTTPException(422, "Invalid or duplicate group entry")
                seen.add(entry_id)
                entry = entries[entry_id]
                if (entry.order_id is not None) != (kind == "regular"):
                    raise HTTPException(422, "An order's kind cannot change")
                order = entry_order(db, entry)
                if not order:
                    raise HTTPException(409, "Order was removed")
                if data.get("id") not in (None, order.id) or data.get("client_id") != order.client_id:
                    raise HTTPException(422, "Order identity cannot change")
                updates = _prepare_update_payload(db, user, order, model, data)
                for key, value in updates.items():
                    if key not in {"id", "clinic_id", "client_id", "deleted_at", "deleted_by_user_id", "trash_item_id"}:
                        setattr(order, key, value)
            else:
                if data.get("id"):
                    raise HTTPException(422, "Existing orders cannot be attached through creation")
                data = {**data, "clinic_id": group.clinic_id}
                data = {key: value for key, value in data.items() if key not in {"deleted_at", "deleted_by_user_id", "trash_item_id"}}
                order = model(**_prepare_model_payload(db, user, model, data))
                db.add(order)
                db.flush()
                entry = OrderGroupEntry(group_id=group.id, position=index, **({"order_id": order.id} if kind == "regular" else {"contact_lens_id": order.id}))
                db.add(entry)
                db.flush()
            entry.position = index
            if incoming.get("client_key"):
                if incoming["client_key"] in client_keys:
                    raise HTTPException(422, "Duplicate draft key")
                client_keys[incoming["client_key"]] = entry.id
            reconcile_order_allocations(db, order=order, current_user=user, company_id=resolve_company_id(db, user),
                                        selections_present="inventory_selections" in incoming,
                                        selections=incoming.get("inventory_selections"), contact=kind == "contact")
            (rebuild_order_index if kind == "regular" else rebuild_contact_lens_order_index)(db, order)
            client = db.query(Client).filter(Client.id == order.client_id).first()
            client.client_updated_date = datetime.now(timezone.utc)
        if removed:
            protect_group(db, group)
        for entry_id in removed:
            entry = entries[entry_id]
            order = entry_order(db, entry)
            if order:
                move_to_trash(db, user, "order" if entry.order_id else "contact_lens_order", order.id, commit=False)
            # Preserve the association for trash restoration; remove only provenance.
            db.query(OrderLineItem).filter(OrderLineItem.source_entry_id == entry.id).update({"source_entry_id": None, "source_slot": None, "manually_edited": True}, synchronize_session=False)
        live_entries = [entry for entry in db.query(OrderGroupEntry).filter(OrderGroupEntry.group_id == group.id).all() if entry_order(db, entry)]
        if len(live_entries) > 1:
            protect_group(db, group)
        billing = db.query(Billing).filter(Billing.order_group_id == group.id).first()
        billing_data = payload.get("billing")
        if billing_data is not None:
            if not isinstance(billing_data, dict):
                raise HTTPException(422, "Invalid billing")
            if billing_data.get("id") not in (None, billing.id if billing else None):
                raise HTTPException(422, "Billing does not belong to this group")
            currency = normalize_currency(billing_data.get("currency"), default=None) or (billing.currency if billing else _default_currency_for_clinic(db, group.clinic_id))
            if billing and currency != billing.currency:
                raise HTTPException(409, "Billing currency is immutable")
            if "line_items" not in payload:
                raise HTTPException(422, "A complete billing item list is required when saving billing")
            new_billing = not billing
            prior_discount = (billing.discount_amount, billing.discount_percent) if billing else (None, None)
            if not billing:
                billing = Billing(order_group_id=group.id, currency=currency)
                db.add(billing)
                db.flush()
            for field in ("discount_amount", "discount_percent", "installment_count", "notes"):
                if field in billing_data:
                    setattr(billing, field, billing_data[field])
            existing_lines = {row.id: row for row in db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing.id).all()}
            sent_ids = set()
            financial_changed = new_billing or prior_discount != (billing.discount_amount, billing.discount_percent)
            total = Decimal("0")
            for item in payload.get("line_items", []):
                item_id = item.get("id")
                if item_id and item_id > 0:
                    if item_id not in existing_lines or item_id in sent_ids:
                        raise HTTPException(422, "Invalid or duplicate billing item")
                    line = existing_lines[item_id]
                    sent_ids.add(item_id)
                    if any(item.get(field, getattr(line, field)) != getattr(line, field) for field in ("price", "quantity", "discount")):
                        financial_changed = True
                else:
                    financial_changed = True
                    line = OrderLineItem(billings_id=billing.id, currency=currency)
                    db.add(line)
                source = client_keys.get(item.get("source_client_key"), item.get("source_entry_id"))
                if source in removed:
                    source = None
                if source:
                    source_entry = db.query(OrderGroupEntry).filter(OrderGroupEntry.id == source, OrderGroupEntry.group_id == group.id).first()
                    if not source_entry or not entry_order(db, source_entry):
                        raise HTTPException(422, "Invalid suggestion source")
                for field in ("sku", "description", "supplied_by", "supplied", "price", "quantity", "discount", "source_slot", "manually_edited"):
                    if field in item:
                        setattr(line, field, item[field])
                line.source_entry_id = source
                if not source and (item.get("source_entry_id") or item.get("source_client_key")):
                    line.source_slot = None
                    line.manually_edited = True
                if item.get("currency") and normalize_currency(item["currency"], default=None) != currency:
                    raise HTTPException(422, "Cannot mix billing currencies")
                line.currency = currency
                price, quantity, discount = (Decimal(str(getattr(line, key) or 0)) for key in ("price", "quantity", "discount"))
                if not all(value.is_finite() for value in (price, quantity, discount)) or min(price, quantity, discount) < 0:
                    raise HTTPException(422, "Invalid billing amounts")
                amount = max(Decimal("0"), price * quantity - discount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                line.line_total = float(amount)
                total += amount
            for item_id, line in existing_lines.items():
                if item_id not in sent_ids:
                    financial_changed = True
                    db.delete(line)
            if financial_changed:
                billing.total_before_discount = float(total)
            discount = Decimal(str(billing.discount_amount or 0)) if billing.discount_amount else total * Decimal(str(billing.discount_percent or 0)) / 100
            if not discount.is_finite() or discount < 0:
                raise HTTPException(422, "Invalid billing discount")
            if financial_changed:
                billing.total_after_discount = float(max(Decimal("0"), total - discount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            if "prepayment_amount" in billing_data:
                paid = Decimal(str(billing_data.get("prepayment_amount") or 0))
                if not paid.is_finite() or paid < 0:
                    raise HTTPException(422, "Invalid paid amount")
                delta = paid - Decimal(str(billing.prepayment_amount or 0))
                if delta:
                    db.add(BillingPayment(billing_id=billing.id, amount=float(delta), kind="adjustment", paid_at=date.today(), currency=currency))
                    billing.prepayment_amount = float(paid)
            if not group.legacy_write_protected and len(live_entries) == 1:
                billing.order_id = live_entries[0].order_id
                billing.contact_lens_id = live_entries[0].contact_lens_id
        if group_id:
            group.revision += 1
        if commit:
            db.commit()
        else:
            db.flush()
    result = group_dict(db, group)
    result["client_keys"] = client_keys
    return result


@event.listens_for(Session, "before_flush")
def protect_legacy_writes(db, _context, _instances):
    """Covers legacy ORM write paths, including component saves and trash."""
    if db.info.get("order_group_write"):
        return
    for row in list(db.new) + list(db.dirty) + list(db.deleted):
        group = None
        if isinstance(row, (Order, ContactLensOrder)) and row.id:
            group = group_for_order(db, row.id, isinstance(row, ContactLensOrder), include_deleted=True)
        elif isinstance(row, Billing):
            group = db.get(OrderGroup, row.order_group_id) if row.order_group_id else None
            if not group:
                group = group_for_order(db, row.order_id or row.contact_lens_id, bool(row.contact_lens_id)) if row.order_id or row.contact_lens_id else None
        elif isinstance(row, (BillingPayment, OrderLineItem)):
            billing = db.get(Billing, row.billing_id if isinstance(row, BillingPayment) else row.billings_id)
            group = db.get(OrderGroup, billing.order_group_id) if billing and billing.order_group_id else None
        elif isinstance(row, Client) and (row in db.deleted or inspect(row).attrs.deleted_at.history.added and row.deleted_at is not None):
            group = db.query(OrderGroup).join(OrderGroupEntry).outerjoin(Order, OrderGroupEntry.order_id == Order.id).outerjoin(ContactLensOrder, OrderGroupEntry.contact_lens_id == ContactLensOrder.id).filter(
                OrderGroup.legacy_write_protected.is_(True), or_(Order.client_id == row.id, ContactLensOrder.client_id == row.id, OrderGroup.payer_client_id == row.id)).first()
        # A legacy update must not evade protection by changing the foreign key
        # before this flush (for example moving a shared item to another invoice).
        original_groups = []
        if isinstance(row, Billing):
            for old_id in inspect(row).attrs.order_group_id.history.deleted:
                if old_id:
                    original_groups.append(db.get(OrderGroup, old_id))
        elif isinstance(row, (BillingPayment, OrderLineItem)):
            attribute = "billing_id" if isinstance(row, BillingPayment) else "billings_id"
            for old_id in inspect(row).attrs[attribute].history.deleted:
                old_billing = db.get(Billing, old_id) if old_id else None
                if old_billing and old_billing.order_group_id:
                    original_groups.append(db.get(OrderGroup, old_billing.order_group_id))
        if any(original and original.legacy_write_protected for original in original_groups):
            raise HTTPException(409, {"code": "order_group_requires_update", "message": "Use an updated application to modify this order group."})
        if group and group.legacy_write_protected:
            raise HTTPException(409, {"code": "order_group_requires_update", "message": "Use an updated application to modify this order group."})
        if group and not group.legacy_write_protected and isinstance(row, (Order, ContactLensOrder)) and inspect(row).attrs.deleted_at.history.has_changes():
            group.deleted_at = row.deleted_at
            group.deleted_by_user_id = row.deleted_by_user_id
            group.trash_item_id = row.trash_item_id
        if group and isinstance(row, (Order, ContactLensOrder, Billing, BillingPayment, OrderLineItem)) and db.is_modified(row, include_collections=False):
            group.revision = (group.revision or 1) + 1


@event.listens_for(Session, "before_flush")
def collect_legacy_creations(db, _context, _instances):
    if db.info.get("order_group_write"):
        return
    # Also covers migration/import services that create ORM records outside HTTP routes.
    db.info.setdefault("new_legacy_orders", []).extend(row for row in db.new if isinstance(row, (Order, ContactLensOrder)))
    for billing in list(db.new):
        if isinstance(billing, Billing) and billing.order_group_id is None and not billing.order_group and (billing.order_id or billing.contact_lens_id):
            group = group_for_order(db, billing.order_id or billing.contact_lens_id, bool(billing.contact_lens_id), include_deleted=True)
            if group:
                billing.order_group = group


@event.listens_for(Session, "after_flush_postexec")
def link_legacy_creations(db, _context):
    for order in db.info.pop("new_legacy_orders", []):
        if not order.id or group_for_order(db, order.id, isinstance(order, ContactLensOrder), include_deleted=True):
            continue
        group = OrderGroup(clinic_id=order.clinic_id, payer_client_id=order.client_id, opened_date=order.order_date,
                           deleted_at=order.deleted_at, deleted_by_user_id=order.deleted_by_user_id, trash_item_id=order.trash_item_id)
        db.add(OrderGroupEntry(group=group, position=0, **({"contact_lens_id": order.id} if isinstance(order, ContactLensOrder) else {"order_id": order.id})))
