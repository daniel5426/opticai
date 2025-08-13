from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Client, Family, Clinic, User, OpticalExam, Appointment, Order, Referral, File, MedicalLog, ContactLens
from schemas import ClientCreate, ClientUpdate, Client as ClientSchema
from sqlalchemy import and_, func
from auth import get_current_user

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
    
    mapping = {
        "exam": "ai_exam_state",
        "order": "ai_order_state",
        "referral": "ai_referral_state",
        "contact_lens": "ai_contact_lens_state",
        "appointment": "ai_appointment_state",
        "file": "ai_file_state",
        "medical": "ai_medical_state",
    }

    for key, value in ai_states.items():
        field_name = mapping.get(key, key)
        if hasattr(client, field_name):
            setattr(client, field_name, value)
    client.ai_updated_date = func.now()
    
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
        client.ai_updated_date = func.now()
        db.commit()
        return {"message": f"AI {part} state updated successfully"}
    else:
        raise HTTPException(status_code=400, detail=f"Invalid part: {part}")

@router.get("/{client_id}/all-data-for-ai")
def get_all_client_data_for_ai(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    exams = db.query(OpticalExam).filter(OpticalExam.client_id == client_id).all()
    appointments = db.query(Appointment).filter(Appointment.client_id == client_id).all()
    orders = db.query(Order).filter(Order.client_id == client_id).all()
    referrals = db.query(Referral).filter(Referral.client_id == client_id).all()
    files = db.query(File).filter(File.client_id == client_id).all()
    medical_logs = db.query(MedicalLog).filter(MedicalLog.client_id == client_id).order_by(MedicalLog.id.desc()).all()
    contact_lenses = db.query(ContactLens).filter(ContactLens.client_id == client_id).all()

    try:
        print(
            f"[AI DEBUG] all-data-for-ai client_id={client_id} "
            f"exams={len(exams)} appointments={len(appointments)} orders={len(orders)} "
            f"referrals={len(referrals)} files={len(files)} medical_logs={len(medical_logs)} contact_lenses={len(contact_lenses)}"
        )
        if medical_logs:
            print("[AI DEBUG] medical_log_ids:", [ml.id for ml in medical_logs])
    except Exception:
        pass

    return {
        "client": client,
        "family": client.family,
        "exams": exams,
        "appointments": appointments,
        "orders": orders,
        "referrals": referrals,
        "files": files,
        "medical_logs": medical_logs,
        "contact_lenses": contact_lenses,
    }

@router.get("/stats/company/{company_id}")
def get_company_new_clients_stats(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "company_ceo":
        raise HTTPException(status_code=403, detail="Access denied")
    month_expr = func.date_trunc('month', Client.file_creation_date)
    month_str = func.to_char(month_expr, 'YYYY-MM')
    rows = (
        db.query(month_str.label('month'), func.count(Client.id).label('count'))
        .join(Clinic, Clinic.id == Client.clinic_id)
        .filter(Clinic.company_id == company_id)
        .group_by(month_expr)
        .order_by(month_expr)
        .all()
    )
    return [{"month": r.month, "count": int(r.count)} for r in rows]