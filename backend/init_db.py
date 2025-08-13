#!/usr/bin/env python3
"""
Initialize database with sample data
"""

import os
import uuid
from dotenv import load_dotenv
from database import SessionLocal, engine
from models import (
    Base, Company, Clinic, User, 
    LookupSupplier, LookupOrderType, LookupLensModel, LookupColor, 
    LookupMaterial, LookupCoating, LookupManufacturer, LookupFrameModel
)
from auth import get_password_hash
from config import settings

load_dotenv()

def init_lookup_data(db):
    """Initialize lookup tables with sample data"""
    print("Creating sample lookup data...")
    
    # Sample suppliers
    suppliers = [
        "Essilor", "Zeiss", "Hoya", "Nikon", "Rodenstock", "Shamir", "Seiko"
    ]
    for supplier_name in suppliers:
        supplier = LookupSupplier(name=supplier_name)
        db.add(supplier)
    
    # Sample order types
    order_types = [
        "משקפיים חד-מוקדיים", "משקפיים דו-מוקדיים", "משקפיים רב-מוקדיים",
        "משקפיים לקריאה", "משקפיים לשמש", "משקפיים ספורט"
    ]
    for order_type in order_types:
        order_type_obj = LookupOrderType(name=order_type)
        db.add(order_type_obj)
    
    # Sample lens models
    lens_models = [
        "Varilux X", "Progressive Plus", "Comfort Max", "Vision Elite",
        "Crystal Clear", "Premium Plus", "Standard Single"
    ]
    for lens_model in lens_models:
        lens_model_obj = LookupLensModel(name=lens_model)
        db.add(lens_model_obj)
    
    # Sample colors
    colors = [
        "שקוף", "חום בהיר", "חום כהה", "אפור", "ירוק", "כחול", "צהוב"
    ]
    for color in colors:
        color_obj = LookupColor(name=color)
        db.add(color_obj)
    
    # Sample materials
    materials = [
        "פלסטיק", "פוליקרבונט", "זכוכית", "טריווקס", "הי-אינדקס 1.67",
        "הי-אינדקס 1.74", "פוטוכרומי"
    ]
    for material in materials:
        material_obj = LookupMaterial(name=material)
        db.add(material_obj)
    
    # Sample coatings
    coatings = [
        "אנטי-רפלקס", "אנטי-שריטה", "פוטוכרומי", "מקטב", "כחול-בלוק",
        "הידרופובי", "לוטוס"
    ]
    for coating in coatings:
        coating_obj = LookupCoating(name=coating)
        db.add(coating_obj)
    
    # Sample manufacturers
    manufacturers = [
        "Ray-Ban", "Oakley", "Gucci", "Prada", "Tom Ford", "Persol", "Maui Jim"
    ]
    for manufacturer in manufacturers:
        manufacturer_obj = LookupManufacturer(name=manufacturer)
        db.add(manufacturer_obj)
    
    # Sample frame models
    frame_models = [
        "Aviator", "Wayfarer", "Round", "Square", "Cat Eye", "Oversized",
        "Rimless", "Semi-rimless"
    ]
    for frame_model in frame_models:
        frame_model_obj = LookupFrameModel(name=frame_model)
        db.add(frame_model_obj)
    
    db.commit()
    print("Sample lookup data created successfully!")

def init_database():
    """Initialize database with sample data"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if we already have data
        existing_company = db.query(Company).first()
        if existing_company:
            print("Database already has data, skipping initialization")
            return
        
        print("Creating sample company...")
        company = Company(
            name="Sample Optical Company",
            owner_full_name="John Doe",
            contact_email="john@sampleoptical.com",
            contact_phone="+1234567890",
            address="123 Main St, City, State 12345"
        )
        db.add(company)
        db.commit()
        db.refresh(company)
        
        print("Creating sample clinic...")
        clinic = Clinic(
            company_id=company.id,
            name="Main Clinic",
            location="Downtown",
            phone_number="+1234567891",
            email="main@sampleoptical.com",
            unique_id=str(uuid.uuid4()),
            is_active=True
        )
        db.add(clinic)
        db.commit()
        db.refresh(clinic)
        
        print("Creating sample users...")
        
        # CEO user
        ceo_user = User(
            username="ceo",
            email="ceo@sampleoptical.com",
            password=get_password_hash("password123"),
            role="company_ceo",
            is_active=True
        )
        db.add(ceo_user)
        
        # Clinic manager
        manager_user = User(
            username="manager",
            email="manager@sampleoptical.com",
            password=get_password_hash("password123"),
            role="clinic_manager",
            clinic_id=clinic.id,
            is_active=True
        )
        db.add(manager_user)
        
        # Clinic worker
        worker_user = User(
            username="worker",
            email="worker@sampleoptical.com",
            password=get_password_hash("password123"),
            role="clinic_worker",
            clinic_id=clinic.id,
            is_active=True
        )
        db.add(worker_user)
        
        db.commit()
        
        # Initialize lookup data
        init_lookup_data(db)
        
        print("Database initialized successfully!")
        print("\nSample users created:")
        print("CEO - Username: ceo, Password: password123")
        print("Manager - Username: manager, Password: password123")
        print("Worker - Username: worker, Password: password123")
        print(f"\nClinic unique ID: {clinic.unique_id}")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_database() 