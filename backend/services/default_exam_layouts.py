from __future__ import annotations

import json
from dataclasses import dataclass

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Clinic, ExamLayout


@dataclass(frozen=True)
class DefaultExamLayoutTemplate:
    seed_key: str
    seed_version: int
    name: str
    layout_data: str
    type: str
    sort_index: int


DEFAULT_EXAM_LAYOUT_SEED_VERSION = 1

DEFAULT_EXAM_LAYOUT_TEMPLATES: tuple[DefaultExamLayoutTemplate, ...] = (
    DefaultExamLayoutTemplate(
        seed_key="standard-glasses",
        seed_version=DEFAULT_EXAM_LAYOUT_SEED_VERSION,
        name="בדיקות ראיה למשקפיים סטנדרטי",
        type="global",
        sort_index=1,
        layout_data='{"rows":[{"id":"row-2","cards":[{"id":"uncorrected-va-1765721735376","type":"uncorrected-va"},{"id":"old-refraction-1765721745303","type":"old-refraction"}]},{"id":"row-1765721836764","cards":[{"id":"retinoscop-1765721844756","type":"retinoscop"}]},{"id":"row-1765722345779","cards":[{"id":"subjective-1765722364008","type":"subjective"},{"id":"notes-1767557840309","type":"notes"}]},{"id":"row-1765722623454","cards":[{"id":"final-subjective-1765722634578","type":"final-subjective"},{"id":"addition-1767556869050","type":"addition"}]}],"customWidths":{"row-2":{"uncorrected-va-1765721735376":23.31658291457286,"old-refraction-1765721745303":76.68341708542714},"row-1765722345779":{"subjective-1765722364008":53.18819708297586,"notes-1767557840309":46.81180291702414}}}',
    ),
    DefaultExamLayoutTemplate(
        seed_key="dilated-prescription",
        seed_version=DEFAULT_EXAM_LAYOUT_SEED_VERSION,
        name="מרשם עם הרחבת אישונים",
        type="global",
        sort_index=2,
        layout_data='{"rows":[{"id":"row-2","cards":[{"id":"uncorrected-va-1765724353823","type":"uncorrected-va"},{"id":"compact-prescription-1765724404168","type":"compact-prescription","showEyeLabels":true}]},{"id":"row-1765724416574","cards":[{"id":"retinoscop-dilation-1765724421626","type":"retinoscop-dilation"},{"id":"notes-1766608851196","type":"notes","showEyeLabels":true}]},{"id":"row-1765724452997","cards":[{"id":"final-subjective-1765724458702","type":"final-subjective"}]},{"id":"row-1765724469015","cards":[{"id":"final-prescription-1765724472564","type":"final-prescription"}]},{"id":"row-1766608860531","cards":[{"id":"notes-1766608864771","type":"notes"}]}],"customWidths":{"row-2":{"uncorrected-va-1765724353823":23.62951119232526,"compact-prescription-1765724404168":76.37048880767475}}}',
    ),
    DefaultExamLayoutTemplate(
        seed_key="contact-lens-exam",
        seed_version=DEFAULT_EXAM_LAYOUT_SEED_VERSION,
        name="בדיקת עדשות מגע",
        type="contact lens",
        sort_index=3,
        layout_data='{"rows":[{"id":"row-1766607039365","cards":[{"id":"anamnesis-1766607083814","type":"anamnesis"}]},{"id":"row-1766607185533","cards":[{"id":"contact-lens-diameters-1766607190437","type":"contact-lens-diameters"},{"id":"keratometer-contact-lens-1777320166178","type":"keratometer-contact-lens"}]},{"id":"row-1777318955846","cards":[{"id":"final-prescription-1777318970198","type":"final-prescription"}]},{"id":"row-1","cards":[{"id":"old-contact-lenses-1777318807193","type":"old-contact-lenses"}]},{"id":"row-1777318388690","cards":[{"id":"over-refraction-1777318405574","type":"over-refraction"},{"id":"schirmer-test-1777320208432","type":"schirmer-test"}]},{"id":"row-1766607106220","cards":[{"id":"old-contact-lenses-1766607135854","type":"old-contact-lenses"}]},{"id":"row-1766607146100","cards":[{"id":"notes-1766607157245","type":"notes"}]},{"id":"row-1766607227908","cards":[{"id":"corneal-topography-1766607241245","type":"corneal-topography"}]},{"id":"row-1777319400177","cards":[]}],"customWidths":{}}',
    ),
    DefaultExamLayoutTemplate(
        seed_key="routine-glasses",
        seed_version=DEFAULT_EXAM_LAYOUT_SEED_VERSION,
        name="בדיקה שגרתית",
        type="glass",
        sort_index=4,
        layout_data='{"rows":[{"id":"row-1776585448502","cards":[{"id":"old-refraction-1776585463151","type":"old-refraction"},{"id":"keratometer-1776585471161","type":"keratometer"}]},{"id":"row-1776585474535","cards":[{"id":"anamnesis-1776585515524","type":"anamnesis"}]}],"customWidths":{}}',
    ),
)


