from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from database import get_db
from models import OpticalExam, User, Client
from schemas import OpticalExam as OpticalExamSchema, OpticalExamCreate
from auth import get_current_user

router = APIRouter(prefix="/exams", tags=["exams"])

@router.get("/enriched", response_model=List[dict])
def get_enriched_exams(
    type: Optional[str] = Query(None, description="Filter by exam type"),
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all exams with user and client information in a single query"""
    query = db.query(
        OpticalExam,
        User.username.label('username'),
        Client.first_name.label('client_first_name'),
        Client.last_name.label('client_last_name')
    ).outerjoin(User, OpticalExam.user_id == User.id).outerjoin(Client, OpticalExam.client_id == Client.id)
    
    # Apply filters
    if type:
        query = query.filter(OpticalExam.type == type)
    if clinic_id:
        query = query.filter(OpticalExam.clinic_id == clinic_id)
    
    # Apply role-based access control
    if current_user.role == "company_ceo":
        # CEO can see all exams
        pass
    elif current_user.role == "clinic_manager":
        # Clinic manager can see exams in their clinic
        query = query.filter(OpticalExam.clinic_id == current_user.clinic_id)
    else:
        # Other users can only see exams in their clinic
        query = query.filter(OpticalExam.clinic_id == current_user.clinic_id)
    
    results = query.all()
    
    # Transform results to include enriched data
    enriched_exams = []
    for exam, username, client_first_name, client_last_name in results:
        exam_dict = {
            "id": exam.id,
            "client_id": exam.client_id,
            "clinic_id": exam.clinic_id,
            "clinic": exam.clinic,
            "user_id": exam.user_id,
            "exam_date": exam.exam_date,
            "test_name": exam.test_name,
            "dominant_eye": exam.dominant_eye,
            "type": exam.type,
            "username": username or "",
            "clientName": f"{client_first_name or ''} {client_last_name or ''}".strip()
        }
        enriched_exams.append(exam_dict)
    
    return enriched_exams

@router.get("/", response_model=List[OpticalExamSchema])
def get_exams(
    type: Optional[str] = Query(None, description="Filter by exam type"),
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all exams with optional filtering"""
    query = db.query(OpticalExam)
    
    # Apply filters
    if type:
        query = query.filter(OpticalExam.type == type)
    if clinic_id:
        query = query.filter(OpticalExam.clinic_id == clinic_id)
    
    # Apply role-based access control
    if current_user.role == "company_ceo":
        # CEO can see all exams
        pass
    elif current_user.role == "clinic_manager":
        # Clinic manager can see exams in their clinic
        query = query.filter(OpticalExam.clinic_id == current_user.clinic_id)
    else:
        # Other users can only see exams in their clinic
        query = query.filter(OpticalExam.clinic_id == current_user.clinic_id)
    
    return query.all()

@router.post("/", response_model=OpticalExamSchema)
def create_exam(
    exam: OpticalExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new exam"""
    try:
        # Set clinic_id if not provided
        if not exam.clinic_id:
            exam.clinic_id = current_user.clinic_id
        
        # Set user_id if not provided
        if not exam.user_id:
            exam.user_id = current_user.id
        
        # Apply role-based access control
        if current_user.role == "company_ceo":
            # CEO can create exams in any clinic
            pass
        elif current_user.role == "clinic_manager":
            # Clinic manager can only create exams in their clinic
            if exam.clinic_id != current_user.clinic_id:
                raise HTTPException(status_code=403, detail="Can only create exams in your clinic")
        else:
            # Other users can only create exams in their clinic
            if exam.clinic_id != current_user.clinic_id:
                raise HTTPException(status_code=403, detail="Can only create exams in your clinic")
        
        db_exam = OpticalExam(**exam.dict())
        db.add(db_exam)
        db.commit()
        db.refresh(db_exam)
        return db_exam
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=f"Error creating exam: {str(e)}")

@router.get("/{exam_id}", response_model=OpticalExamSchema)
def get_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific exam by ID"""
    exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    if current_user.role == "company_ceo":
        # CEO can see any exam
        pass
    elif current_user.role == "clinic_manager":
        # Clinic manager can only see exams in their clinic
        if exam.clinic_id != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        # Other users can only see exams in their clinic
        if exam.clinic_id != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return exam

@router.put("/{exam_id}", response_model=OpticalExamSchema)
def update_exam(
    exam_id: int,
    exam_update: OpticalExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing exam"""
    db_exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not db_exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    if current_user.role == "company_ceo":
        # CEO can update any exam
        pass
    elif current_user.role == "clinic_manager":
        # Clinic manager can only update exams in their clinic
        if db_exam.clinic_id != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        # Other users can only update exams in their clinic
        if db_exam.clinic_id != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        for field, value in exam_update.dict(exclude_unset=True).items():
            setattr(db_exam, field, value)
        
        db.commit()
        db.refresh(db_exam)
        return db_exam
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=f"Error updating exam: {str(e)}")

@router.delete("/{exam_id}")
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an exam"""
    db_exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not db_exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    if current_user.role == "company_ceo":
        # CEO can delete any exam
        pass
    elif current_user.role == "clinic_manager":
        # Clinic manager can only delete exams in their clinic
        if db_exam.clinic_id != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        # Other users can only delete exams in their clinic
        if db_exam.clinic_id != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        db.delete(db_exam)
        db.commit()
        return {"message": "Exam deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=f"Error deleting exam: {str(e)}")

@router.get("/client/{client_id}", response_model=List[OpticalExamSchema])
def get_exams_by_client(
    client_id: int,
    type: Optional[str] = Query(None, description="Filter by exam type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all exams for a specific client"""
    query = db.query(OpticalExam).filter(OpticalExam.client_id == client_id)
    
    # Apply filters
    if type:
        query = query.filter(OpticalExam.type == type)
    
    # Apply role-based access control
    if current_user.role == "company_ceo":
        # CEO can see all exams
        pass
    elif current_user.role == "clinic_manager":
        # Clinic manager can see exams in their clinic
        query = query.filter(OpticalExam.clinic_id == current_user.clinic_id)
    else:
        # Other users can only see exams in their clinic
        query = query.filter(OpticalExam.clinic_id == current_user.clinic_id)
    
    return query.all() 