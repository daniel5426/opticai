from services.imported_client_history import clinical_exam_filter
from security.scope import record_filter
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy import func
from sqlalchemy import and_, or_
from typing import List, Optional
from database import get_db
from models import OpticalExam, User, Client, Clinic
from schemas import OpticalExam as OpticalExamSchema, OpticalExamCreate, ExamWorkspaceSave, ExamWorkspaceSaved
from auth import get_current_user
from .exam_layouts import build_layout_tree
from services.prism_axis_compatibility import normalize_prism_axis_exam_data
from utils.column_filters import lookup_filter, ColumnFilter, build_column_filter_conditions
from utils.table_search import build_all_terms_search_condition, search_blob, spaced_concat, split_search_terms
from security.scope import (
    apply_clinic_user_scope,
    assert_record_scope,
    get_record_clinic_ids,
    get_scoped_client,
)
from services.trash_service import move_to_trash

router = APIRouter(prefix="/exams", tags=["exams"])

def exam_list_query(db, current_user, clinic_id, search, test_name, type, order, filters=None):
    """Get paginated exams with user and client information in a single query"""
    base_query = db.query(
        OpticalExam,
        User.username.label('username'),
        User.full_name.label('full_name'),
        Client.first_name.label('client_first_name'),
        Client.last_name.label('client_last_name'),
        Clinic.name.label('clinic_name')
    ).outerjoin(User, OpticalExam.user_id == User.id).outerjoin(Client, OpticalExam.client_id == Client.id).outerjoin(Clinic, (Clinic.id == OpticalExam.clinic_id) & (Clinic.company_id == OpticalExam.company_id))

    allowed_clinic_ids = get_record_clinic_ids(db, current_user, clinic_id)
    base_query = base_query.filter(clinical_exam_filter()).filter(record_filter(db, current_user, OpticalExam, clinic_id))

    # Apply filters
    if type:
        base_query = base_query.filter(OpticalExam.type == type)
    if test_name and test_name != "all":
        base_query = base_query.filter(OpticalExam.test_name == test_name)

    # Client and examiner matches are looked up once per term by id instead of building the
    # joined text for every exam row; the client lookup uses the clients trigram index.
    term_conditions = []
    for term in split_search_terms(search):
        like = f"%{term.lower()}%"
        matching_clients = select(Client.id).where(
            func.lower(search_blob(Client.first_name, Client.last_name, Client.national_id, Client.phone_mobile, Client.email)).like(like)
        )
        matching_users = select(User.id).where(
            func.lower(search_blob(User.full_name, User.username, User.email, User.phone)).like(like)
        )
        term_conditions.append(or_(
            build_all_terms_search_condition(
                term,
                text_expressions=[search_blob(OpticalExam.test_name, Clinic.name, OpticalExam.clinic)],
                date_columns=[OpticalExam.exam_date],
            ),
            OpticalExam.client_id.in_(matching_clients),
            OpticalExam.user_id.in_(matching_users),
        ))
    if term_conditions:
        base_query = base_query.filter(and_(*term_conditions))
    base_query = base_query.filter(*build_column_filter_conditions(filters, {
        "exam_date": ColumnFilter(OpticalExam.exam_date, "date"),
        "test_name": ColumnFilter(OpticalExam.test_name, "options"),
        "client": ColumnFilter(spaced_concat(Client.first_name, Client.last_name)),
        "clinic": lookup_filter(OpticalExam.clinic_id, func.coalesce(Clinic.name, OpticalExam.clinic)),
        "examiner": lookup_filter(OpticalExam.user_id, func.coalesce(User.full_name, User.username)),
    }))

    # Count total before pagination

    order_columns = {
        "exam_date": OpticalExam.exam_date,
        "test_name": OpticalExam.test_name,
        "client": spaced_concat(Client.first_name, Client.last_name),
        "clinic": Clinic.name,
        "examiner": func.coalesce(User.full_name, User.username),
    }
    order_key, _, order_direction = (order or "exam_date_desc").rpartition("_")
    order_column = order_columns.get(order_key, OpticalExam.exam_date)
    if order_direction == "asc":
        base_query = base_query.order_by(order_column.asc().nulls_last(), OpticalExam.id.asc())
    else:
        base_query = base_query.order_by(order_column.desc().nulls_last(), OpticalExam.id.desc())

    # Pagination
    return base_query


