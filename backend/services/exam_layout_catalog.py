"""Company layout definitions and their clinic-specific availability."""
from fastapi import HTTPException
from sqlalchemy import and_, case, func, or_, select

from models import Clinic, ExamLayout, ExamLayoutClinicActivation
from schemas import ExamLayout as ExamLayoutSchema


def company_layout_scope(company_id):
    # Old writers can still create rows with only a clinic during rollout.
    return or_(
        ExamLayout.company_id == company_id,
        and_(ExamLayout.company_id.is_(None), ExamLayout.clinic_id.in_(
            select(Clinic.id).where(Clinic.company_id == company_id)
        )),
    )


def layout_catalog(db, company_id):
    return db.query(ExamLayout).filter(
        company_layout_scope(company_id), ExamLayout.canonical_layout_id.is_(None),
    )


def clinic_layouts(query, clinic_id):
    activation = ExamLayoutClinicActivation
    legacy_active = case(
        (ExamLayout.clinic_id == clinic_id, ExamLayout.is_active),
        (ExamLayout.is_group.is_(True), True),
        else_=False,
    )
    return query.outerjoin(
        activation, and_(activation.layout_id == ExamLayout.id, activation.clinic_id == clinic_id)
    ).add_columns(func.coalesce(activation.is_active, legacy_active, False).label("active_for_clinic"))


def layout_activations(db, company_id):
    query = (
        db.query(ExamLayout.id, Clinic.id)
        .select_from(ExamLayout)
        .join(Clinic, Clinic.company_id == company_id)
        .filter(company_layout_scope(company_id), ExamLayout.canonical_layout_id.is_(None))
    )
    activations = {}
    for layout_id, clinic_id, is_active in clinic_layouts(query, Clinic.id):
        activations.setdefault(layout_id, {})[clinic_id] = is_active
    return activations


def serialize_layout(layout, clinic_id, active):
    return {
        **{field: getattr(layout, field) for field in ExamLayoutSchema.model_fields if field != "children"},
        "clinic_id": clinic_id,
        "is_active": active,
        "is_default": bool(layout.is_default),
        "is_group": bool(layout.is_group),
        "is_seeded_default": bool(layout.is_seeded_default),
        "children": [],
    }


def build_layout_tree(layouts, *, clinic_id=None, activation=None):
    nodes = {}
    for layout in sorted(layouts, key=lambda row: (row.sort_index or 0, row.id)):
        active = activation[layout.id] if activation is not None else bool(layout.is_active)
        nodes[layout.id] = serialize_layout(layout, clinic_id, active)
    roots = []
    for node in nodes.values():
        parent = nodes.get(node["parent_layout_id"])
        if parent is None:
            roots.append(node)
        else:
            parent["children"].append(node)
    return roots


def layout_tree(db, company_id, clinic_id, layout_type=None, *, active_only=False):
    query = layout_catalog(db, company_id)
    rows = clinic_layouts(query, clinic_id).all()
    tree = build_layout_tree(
        [layout for layout, _ in rows], clinic_id=clinic_id,
        activation={layout.id: active for layout, active in rows},
    )
    if active_only:
        tree = active_layout_tree(tree)
    if layout_type:
        def matching(nodes):
            for node in nodes:
                children = list(matching(node["children"]))
                if node["type"] == layout_type or children:
                    yield {**node, "children": children}
        tree = list(matching(tree))
    return tree


def active_layout_tree(nodes):
    result = []
    for node in nodes:
        if node["is_active"]:
            children = active_layout_tree(node["children"])
            if children or not node["is_group"]:
                result.append({**node, "children": children})
    return result


def find_layout(db, company_id, layout_id):
    layout = db.query(ExamLayout).filter(company_layout_scope(company_id), ExamLayout.id == layout_id)
    row = layout.first()
    if row and row.canonical_layout_id:
        canonical = layout_catalog(db, company_id).filter(ExamLayout.id == row.canonical_layout_id)
        row = canonical.first()
    return row


def set_clinic_activation(db, layout_id, clinic_id, active):
    row = db.get(ExamLayoutClinicActivation, (layout_id, clinic_id))
    if row is None:
        db.add(ExamLayoutClinicActivation(layout_id=layout_id, clinic_id=clinic_id, is_active=active))
    else:
        row.is_active = active


def usable_layout(db, company_id, clinic_id, layout_id):
    row = find_layout(db, company_id, layout_id)
    if row and not row.is_group:
        query = clinic_layouts(layout_catalog(db, company_id), clinic_id)
        seen = set()
        parent_id = row.id
        while parent_id is not None and parent_id not in seen:
            found = query.filter(ExamLayout.id == parent_id).first()
            if not found or not found.active_for_clinic:
                break
            seen.add(parent_id)
            parent_id = found.ExamLayout.parent_layout_id
        if parent_id is None:
            return row
    raise HTTPException(422, "Invalid exam layout")
