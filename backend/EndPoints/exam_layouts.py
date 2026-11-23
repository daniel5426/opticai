from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional

from auth import get_current_user
from database import get_db
from models import Company, ExamLayout, ExamLayoutInstance, User
from schemas import (
    ExamLayoutCreate,
    ExamLayoutUpdate,
    ExamLayout as ExamLayoutSchema,
    ExamLayoutActivationUpdate,
    ExamLayoutReorderRequest,
    ExamLayoutGroupRequest,
    ExamLayoutBulkDeleteRequest,
    ExamLayoutInstanceReorderRequest,
)
from security.scope import (
    assert_record_clinic, assert_record_scope, normalize_clinic_id_for_company, resolve_company_id,
)
from services.exam_layout_catalog import (
    build_layout_tree, clinic_layouts, find_layout, layout_activations, layout_catalog, layout_tree,
    serialize_layout, set_clinic_activation, usable_layout,
)
from services.exam_workspace import lock_exam, lock_instance_exam
from services.prescription_search_index import rebuild_exam_instance_index

router = APIRouter(prefix="/exam-layouts", tags=["exam-layouts"])


def clinic_context(db, user, clinic_id=None):
    clinic_id = clinic_id if clinic_id is not None else user.clinic_id
    if clinic_id is not None:
        assert_record_clinic(db, user, clinic_id)
    return clinic_id


def lock_company(db, user):
    company_id = resolve_company_id(db, user)
    db.query(Company.id).filter(Company.id == company_id).with_for_update(key_share=True).one()
    return company_id


def require_layout(db, company_id, layout_id):
    layout = find_layout(db, company_id, layout_id)
    if not layout:
        raise HTTPException(404, "Exam layout not found")
    return layout


def layout_response(db, company_id, layout, clinic_id):
    row, active = clinic_layouts(layout_catalog(db, company_id), clinic_id).filter(ExamLayout.id == layout.id).one()
    return serialize_layout(row, clinic_id, active)


def siblings(query, parent_id):
    return query.filter(ExamLayout.parent_layout_id == parent_id)


def next_sort(query, parent_id):
    return siblings(query, parent_id).with_entities(func.coalesce(func.max(ExamLayout.sort_index), 0)).scalar() + 1


def reindex_siblings(query, parent_ids):
    for parent_id in parent_ids:
        for index, layout in enumerate(siblings(query, parent_id).order_by(ExamLayout.sort_index, ExamLayout.id), start=1):
            layout.sort_index = index


def validate_parent(layouts, layout_id, parent_id, proposed=None):
    if parent_id is None:
        return
    parent = layouts.get(parent_id)
    if parent is None:
        raise HTTPException(403, "Invalid parent layout")
    if not parent.is_group:
        raise HTTPException(400, "Parent layout must be a group")
    seen = {layout_id}
    while parent:
        if parent.id in seen:
            raise HTTPException(400, "Layout groups cannot contain themselves")
        seen.add(parent.id)
        parent = layouts.get((proposed or {}).get(parent.id, parent.parent_layout_id))


def default_layouts(db, user, clinic_id, layout_type):
    tree = layout_tree(db, resolve_company_id(db, user), clinic_context(db, user, clinic_id), active_only=True)
    defaults = []
    def collect(nodes):
        for node in nodes:
            if node["is_group"]:
                collect(node["children"])
            elif (node["is_seeded_default"] or node["is_default"]) and (not layout_type or node["type"] == layout_type):
                defaults.append(node)
    collect(tree)
    return sorted(defaults, key=lambda item: (not item["is_seeded_default"], item["sort_index"], item["id"]))


