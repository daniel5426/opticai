from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Campaign, CampaignClientExecution, Client
from schemas import CampaignCreate, CampaignUpdate, Campaign as CampaignSchema
from auth import get_current_user
from models import User
from models import Clinic
from security.scope import resolve_company_id, assert_clinic_belongs_to_company

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.post("/", response_model=CampaignSchema)
def create_campaign(campaign: CampaignCreate, db: Session = Depends(get_db)):
    db_campaign = Campaign(**campaign.dict())
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign

@router.get("/{campaign_id}", response_model=CampaignSchema)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign

@router.get("/", response_model=List[CampaignSchema])
def get_all_campaigns(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    company_id = resolve_company_id(db, current_user)
    query = db.query(Campaign).join(Clinic, Clinic.id == Campaign.clinic_id).filter(Clinic.company_id == company_id)
    if clinic_id is not None:
        assert_clinic_belongs_to_company(db, clinic_id, company_id)
        query = query.filter(Campaign.clinic_id == clinic_id)
    return query.all()

@router.put("/{campaign_id}", response_model=CampaignSchema)
def update_campaign(campaign_id: int, campaign: CampaignUpdate, db: Session = Depends(get_db)):
    db_campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not db_campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    for field, value in campaign.dict(exclude_unset=True).items():
        setattr(db_campaign, field, value)
    
    db.commit()
    db.refresh(db_campaign)
    return db_campaign

@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    db.delete(campaign)
    db.commit()
    return {"message": "Campaign deleted successfully"}

@router.get("/{campaign_id}/client-execution/{client_id}")
def get_campaign_client_execution(campaign_id: int, client_id: int, db: Session = Depends(get_db)):
    execution = db.query(CampaignClientExecution).filter(
        CampaignClientExecution.campaign_id == campaign_id,
        CampaignClientExecution.client_id == client_id
    ).first()
    return {"executed": execution is not None}

@router.post("/{campaign_id}/client-execution/{client_id}")
def add_campaign_client_execution(campaign_id: int, client_id: int, db: Session = Depends(get_db)):
    # Check if campaign exists
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Check if client exists
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Check if execution already exists
    existing = db.query(CampaignClientExecution).filter(
        CampaignClientExecution.campaign_id == campaign_id,
        CampaignClientExecution.client_id == client_id
    ).first()
    
    if existing:
        return {"message": "Execution already exists"}
    
    execution = CampaignClientExecution(
        campaign_id=campaign_id,
        client_id=client_id
    )
    db.add(execution)
    db.commit()
    
    return {"message": "Campaign client execution added successfully"}

@router.delete("/{campaign_id}/client-executions")
def delete_campaign_client_executions(campaign_id: int, db: Session = Depends(get_db)):
    executions = db.query(CampaignClientExecution).filter(
        CampaignClientExecution.campaign_id == campaign_id
    ).all()
    
    for execution in executions:
        db.delete(execution)
    
    db.commit()
    return {"message": f"Deleted {len(executions)} campaign client executions"} 