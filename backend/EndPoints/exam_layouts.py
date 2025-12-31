from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import ExamLayout, ExamLayoutInstance, Clinic, User
from schemas import (
    ExamLayoutCreate,
    ExamLayoutUpdate,
    ExamLayout as ExamLayoutSchema,
    ExamLayoutReorderRequest,
    ExamLayoutGroupRequest,
    ExamLayoutBulkDeleteRequest,
    ExamLayoutInstanceReorderRequest,
)
from auth import get_current_user
from security.scope import normalize_clinic_id_for_company, resolve_company_id, assert_clinic_belongs_to_company

router = APIRouter(prefix="/exam-layouts", tags=["exam-layouts"])

def build_layout_tree(layouts: List[ExamLayout]) -> List[dict]:
    layout_map = {layout.id: layout for layout in layouts}
    children_map = {layout.id: [] for layout in layouts}
    for layout in layouts:
        parent_id = layout.parent_layout_id
        if parent_id and parent_id in layout_map:
            children_map[parent_id].append(layout)
    def serialize(layout: ExamLayout) -> dict:
        children = sorted(children_map[layout.id], key=lambda item: (item.sort_index, item.id))
        return {
            "id": layout.id,
            "clinic_id": layout.clinic_id,
            "name": layout.name,
            "layout_data": layout.layout_data,
            "is_default": layout.is_default,
            "is_active": layout.is_active,
            "sort_index": layout.sort_index,
            "parent_layout_id": layout.parent_layout_id,
            "is_group": layout.is_group,
            "type": layout.type,
            "created_at": layout.created_at,
            "updated_at": layout.updated_at,
            "children": [serialize(child) for child in children]
        }
    roots = [
        layout for layout in layouts
        if layout.parent_layout_id is None or layout.parent_layout_id not in layout_map
    ]
    roots.sort(key=lambda item: (item.sort_index, item.id))
    return [serialize(layout) for layout in roots]

def reindex_siblings(db: Session, clinic_id: int, parent_id: Optional[int]) -> None:
    siblings = (
        db.query(ExamLayout)
        .filter(
            ExamLayout.clinic_id == clinic_id,
            ExamLayout.parent_layout_id == parent_id
        )
        .order_by(ExamLayout.sort_index.asc(), ExamLayout.id.asc())
        .all()
    )
    for index, layout in enumerate(siblings, start=1):
        layout.sort_index = index

