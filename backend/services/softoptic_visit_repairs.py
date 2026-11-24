"""Repair primitives based on immutable Soft Optic source rows.

These functions produce a plan. Callers decide when to apply it. Existing visit
IDs and links are retained, and edited exam fields are never overwritten.
"""
from dataclasses import dataclass
from typing import Any

from migration.pipeline.common import (
    CONTACT_FIT_EYE_TEST_CARDS,
    CONTACT_FIT_EYE_TEST_DETAIL_SLOTS,
    SOFTOPTIC_DETAIL_ZERO_VALUES,
    build_component_entry,
    build_contact_fit_exam_data,
    get_migrated_card_id,
    parse_float,
    parse_int,
)

COPIED_EYE_CARD_KEYS = {
    key for card in CONTACT_FIT_EYE_TEST_CARDS
    for key in (card, f"{card}-{get_migrated_card_id(card)}")
} | {f"softoptic-details-{slot}" for slot in CONTACT_FIT_EYE_TEST_DETAIL_SLOTS}


@dataclass
class FitVisitRepair:
    data: dict[str, Any]
    moved_reflex_fields: int
    removed_copied_blocks: int
    copied_data_needs_review: bool


def remove_legacy_check_overlay(data, source_rows):
    """Remove the exact loose block the older importer wrote onto an unrelated exam."""
    expected = {}
    for raw in source_rows:
        eye = (raw.get("tested_eye") or "").strip().lower()
        va = parse_float(raw.get("chk_va"))
        if eye in ("r", "l"):
            expected.update({
                f"{eye}_sph": parse_float(raw.get("or_sph")),
                f"{eye}_cyl": parse_float(raw.get("or_cyl")),
                f"{eye}_ax": parse_int(raw.get("or_ax")),
                f"{eye}_va": va,
                f"{eye}_add": parse_float(raw.get("chk_add")),
            })
        if va is not None:
            expected["comb_va"] = va
    if expected and data.get("over-refraction") == expected and not any(
        key.startswith("over-refraction-") for key in data
    ):
        return {key: value for key, value in data.items() if key != "over-refraction"}
    return data


def plan_fit_visit_repair(current, raw_fit, archived_eye_cards=None, *, updated=False) -> FitVisitRepair:
    """Move unchanged Reflex values and remove only unchanged, verified historic copies."""
    data = dict(current)
    rebuilt = build_contact_fit_exam_data(raw_fit)
    fitting = current.get("softoptic-details-fitting")
    fitting = fitting if isinstance(fitting, dict) else {}
    reflex_aliases = ("retinoscop", "retinoscop-retinoscop-1")
    reflex = rebuilt.get("retinoscop") or {}
    moved = {}
    for key in ("r_reflex", "l_reflex"):
        source_value = reflex.get(key)
        if source_value and source_value not in SOFTOPTIC_DETAIL_ZERO_VALUES and fitting.get(key) == source_value:
            if all(not isinstance(current.get(alias), dict) or current[alias].get(key) in (None, "", source_value)
                   for alias in reflex_aliases):
                moved[key] = source_value
    if moved:
        for key, block in build_component_entry("retinoscop", moved).items():
            data[key] = {**block, **(data.get(key) or {}), **moved}
        remaining = {key: value for key, value in fitting.items() if key not in moved}
        if set(remaining) <= {"card_instance_id"}:
            data.pop("softoptic-details-fitting", None)
        else:
            data["softoptic-details-fitting"] = remaining

    caption = "softoptic-details-eye-test"
    original_keys = COPIED_EYE_CARD_KEYS.intersection(current)
    safe_to_remove = (
        caption in current and bool(original_keys) and not updated and archived_eye_cards is not None
        and all(current[key] == archived_eye_cards.get(key) for key in original_keys)
        and not original_keys.intersection(rebuilt)
    )
    if safe_to_remove:
        for key in original_keys | {caption}:
            data.pop(key, None)
    return FitVisitRepair(data, len(moved), len(original_keys) if safe_to_remove else 0,
                          caption in current and not safe_to_remove)
