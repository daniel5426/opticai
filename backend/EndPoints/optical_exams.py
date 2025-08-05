from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import OpticalExam, Client, User
from schemas import OpticalExamCreate, OpticalExamUpdate, OpticalExam as OpticalExamSchema

router = APIRouter(prefix="/optical-exams", tags=["optical-exams"])

@router.post("/", response_model=OpticalExamSchema)
def create_optical_exam(exam: OpticalExamCreate, db: Session = Depends(get_db)):
    db_exam = OpticalExam(**exam.dict())
    db.add(db_exam)
    db.commit()
    db.refresh(db_exam)
    return db_exam

@router.get("/{exam_id}", response_model=OpticalExamSchema)
def get_optical_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Optical exam not found")
    return exam

@router.get("/", response_model=List[OpticalExamSchema])
def get_all_optical_exams(
    type: Optional[str] = Query(None, description="Filter by exam type"),
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(OpticalExam)
    if type:
        query = query.filter(OpticalExam.type == type)
    if clinic_id:
        query = query.filter(OpticalExam.clinic_id == clinic_id)
    return query.all()

@router.get("/client/{client_id}", response_model=List[OpticalExamSchema])
def get_optical_exams_by_client(
    client_id: int, 
    type: Optional[str] = Query(None, description="Filter by exam type"),
    db: Session = Depends(get_db)
):
    query = db.query(OpticalExam).filter(OpticalExam.client_id == client_id)
    if type:
        query = query.filter(OpticalExam.type == type)
    return query.all()

@router.put("/{exam_id}", response_model=OpticalExamSchema)
def update_optical_exam(exam_id: int, exam: OpticalExamUpdate, db: Session = Depends(get_db)):
    db_exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not db_exam:
        raise HTTPException(status_code=404, detail="Optical exam not found")
    
    for field, value in exam.dict(exclude_unset=True).items():
        setattr(db_exam, field, value)
    
    db.commit()
    db.refresh(db_exam)
    return db_exam

@router.delete("/{exam_id}")
def delete_optical_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Optical exam not found")
    
    db.delete(exam)
    db.commit()
    return {"message": "Optical exam deleted successfully"} 