from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy import or_
from sqlalchemy import func
from typing import List, Optional
from database import get_db
from models import OpticalExam, User, Client
from schemas import OpticalExam as OpticalExamSchema, OpticalExamCreate
from auth import get_current_user

router = APIRouter(prefix="/exams", tags=["exams"])

@router.get("/enriched")
def get_enriched_exams(
    type: Optional[str] = Query(None, description="Filter by exam type"),
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(50, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("exam_date_desc", description="Sort order: exam_date_desc|exam_date_asc"),
    search: Optional[str] = Query(None, description="Search by client name, username, test name, or clinic"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get paginated exams with user and client information in a single query"""
    base_query = db.query(
        OpticalExam,
        User.username.label('username'),
        Client.first_name.label('client_first_name'),
        Client.last_name.label('client_last_name')
    ).outerjoin(User, OpticalExam.user_id == User.id).outerjoin(Client, OpticalExam.client_id == Client.id)

    # Apply filters
    if type:
        base_query = base_query.filter(OpticalExam.type == type)
    if clinic_id:
        base_query = base_query.filter(OpticalExam.clinic_id == clinic_id)

    # Apply role-based access control
    if current_user.role == "company_ceo":
        pass
    else:
        base_query = base_query.filter(OpticalExam.clinic_id == current_user.clinic_id)

    # Apply search
    if search:
        like = f"%{search.strip()}%"
        base_query = base_query.filter(
            or_(
                func.concat(Client.first_name, ' ', Client.last_name).ilike(like),
                User.username.ilike(like),
                User.full_name.ilike(like),
                OpticalExam.test_name.ilike(like),
                OpticalExam.clinic.ilike(like),
            )
        )

    # Count total before pagination
    total = base_query.count()

    # Ordering
    if order == "exam_date_asc":
        base_query = base_query.order_by(OpticalExam.exam_date.asc(), OpticalExam.id.asc())
    else:
        base_query = base_query.order_by(OpticalExam.exam_date.desc(), OpticalExam.id.desc())

    # Pagination
    rows = base_query.offset(offset).limit(limit).all()

    items = []
    for exam, username, client_first_name, client_last_name in rows:
        items.append({
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
        })

    return { "items": items, "total": total }

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
        # bump client_updated_date
        try:
            if db_exam.client_id:
                client = db.query(Client).filter(Client.id == db_exam.client_id).first()
                if client:
                    client.client_updated_date = func.now()
                    db.commit()
        except Exception:
            pass
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

@router.get("/{exam_id}/with-layouts")
def get_exam_with_layouts(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get exam with all its layout instances and layouts in a single call"""
    from models import ExamLayoutInstance, ExamLayout
    
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
    
    # Get all layout instances for this exam
    layout_instances = db.query(ExamLayoutInstance).filter(
        ExamLayoutInstance.exam_id == exam_id
    ).all()
    
    # Get all unique layout IDs
    layout_ids = list(set([instance.layout_id for instance in layout_instances]))
    
    # Get all layouts in one query
    layouts = []
    if layout_ids:
        layouts = db.query(ExamLayout).filter(ExamLayout.id.in_(layout_ids)).all()
    
    layout_map = {layout.id: layout for layout in layouts}
    
    # Build the response
    result = {
        "exam": exam,
        "layout_instances": layout_instances,
        "layouts": layouts,
        "layout_map": {str(k): v for k, v in layout_map.items()}
    }
    
    return result

@router.get("/{exam_id}/page-data")
def get_exam_page_data(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import ExamLayoutInstance, ExamLayout
    exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if current_user.role == "company_ceo":
        pass
    elif current_user.role == "clinic_manager":
        if exam.clinic_id != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if exam.clinic_id != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    # One roundtrip: fetch instances joined with layouts
    pairs = (
        db.query(ExamLayoutInstance, ExamLayout)
        .outerjoin(ExamLayout, ExamLayout.id == ExamLayoutInstance.layout_id)
        .filter(ExamLayoutInstance.exam_id == exam_id)
        .all()
    )
    layout_instances = [p[0] for p in pairs]
    layout_map = {p[0].layout_id: p[1] for p in pairs if p[1] is not None}
    # Build enriched instances with layout and exam_data
    # Sort deterministically: by 'order' ascending, then by id
    def sort_key(i):
        try:
            return (int(i.order or 0), int(i.id or 0))
        except Exception:
            return (0, 0)
    layout_instances_sorted = sorted(layout_instances, key=sort_key)

    enriched_instances = []
    for inst in layout_instances_sorted:
        enriched_instances.append({
            "instance": inst,
            "layout": layout_map.get(inst.layout_id),
            "exam_data": inst.exam_data or {}
        })

    # Determine chosen active instance: prefer DB is_active; fallback to first by order
    active_instance = next((i for i in layout_instances if getattr(i, 'is_active', False)), None)
    if not active_instance and layout_instances_sorted:
        active_instance = layout_instances_sorted[0]
    active_layout = layout_map.get(active_instance.layout_id) if active_instance else None
    active_exam_data = active_instance.exam_data if active_instance and getattr(active_instance, 'exam_data', None) else {}
    # Gather available layouts (include clinic-specific and global where applicable)
    available_layouts_q = db.query(ExamLayout)
    if exam.clinic_id is not None:
        available_layouts_q = available_layouts_q.filter(or_(ExamLayout.clinic_id == exam.clinic_id, ExamLayout.clinic_id == None))
    available_layouts = available_layouts_q.all()

    # Trim payload to only fields used by the page
    result = {
        "exam": {
            "id": exam.id,
            "client_id": exam.client_id,
            "clinic_id": exam.clinic_id,
            "user_id": exam.user_id,
            "exam_date": exam.exam_date,
            "test_name": exam.test_name,
            "dominant_eye": exam.dominant_eye,
            "type": exam.type,
        },
        "instances": [
            {
                "instance": {
                    "id": ei["instance"].id,
                    "layout_id": ei["instance"].layout_id,
                    "is_active": ei["instance"].is_active,
                    "order": ei["instance"].order,
                },
                "layout": {
                    "id": ei["layout"].id if ei["layout"] else None,
                    "name": ei["layout"].name if ei["layout"] else None,
                    "layout_data": ei["layout"].layout_data if ei["layout"] else None,
                },
                "exam_data": ei["exam_data"],
            }
            for ei in enriched_instances
        ],
        "chosen_active_instance_id": getattr(active_instance, 'id', None),
        "available_layouts": [
            {
                "id": l.id,
                "name": l.name,
                "layout_data": l.layout_data
            } for l in available_layouts
        ],
    }
    return result

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
        # bump client_updated_date
        try:
            if db_exam.client_id:
                client = db.query(Client).filter(Client.id == db_exam.client_id).first()
                if client:
                    client.client_updated_date = func.now()
                    db.commit()
        except Exception:
            pass
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
        client_id = db_exam.client_id
        db.delete(db_exam)
        db.commit()
        # bump client_updated_date
        try:
            if client_id:
                client = db.query(Client).filter(Client.id == client_id).first()
                if client:
                    client.client_updated_date = func.now()
                    db.commit()
        except Exception:
            pass
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