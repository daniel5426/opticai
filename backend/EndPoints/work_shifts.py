from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import WorkShift, User, Clinic
from schemas import WorkShiftCreate, WorkShiftUpdate, WorkShift as WorkShiftSchema
from auth import get_current_user
from security.scope import get_scoped_user, resolve_company_id

router = APIRouter(prefix="/work-shifts", tags=["work-shifts"])

@router.post("/", response_model=WorkShiftSchema)
def create_work_shift(
    work_shift: WorkShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, work_shift.user_id)
    db_work_shift = WorkShift(**work_shift.dict())
    db.add(db_work_shift)
    db.commit()
    db.refresh(db_work_shift)
    return db_work_shift

@router.get("/{work_shift_id}", response_model=WorkShiftSchema)
def get_work_shift(
    work_shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    work_shift = db.query(WorkShift).filter(WorkShift.id == work_shift_id).first()
    if not work_shift:
        raise HTTPException(status_code=404, detail="Work shift not found")
    get_scoped_user(db, current_user, work_shift.user_id)
    return work_shift

@router.get("/", response_model=List[WorkShiftSchema])
def get_all_work_shifts(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(WorkShift)
    if user_id:
        get_scoped_user(db, current_user, user_id)
        query = query.filter(WorkShift.user_id == user_id)
    else:
        if (current_user.role_level or 1) >= 4:
            company_id = resolve_company_id(db, current_user)
            company_user_ids = [
                row[0]
                for row in (
                    db.query(User.id)
                    .outerjoin(Clinic, User.clinic_id == Clinic.id)
                    .filter((User.company_id == company_id) | (Clinic.company_id == company_id))
                    .all()
                )
            ]
            query = query.filter(WorkShift.user_id.in_(company_user_ids))
        elif (current_user.role_level or 1) < 3:
            query = query.filter(WorkShift.user_id == current_user.id)
        elif current_user.clinic_id:
            clinic_user_ids = [row[0] for row in db.query(User.id).filter(User.clinic_id == current_user.clinic_id).all()]
            query = query.filter(WorkShift.user_id.in_(clinic_user_ids))
    return query.all()

@router.get("/user/{user_id}", response_model=List[WorkShiftSchema])
def get_work_shifts_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
    work_shifts = db.query(WorkShift).filter(WorkShift.user_id == user_id).all()
    return work_shifts

@router.get("/user/{user_id}/active", response_model=Optional[WorkShiftSchema])
def get_active_work_shift_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
    work_shifts = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.date.like(f"{year:04d}-{month:02d}%")
    ).all()
    return work_shifts

@router.get("/user/{user_id}/date/{date}", response_model=List[WorkShiftSchema])
def get_work_shifts_by_user_and_date(
    user_id: int, 
    date: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
    work_shifts = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.date == date
    ).all()
    return work_shifts

@router.put("/{work_shift_id}", response_model=WorkShiftSchema)
def update_work_shift(
    work_shift_id: int,
    work_shift: WorkShiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_work_shift = db.query(WorkShift).filter(WorkShift.id == work_shift_id).first()
    if not db_work_shift:
        raise HTTPException(status_code=404, detail="Work shift not found")
    get_scoped_user(db, current_user, db_work_shift.user_id)
    if work_shift.user_id is not None:
        get_scoped_user(db, current_user, work_shift.user_id)
    
    for field, value in work_shift.dict(exclude_unset=True).items():
        setattr(db_work_shift, field, value)
    
    db.commit()
    db.refresh(db_work_shift)
    return db_work_shift

@router.delete("/{work_shift_id}")
def delete_work_shift(
    work_shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    work_shift = db.query(WorkShift).filter(WorkShift.id == work_shift_id).first()
    if not work_shift:
        raise HTTPException(status_code=404, detail="Work shift not found")
    get_scoped_user(db, current_user, work_shift.user_id)
    
    db.delete(work_shift)
    db.commit()
    return {"message": "Work shift deleted successfully"}

@router.get("/user/{user_id}/stats/{year}/{month}")
def get_work_shift_stats(
    user_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
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
