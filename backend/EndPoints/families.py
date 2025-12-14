from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from database import get_db
from models import Family, Client
from schemas import FamilyCreate, FamilyUpdate, Family as FamilySchema

router = APIRouter(prefix="/families", tags=["families"])

@router.get("/paginated")
def get_families_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    company_id: Optional[int] = Query(None, description="Filter by company ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("created_desc", description="Sort order: created_desc|created_asc|name_asc|name_desc|id_desc|id_asc"),
    search: Optional[str] = Query(None, description="Search by family name"),
    db: Session = Depends(get_db)
):
    count_q = db.query(func.count(Family.id))
    
    # Filter by company_id if provided
    if company_id:
        count_q = count_q.filter(Family.company_id == company_id)
        
    # If clinic_id is provided, filter by it (AND logic)
    if clinic_id:
        count_q = count_q.filter(Family.clinic_id == clinic_id)
        
    if search:
        like = f"%{search.strip()}%"
        count_q = count_q.filter(Family.name.ilike(like))

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

    if company_id:
        base = base.filter(Family.company_id == company_id)

    if clinic_id:
        base = base.filter(Family.clinic_id == clinic_id)
        
    if search:
        like = f"%{search.strip()}%"
        base = base.filter(Family.name.ilike(like))

    base = base.group_by(Family.id, Family.clinic_id, Family.name, Family.created_date, Family.notes, Family.company_id)

    if order == "created_desc":
        base = base.order_by(Family.created_date.desc().nulls_last())
    elif order == "created_asc":
        base = base.order_by(Family.created_date.asc().nulls_last())
    elif order == "name_asc":
        base = base.order_by(Family.name.asc())
    elif order == "name_desc":
        base = base.order_by(Family.name.desc())
    elif order == "id_asc":
        base = base.order_by(Family.id.asc())
    else:
        base = base.order_by(Family.id.desc())

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
def create_family(family: FamilyCreate, db: Session = Depends(get_db)):
    db_family = Family(**family.dict())
    db.add(db_family)
    db.commit()
    db.refresh(db_family)
    return db_family

@router.get("/{family_id}", response_model=FamilySchema)
def get_family(family_id: int, db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    return family

@router.get("/", response_model=List[FamilySchema])
def get_all_families(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    company_id: Optional[int] = Query(None, description="Filter by company ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Family)
    if company_id:
        query = query.filter(Family.company_id == company_id)
    if clinic_id:
        query = query.filter(Family.clinic_id == clinic_id)
    return query.all()

@router.put("/{family_id}", response_model=FamilySchema)
def update_family(family_id: int, family: FamilyUpdate, db: Session = Depends(get_db)):
    db_family = db.query(Family).filter(Family.id == family_id).first()
    if not db_family:
        raise HTTPException(status_code=404, detail="Family not found")
    
    for field, value in family.dict(exclude_unset=True).items():
        setattr(db_family, field, value)
    
    db.commit()
    db.refresh(db_family)
    return db_family

@router.delete("/{family_id}")
def delete_family(family_id: int, db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    
    db.delete(family)
    db.commit()
    return {"message": "Family deleted successfully"}

@router.get("/{family_id}/members", response_model=List[dict])
def get_family_members(family_id: int, db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    
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
    db: Session = Depends(get_db)
):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client.family_id = family_id
    client.family_role = role
    db.commit()
    
    return {"message": "Client added to family successfully"}

@router.delete("/{family_id}/remove-client/{client_id}")
def remove_client_from_family(family_id: int, client_id: int, db: Session = Depends(get_db)):
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