@router.get("/default", response_model=Optional[ExamLayoutSchema])
def get_default_exam_layout(
    clinic_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return next(iter(default_layouts(db, current_user, clinic_id, type)), None)


@router.get("/defaults", response_model=List[ExamLayoutSchema])
def get_default_exam_layouts(
    clinic_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return default_layouts(db, current_user, clinic_id, type)


@router.post("/", response_model=ExamLayoutSchema)
def create_exam_layout(
    layout: ExamLayoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = layout.model_dump(exclude={"clinic_id", "is_active", "seed_key", "seed_version", "is_seeded_default"})
    clinic_id = normalize_clinic_id_for_company(db, current_user, layout.clinic_id)
    company_id = lock_company(db, current_user)
    catalog = layout_catalog(db, company_id)
    parent_id = payload.get("parent_layout_id")
    if parent_id is not None:
        validate_parent({row.id: row for row in catalog}, None, parent_id)
    if payload["sort_index"] is None:
        payload["sort_index"] = next_sort(catalog, parent_id)
    row = ExamLayout(company_id=company_id, is_active=False, **payload)
    db.add(row)
    db.flush()
    set_clinic_activation(db, row.id, clinic_id, layout.is_active)
    db.commit()
    return layout_response(db, company_id, row, clinic_id)


@router.get("/", response_model=List[ExamLayoutSchema])
def get_all_exam_layouts(
    clinic_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(False),
):
    return layout_tree(
        db, resolve_company_id(db, current_user), clinic_context(db, current_user, clinic_id), type,
        active_only=active_only,
    )


@router.get("/clinic/{clinic_id}", response_model=List[ExamLayoutSchema])
def get_exam_layouts_by_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_all_exam_layouts(clinic_id, None, db, current_user, False)


@router.get("/activations", response_model=dict[int, dict[int, bool]])
def get_exam_layout_activations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return layout_activations(db, resolve_company_id(db, current_user))


@router.get("/{layout_id}", response_model=ExamLayoutSchema)
def get_exam_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    clinic_id: Optional[int] = Query(None),
):
    company_id = resolve_company_id(db, current_user)
    layout = require_layout(db, company_id, layout_id)
    return layout_response(db, company_id, layout, clinic_context(db, current_user, clinic_id))


@router.put("/{layout_id}/activation", response_model=ExamLayoutSchema)
def update_exam_layout_activation(
    layout_id: int,
    activation: ExamLayoutActivationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clinic_id = normalize_clinic_id_for_company(db, current_user, activation.clinic_id)
    company_id = lock_company(db, current_user)
    layout = require_layout(db, company_id, layout_id)
    set_clinic_activation(db, layout.id, clinic_id, activation.is_active)
    db.commit()
    return layout_response(db, company_id, layout, clinic_id)


@router.put("/{layout_id}", response_model=ExamLayoutSchema)
def update_exam_layout(
    layout_id: int,
    layout: ExamLayoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = lock_company(db, current_user)
    row = require_layout(db, company_id, layout_id)
    payload = layout.model_dump(
        exclude_unset=True, exclude={"clinic_id", "is_active", "seed_key", "seed_version", "is_seeded_default"},
    )
    clinic_id = clinic_context(db, current_user, layout.clinic_id)
    if "is_active" in layout.model_fields_set:
        clinic_id = normalize_clinic_id_for_company(db, current_user, clinic_id)
        set_clinic_activation(db, row.id, clinic_id, layout.is_active)
    catalog = layout_catalog(db, company_id)
    if payload.get("is_group") is False and siblings(catalog, row.id).first():
        raise HTTPException(400, "Cannot unset group while children exist")
    old_parent = row.parent_layout_id
    if "parent_layout_id" in payload:
        parent_id = payload["parent_layout_id"]
        validate_parent({item.id: item for item in catalog}, row.id, parent_id)
        if parent_id != old_parent and "sort_index" not in payload:
            payload["sort_index"] = next_sort(catalog, parent_id)
    for field, value in payload.items():
        setattr(row, field, value)
    if {"parent_layout_id", "sort_index"} & payload.keys():
        db.flush()
        reindex_siblings(catalog, {old_parent, row.parent_layout_id})
    db.commit()
    return layout_response(db, company_id, row, clinic_id)


@router.post("/reorder", response_model=List[ExamLayoutSchema])
def reorder_exam_layouts(
    request: ExamLayoutReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not request.items:
        raise HTTPException(400, "No layouts to reorder")
    clinic_id = clinic_context(db, current_user, request.clinic_id)
    company_id = lock_company(db, current_user)
    catalog = layout_catalog(db, company_id)
    layouts = {row.id: row for row in catalog}
    proposed = {item.id: item.parent_layout_id for item in request.items}
    if len(proposed) != len(request.items) or not proposed.keys() <= layouts.keys():
        raise HTTPException(404, "One or more layouts not found")
    parents = set()
    for item in request.items:
        validate_parent(layouts, item.id, item.parent_layout_id, proposed)
        parents.update((layouts[item.id].parent_layout_id, item.parent_layout_id))
    for item in request.items:
        layouts[item.id].parent_layout_id = item.parent_layout_id
        layouts[item.id].sort_index = item.sort_index
    db.flush()
    reindex_siblings(catalog, parents)
    db.commit()
    return layout_tree(db, company_id, clinic_id)


def selected_layouts(catalog, layout_ids):
    ids = list(dict.fromkeys(layout_ids))
    layouts = {row.id: row for row in catalog.filter(ExamLayout.id.in_(ids))}
    if len(ids) != len(layouts):
        raise HTTPException(404, "One or more layouts not found")
    return [layouts[layout_id] for layout_id in ids]


@router.post("/groups", response_model=ExamLayoutSchema)
def create_exam_layout_group(
    request: ExamLayoutGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = request.name.strip()
    if not name or not request.layout_ids:
        raise HTTPException(400, "Group name and layouts are required")
    clinic_id = clinic_context(db, current_user, request.clinic_id)
    company_id = lock_company(db, current_user)
    catalog = layout_catalog(db, company_id)
    layouts = selected_layouts(catalog, request.layout_ids)
    old_parents = {layout.parent_layout_id for layout in layouts}
    group = ExamLayout(company_id=company_id, name=name, layout_data="{}", is_group=True, sort_index=next_sort(catalog, None))
    db.add(group)
    db.flush()
    for index, layout in enumerate(layouts, start=1):
        layout.parent_layout_id = group.id
        layout.sort_index = index
    db.flush()
    reindex_siblings(catalog, old_parents)
    db.commit()
    return layout_response(db, company_id, group, clinic_id)


def delete_layouts(db, catalog, layouts):
    deleted_ids = {layout.id for layout in layouts}
    parents = {layout.parent_layout_id for layout in layouts} - deleted_ids
    root_sort = next_sort(catalog, None)
    children = catalog.filter(
        ExamLayout.parent_layout_id.in_(deleted_ids), ExamLayout.id.not_in(deleted_ids),
    ).order_by(ExamLayout.sort_index, ExamLayout.id)
    for index, child in enumerate(children, start=root_sort):
        child.parent_layout_id = None
        child.sort_index = index
    db.flush()
    for layout in layouts:
        db.delete(layout)
    db.flush()
    reindex_siblings(catalog, parents | {None})
    db.commit()


@router.post("/bulk-delete", response_model=List[ExamLayoutSchema])
def bulk_delete_exam_layouts(
    request: ExamLayoutBulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not request.layout_ids:
        return []
    clinic_id = clinic_context(db, current_user, request.clinic_id)
    company_id = lock_company(db, current_user)
    catalog = layout_catalog(db, company_id)
    delete_layouts(db, catalog, selected_layouts(catalog, request.layout_ids))
    return layout_tree(db, company_id, clinic_id)


@router.delete("/{layout_id}")
def delete_exam_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = lock_company(db, current_user)
    delete_layouts(db, layout_catalog(db, company_id), [require_layout(db, company_id, layout_id)])
    return {"message": "Exam layout deleted successfully"}

# Exam Layout Instances endpoints
@router.post("/instances")
def create_exam_layout_instance(
    instance_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam
    
    exam = lock_exam(db, current_user, instance_data.get('exam_id'))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    assert_record_scope(db, current_user, exam)
    
    if instance_data.get("layout_id"):
        layout = usable_layout(db, exam.company_id, exam.clinic_id, instance_data["layout_id"])
        instance_data = {**instance_data, "layout_id": layout.id}
    instance = ExamLayoutInstance(**instance_data)
    db.add(instance)
    db.flush()
    rebuild_exam_instance_index(db, instance)
    db.commit()
    return {
        "id": instance.id,
        "exam_id": instance.exam_id,
        "layout_id": instance.layout_id,
        "layout_data": getattr(instance, 'layout_data', None),
        "is_active": instance.is_active,
        "order": instance.order,
        "created_at": instance.created_at,
        "updated_at": instance.updated_at
    }

@router.post("/instances/reorder")
def reorder_exam_layout_instances(
    request: ExamLayoutInstanceReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam

    if not request.items:
        return {"updated": 0}

    exam = lock_exam(db, current_user, request.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    assert_record_scope(db, current_user, exam)

    instance_ids = [item.id for item in request.items]
    instances = (
        db.query(ExamLayoutInstance)
        .filter(ExamLayoutInstance.id.in_(instance_ids))
        .all()
    )
    if len(instances) != len(instance_ids):
        raise HTTPException(status_code=404, detail="One or more layout instances not found")

    instance_map = {instance.id: instance for instance in instances}
    order_map = {item.id: item.order for item in request.items}

    for instance_id, instance in instance_map.items():
        if instance.exam_id != request.exam_id:
            raise HTTPException(status_code=400, detail="Layout instance does not belong to the specified exam")
        instance.order = order_map.get(instance_id, instance.order)

    db.commit()

    return {
        "updated": len(instances)
    }

@router.get("/instances/{instance_id}")
def get_exam_layout_instance(
    instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam
    
    instance = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Exam layout instance not found")
    
    exam = db.query(OpticalExam).filter(OpticalExam.id == instance.exam_id).first()
    assert_record_scope(db, current_user, exam)
    
    return {
        "id": instance.id,
        "exam_id": instance.exam_id,
        "layout_id": instance.layout_id,
        "layout_data": getattr(instance, 'layout_data', None),
        "is_active": instance.is_active,
        "order": instance.order,
        "created_at": instance.created_at,
        "updated_at": instance.updated_at
    }

@router.get("/instances/exam/{exam_id}", response_model=List[dict])
def get_exam_layout_instances_by_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam
    
    exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    assert_record_scope(db, current_user, exam)
    
    instances = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.exam_id == exam_id).all()
    return [
        {
            "id": instance.id,
            "exam_id": instance.exam_id,
            "layout_id": instance.layout_id,
            "layout_data": getattr(instance, 'layout_data', None),
            "is_active": instance.is_active,
            "order": instance.order,
            "created_at": instance.created_at,
            "updated_at": instance.updated_at
        }
        for instance in instances
    ]

@router.get("/instances/exam/{exam_id}/active")
def get_active_exam_layout_instance_by_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam
    
    exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    assert_record_scope(db, current_user, exam)
    
    instance = db.query(ExamLayoutInstance).filter(
        ExamLayoutInstance.exam_id == exam_id,
        ExamLayoutInstance.is_active == True
    ).first()
    
    if not instance:
        return None
    
    return {
        "id": instance.id,
        "exam_id": instance.exam_id,
        "layout_id": instance.layout_id,
        "layout_data": getattr(instance, 'layout_data', None),
        "is_active": instance.is_active,
        "order": instance.order,
        "created_at": instance.created_at,
        "updated_at": instance.updated_at
    }

@router.put("/instances/{instance_id}")
def update_exam_layout_instance(
    instance_id: int,
    instance_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    from models import OpticalExam
    
    lock_instance_exam(db, current_user, instance_id)
    instance = db.query(ExamLayoutInstance).populate_existing().with_for_update().filter(ExamLayoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Exam layout instance not found")
    
    exam = db.query(OpticalExam).filter(OpticalExam.id == instance.exam_id).first()
    assert_record_scope(db, current_user, exam)
    
    if instance_data.get("exam_id", instance.exam_id) != instance.exam_id:
        raise HTTPException(422, "companyClients.instanceExam")
    from services.legacy_exam_compatibility import preserve_unrepresented_components, preserve_unrepresented_layout
    instance_data = dict(instance_data)
    if instance_data.get("layout_id") and instance_data["layout_id"] != instance.layout_id:
        instance_data["layout_id"] = usable_layout(
            db, exam.company_id, exam.clinic_id, instance_data["layout_id"],
        ).id
    if "exam_data" in instance_data:
        if not isinstance(instance_data["exam_data"], dict):
            raise HTTPException(422, "agent.invalidFields")
        instance_data["exam_data"] = preserve_unrepresented_components(instance.exam_data, instance_data["exam_data"], request)
    if "layout_data" in instance_data:
        instance_data["layout_data"] = preserve_unrepresented_layout(instance.layout_data, instance_data["layout_data"], request)
    for field, value in instance_data.items():
        if hasattr(instance, field):
            setattr(instance, field, value)
    if "exam_data" in instance_data:
        rebuild_exam_instance_index(db, instance)
    db.commit()
    db.refresh(instance)
    
    return {
        "id": instance.id,
        "exam_id": instance.exam_id,
        "layout_id": instance.layout_id,
        "layout_data": getattr(instance, 'layout_data', None),
        "is_active": instance.is_active,
        "order": instance.order,
        "created_at": instance.created_at,
        "updated_at": instance.updated_at
    }

@router.delete("/instances/{instance_id}")
def delete_exam_layout_instance(
    instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam
    
    lock_instance_exam(db, current_user, instance_id)
    instance = db.query(ExamLayoutInstance).populate_existing().with_for_update().filter(ExamLayoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Exam layout instance not found")
    
    exam = db.query(OpticalExam).filter(OpticalExam.id == instance.exam_id).first()
    assert_record_scope(db, current_user, exam)
    
    db.delete(instance)
    db.commit()
    return {"message": "Exam layout instance deleted successfully"}

@router.post("/instances/exam/{exam_id}/set-active/{instance_id}")
def set_active_exam_layout_instance(
    exam_id: int,
    instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam
    
    exam = lock_exam(db, current_user, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    assert_record_scope(db, current_user, exam)
    
    # Deactivate all instances for this exam
    instances = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.exam_id == exam_id).all()
    for instance in instances:
        instance.is_active = False
    
    # Activate the specified instance
    target_instance = db.query(ExamLayoutInstance).filter(
        ExamLayoutInstance.id == instance_id,
        ExamLayoutInstance.exam_id == exam_id
    ).first()
    
    if not target_instance:
        raise HTTPException(status_code=404, detail="Exam layout instance not found")
    
    target_instance.is_active = True
    db.commit()
    
    return {"message": "Active exam layout instance updated successfully"}
