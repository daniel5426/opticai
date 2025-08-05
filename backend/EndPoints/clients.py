from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Client, Family
from schemas import ClientCreate, ClientUpdate, Client as ClientSchema
from sqlalchemy import and_

router = APIRouter(prefix="/clients", tags=["clients"])

@router.post("/", response_model=ClientSchema)
def create_client(client: ClientCreate, db: Session = Depends(get_db)):
    db_client = Client(**client.dict())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@router.get("/{client_id}", response_model=ClientSchema)
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.get("/", response_model=List[ClientSchema])
def get_all_clients(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Client)
    if clinic_id:
        query = query.filter(Client.clinic_id == clinic_id)
    return query.all()

@router.put("/{client_id}", response_model=ClientSchema)
def update_client(client_id: int, client: ClientUpdate, db: Session = Depends(get_db)):
    db_client = db.query(Client).filter(Client.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    for field, value in client.dict(exclude_unset=True).items():
        setattr(db_client, field, value)
    
    db.commit()
    db.refresh(db_client)
    return db_client

@router.delete("/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    db.delete(client)
    db.commit()
    return {"message": "Client deleted successfully"}

@router.get("/{client_id}/family-members", response_model=List[ClientSchema])
def get_family_members(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if not client.family_id:
        return []
    
    return db.query(Client).filter(Client.family_id == client.family_id).all()

@router.put("/{client_id}/update-date")
def update_client_updated_date(client_id: int, db: Session = Depends(get_db)):
    from sqlalchemy.sql import func
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client.client_updated_date = func.now()
    db.commit()
    return {"message": "Client updated date updated successfully"}

@router.put("/{client_id}/ai-states")
def update_client_ai_states(
    client_id: int, 
    ai_states: dict, 
    db: Session = Depends(get_db)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    for key, value in ai_states.items():
        if hasattr(client, key):
            setattr(client, key, value)
    
    db.commit()
    return {"message": "AI states updated successfully"}

@router.put("/{client_id}/ai-part-state")
def update_client_ai_part_state(
    client_id: int, 
    part: str, 
    ai_part_state: str, 
    db: Session = Depends(get_db)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    field_name = f"ai_{part}_state"
    if hasattr(client, field_name):
        setattr(client, field_name, ai_part_state)
        db.commit()
        return {"message": f"AI {part} state updated successfully"}
    else:
        raise HTTPException(status_code=400, detail=f"Invalid part: {part}")

@router.get("/{client_id}/all-data-for-ai")
def get_all_client_data_for_ai(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # This would need to be expanded to include all related data
    # For now, returning basic client data
    return {
        "client": client,
        "family": client.family,
        "exams": [],  # Would need to implement exam queries
        "appointments": [],  # Would need to implement appointment queries
        "orders": [],  # Would need to implement order queries
        "referrals": [],  # Would need to implement referral queries
        "files": [],  # Would need to implement file queries
        "medical_logs": []  # Would need to implement medical log queries
    } 