def validate_default_exam_layout_templates() -> None:
    keys = set()
    for template in DEFAULT_EXAM_LAYOUT_TEMPLATES:
        if template.seed_key in keys:
            raise ValueError(f"Duplicate default exam layout seed_key: {template.seed_key}")
        keys.add(template.seed_key)
        parsed = json.loads(template.layout_data)
        if not isinstance(parsed, dict) or not isinstance(parsed.get("rows"), list):
            raise ValueError(f"Invalid default exam layout template: {template.seed_key}")


def _next_sort_index(db: Session, clinic_id: int) -> int:
    max_sort = (
        db.query(func.coalesce(func.max(ExamLayout.sort_index), 0))
        .filter(ExamLayout.clinic_id == clinic_id)
        .filter(ExamLayout.parent_layout_id.is_(None))
        .scalar()
    )
    return int(max_sort or 0) + 1


def _apply_seed_metadata(layout: ExamLayout, template: DefaultExamLayoutTemplate) -> None:
    layout.seed_key = template.seed_key
    layout.seed_version = template.seed_version
    layout.is_seeded_default = True
    layout.is_default = True
    layout.is_active = True
    layout.is_group = False
    layout.parent_layout_id = None
    layout.type = template.type


def ensure_default_exam_layouts_for_clinic(
    db: Session,
    clinic_id: int,
    *,
    dry_run: bool = False,
) -> dict[str, int]:
    validate_default_exam_layout_templates()
    clinic = db.query(Clinic.id).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise ValueError(f"Clinic {clinic_id} does not exist")

    result = {"created": 0, "tagged": 0, "existing": 0}
    next_sort = _next_sort_index(db, clinic_id)

    for template in DEFAULT_EXAM_LAYOUT_TEMPLATES:
        existing_seeded = (
            db.query(ExamLayout)
            .filter(ExamLayout.clinic_id == clinic_id)
            .filter(ExamLayout.seed_key == template.seed_key)
            .first()
        )
        if existing_seeded:
            result["existing"] += 1
            continue

        exact_match = (
            db.query(ExamLayout)
            .filter(ExamLayout.clinic_id == clinic_id)
            .filter(ExamLayout.seed_key.is_(None))
            .filter(ExamLayout.layout_data == template.layout_data)
            .order_by(ExamLayout.id.asc())
            .first()
        )
        if exact_match:
            result["tagged"] += 1
            if not dry_run:
                _apply_seed_metadata(exact_match, template)
            continue

        result["created"] += 1
        if dry_run:
            continue
        layout = ExamLayout(
            clinic_id=clinic_id,
            name=template.name,
            layout_data=template.layout_data,
            is_default=True,
            is_active=True,
            sort_index=next_sort,
            parent_layout_id=None,
            is_group=False,
            type=template.type,
            seed_key=template.seed_key,
            seed_version=template.seed_version,
            is_seeded_default=True,
        )
        next_sort += 1
        db.add(layout)

    return result
