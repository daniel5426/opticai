from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from database import get_db
from models import Family, Client
from schemas import FamilyCreate, FamilyUpdate, Family as FamilySchema, FamilyWithMembers
from auth import get_current_user
from models import User
from utils.table_search import build_all_terms_search_condition, search_blob
from security.scope import (
    get_allowed_clinic_ids,
    get_scoped_client,
    get_scoped_family,
    normalize_clinic_id_for_company,
    resolve_company_id,
)

router = APIRouter(prefix="/families", tags=["families"])

@router.get("/paginated")
def get_families_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    company_id: Optional[int] = Query(None, description="Filter by company ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("created_desc", description="Sort order: created_desc|created_asc|name_asc|name_desc|id_desc|id_asc"),
    search: Optional[str] = Query(None, description="Search by family name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    effective_company_id = resolve_company_id(db, current_user)
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)

    count_q = db.query(func.count(Family.id))
    
    if effective_company_id is not None:
        count_q = count_q.filter(Family.company_id == effective_company_id)
        
    count_q = count_q.filter(Family.clinic_id.in_(allowed_clinic_ids))
        
    search_condition = build_all_terms_search_condition(
        search,
        text_expressions=[search_blob(Family.name)],
        date_columns=[Family.created_date],
    )
    if search_condition is not None:
        count_q = count_q.filter(search_condition)

    total = count_q.scalar() or 0

    base = db.query(
        Family.id,
        Family.clinic_id,
        Family.name,
        Family.created_date,
        Family.notes,
        func.count(Client.id).label('member_count'),
        Family.company_id
    ).outerjoin(Client, Client.family_id == Family.id)

    if effective_company_id is not None:
        base = base.filter(Family.company_id == effective_company_id)

    base = base.filter(Family.clinic_id.in_(allowed_clinic_ids))
        
    if search_condition is not None:
        base = base.filter(search_condition)

    base = base.group_by(Family.id, Family.clinic_id, Family.name, Family.created_date, Family.notes, Family.company_id)

    member_count = func.count(Client.id)
    order_columns = {
        "created": Family.created_date,
        "created_date": Family.created_date,
        "name": Family.name,
        "member_count": member_count,
        "id": Family.id,
    }
    order_key, _, order_direction = (order or "id_desc").rpartition("_")
    order_column = order_columns.get(order_key, Family.id)
    if order_direction == "asc":
        base = base.order_by(order_column.asc().nulls_last(), Family.id.asc())
    else:
        base = base.order_by(order_column.desc().nulls_last(), Family.id.desc())

    rows = base.offset(offset).limit(limit).all()
    family_ids = [r[0] for r in rows]

    clients_by_family: dict[int, list] = {}
    if family_ids:
        members = (
            db.query(Client)
            .filter(Client.family_id.in_(family_ids))
            .all()
        )
        for m in members:
            if m.family_id is None:
                continue
            clients_by_family.setdefault(m.family_id, []).append({
                "id": m.id,
                "first_name": m.first_name,
                "last_name": m.last_name,
                "family_id": m.family_id,
                "family_role": m.family_role,
                "national_id": m.national_id,
                "phone_mobile": m.phone_mobile,
                "email": m.email,
            })

    items = []
    for r in rows:
        fid = r[0]
        clients = clients_by_family.get(fid, [])
        items.append({
            "id": fid,
            "clinic_id": r[1],
            "name": r[2],
            "created_date": r[3],
            "notes": r[4],
            "member_count": len(clients),
            "clients": clients,
            "company_id": r[6],
        })

    return {"items": items, "total": total}

@router.post("/", response_model=FamilySchema)
def create_family(
    family: FamilyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = family.dict()
    payload["company_id"] = resolve_company_id(db, current_user)
    payload["clinic_id"] = normalize_clinic_id_for_company(db, current_user, payload.get("clinic_id"))
    db_family = Family(**payload)
    db.add(db_family)
    db.commit()
    db.refresh(db_family)
    return db_family

@router.get("/{family_id}", response_model=FamilySchema)
def get_family(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_scoped_family(db, current_user, family_id)

@router.get("/", response_model=List[FamilyWithMembers])
def get_all_families(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    company_id: Optional[int] = Query(None, description="Filter by company ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    effective_company_id = resolve_company_id(db, current_user)
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    query = db.query(Family).filter(Family.company_id == effective_company_id).filter(Family.clinic_id.in_(allowed_clinic_ids))
    families = query.all()
    family_ids = [family.id for family in families]

    clients_by_family: dict[int, list] = {}
    if family_ids:
        members = (
            db.query(
                Client.id,
                Client.first_name,
                Client.last_name,
                Client.family_id,
                Client.family_role,
                Client.national_id,
                Client.phone_mobile,
                Client.email,
            )
            .filter(Client.family_id.in_(family_ids))
            .all()
        )
        for member in members:
            if member.family_id is None:
                continue
            clients_by_family.setdefault(member.family_id, []).append({
                "id": member.id,
                "first_name": member.first_name,
                "last_name": member.last_name,
                "family_id": member.family_id,
                "family_role": member.family_role,
                "national_id": member.national_id,
                "phone_mobile": member.phone_mobile,
                "email": member.email,
            })

    return [
        {
            "id": family.id,
            "clinic_id": family.clinic_id,
            "company_id": family.company_id,
            "name": family.name,
            "created_date": family.created_date,
            "notes": family.notes,
            "member_count": len(clients_by_family.get(family.id, [])),
            "clients": clients_by_family.get(family.id, []),
        }
        for family in families
    ]

@router.put("/{family_id}", response_model=FamilySchema)
def update_family(
    family_id: int,
    family: FamilyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_family = get_scoped_family(db, current_user, family_id)
    update_fields = family.dict(exclude_unset=True)
    update_fields.pop("company_id", None)
    if "clinic_id" in update_fields:
        update_fields["clinic_id"] = normalize_clinic_id_for_company(db, current_user, update_fields["clinic_id"])
    for field, value in update_fields.items():
        setattr(db_family, field, value)
    
    db.commit()
    db.refresh(db_family)
    return db_family

@router.delete("/{family_id}")
def delete_family(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    family = get_scoped_family(db, current_user, family_id)
    db.delete(family)
    db.commit()
    return {"message": "Family deleted successfully"}

@router.get("/{family_id}/members", response_model=List[dict])
def get_family_members(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_family(db, current_user, family_id)
    
    members = db.query(Client).filter(Client.family_id == family_id).all()
    return [
        {
            "id": member.id,
            "first_name": member.first_name,
            "last_name": member.last_name,
            "family_id": member.family_id,
            "family_role": member.family_role,
            "national_id": member.national_id,
            "phone_mobile": member.phone_mobile,
            "email": member.email,
        }
        for member in members
    ]

@router.post("/{family_id}/add-client")
def add_client_to_family(
    family_id: int, 
    client_id: int, 
    role: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    family = get_scoped_family(db, current_user, family_id)
    client = get_scoped_client(db, current_user, client_id)
    if client.clinic_id != family.clinic_id:
        raise HTTPException(status_code=403, detail="Client does not belong to family clinic")
    
    client.family_id = family_id
    client.family_role = role
    db.commit()
    
    return {"message": "Client added to family successfully"}

@router.delete("/{family_id}/remove-client/{client_id}")
def remove_client_from_family(
    family_id: int,
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_family(db, current_user, family_id)
    get_scoped_client(db, current_user, client_id)
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.family_id == family_id
    ).first()
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found in family")
    
    client.family_id = None
    client.family_role = None
    db.commit()
    
    return {"message": "Client removed from family successfully"}
