from typing import Any, Dict, Mapping

PRISM_AXIS_COMPONENT_TYPES = ("subjective", "final-subjective")

HORIZONTAL_ALIASES = (
    ("r_pris", "r_pr_h"),
    ("l_pris", "l_pr_h"),
    ("r_base", "r_base_h"),
    ("l_base", "l_base_h"),
)


def _is_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def is_prism_axis_component_key(key: str) -> bool:
    return any(
        key == component_type or key.startswith(f"{component_type}-")
        for component_type in PRISM_AXIS_COMPONENT_TYPES
    )


def normalize_prism_axis_block(block: Mapping[str, Any]) -> Dict[str, Any]:
    next_block = dict(block)
    for legacy, split in HORIZONTAL_ALIASES:
        legacy_present = _is_present(next_block.get(legacy))
        split_present = _is_present(next_block.get(split))
        if legacy_present:
            next_block[split] = next_block.get(legacy)
        elif split_present:
            next_block[legacy] = next_block.get(split)
    return next_block


def normalize_prism_axis_exam_data(exam_data: Dict[str, Any] | None) -> Dict[str, Any]:
    if not exam_data:
        return {}
    normalized: Dict[str, Any] = {}
    for key, value in exam_data.items():
        if is_prism_axis_component_key(key) and isinstance(value, dict):
            normalized[key] = normalize_prism_axis_block(value)
            continue
        normalized[key] = value
    return normalized