@router.get("/enriched")
def get_enriched_exams(
    type: Optional[str] = Query(None, description="Filter by exam type"),
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(50, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("exam_date_desc", description="Sort order: exam_date_desc|exam_date_asc"),
    search: Optional[str] = Query(None, description="Search by client name, username, test name, or clinic"),
    test_name: Optional[str] = Query(None, description="Filter by exact test name"),
    filters: Optional[str] = Query(None, description="JSON column filters: exam_date|test_name|client|clinic|examiner"),
    include_total: bool = Query(True, description="Include the exact total count"),
    count_only: bool = Query(False, description="Return only the exact total count"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base_query = exam_list_query(db, current_user, clinic_id, search, test_name, type, order, filters)
    total = base_query.order_by(None).count() if include_total or count_only else None
    if count_only:
        return {"items": [], "total": total or 0, "has_more": False}
    rows = base_query.offset(offset).limit(limit + 1).all()

    items = []
    for exam, username, full_name, client_first_name, client_last_name, clinic_name in rows[:limit]:
        items.append({
            "id": exam.id,
            "client_id": exam.client_id,
            "clinic_id": exam.clinic_id,
            "clinic": exam.clinic,
            "clinic_name": clinic_name,
            "user_id": exam.user_id,
            "exam_date": exam.exam_date,
            "test_name": exam.test_name,
            "dominant_eye": exam.dominant_eye,
            "type": exam.type,
            "username": username or "",
            "full_name": full_name or "",
            "clientName": f"{client_first_name or ''} {client_last_name or ''}".strip()
        })

    return { "items": items, "total": total, "has_more": len(rows) > limit }

@router.get("/", response_model=List[OpticalExamSchema])
def get_exams(
    type: Optional[str] = Query(None, description="Filter by exam type"),
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all exams with optional filtering"""
    query = db.query(OpticalExam).filter(clinical_exam_filter())
    allowed_clinic_ids = get_record_clinic_ids(db, current_user, clinic_id)
    query = query.filter(record_filter(db, current_user, OpticalExam, clinic_id))
    
    # Apply filters
    if type:
        query = query.filter(OpticalExam.type == type)
    
    return query.all()

@router.post("/", response_model=OpticalExamSchema)
def create_exam(
    exam: OpticalExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new exam"""
    try:
        payload = apply_clinic_user_scope(db, current_user, exam.dict())
        db_exam = OpticalExam(**payload)
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

@router.post("/workspace", response_model=ExamWorkspaceSaved)
def create_exam_workspace(payload: ExamWorkspaceSave, request: Request,
                          idempotency_key: str = Header(...), db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    from services.exam_workspace import save_workspace
    return save_workspace(db, current_user, payload, request, creation_key=idempotency_key)


@router.patch("/{exam_id}/workspace", response_model=ExamWorkspaceSaved)
def update_exam_workspace(exam_id: int, payload: ExamWorkspaceSave, request: Request,
                          db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from services.exam_workspace import save_workspace
    return save_workspace(db, current_user, payload, request, exam_id=exam_id)


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
    
    assert_record_scope(db, current_user, exam)
    
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
    
    assert_record_scope(db, current_user, exam)
    
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
    exam = db.query(OpticalExam).filter(OpticalExam.id == exam_id).with_for_update(read=True).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    assert_record_scope(db, current_user, exam)
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
            "instance": {
                "id": inst.id,
                "layout_id": inst.layout_id,
                "is_active": inst.is_active,
                "order": inst.order,
                "layout_data": getattr(inst, 'layout_data', None),
            },
            "layout": layout_map.get(inst.layout_id),
            "exam_data": normalize_prism_axis_exam_data(inst.exam_data or {})
        })

    # Determine chosen active instance: prefer DB is_active; fallback to first by order
    active_instance = next((i for i in layout_instances if getattr(i, 'is_active', False)), None)
    if not active_instance and layout_instances_sorted:
        active_instance = layout_instances_sorted[0]
    active_layout = layout_map.get(active_instance.layout_id) if active_instance else None
    active_exam_data = active_instance.exam_data if active_instance and getattr(active_instance, 'exam_data', None) else {}
    # Gather available layouts (include clinic-specific and global where applicable)
    available_layouts_q = db.query(ExamLayout)
    available_layouts_q = available_layouts_q.filter(or_(ExamLayout.clinic_id == exam.clinic_id, ExamLayout.clinic_id == None))
    available_layouts = (
        available_layouts_q
        .order_by(ExamLayout.sort_index.asc(), ExamLayout.id.asc())
        .all()
    )
    available_layout_tree = build_layout_tree(available_layouts)

    # Trim payload to only fields used by the page
    from services.exam_workspace import save_token
    result = {
        "save_token": save_token(exam, layout_instances),
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
                "instance": ei["instance"],
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
        "available_layouts": available_layout_tree,
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
    from services.exam_workspace import lock_exam
    db_exam = lock_exam(db, current_user, exam_id)
    if not db_exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    assert_record_scope(db, current_user, db_exam)
    
    try:
        update_fields = exam_update.dict(exclude_unset=True)
        if update_fields:
            candidate = {
                "client_id": db_exam.client_id,
                "clinic_id": db_exam.clinic_id,
                "user_id": db_exam.user_id,
            }
            candidate.update({k: update_fields[k] for k in candidate.keys() & update_fields.keys()})
            scoped = apply_clinic_user_scope(db, current_user, candidate)
            for key in ("client_id", "clinic_id", "user_id"):
                if key in update_fields:
                    update_fields[key] = scoped[key]

        for field, value in update_fields.items():
            setattr(db_exam, field, value)
        
        # bump client_updated_date in the same transaction
        # bump client_updated_date
        try:
            if db_exam.client_id:
                client = db.query(Client).filter(Client.id == db_exam.client_id).first()
                if client:
                    client.client_updated_date = func.now()
                    db.commit()
        except Exception:
            pass
        db.commit()
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
    
    assert_record_scope(db, current_user, db_exam)
    
    item = move_to_trash(db, current_user, "exam", exam_id)
    return {"message": "Exam deleted successfully", "trash_item_id": item.id, "expires_at": item.expires_at, "side_effects": "backend"}

@router.get("/client/{client_id}", response_model=List[OpticalExamSchema])
def get_exams_by_client(
    client_id: int,
    clinic_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None, description="Filter by exam type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all exams for a specific client"""
    client_id = get_scoped_client(db, current_user, client_id).id
    query = db.query(OpticalExam, Clinic.name).outerjoin(Clinic, (Clinic.id == OpticalExam.clinic_id) & (Clinic.company_id == OpticalExam.company_id)).filter(clinical_exam_filter(), OpticalExam.client_id == client_id, record_filter(db, current_user, OpticalExam, clinic_id))
    
    # Apply filters
    if type:
        query = query.filter(OpticalExam.type == type)
    
    rows = query.order_by(OpticalExam.exam_date.desc().nulls_last(), OpticalExam.id.desc()).all()
    for exam, clinic_name in rows:
        exam.clinic_name = clinic_name
    return [exam for exam, _ in rows]
