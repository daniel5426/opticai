from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import ExamLayout, ExamLayoutInstance, Clinic
from schemas import ExamLayoutCreate, ExamLayoutUpdate, ExamLayout as ExamLayoutSchema

router = APIRouter(prefix="/exam-layouts", tags=["exam-layouts"])

@router.post("/", response_model=ExamLayoutSchema)
def create_exam_layout(layout: ExamLayoutCreate, db: Session = Depends(get_db)):
    db_layout = ExamLayout(**layout.dict())
    db.add(db_layout)
    db.commit()
    db.refresh(db_layout)
    return db_layout

@router.get("/{layout_id}", response_model=ExamLayoutSchema)
def get_exam_layout(layout_id: int, db: Session = Depends(get_db)):
    layout = db.query(ExamLayout).filter(ExamLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Exam layout not found")
    return layout

@router.get("/", response_model=List[ExamLayoutSchema])
def get_all_exam_layouts(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    type: Optional[str] = Query(None, description="Filter by layout type"),
    db: Session = Depends(get_db)
):
    query = db.query(ExamLayout)
    if clinic_id:
        query = query.filter(ExamLayout.clinic_id == clinic_id)
    if type:
        query = query.filter(ExamLayout.type == type)
    return query.all()

@router.get("/clinic/{clinic_id}", response_model=List[ExamLayoutSchema])
def get_exam_layouts_by_clinic(clinic_id: int, db: Session = Depends(get_db)):
    layouts = db.query(ExamLayout).filter(ExamLayout.clinic_id == clinic_id).all()
    return layouts

@router.get("/type/{type}", response_model=List[ExamLayoutSchema])
def get_exam_layouts_by_type(type: str, db: Session = Depends(get_db)):
    layouts = db.query(ExamLayout).filter(ExamLayout.type == type).all()
    return layouts

@router.put("/{layout_id}", response_model=ExamLayoutSchema)
def update_exam_layout(layout_id: int, layout: ExamLayoutUpdate, db: Session = Depends(get_db)):
    db_layout = db.query(ExamLayout).filter(ExamLayout.id == layout_id).first()
    if not db_layout:
        raise HTTPException(status_code=404, detail="Exam layout not found")
    
    for field, value in layout.dict(exclude_unset=True).items():
        setattr(db_layout, field, value)
    
    db.commit()
    db.refresh(db_layout)
    return db_layout

@router.delete("/{layout_id}")
def delete_exam_layout(layout_id: int, db: Session = Depends(get_db)):
    layout = db.query(ExamLayout).filter(ExamLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Exam layout not found")
    
    db.delete(layout)
    db.commit()
    return {"message": "Exam layout deleted successfully"}

@router.get("/default")
def get_default_exam_layout(db: Session = Depends(get_db)):
    layout = db.query(ExamLayout).filter(ExamLayout.is_default == True).first()
    return layout

@router.get("/defaults", response_model=List[ExamLayoutSchema])
def get_default_exam_layouts(db: Session = Depends(get_db)):
    layouts = db.query(ExamLayout).filter(ExamLayout.is_default == True).all()
    return layouts

# Exam Layout Instances endpoints
@router.post("/instances")
def create_exam_layout_instance(instance_data: dict, db: Session = Depends(get_db)):
    instance = ExamLayoutInstance(**instance_data)
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return {
        "id": instance.id,
        "exam_id": instance.exam_id,
        "layout_id": instance.layout_id,
        "is_active": instance.is_active,
        "order": instance.order,
        "created_at": instance.created_at,
        "updated_at": instance.updated_at
    }

@router.get("/instances/{instance_id}")
def get_exam_layout_instance(instance_id: int, db: Session = Depends(get_db)):
    instance = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Exam layout instance not found")
    
    return {
        "id": instance.id,
        "exam_id": instance.exam_id,
        "layout_id": instance.layout_id,
        "is_active": instance.is_active,
        "order": instance.order,
        "created_at": instance.created_at,
        "updated_at": instance.updated_at
    }

@router.get("/instances/exam/{exam_id}", response_model=List[dict])
def get_exam_layout_instances_by_exam(exam_id: int, db: Session = Depends(get_db)):
    instances = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.exam_id == exam_id).all()
    return [
        {
            "id": instance.id,
            "exam_id": instance.exam_id,
            "layout_id": instance.layout_id,
            "is_active": instance.is_active,
            "order": instance.order,
            "created_at": instance.created_at,
            "updated_at": instance.updated_at
        }
        for instance in instances
    ]

@router.get("/instances/exam/{exam_id}/active")
def get_active_exam_layout_instance_by_exam(exam_id: int, db: Session = Depends(get_db)):
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
        "is_active": instance.is_active,
        "order": instance.order,
        "created_at": instance.created_at,
        "updated_at": instance.updated_at
    }

@router.put("/instances/{instance_id}")
def update_exam_layout_instance(instance_id: int, instance_data: dict, db: Session = Depends(get_db)):
    instance = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Exam layout instance not found")
    
    for field, value in instance_data.items():
        if hasattr(instance, field):
            setattr(instance, field, value)
    
    db.commit()
    db.refresh(instance)
    
    return {
        "id": instance.id,
        "exam_id": instance.exam_id,
        "layout_id": instance.layout_id,
        "is_active": instance.is_active,
        "order": instance.order,
        "created_at": instance.created_at,
        "updated_at": instance.updated_at
    }

@router.delete("/instances/{instance_id}")
def delete_exam_layout_instance(instance_id: int, db: Session = Depends(get_db)):
    instance = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Exam layout instance not found")
    
    db.delete(instance)
    db.commit()
    return {"message": "Exam layout instance deleted successfully"}

@router.post("/instances/exam/{exam_id}/set-active/{instance_id}")
def set_active_exam_layout_instance(exam_id: int, instance_id: int, db: Session = Depends(get_db)):
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