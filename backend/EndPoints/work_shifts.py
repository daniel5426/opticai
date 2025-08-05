from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import WorkShift, User
from schemas import WorkShiftCreate, WorkShiftUpdate, WorkShift as WorkShiftSchema
from datetime import datetime

router = APIRouter(prefix="/work-shifts", tags=["work-shifts"])

@router.post("/", response_model=WorkShiftSchema)
def create_work_shift(work_shift: WorkShiftCreate, db: Session = Depends(get_db)):
    db_work_shift = WorkShift(**work_shift.dict())
    db.add(db_work_shift)
    db.commit()
    db.refresh(db_work_shift)
    return db_work_shift

@router.get("/{work_shift_id}", response_model=WorkShiftSchema)
def get_work_shift(work_shift_id: int, db: Session = Depends(get_db)):
    work_shift = db.query(WorkShift).filter(WorkShift.id == work_shift_id).first()
    if not work_shift:
        raise HTTPException(status_code=404, detail="Work shift not found")
    return work_shift

@router.get("/", response_model=List[WorkShiftSchema])
def get_all_work_shifts(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    db: Session = Depends(get_db)
):
    query = db.query(WorkShift)
    if user_id:
        query = query.filter(WorkShift.user_id == user_id)
    return query.all()

@router.get("/user/{user_id}", response_model=List[WorkShiftSchema])
def get_work_shifts_by_user(user_id: int, db: Session = Depends(get_db)):
    work_shifts = db.query(WorkShift).filter(WorkShift.user_id == user_id).all()
    return work_shifts

@router.get("/user/{user_id}/active", response_model=Optional[WorkShiftSchema])
def get_active_work_shift_by_user(user_id: int, db: Session = Depends(get_db)):
    work_shift = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.status == "active"
    ).first()
    return work_shift

@router.get("/user/{user_id}/month/{year}/{month}", response_model=List[WorkShiftSchema])
def get_work_shifts_by_user_and_month(
    user_id: int, 
    year: int, 
    month: int, 
    db: Session = Depends(get_db)
):
    work_shifts = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.date.like(f"{year:04d}-{month:02d}%")
    ).all()
    return work_shifts

@router.get("/user/{user_id}/date/{date}", response_model=List[WorkShiftSchema])
def get_work_shifts_by_user_and_date(
    user_id: int, 
    date: str, 
    db: Session = Depends(get_db)
):
    work_shifts = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.date == date
    ).all()
    return work_shifts

@router.put("/{work_shift_id}", response_model=WorkShiftSchema)
def update_work_shift(work_shift_id: int, work_shift: WorkShiftUpdate, db: Session = Depends(get_db)):
    db_work_shift = db.query(WorkShift).filter(WorkShift.id == work_shift_id).first()
    if not db_work_shift:
        raise HTTPException(status_code=404, detail="Work shift not found")
    
    for field, value in work_shift.dict(exclude_unset=True).items():
        setattr(db_work_shift, field, value)
    
    db.commit()
    db.refresh(db_work_shift)
    return db_work_shift

@router.delete("/{work_shift_id}")
def delete_work_shift(work_shift_id: int, db: Session = Depends(get_db)):
    work_shift = db.query(WorkShift).filter(WorkShift.id == work_shift_id).first()
    if not work_shift:
        raise HTTPException(status_code=404, detail="Work shift not found")
    
    db.delete(work_shift)
    db.commit()
    return {"message": "Work shift deleted successfully"}

@router.get("/user/{user_id}/stats/{year}/{month}")
def get_work_shift_stats(user_id: int, year: int, month: int, db: Session = Depends(get_db)):
    work_shifts = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.date.like(f"{year:04d}-{month:02d}%")
    ).all()
    
    total_shifts = len(work_shifts)
    total_minutes = sum(shift.duration_minutes or 0 for shift in work_shifts)
    average_minutes = total_minutes / total_shifts if total_shifts > 0 else 0
    
    return {
        "total_shifts": total_shifts,
        "total_minutes": total_minutes,
        "average_minutes": average_minutes
    } 