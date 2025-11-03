from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import ExamLayout, ExamLayoutInstance, Clinic, User
from schemas import ExamLayoutCreate, ExamLayoutUpdate, ExamLayout as ExamLayoutSchema
from auth import get_current_user

router = APIRouter(prefix="/exam-layouts", tags=["exam-layouts"])

@router.post("/", response_model=ExamLayoutSchema)
def create_exam_layout(
    layout: ExamLayoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    layout_data = layout.dict()

    if layout_data.get('clinic_id') is None and current_user.clinic_id is not None:
        layout_data['clinic_id'] = current_user.clinic_id
    
    if current_user.role_level < 4 and layout_data.get('clinic_id') != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot create layout for other clinics")
    
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
    query = db.query(ExamLayout)
    
    if current_user.role_level >= 4:
        if clinic_id:
            query = query.filter(ExamLayout.clinic_id == clinic_id)
    else:
        query = query.filter(ExamLayout.clinic_id == current_user.clinic_id)
    
    if type:
        query = query.filter(ExamLayout.type == type)
    return query.all()

@router.get("/clinic/{clinic_id}", response_model=List[ExamLayoutSchema])
def get_exam_layouts_by_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_level < 4 and current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied to this clinic's layouts")
    
    layouts = db.query(ExamLayout).filter(ExamLayout.clinic_id == clinic_id).all()
    return layouts



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
    
    for field, value in layout.dict(exclude_unset=True).items():
        setattr(db_layout, field, value)
    
    db.commit()
    db.refresh(db_layout)
    return db_layout

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
    
    db.delete(layout)
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