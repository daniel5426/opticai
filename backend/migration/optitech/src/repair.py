"""Conservative three-way repair of existing OptiTech exam JSON.

The previous trace is the import baseline; changed/deleted user fields win.
This module does not connect to a database or execute a migration on import.
"""
from copy import deepcopy
from typing import Any

_MISSING = object()


def merge_imported_data(baseline: dict, current: dict, corrected: dict):
    conflicts = []

    def merge(old, live, new, path):
        if new is _MISSING:
            # Removing formerly imported fields requires a separate contract step.
            return deepcopy(live) if live is not _MISSING else _MISSING
        if live == new:
            return deepcopy(live)
        if isinstance(new, dict) and (isinstance(live, dict) or live is _MISSING):
            if live is _MISSING and old is not _MISSING:
                conflicts.append({"path": path, "reason": "deleted_after_import"})
                return _MISSING
            result = deepcopy(live) if isinstance(live, dict) else {}
            for key, value in new.items():
                merged = merge(old.get(key, _MISSING) if isinstance(old, dict) else _MISSING,
                               result.get(key, _MISSING), value, f"{path}.{key}" if path else key)
                if merged is not _MISSING:
                    result[key] = merged
            return result
        if live is _MISSING and old is _MISSING or old is not _MISSING and live == old:
            return deepcopy(new)
        conflicts.append({"path": path, "reason": "changed_after_import"})
        return deepcopy(live) if live is not _MISSING else _MISSING

    return merge(baseline, current, corrected, ""), conflicts


def merge_layout(current: str | None, corrected: str, baseline: str | None = None):
    """Append newly recovered cards; retain all positions and existing cards."""
    import json
    if not current:
        return corrected
    existing, new = json.loads(current), json.loads(corrected)
    if not isinstance(existing, dict) or not isinstance(existing.get("items"), list):
        raise ValueError("Existing layout requires manual review")
    ids = {item.get("id") for item in existing["items"]}
    old_layout = json.loads(baseline) if baseline else {}
    removed_ids = {item.get("id") for item in old_layout.get("items", [])} - ids
    y = max((item.get("y", 0) + item.get("h", 1) for item in existing["items"]), default=0)
    for item in new["items"]:
        if item["id"] not in ids and item["id"] not in removed_ids:
            existing["items"].append({**item, "y": y})
            ids.add(item["id"])
            y += 1
    return json.dumps(existing, ensure_ascii=False)


def include_live_card_aliases(baseline: dict, current: dict, corrected: dict):
    """Repair the instance-specific keys written by the editor as well as defaults.

    A repeated card with a different id is never treated as the imported card.
    Each alias still goes through the three-way merge, so edited aliases win.
    """
    old, new = deepcopy(baseline), deepcopy(corrected)
    for component, block in corrected.items():
        if not isinstance(block, dict) or not block.get('card_instance_id'):
            continue
        alias = f"{component}-{block['card_instance_id']}"
        if alias in current and alias != component:
            new[alias] = deepcopy(block)
            if component in baseline:
                old[alias] = deepcopy(baseline[component])
    return old, new
