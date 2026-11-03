"""Move legacy custom values into visible standard cards without losing edits."""
from copy import deepcopy
import json

_MISSING = object()
_METADATA = {"id", "layout_instance_id", "source_layout_instance_id", "card_instance_id",
             "source_card_type", "source_table", "source_key", "bindings"}


def relocate_clinical_fields(baseline, current, incoming, current_layout, baseline_layout):
    old, live, new = deepcopy(baseline), deepcopy(current), deepcopy(incoming)
    moved, conflicts, retired = [], [], set()
    old_items = json.loads(baseline_layout or "{}").get("items", [])
    live_items = json.loads(current_layout or "{}").get("items", [])
    removed_ids = {i.get("id") for i in old_items} - {i.get("id") for i in live_items}

    def equivalent_key(data, key, block):
        alias = f"{block.get('source_card_type') or key}-{block.get('card_instance_id')}"
        return alias if alias in data else key

    def coerce(value, template):
        if value is _MISSING or value is None:
            return None
        if isinstance(template, (int, float)) and not isinstance(template, bool):
            from .mapping import number
            parsed = number(value, minimum=-1e12, maximum=1e12)
            if parsed is None:
                raise ValueError("Edited source text is not a native numeric value")
            return parsed
        return value

    for destination, block in list(new.items()):
        source = block.get("opticplus_source") if isinstance(block, dict) else None
        if not source:
            continue
        for field, target_field in list(source.get("fields", {}).items()):
            # A bound fallback intentionally displays an otherwise hidden native
            # value; it must remain, rather than becoming a second editable copy.
            fallbacks = [v for v in new.values() if isinstance(v, dict) and v.get("source_table") == source["table"] and
                         str(v.get("source_key")) == source["key"] and field in v]
            if any(field not in v.get("bindings", {}) for v in fallbacks):
                continue
            keep_display = bool(fallbacks)
            candidates = [(k, v) for k, v in old.items() if isinstance(v, dict) and
                v.get("source_table") == source["table"] and str(v.get("source_key")) == source["key"] and field in v]
            if not candidates:
                continue
            key, previous = candidates[0]
            if keep_display and field in previous.get("bindings", {}):
                continue
            live_key = equivalent_key(live, key, previous)
            value = live.get(live_key, {}).get(field, _MISSING)
            dest_key = equivalent_key(live, destination, block)
            dest_live = live.get(dest_key, {})
            dest_old = old.get(dest_key, old.get(destination, {}))
            before = previous[field]
            try:
                desired = coerce(value, block.get(target_field))
                old_value = coerce(before, block.get(target_field))
            except ValueError:
                conflicts.append({"field": field, "reason": "edited_value_not_representable"})
                block.pop(target_field, None)
                source["fields"].pop(field, None)
                continue
            if previous.get("card_instance_id") in removed_ids:
                # Respect deletion of the old card instead of resurrecting its
                # values through a newly introduced standard card.
                block.pop(target_field, None)
                source["fields"].pop(field, None)
                conflicts.append({"field": field, "reason": "source_card_removed"})
                continue
            if (target_field in dest_live and dest_live.get(target_field) != dest_old.get(target_field) and
                    dest_live.get(target_field) != desired):
                conflicts.append({"field": field, "reason": "destination_edited"})
                continue
            if value is _MISSING or value != before:
                # Seed the new destination with the user's edit and its original
                # baseline. The normal three-way merge then keeps owning that edit.
                live.setdefault(destination, deepcopy(dest_live))[target_field] = desired
                old.setdefault(destination, deepcopy(dest_old))[target_field] = old_value
                if dest_key != destination:
                    live[dest_key][target_field] = desired
                    old.setdefault(dest_key, deepcopy(dest_old))[target_field] = old_value
            moved.append({"source_card": key, "field": field, "destination": destination,
                          "target_field": target_field, "previous": deepcopy(previous)})
            if keep_display:
                continue
            for data in (old, live):
                for name, value_block in list(data.items()):
                    if not isinstance(value_block, dict) or value_block.get("card_instance_id") != previous.get("card_instance_id"):
                        continue
                    value_block.pop(field, None)
                    if isinstance(value_block.get("bindings"), dict):
                        value_block["bindings"].pop(field, None)
                    if not any(k not in _METADATA and not k.startswith("__") for k in value_block):
                        retired.add(value_block.get("card_instance_id"))
                        data.pop(name)

    # v2 wrote old-contact ADD into a field that no old-contact control renders.
    # Surface the current stored value in the fitting fallback before retiring it.
    for key, block in new.items():
        if not isinstance(block, dict) or block.get("source_table") != "adchecks":
            continue
        for side in ("r", "l"):
            field, hidden = f"cn{side}add", f"{side}_read_ad"
            for old_key, previous in old.items():
                if not old_key.startswith("old-contact-lenses") or not isinstance(previous, dict) or hidden not in previous or field not in block:
                    continue
                live_key = equivalent_key(live, old_key, previous)
                value = live.get(live_key, {}).get(hidden, _MISSING)
                if value != previous[hidden]:
                    live.setdefault(key, {})[field] = None if value is _MISSING else value
                    old.setdefault(key, {})[field] = previous[hidden]

    # Failed moves must keep their legacy display. Successful moves remove only
    # fields that now have an owned destination; all evidence stays in recovery.
    for key, block in list(new.items()):
        if not isinstance(block, dict) or not block.get("opticplus_source"):
            continue
        fields = block["opticplus_source"].get("fields", {})
        if not fields and all(k in {"card_instance_id", "source_card_type", "opticplus_source", "title"} for k in block):
            new.pop(key)
    if retired:
        for data in (old, live):
            for key, block in list(data.items()):
                if isinstance(block, dict) and block.get("card_instance_id") in retired:
                    # Another alias can contain manual fields; never retire it.
                    if any(k not in _METADATA and not k.startswith("__") for k in block):
                        retired.discard(block.get("card_instance_id"))
        live_items = [i for i in live_items if i.get("id") not in retired]
        old_items = [i for i in old_items if i.get("id") not in retired]
    current_shape = json.loads(current_layout or "{}"); current_shape["items"] = live_items
    baseline_shape = json.loads(baseline_layout or "{}"); baseline_shape["items"] = old_items
    return old, live, new, json.dumps(current_shape), json.dumps(baseline_shape), moved, conflicts
