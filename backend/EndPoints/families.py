from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Family, Client
from schemas import FamilyCreate, FamilyUpdate, Family as FamilySchema

router = APIRouter(prefix="/families", tags=["families"])

@router.get("/paginated")
def get_families_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("created_desc", description="Sort order: created_desc|created_asc|name_asc|name_desc|id_desc|id_asc"),
    db: Session = Depends(get_db)
):
    base = db.query(Family)
    if clinic_id:
        base = base.filter(Family.clinic_id == clinic_id)
    
    # Apply ordering
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
    else:  # default to id_desc
        base = base.order_by(Family.id.desc())
    
    total = base.count()
    items = base.offset(offset).limit(limit).all()
    
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
    db: Session = Depends(get_db)
):
    query = db.query(Family)
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
            "family_role": member.family_role
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