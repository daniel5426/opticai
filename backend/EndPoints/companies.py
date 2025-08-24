from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Company, Clinic
from sqlalchemy.exc import IntegrityError
from schemas import CompanyCreate, CompanyUpdate, Company as CompanySchema
from auth import get_current_user
from models import User
from utils.storage import upload_base64_image

router = APIRouter(prefix="/companies", tags=["companies"])

@router.get("/public", response_model=List[CompanySchema])
def get_companies_public(db: Session = Depends(get_db)):
    """Public endpoint for getting companies during initial setup"""
    companies = db.query(Company).all()
    return companies

@router.post("/public", response_model=CompanySchema)
def create_company_public(
    company: CompanyCreate,
    db: Session = Depends(get_db)
):
    """Public endpoint for creating companies during registration"""
    print(f"DEBUG: Creating new company: {company.name}")
    try:
        payload = company.dict()
        if payload.get('logo_path'):
            try:
                payload['logo_path'] = upload_base64_image(payload['logo_path'], f"companies")
            except Exception:
                pass
        db_company = Company(**payload)
        db.add(db_company)
        db.commit()
        db.refresh(db_company)
        print(f"DEBUG: Company created successfully with ID: {db_company.id}")
        return db_company
    except IntegrityError:
        db.rollback()
        # If a unique constraint exists at DB level from older schema, reuse existing company
        existing = db.query(Company).filter(Company.name == company.name).first()
        if existing:
            print(f"DEBUG: Company with same name exists, returning existing ID: {existing.id}")
            return existing
        raise

@router.post("/", response_model=CompanySchema)
def create_company(data: CompanyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "company_ceo":
        raise HTTPException(status_code=403, detail="Only company CEOs can create companies")
    
    try:
        payload = data.dict()
        if payload.get('logo_path'):
            try:
                payload['logo_path'] = upload_base64_image(payload['logo_path'], f"companies")
            except Exception:
                pass
        db_company = Company(**payload)
        db.add(db_company)
        db.commit()
        db.refresh(db_company)
        return db_company
    except IntegrityError:
        db.rollback()
        existing = db.query(Company).filter(Company.name == data.name).first()
        if existing:
            return existing
        raise

@router.get("/", response_model=List[CompanySchema])
def get_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "company_ceo":
        companies = db.query(Company).all()
    else:
        companies = db.query(Company).join(Clinic).filter(Clinic.id == current_user.clinic_id).all()
    return companies

@router.get("/{company_id}", response_model=CompanySchema)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if current_user.role != "company_ceo" and current_user.clinic_id:
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        if not clinic or clinic.company_id != company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return company

@router.put("/{company_id}", response_model=CompanySchema)
def update_company(
    company_id: int,
    company: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "company_ceo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company CEOs can update companies"
        )
    
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if db_company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    
    update_fields = company.dict(exclude_unset=True)
    if update_fields.get('logo_path'):
        try:
            update_fields['logo_path'] = upload_base64_image(update_fields['logo_path'], f"companies/{company_id}")
        except Exception:
            pass
    for field, value in update_fields.items():
        setattr(db_company, field, value)
    
    db.commit()
    db.refresh(db_company)
    return db_company

@router.delete("/{company_id}")
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "company_ceo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company CEOs can delete companies"
        )
    
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if db_company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    
    db.delete(db_company)
    db.commit()
    return {"message": "Company deleted successfully"} 