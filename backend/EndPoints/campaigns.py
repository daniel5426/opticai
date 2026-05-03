from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Campaign, CampaignClientExecution, Client
from schemas import CampaignCreate, CampaignUpdate, Campaign as CampaignSchema
from auth import get_current_user
from models import User
from models import Clinic
from security.scope import (
    get_allowed_clinic_ids,
    get_scoped_campaign,
    get_scoped_client,
    normalize_clinic_id_for_company,
    resolve_company_id,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.post("/", response_model=CampaignSchema)
def create_campaign(
    campaign: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = campaign.dict()
    payload["clinic_id"] = normalize_clinic_id_for_company(db, current_user, payload.get("clinic_id"))
    db_campaign = Campaign(**payload)
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign

@router.get("/{campaign_id}", response_model=CampaignSchema)
def get_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_scoped_campaign(db, current_user, campaign_id)

@router.get("/", response_model=List[CampaignSchema])
def get_all_campaigns(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    query = db.query(Campaign).filter(Campaign.clinic_id.in_(allowed_clinic_ids))
    return query.all()

@router.put("/{campaign_id}", response_model=CampaignSchema)
def update_campaign(
    campaign_id: int,
    campaign: CampaignUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_campaign = get_scoped_campaign(db, current_user, campaign_id)
    update_fields = campaign.dict(exclude_unset=True)
    if "clinic_id" in update_fields:
        update_fields["clinic_id"] = normalize_clinic_id_for_company(db, current_user, update_fields["clinic_id"])
    for field, value in update_fields.items():
        setattr(db_campaign, field, value)
    
    db.commit()
    db.refresh(db_campaign)
    return db_campaign

@router.delete("/{campaign_id}")
def delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = get_scoped_campaign(db, current_user, campaign_id)
    db.delete(campaign)
    db.commit()
    return {"message": "Campaign deleted successfully"}

@router.get("/{campaign_id}/client-execution/{client_id}")
def get_campaign_client_execution(
    campaign_id: int,
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = get_scoped_campaign(db, current_user, campaign_id)
    client = get_scoped_client(db, current_user, client_id)
    if client.clinic_id != campaign.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    execution = db.query(CampaignClientExecution).filter(
        CampaignClientExecution.campaign_id == campaign_id,
        CampaignClientExecution.client_id == client_id
    ).first()
    return {"executed": execution is not None}

@router.post("/{campaign_id}/client-execution/{client_id}")
def add_campaign_client_execution(
    campaign_id: int,
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = get_scoped_campaign(db, current_user, campaign_id)
    client = get_scoped_client(db, current_user, client_id)
    if client.clinic_id != campaign.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
def delete_campaign_client_executions(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_campaign(db, current_user, campaign_id)
    executions = db.query(CampaignClientExecution).filter(
        CampaignClientExecution.campaign_id == campaign_id
    ).all()
    
    for execution in executions:
        db.delete(execution)
    
    db.commit()
    return {"message": f"Deleted {len(executions)} campaign client executions"}

from fastapi import BackgroundTasks
from services.campaign_service import CampaignService

@router.post("/{campaign_id}/execute")
async def execute_campaign(
    campaign_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    get_scoped_campaign(db, current_user, campaign_id)

    service = CampaignService(db)
    background_tasks.add_task(service.execute_campaign, campaign_id)
    
    return {"message": "Campaign execution started in background", "campaign_id": campaign_id}
 
