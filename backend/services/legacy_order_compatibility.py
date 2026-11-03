"""Translate v1.0.79 writes into the same locked transactions as the new workspace.

The old editor spreads billing response fields back into its full save. A signed
revision receipt therefore provides concurrency checks without updating that app.
Delta payments and explicit item deletions do not replace a stale invoice snapshot.
Raw ORM writes remain protected by order_group_service's flush guard.
"""
from copy import deepcopy
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from jose import jwt, JWTError

from config import settings
from models import Billing, ContactLensOrder, OrderGroupEntry, OrderLineItem, TrashItem
from services.order_group_service import (
    billing_for_order, check_revision, get_group, group_for_order, group_write,
    row_dict, save_group,
)


def receipt(group, user):
    return jwt.encode({"token_type": "legacy_order_revision", "group_id": group.id,
                       "revision": group.revision, "user_id": user.id,
                       "exp": datetime.now(timezone.utc) + timedelta(days=30)},
                      settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def order_response(db, user, order):
    group = group_for_order(db, order.id, isinstance(order, ContactLensOrder))
    if group and group.legacy_write_protected:
        group = get_group(db, user, group.id, lock=True)
        db.refresh(order)
    order.compatibility_token = receipt(group, user) if group and group.legacy_write_protected else None
    return order


def billing_response(db, user, billing):
    from models import OrderGroup
    group = db.get(OrderGroup, billing.order_group_id) if billing.order_group_id else None
    if group and group.legacy_write_protected:
        # The row and receipt must describe the same committed revision, even
        # when a writer commits between the authorization read and this response.
        group = get_group(db, user, group.id, lock=True)
        db.refresh(billing)
    billing.compatibility_token = receipt(group, user) if group and group.legacy_write_protected else None
    return billing


def billing_responses(db, user, rows):
    # Match the lock order used by company-wide merge/delete transactions while
    # retaining the legacy endpoint's response order.
    for billing in sorted(rows, key=lambda row: (row.order_group_id or 0, row.id)):
        billing_response(db, user, billing)
    return rows


def _locked(db, user, group):
    if not group or db.info.get("order_group_write"):
        return None
    if (user.role_level or 1) < 2:
        raise HTTPException(403, "Editing permission is required")
    group = get_group(db, user, group.id, lock=True)
    return group if group.legacy_write_protected else None


def _check_receipts(group, user, *payloads, required=False):
    tokens = [data.get("compatibility_token") for data in payloads if isinstance(data, dict) and data.get("compatibility_token")]
    if required and not tokens:
        check_revision(group, None)
    for token in tokens:
        try:
            data = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if data.get("token_type") != "legacy_order_revision" or data.get("group_id") != group.id or data.get("user_id") != user.id:
                raise ValueError("Invalid revision receipt")
        except (JWTError, ValueError, TypeError):
            check_revision(group, None)
        check_revision(group, data.get("revision"))


def merge_json(previous, incoming):
    """Legacy editors cannot express fields introduced after their release."""
    if isinstance(previous, dict) and isinstance(incoming, dict):
        return {**deepcopy(previous), **{key: merge_json(previous.get(key), value) for key, value in incoming.items()}}
    return deepcopy(incoming)


def _lines(db, billing, incoming, *, replace):
    existing = {line.id: row_dict(line) for line in db.query(OrderLineItem).populate_existing().filter_by(billings_id=billing.id)} if billing else {}
    result = []
    seen = set()
    for patch in incoming:
        if not isinstance(patch, dict):
            raise HTTPException(422, "Invalid or duplicate billing item")
        key = patch.get("id")
        if key and (key not in existing or key in seen):
            raise HTTPException(422, "Invalid or duplicate billing item")
        seen.add(key)
        # Provenance belongs to the workspace, not the legacy billing form.
        patch = {k: v for k, v in patch.items() if k not in {"source_entry_id", "source_slot", "manually_edited", "billings_id"}}
        line = {**existing.get(key, {}), **patch}
        if not key or any(existing[key].get(k) != v for k, v in patch.items() if k not in {"id", "currency", "compatibility_token"}):
            line["manually_edited"] = True
        result.append(line)
    if not replace:
        result.extend(line for key, line in existing.items() if key not in seen)
    return result


def _billing_payload(db, group, data, items=None, *, replace=False):
    billing = db.query(Billing).populate_existing().filter_by(order_group_id=group.id).first()
    if data.get("id") not in (None, billing.id if billing else None):
        raise HTTPException(422, "Billing does not belong to this group")
    # The shared invoice must never be re-anchored to a tab or another group.
    for anchor in ("order_id", "contact_lens_id"):
        if data.get(anchor):
            column = OrderGroupEntry.order_id if anchor == "order_id" else OrderGroupEntry.contact_lens_id
            if not db.query(OrderGroupEntry.id).filter(column == data[anchor], OrderGroupEntry.group_id == group.id).first():
                raise HTTPException(422, "Billing does not belong to this group")
    current = row_dict(billing) if billing else {}
    changed = {key: value for key, value in data.items() if key not in {"order_id", "contact_lens_id", "order_group_id", "compatibility_token", "line_items"}}
    if items is not None:
        lines = _lines(db, billing, items, replace=replace)
    else:
        lines = [row_dict(line) for line in db.query(OrderLineItem).populate_existing().filter_by(billings_id=billing.id)] if billing else []
    return {"billing": {**current, **changed}, "line_items": lines}


def update_order(db, user, order, fields, *, billing_data=None, line_items=None):
    group = _locked(db, user, group_for_order(db, order.id, isinstance(order, ContactLensOrder)))
    if not group:
        return None
    # v1.0.79's regular-order editor merges local order fields over the save
    # response, retaining its previous order receipt. Its billing merge retains
    # the fresh response receipt. That invoice receipt guards the entire group
    # revision for full saves; order-only writes still use the order receipt.
    if isinstance(billing_data, dict):
        _check_receipts(group, user, billing_data, required=True)
    else:
        _check_receipts(group, user, fields)
    db.refresh(order)
    for identity in ("id", "client_id", "clinic_id", "company_id"):
        if identity in fields and fields[identity] != getattr(order, identity):
            raise HTTPException(422, "Order identity cannot change")
    entry = db.query(OrderGroupEntry).filter_by(group_id=group.id).filter(
        (OrderGroupEntry.contact_lens_id == order.id) if isinstance(order, ContactLensOrder) else (OrderGroupEntry.order_id == order.id)).one()
    data = {**row_dict(order), **fields}
    if "order_data" in fields:
        data["order_data"] = merge_json(order.order_data, fields["order_data"])
    payload = {"revision": group.revision, "entries": [{"id": entry.id,
               "kind": "contact" if isinstance(order, ContactLensOrder) else "regular", "order": data}]}
    if isinstance(billing_data, dict):
        payload.update(_billing_payload(db, group, billing_data, line_items, replace=True))
    save_group(db, user, payload, group_id=group.id, partial_entries=True)
    billing = billing_for_order(db, order.id, isinstance(order, ContactLensOrder))
    return {"order": order_response(db, user, order),
            "billing": billing_response(db, user, billing) if billing else None,
            "line_items": db.query(OrderLineItem).filter_by(billings_id=billing.id).all() if billing else [],
            "inventory_allocations": []}


def delete_order(db, user, order):
    group = _locked(db, user, group_for_order(db, order.id, isinstance(order, ContactLensOrder)))
    if not group:
        return None
    column = OrderGroupEntry.contact_lens_id if isinstance(order, ContactLensOrder) else OrderGroupEntry.order_id
    entry = db.query(OrderGroupEntry).filter(column == order.id, OrderGroupEntry.group_id == group.id).one()
    save_group(db, user, {"revision": group.revision, "removed_entry_ids": [entry.id]}, group_id=group.id)
    return db.get(TrashItem, order.trash_item_id)


def update_billing(db, user, billing, fields, items=None):
    from models import OrderGroup
    group = _locked(db, user, db.get(OrderGroup, billing.order_group_id) if billing.order_group_id else None)
    if not group:
        return None
    _check_receipts(group, user, fields, required=True)
    payload = {"revision": group.revision, **_billing_payload(db, group, fields, items, replace=False)}
    save_group(db, user, payload, group_id=group.id)
    return billing_response(db, user, billing)


def change_line(db, user, billing, fields=None, *, item=None, delete=False):
    from models import OrderGroup
    group = _locked(db, user, db.get(OrderGroup, billing.order_group_id) if billing.order_group_id else None)
    if not group:
        return None
    db.refresh(billing)
    if item:
        item = db.query(OrderLineItem).populate_existing().filter_by(id=item.id).first()
        if item is None:
            raise HTTPException(404, "Order line item not found")
    fields = fields or {}
    if fields.get("billings_id", billing.id) != billing.id:
        raise HTTPException(422, "Billing does not belong to this group")
    existing = list(db.query(OrderLineItem).populate_existing().filter_by(billings_id=billing.id))
    lines = [row_dict(line) for line in existing if not (delete and line.id == item.id)]
    if not delete:
        if item:
            lines = _lines(db, billing, [{**fields, "id": item.id}], replace=False)
        else:
            lines.append({**fields, "manually_edited": True})
    before = {line.id for line in existing}
    save_group(db, user, {"revision": group.revision, "billing": row_dict(billing), "line_items": lines}, group_id=group.id)
    if delete:
        return {"message": "Order line item deleted successfully"}
    return db.get(OrderLineItem, item.id) if item else db.query(OrderLineItem).filter(
        OrderLineItem.billings_id == billing.id, OrderLineItem.id.notin_(before)).one()


def payment_write(db, user, billing):
    """Lock before reading the balance; native group routes already hold this lock."""
    from models import OrderGroup
    group = _locked(db, user, db.get(OrderGroup, billing.order_group_id) if billing.order_group_id else None)
    if group:
        db.refresh(billing)
    return group


def change_payment(db, user, billing, *, payment=None, payment_id=None):
    group = payment_write(db, user, billing)
    if not group:
        return None
    from EndPoints.billing import create_billing_payment, delete_billing_payment
    with group_write(db):
        group.revision += 1
        if payment_id is not None:
            return delete_billing_payment(billing.id, payment_id, db, user)
        return create_billing_payment(billing.id, payment, db, user)
