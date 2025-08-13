from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import ContactLens, Client, User
from sqlalchemy import func
from schemas import ContactLensCreate, ContactLensUpdate, ContactLens as ContactLensSchema

router = APIRouter(prefix="/contact-lenses", tags=["contact-lenses"])

@router.post("/", response_model=ContactLensSchema)
def create_contact_lens(contact_lens: ContactLensCreate, db: Session = Depends(get_db)):
    db_contact_lens = ContactLens(**contact_lens.dict())
    db.add(db_contact_lens)
    db.commit()
    db.refresh(db_contact_lens)
    # bump client_updated_date
    try:
        if db_contact_lens.client_id:
            client = db.query(Client).filter(Client.id == db_contact_lens.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return db_contact_lens

@router.get("/{contact_lens_id}", response_model=ContactLensSchema)
def get_contact_lens(contact_lens_id: int, db: Session = Depends(get_db)):
    contact_lens = db.query(ContactLens).filter(ContactLens.id == contact_lens_id).first()
    if not contact_lens:
        raise HTTPException(status_code=404, detail="Contact lens not found")
    return contact_lens

@router.get("/", response_model=List[ContactLensSchema])
def get_all_contact_lenses(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(ContactLens)
    if clinic_id:
        query = query.filter(ContactLens.clinic_id == clinic_id)
    return query.all()

@router.get("/client/{client_id}", response_model=List[ContactLensSchema])
def get_contact_lenses_by_client(client_id: int, db: Session = Depends(get_db)):
    contact_lenses = db.query(ContactLens).filter(ContactLens.client_id == client_id).all()
    return contact_lenses

@router.put("/{contact_lens_id}", response_model=ContactLensSchema)
def update_contact_lens(contact_lens_id: int, contact_lens: ContactLensUpdate, db: Session = Depends(get_db)):
    db_contact_lens = db.query(ContactLens).filter(ContactLens.id == contact_lens_id).first()
    if not db_contact_lens:
        raise HTTPException(status_code=404, detail="Contact lens not found")
    
    for field, value in contact_lens.dict(exclude_unset=True).items():
        setattr(db_contact_lens, field, value)
    
    db.commit()
    # bump client_updated_date
    try:
        if db_contact_lens.client_id:
            client = db.query(Client).filter(Client.id == db_contact_lens.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    db.refresh(db_contact_lens)
    return db_contact_lens

@router.delete("/{contact_lens_id}")
def delete_contact_lens(contact_lens_id: int, db: Session = Depends(get_db)):
    contact_lens = db.query(ContactLens).filter(ContactLens.id == contact_lens_id).first()
    if not contact_lens:
        raise HTTPException(status_code=404, detail="Contact lens not found")
    
    client_id = contact_lens.client_id
    db.delete(contact_lens)
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
    return {"message": "Contact lens deleted successfully"} 