@router.post("/", response_model=ExamLayoutSchema)
def create_exam_layout(
    layout: ExamLayoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    layout_data = layout.dict()
    target_clinic = normalize_clinic_id_for_company(db, current_user, layout_data.get('clinic_id'))
    layout_data['clinic_id'] = target_clinic
    parent_id = layout_data.get('parent_layout_id')
    parent_layout = None
    if parent_id is not None:
        parent_layout = (
            db.query(ExamLayout)
            .filter(ExamLayout.id == parent_id)
            .first()
        )
        if parent_layout is None or parent_layout.clinic_id != target_clinic:
            raise HTTPException(status_code=403, detail="Invalid parent layout")
        if not parent_layout.is_group:
            raise HTTPException(status_code=400, detail="Parent layout must be a group")
    if layout_data.get('sort_index') is None:
        parent_filter = ExamLayout.parent_layout_id == parent_id
        max_sort = (
            db.query(func.coalesce(func.max(ExamLayout.sort_index), 0))
            .filter(ExamLayout.clinic_id == target_clinic)
            .filter(parent_filter)
            .scalar()
        )
        layout_data['sort_index'] = max_sort + 1
    
    db_layout = ExamLayout(**layout_data)
    db.add(db_layout)
    db.commit()
    db.refresh(db_layout)
    return db_layout

@router.get("/{layout_id}", response_model=ExamLayoutSchema)
def get_exam_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    layout = db.query(ExamLayout).filter(ExamLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Exam layout not found")
    
    if current_user.role_level < 4 and layout.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied to this layout")
    
    return layout

@router.get("/", response_model=List[ExamLayoutSchema])
def get_all_exam_layouts(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    type: Optional[str] = Query(None, description="Filter by layout type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    company_id = resolve_company_id(db, current_user)
    query = db.query(ExamLayout).join(Clinic, Clinic.id == ExamLayout.clinic_id).filter(Clinic.company_id == company_id)
    if clinic_id is not None:
        assert_clinic_belongs_to_company(db, clinic_id, company_id)
        query = query.filter(ExamLayout.clinic_id == clinic_id)
    
    if type:
        query = query.filter(ExamLayout.type == type)
    layouts = (
        query.order_by(ExamLayout.sort_index.asc(), ExamLayout.id.asc()).all()
    )
    return build_layout_tree(layouts)

@router.get("/clinic/{clinic_id}", response_model=List[ExamLayoutSchema])
def get_exam_layouts_by_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    company_id = resolve_company_id(db, current_user)
    assert_clinic_belongs_to_company(db, clinic_id, company_id)
    
    layouts = (
        db.query(ExamLayout)
        .filter(ExamLayout.clinic_id == clinic_id)
        .order_by(ExamLayout.sort_index.asc(), ExamLayout.id.asc())
        .all()
    )
    return build_layout_tree(layouts)



@router.put("/{layout_id}", response_model=ExamLayoutSchema)
def update_exam_layout(
    layout_id: int,
    layout: ExamLayoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_layout = db.query(ExamLayout).filter(ExamLayout.id == layout_id).first()
    if not db_layout:
        raise HTTPException(status_code=404, detail="Exam layout not found")
    
    if current_user.role_level < 4 and db_layout.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot update layout for other clinics")
    
    payload = layout.dict(exclude_unset=True)
    old_parent_id = db_layout.parent_layout_id
    new_parent_id = payload.get("parent_layout_id", db_layout.parent_layout_id)
    if new_parent_id == db_layout.id:
        raise HTTPException(status_code=400, detail="Layout cannot be its own parent")
    if new_parent_id is not None:
        parent_layout = (
            db.query(ExamLayout)
            .filter(ExamLayout.id == new_parent_id)
            .first()
        )
        if parent_layout is None or parent_layout.clinic_id != db_layout.clinic_id:
            raise HTTPException(status_code=403, detail="Invalid parent layout")
        if not parent_layout.is_group:
            raise HTTPException(status_code=400, detail="Parent layout must be a group")
    if "is_group" in payload and not payload["is_group"]:
        has_children = (
            db.query(ExamLayout)
            .filter(ExamLayout.parent_layout_id == db_layout.id)
            .count()
        )
        if has_children:
            raise HTTPException(status_code=400, detail="Cannot unset group while children exist")
    for field, value in payload.items():
        if field in {"parent_layout_id", "sort_index"}:
            continue
        setattr(db_layout, field, value)
    if "parent_layout_id" in payload:
        db_layout.parent_layout_id = new_parent_id
        if "sort_index" not in payload:
            parent_filter = ExamLayout.parent_layout_id == new_parent_id
            max_sort = (
                db.query(func.coalesce(func.max(ExamLayout.sort_index), 0))
                .filter(ExamLayout.clinic_id == db_layout.clinic_id)
                .filter(parent_filter)
                .scalar()
            )
            db_layout.sort_index = max_sort + 1
    if "sort_index" in payload:
        db_layout.sort_index = payload["sort_index"]
    reindex_siblings(db, db_layout.clinic_id, old_parent_id)
    reindex_siblings(db, db_layout.clinic_id, db_layout.parent_layout_id)
    db.commit()
    db.refresh(db_layout)
    return db_layout

@router.post("/reorder", response_model=List[ExamLayoutSchema])
def reorder_exam_layouts(
    request: ExamLayoutReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not request.items:
        raise HTTPException(status_code=400, detail="No layouts to reorder")
    target_clinic = normalize_clinic_id_for_company(db, current_user, request.clinic_id)
    layout_ids = [item.id for item in request.items]
    layouts = (
        db.query(ExamLayout)
        .filter(ExamLayout.id.in_(layout_ids))
        .all()
    )
    if len(layouts) != len(layout_ids):
        raise HTTPException(status_code=404, detail="One or more layouts not found")
    layout_map = {layout.id: layout for layout in layouts}
    for layout in layouts:
        if layout.clinic_id != target_clinic:
            raise HTTPException(status_code=403, detail="Cannot modify layouts from other clinics")
    parent_ids = {item.parent_layout_id for item in request.items if item.parent_layout_id is not None}
    if parent_ids:
        parents = (
            db.query(ExamLayout)
            .filter(ExamLayout.id.in_(parent_ids))
            .all()
        )
        parent_map = {parent.id: parent for parent in parents}
        for parent_id in parent_ids:
            parent = parent_map.get(parent_id)
            if parent is None or parent.clinic_id != target_clinic:
                raise HTTPException(status_code=403, detail="Invalid parent layout")
            if not parent.is_group:
                raise HTTPException(status_code=400, detail="Parent layout must be a group")
    original_parents = {layout.id: layout.parent_layout_id for layout in layouts}
    affected_parents = set()
    for item in request.items:
        layout = layout_map[item.id]
        if item.parent_layout_id == layout.id:
            raise HTTPException(status_code=400, detail="Layout cannot be its own parent")
        affected_parents.add(original_parents.get(layout.id))
        affected_parents.add(item.parent_layout_id)
        layout.parent_layout_id = item.parent_layout_id
        layout.sort_index = item.sort_index
    db.flush()
    affected_parents.add(None)
    for parent_id in affected_parents:
        reindex_siblings(db, target_clinic, parent_id)
    db.commit()
    layouts = (
        db.query(ExamLayout)
        .filter(ExamLayout.clinic_id == target_clinic)
        .order_by(ExamLayout.sort_index.asc(), ExamLayout.id.asc())
        .all()
    )
    return build_layout_tree(layouts)

@router.post("/groups", response_model=ExamLayoutSchema)
def create_exam_layout_group(
    request: ExamLayoutGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required")
    if not request.layout_ids:
        raise HTTPException(status_code=400, detail="No layouts selected for grouping")
    target_clinic = normalize_clinic_id_for_company(db, current_user, request.clinic_id)
    layout_ids = list(dict.fromkeys(request.layout_ids))
    layouts = (
        db.query(ExamLayout)
        .filter(ExamLayout.id.in_(layout_ids))
        .all()
    )
    if len(layouts) != len(layout_ids):
        raise HTTPException(status_code=404, detail="One or more layouts not found")
    for layout in layouts:
        if layout.clinic_id != target_clinic:
            raise HTTPException(status_code=403, detail="Cannot group layouts from other clinics")
    max_root = (
        db.query(func.coalesce(func.max(ExamLayout.sort_index), 0))
        .filter(ExamLayout.clinic_id == target_clinic)
        .filter(ExamLayout.parent_layout_id.is_(None))
        .scalar()
    )
    new_group = ExamLayout(
        clinic_id=target_clinic,
        name=name,
        layout_data="{}",
        is_group=True,
        sort_index=max_root + 1,
        parent_layout_id=None
    )
    db.add(new_group)
    db.flush()
    for index, layout in enumerate(layouts, start=1):
        layout.parent_layout_id = new_group.id
        layout.sort_index = index
    reindex_siblings(db, target_clinic, None)
    reindex_siblings(db, target_clinic, new_group.id)
    db.commit()
    db.refresh(new_group)
    return new_group

@router.post("/bulk-delete", response_model=List[ExamLayoutSchema])
def bulk_delete_exam_layouts(
    request: ExamLayoutBulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not request.layout_ids:
        return []
    target_clinic = normalize_clinic_id_for_company(db, current_user, request.clinic_id)
    layout_ids = list(dict.fromkeys(request.layout_ids))
    layouts = (
        db.query(ExamLayout)
        .filter(ExamLayout.id.in_(layout_ids))
        .all()
    )
    if not layouts:
        return []
    for layout in layouts:
        if layout.clinic_id != target_clinic:
            raise HTTPException(status_code=403, detail="Cannot delete layouts from other clinics")
    processed_parents = set()
    for layout in layouts:
        old_parent_id = layout.parent_layout_id
        if layout.is_group:
            children = (
                db.query(ExamLayout)
                .filter(ExamLayout.parent_layout_id == layout.id)
                .order_by(ExamLayout.sort_index.asc(), ExamLayout.id.asc())
                .all()
            )
            if children:
                max_root = (
                    db.query(func.coalesce(func.max(ExamLayout.sort_index), 0))
                    .filter(ExamLayout.clinic_id == target_clinic)
                    .filter(ExamLayout.parent_layout_id.is_(None))
                    .scalar()
                )
                for index, child in enumerate(children, start=1):
                    child.parent_layout_id = None
                    child.sort_index = max_root + index
        db.delete(layout)
        processed_parents.add(old_parent_id)
    for parent_id in processed_parents:
        reindex_siblings(db, target_clinic, parent_id)
    reindex_siblings(db, target_clinic, None)
    db.commit()
    layouts = (
        db.query(ExamLayout)
        .filter(ExamLayout.clinic_id == target_clinic)
        .order_by(ExamLayout.sort_index.asc(), ExamLayout.id.asc())
        .all()
    )
    return build_layout_tree(layouts)
@router.delete("/{layout_id}")
def delete_exam_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    layout = db.query(ExamLayout).filter(ExamLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Exam layout not found")
    
    if current_user.role_level < 4 and layout.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot delete layout for other clinics")
    old_parent_id = layout.parent_layout_id
    clinic_id = layout.clinic_id
    if layout.is_group:
        children = (
            db.query(ExamLayout)
            .filter(ExamLayout.parent_layout_id == layout.id)
            .order_by(ExamLayout.sort_index.asc(), ExamLayout.id.asc())
            .all()
        )
        if children:
            max_root = (
                db.query(func.coalesce(func.max(ExamLayout.sort_index), 0))
                .filter(ExamLayout.clinic_id == clinic_id)
                .filter(ExamLayout.parent_layout_id.is_(None))
                .scalar()
            )
            for index, child in enumerate(children, start=1):
                child.parent_layout_id = None
                child.sort_index = max_root + index
    db.delete(layout)
    reindex_siblings(db, clinic_id, old_parent_id)
    reindex_siblings(db, clinic_id, None)
    db.commit()
    return {"message": "Exam layout deleted successfully"}

@router.get("/default")
def get_default_exam_layout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ExamLayout).filter(ExamLayout.is_default == True)
    
    if current_user.role_level < 4:
        query = query.filter(ExamLayout.clinic_id == current_user.clinic_id)
    
    layout = query.first()
    return layout

@router.get("/defaults", response_model=List[ExamLayoutSchema])
def get_default_exam_layouts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ExamLayout).filter(ExamLayout.is_default == True)
    
    if current_user.role_level < 4:
        query = query.filter(ExamLayout.clinic_id == current_user.clinic_id)
    
    layouts = query.all()
    return layouts

# Exam Layout Instances endpoints
@router.post("/instances")
def create_exam_layout_instance(
    instance_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam
    
    exam = db.query(OpticalExam).filter(OpticalExam.id == instance_data.get('exam_id')).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    if current_user.role_level < 4 and exam.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot create layout instance for exams in other clinics")
    
    instance = ExamLayoutInstance(**instance_data)
    db.add(instance)
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

@router.post("/instances/reorder")
def reorder_exam_layout_instances(
    request: ExamLayoutInstanceReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam

    if not request.items:
        return {"updated": 0}

    exam = db.query(OpticalExam).filter(OpticalExam.id == request.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if current_user.role_level < 4 and exam.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot reorder instances for exams in other clinics")

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
    if exam and current_user.role_level < 4 and exam.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied to this layout instance")
    
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
    
    if current_user.role_level < 4 and exam.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied to this exam's layout instances")
    
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
    
    if current_user.role_level < 4 and exam.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied to this exam's layout instances")
    
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
    current_user: User = Depends(get_current_user)
):
    from models import OpticalExam
    
    instance = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Exam layout instance not found")
    
    exam = db.query(OpticalExam).filter(OpticalExam.id == instance.exam_id).first()
    if exam and current_user.role_level < 4 and exam.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot update layout instance for exams in other clinics")
    
    for field, value in instance_data.items():
        if hasattr(instance, field):
            setattr(instance, field, value)
    
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
    
    instance = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Exam layout instance not found")
    
    exam = db.query(OpticalExam).filter(OpticalExam.id == instance.exam_id).first()
    if exam and current_user.role_level < 4 and exam.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot delete layout instance for exams in other clinics")
    
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
    
    exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    if current_user.role_level < 4 and exam.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot set active layout instance for exams in other clinics")
    
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