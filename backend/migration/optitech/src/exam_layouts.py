from __future__ import annotations

import json
from typing import Iterable, Mapping, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

try:
    from models import Clinic, ExamLayout
except ModuleNotFoundError:
    from backend.models import Clinic, ExamLayout


GLASSES_LAYOUT_NAME = "OptiTech Imported Glasses Layout"
CONTACT_LENS_LAYOUT_NAME = "OptiTech Imported Contact Lens Layout"

GLASSES_COMPONENTS: Tuple[str, ...] = (
    "objective",
    "uncorrected-va",
    "old-refraction",
    "final-prescription",
    "addition",
    "notes",
)

CONTACT_LENS_COMPONENTS: Tuple[str, ...] = (
    "schirmer-test",
    "contact-lens-diameters",
    "keratometer-contact-lens",
    "contact-lens-details",
    "contact-lens-exam",
    "contact-lens-order",
    "notes",
)

EXAM_LAYOUT_VERSION = 2
EXAM_LAYOUT_GRID_COLUMNS = 24
LEGACY_LAYOUT_COLUMNS = 16

COMPONENT_LEGACY_COLUMNS = {
    "old-ref": 3,
    "old-refraction": 8,
    "old-refraction-extension": 12,
    "objective": 4,
    "subjective": 8,
    "final-subjective": 9,
    "final-prescription": 8,
    "compact-prescription": 8,
    "addition": 6,
    "retinoscop": 6,
    "retinoscop-dilation": 6,
    "uncorrected-va": 3,
    "keratometer": 3,
    "keratometer-full": 9,
    "corneal-topography": 1,
    "cover-test": 4,
    "notes": 5,
    "anamnesis": 11,
    "schirmer-test": 2,
    "contact-lens-diameters": 2,
    "contact-lens-details": 10,
    "keratometer-contact-lens": 6,
    "contact-lens-exam": 9,
    "old-contact-lenses": 13,
    "over-refraction": 9,
    "sensation-vision-stability": 5,
    "fusion-range": 5,
    "maddox-rod": 6,
    "maddox-wing": 4,
    "stereo-test": 2,
    "rg": 3,
    "rg-balance": 5,
    "ocular-motor-assessment": 5,
}


def _card_width(component_type: str) -> int:
    legacy_cols = COMPONENT_LEGACY_COLUMNS.get(component_type, 1)
    width = int((legacy_cols / LEGACY_LAYOUT_COLUMNS) * EXAM_LAYOUT_GRID_COLUMNS + 0.5)
    return max(1, min(EXAM_LAYOUT_GRID_COLUMNS, width))


def build_layout_data(component_types: Iterable[str]) -> str:
    items = []
    for index, component_type in enumerate(component_types, start=1):
        card_id = "notes-1" if component_type == "notes" else f"{component_type}-1"
        items.append(
            {
                "id": card_id,
                "type": component_type,
                "showEyeLabels": True,
                "x": 0,
                "y": index - 1,
                "w": _card_width(component_type),
            }
        )
    return json.dumps(
        {
            "version": EXAM_LAYOUT_VERSION,
            "grid": {"columns": EXAM_LAYOUT_GRID_COLUMNS},
            "items": items,
        },
        ensure_ascii=False,
    )


def build_instance_layout_data(
    component_types: Iterable[str],
    exam_data: Mapping[str, object],
) -> str:
    present_components = {_component_type_from_exam_data_key(key) for key in exam_data}
    filtered_components = [component_type for component_type in component_types if component_type in present_components]
    return build_layout_data(filtered_components)


def ensure_phase3_exam_layouts(db: Session, clinic: Clinic) -> tuple[ExamLayout, ExamLayout]:
    glasses_layout = ensure_exam_layout(
        db,
        clinic_id=clinic.id,
        name=GLASSES_LAYOUT_NAME,
        layout_type="glass",
        component_types=GLASSES_COMPONENTS,
    )
    contact_lens_layout = ensure_exam_layout(
        db,
        clinic_id=clinic.id,
        name=CONTACT_LENS_LAYOUT_NAME,
        layout_type="contact lens",
        component_types=CONTACT_LENS_COMPONENTS,
    )
    return glasses_layout, contact_lens_layout


def _component_type_from_exam_data_key(key: str) -> str:
    if key == "__ui":
        return "__ui"
    if key.startswith("notes-"):
        return "notes"
    if key.startswith("old-refraction-") and not key.startswith("old-refraction-extension-"):
        return "old-refraction"
    return key


def ensure_exam_layout(
    db: Session,
    *,
    clinic_id: int,
    name: str,
    layout_type: str,
    component_types: Iterable[str],
) -> ExamLayout:
    layout = (
        db.query(ExamLayout)
        .filter(ExamLayout.clinic_id == clinic_id)
        .filter(ExamLayout.name == name)
        .first()
    )
    payload = {
        "clinic_id": clinic_id,
        "name": name,
        "layout_data": build_layout_data(component_types),
        "is_default": False,
        "is_active": True,
        "type": layout_type,
    }
    if layout is None:
        next_sort = (
            db.query(func.coalesce(func.max(ExamLayout.sort_index), 0))
            .filter(ExamLayout.clinic_id == clinic_id)
            .scalar()
            or 0
        )
        layout = ExamLayout(sort_index=int(next_sort) + 1, **payload)
        db.add(layout)
        db.flush()
        return layout
    for field_name, value in payload.items():
        setattr(layout, field_name, value)
    if layout.sort_index is None:
        layout.sort_index = 0
    db.flush()
    return layout
