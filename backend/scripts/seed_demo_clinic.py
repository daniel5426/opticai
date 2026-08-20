"""Create a rerunnable, high-volume English demo clinic for screenshots.

The script owns only the company identified by ``DEMO_COMPANY_EMAIL``.  Each
``--execute`` run removes that owned company and its related records before
creating a fresh deterministic dataset, so it is safe to re-run against a
shared staging database.  It never modifies other accounts.

Usage:
    cd backend
    .venv/bin/python scripts/seed_demo_clinic.py --execute

The resulting owner can sign in with:
    identifier: demo.admin@northstaroptical.test
    password: DemoClinic2026!
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

from sqlalchemy import func, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from auth import get_password_hash  # noqa: E402
from config import settings  # noqa: E402
from database import SessionLocal  # noqa: E402
from models import (  # noqa: E402
    Appointment,
    AuthSession,
    Billing,
    BillingPayment,
    Campaign,
    CampaignClientExecution,
    CatalogDiscoveryCandidate,
    CatalogDiscoveryRun,
    CatalogOrderObservation,
    CatalogProduct,
    CatalogVariant,
    Chat,
    ChatMessage,
    Client,
    Clinic,
    ClinicDataPruneJob,
    ClinicDataPruneStorageObject,
    ClinicDeviceTrust,
    ClinicHolidayOverride,
    Company,
    ContactLensOrder,
    EmailLog,
    ExamLayout,
    ExamLayoutInstance,
    Family,
    File,
    InventoryBalance,
    InventoryCompanySettings,
    InventoryMovement,
    LookupAdvisor,
    LookupCleaningSolution,
    LookupClinic,
    LookupCoating,
    LookupColor,
    LookupContactEyeLensType,
    LookupContactEyeMaterial,
    LookupContactLensModel,
    LookupContactLensType,
    LookupDisinfectionSolution,
    LookupFrameModel,
    LookupLensModel,
    LookupManufacturingLab,
    LookupManufacturer,
    LookupMaterial,
    LookupOrderType,
    LookupRinsingSolution,
    LookupSupplier,
    LookupVADecimal,
    LookupVAMeter,
    MedicalLog,
    Order,
    OrderInventoryAllocation,
    OrderLineItem,
    OpticalExam,
    PrescriptionSearchIndex,
    RecentClientVisit,
    Referral,
    ReferralEye,
    Settings,
    SoftOpticMigrationJob,
    TermsAcceptance,
    User,
    WorkShift,
)
from services.inventory_service import normalized_product_key, normalized_variant_fingerprint  # noqa: E402


DEMO_COMPANY_EMAIL = "demo.admin@northstaroptical.test"
DEMO_COMPANY_NAME = "Northstar Vision Group"
DEMO_CLINIC_NAME = "Northstar Optometry — Midtown"
DEMO_LOGIN_PASSWORD = "DemoClinic2026!"
DEMO_RANDOM_SEED = 20260811
DEMO_CURRENCY = "USD"

DEMO_CLINIC_SPECS = (
    ("Northstar Optometry — Midtown", "Midtown Manhattan", "Suite 810", "245 Madison Avenue", "New York", "10016", "+1 212 555 0180", "midtown@northstaroptical.test", "Mia Chen", "NY-OPT-44821", "northstar-demo-midtown"),
    ("Northstar Optometry — SoHo", "SoHo", "Ground Floor", "145 Spring Street", "New York", "10012", "+1 212 555 0181", "soho@northstaroptical.test", "Avery Brooks", "NY-OPT-44822", "northstar-demo-soho"),
    ("Northstar Optometry — Williamsburg", "Williamsburg", "Suite 204", "65 North 6th Street", "Brooklyn", "11249", "+1 718 555 0182", "williamsburg@northstaroptical.test", "Sofia Patel", "NY-OPT-44823", "northstar-demo-williamsburg"),
    ("Northstar Optometry — Upper West Side", "Upper West Side", "Suite 302", "198 Columbus Avenue", "New York", "10023", "+1 212 555 0183", "uws@northstaroptical.test", "Ryan Brooks", "NY-OPT-44824", "northstar-demo-uws"),
    ("Northstar Optometry — Long Island City", "Long Island City", "Suite 420", "27-01 Queens Plaza North", "Queens", "11101", "+1 718 555 0184", "lic@northstaroptical.test", "Dr. Elena Ruiz", "NY-OPT-44825", "northstar-demo-lic"),
    ("Northstar Optometry — Jersey City", "Downtown Jersey City", "Suite 510", "90 Columbus Drive", "Jersey City", "07302", "+1 201 555 0185", "jerseycity@northstaroptical.test", "Dr. Nathan Cole", "NJ-OPT-28614", "northstar-demo-jersey-city"),
    ("Northstar Optometry — Hoboken", "Hoboken Waterfront", "Suite 110", "421 Washington Street", "Hoboken", "07030", "+1 201 555 0186", "hoboken@northstaroptical.test", "Dr. Priya Shah", "NJ-OPT-28615", "northstar-demo-hoboken"),
)


@dataclass(frozen=True)
class DemoVolume:
    clients: int = 3_200
    families: int = 850
    regular_orders: int = 1_850
    contact_orders: int = 520
    exams: int = 2_450
    appointments_past: int = 1_280
    appointments_future: int = 480
    referrals: int = 180
    medical_logs: int = 460
    frames: int = 84
    contacts: int = 96

    @classmethod
    def compact(cls) -> "DemoVolume":
        """Small but relationally complete volume used by the test suite."""
        return cls(
            clients=80,
            families=24,
            regular_orders=56,
            contact_orders=18,
            exams=72,
            appointments_past=64,
            appointments_future=28,
            referrals=12,
            medical_logs=20,
            frames=12,
            contacts=16,
        )


FIRST_NAMES = (
    "Ava", "Noah", "Olivia", "Liam", "Emma", "Ethan", "Sophia", "Mason",
    "Isabella", "Lucas", "Mia", "James", "Amelia", "Henry", "Harper", "Theo",
    "Evelyn", "Benjamin", "Charlotte", "Jack", "Elijah", "Grace", "Leo", "Nora",
    "Ella", "Daniel", "Scarlett", "Owen", "Layla", "Samuel", "Chloe", "William",
    "Hannah", "Alexander", "Zoe", "Julian", "Victoria", "Caleb", "Aria", "Miles",
    "Madison", "Ezra", "Penelope", "Nathan", "Ruby", "Gabriel", "Audrey", "Isaac",
)
LAST_NAMES = (
    "Adams", "Bennett", "Carter", "Dawson", "Ellis", "Foster", "Garcia", "Hayes",
    "Irwin", "Johnson", "Kim", "Lewis", "Mitchell", "Nguyen", "Owens", "Patel",
    "Quinn", "Reed", "Sullivan", "Turner", "Underwood", "Vasquez", "Walker", "Xu",
    "Young", "Zimmerman", "Brooks", "Coleman", "Diaz", "Edwards", "Fleming", "Grant",
    "Hughes", "Ingram", "Jordan", "Klein", "Lawson", "Morgan", "Nolan", "Parker",
)
CITIES = ("New York", "Brooklyn", "Queens", "Jersey City", "Hoboken", "Long Island City")
STREETS = ("Madison Avenue", "Lexington Avenue", "Broadway", "Park Avenue", "Fifth Avenue", "Hudson Street")
EXAM_NAMES = (
    "Comprehensive Eye Exam",
    "Annual Vision Check",
    "Contact Lens Comprehensive",
    "Contact Lens Fitting",
    "Dry Eye Evaluation",
    "Pediatric & Binocular Vision",
    "Myopia Management Review",
    "Progressive Lens Consultation",
    "Computer Vision Assessment",
    "Dilated Refraction Review",
    "Low Vision Assessment",
    "Keratoconus Lens Review",
    "Post-Operative Follow-up",
)
ORDER_TYPES = ("Progressive Glasses", "Single Vision Glasses", "Computer Glasses", "Prescription Sunglasses")
ORDER_STATUSES = (
    "נשלח לייצור",
    "ממתין לעדשות",
    "ממתין למסגור",
    "ממתין למשלוח חזרה לחנות",
    "ממתין לאיסוף לקוח",
    "נמסר ללקוח",
)
FRAME_CATALOG = (
    ("Moscot", "Lemtosh", "Acetate"), ("Ray-Ban", "RX5228", "Acetate"),
    ("Oliver Peoples", "O'Malley", "Acetate"), ("Persol", "PO3007V", "Acetate"),
    ("Garrett Leight", "Kinney", "Acetate"), ("Lindberg", "Air Titanium", "Titanium"),
    ("Warby Parker", "Durand", "Acetate"), ("Tom Ford", "FT5401", "Acetate"),
    ("Mykita", "Lite Acetate", "Stainless Steel"), ("Oakley", "Holbrook RX", "O Matter"),
    ("Dita", "Statesman", "Titanium"), ("Etnia Barcelona", "Tobago", "Acetate"),
    ("Maui Jim", "Kawika Optical", "Titanium"), ("Silhouette", "TMA Icon", "Titanium"),
    ("ic! berlin", "Mauerpark", "Stainless Steel"), ("Vanni", "V1836", "Acetate"),
    ("William Morris London", "LN 508", "Acetate"), ("Flexon", "H6001", "Memory Metal"),
    ("ProDesign Denmark", "Titanium 4760", "Titanium"), ("Kirk & Kirk", "Maya", "Acetate"),
    ("Marchon NYC", "M-4012", "Acetate"), ("Nike Vision", "NVX 709", "Nylon"),
    ("Polo Ralph Lauren", "PH2256", "Acetate"), ("Carrera", "CA 8908", "Stainless Steel"),
)
CONTACT_CATALOG = (
    ("Acuvue", "Oasys 1-Day", "Daily", "Silicone Hydrogel"),
    ("Acuvue", "Vita", "Monthly", "Silicone Hydrogel"),
    ("CooperVision", "MyDay", "Daily", "Silicone Hydrogel"),
    ("CooperVision", "Biofinity Toric", "Toric", "Silicone Hydrogel"),
    ("Alcon", "Dailies Total1", "Daily", "Water Gradient"),
    ("Alcon", "Precision1", "Daily", "Silicone Hydrogel"),
    ("Bausch + Lomb", "Ultra", "Monthly", "Silicone Hydrogel"),
    ("Bausch + Lomb", "Infuse", "Daily", "Silicone Hydrogel"),
    ("Johnson & Johnson Vision", "Acuvue Oasys Max", "Daily", "Silicone Hydrogel"),
    ("Menicon", "Miru 1day Flat Pack", "Daily", "Silicone Hydrogel"),
    ("SEED", "1dayPure Moisture", "Daily", "Silicone Hydrogel"),
    ("Hoya", "iD MyStyle", "Monthly", "Silicone Hydrogel"),
    ("SynergEyes", "UltraHealth", "Specialty", "Hyper-Gel"),
    ("Bausch + Lomb Specialty", "Zenlens", "Specialty", "Hyper-Gel"),
    ("CooperVision Specialty", "MiSight 1 day", "Daily", "Silicone Hydrogel"),
)
FRAME_SUPPLIERS = (
    "A&A Optical", "Allied Vision Supply", "Aspex Eyewear", "Marchon Eyewear",
    "De Rigo Vision", "Safilo Group", "Luxottica Wholesale", "Marcolin",
    "Kering Eyewear", "Tura", "WestGroupe", "Europa Eyewear",
    "ECO Eyewear", "Modo Eyewear", "Design Eyewear Group", "OGI Eyewear",
    "The Optical Foundry", "Viva International", "ClearVision Optical", "Bellinger House",
)
CONTACT_SUPPLIERS = tuple(dict.fromkeys(item[0] for item in CONTACT_CATALOG))


def _chunks(rows: Sequence[Any], size: int = 500) -> Iterable[Sequence[Any]]:
    for index in range(0, len(rows), size):
        yield rows[index:index + size]


def _add_in_batches(db: Session, rows: Sequence[Any], size: int = 500) -> None:
    for batch in _chunks(rows, size):
        db.add_all(batch)
        db.flush()


def _business_days(start: date, end: date) -> list[date]:
    result: list[date] = []
    current = start
    while current <= end:
        if current.weekday() < 5:
            result.append(current)
        current += timedelta(days=1)
    return result


def _weighted_history_date(rng: random.Random, today: date) -> date:
    """Bias recent order activity so dashboard period comparisons look alive."""
    roll = rng.random()
    if roll < 0.07:
        return today - timedelta(days=rng.randrange(0, 30))
    if roll < 0.115:
        return today - timedelta(days=rng.randrange(30, 60))
    return today - timedelta(days=rng.randrange(60, 730))


def _utc_at(day: date, hour: int = 10) -> datetime:
    return datetime(day.year, day.month, day.day, hour, tzinfo=timezone.utc)


LOOKUP_SEEDS: dict[type[Any], tuple[str, ...]] = {
    LookupSupplier: FRAME_SUPPLIERS + CONTACT_SUPPLIERS + (
        "EssilorLuxottica", "Zeiss Vision Care", "Hoya Vision Care", "Shamir Optical", "Younger Optics",
    ),
    LookupClinic: ("Midtown", "Optical Lab", "Contact Lens Desk"),
    LookupOrderType: ORDER_TYPES + ("Contact Lens Supply",),
    LookupLensModel: ("Varilux XR", "SmartLife Individual 3", "Eyezen Start", "DriveSafe"),
    LookupColor: ("Tortoise", "Matte Black", "Crystal", "Olive", "Rose Gold", "Navy"),
    LookupMaterial: ("Acetate", "Titanium", "Stainless Steel", "Memory Metal", "Nylon", "O Matter", "Silicone Hydrogel", "Hyper-Gel"),
    LookupCoating: ("Crizal Sapphire HR", "DuraVision Platinum", "BlueGuard", "Polarized"),
    LookupManufacturer: tuple(dict.fromkeys(item[0] for item in FRAME_CATALOG + CONTACT_CATALOG)),
    LookupFrameModel: tuple(item[1] for item in FRAME_CATALOG),
    LookupContactLensType: ("Daily", "Monthly", "Toric", "Multifocal"),
    LookupContactEyeLensType: ("Spherical", "Toric", "Multifocal"),
    LookupContactEyeMaterial: ("Silicone Hydrogel", "Water Gradient"),
    LookupContactLensModel: tuple(item[1] for item in CONTACT_CATALOG),
    LookupCleaningSolution: ("Clear Care Plus", "Biotrue", "Opti-Free Puremoist"),
    LookupDisinfectionSolution: ("Clear Care Plus", "Biotrue", "RevitaLens"),
    LookupRinsingSolution: ("Sterile Saline", "Biotrue", "Opti-Free Puremoist"),
    LookupManufacturingLab: ("Essilor Lab", "Zeiss Vision Lab", "Hoya Lab"),
    LookupAdvisor: ("Mia Chen", "Jacob Miller", "Sofia Patel", "Ryan Brooks"),
    LookupVAMeter: ("6/6", "6/7.5", "6/9", "6/12"),
    LookupVADecimal: ("0.7", "0.8", "1.0", "1.2"),
}


def _delete_rows(db: Session, model: type[Any], *filters: Any) -> None:
    if filters:
        db.query(model).filter(*filters).delete(synchronize_session=False)


def delete_demo_company(db: Session) -> bool:
    """Delete only the known demo account, in FK-safe dependency order."""
    company = db.query(Company).filter(Company.contact_email == DEMO_COMPANY_EMAIL).first()
    if not company:
        return False

    company_id = company.id
    clinic_ids = [row[0] for row in db.query(Clinic.id).filter(Clinic.company_id == company_id).all()]
    user_ids = [row[0] for row in db.query(User.id).filter(User.company_id == company_id).all()]
    client_ids = [row[0] for row in db.query(Client.id).filter(Client.company_id == company_id).all()]
    order_ids = [row[0] for row in db.query(Order.id).filter(Order.clinic_id.in_(clinic_ids)).all()] if clinic_ids else []
    contact_order_ids = (
        [row[0] for row in db.query(ContactLensOrder.id).filter(ContactLensOrder.clinic_id.in_(clinic_ids)).all()]
        if clinic_ids else []
    )
    appointment_ids = (
        [row[0] for row in db.query(Appointment.id).filter(Appointment.clinic_id.in_(clinic_ids)).all()]
        if clinic_ids else []
    )
    exam_ids = [row[0] for row in db.query(OpticalExam.id).filter(OpticalExam.client_id.in_(client_ids)).all()] if client_ids else []
    referral_ids = [row[0] for row in db.query(Referral.id).filter(Referral.client_id.in_(client_ids)).all()] if client_ids else []
    billing_ids = []
    if order_ids or contact_order_ids:
        billing_query = db.query(Billing.id)
        if order_ids:
            billing_query = billing_query.filter(Billing.order_id.in_(order_ids))
        if contact_order_ids:
            billing_query = billing_query.union(
                db.query(Billing.id).filter(Billing.contact_lens_id.in_(contact_order_ids))
            )
        billing_ids = [row[0] for row in billing_query.all()]
    campaign_ids = (
        [row[0] for row in db.query(Campaign.id).filter(Campaign.clinic_id.in_(clinic_ids)).all()] if clinic_ids else []
    )
    chat_ids = [row[0] for row in db.query(Chat.id).filter(Chat.clinic_id.in_(clinic_ids)).all()] if clinic_ids else []
    discovery_run_ids = [
        row[0] for row in db.query(CatalogDiscoveryRun.id).filter(CatalogDiscoveryRun.company_id == company_id).all()
    ]
    prune_job_ids = [
        row[0] for row in db.query(ClinicDataPruneJob.id).filter(ClinicDataPruneJob.company_id == company_id).all()
    ]

    if prune_job_ids:
        _delete_rows(db, ClinicDataPruneStorageObject, ClinicDataPruneStorageObject.job_id.in_(prune_job_ids))
    if discovery_run_ids:
        _delete_rows(db, CatalogDiscoveryCandidate, CatalogDiscoveryCandidate.run_id.in_(discovery_run_ids))
    if appointment_ids:
        _delete_rows(db, EmailLog, EmailLog.appointment_id.in_(appointment_ids))
    if billing_ids:
        _delete_rows(db, BillingPayment, BillingPayment.billing_id.in_(billing_ids))
        _delete_rows(db, OrderLineItem, OrderLineItem.billings_id.in_(billing_ids))
    if referral_ids:
        _delete_rows(db, ReferralEye, ReferralEye.referral_id.in_(referral_ids))
    if exam_ids:
        _delete_rows(db, PrescriptionSearchIndex, PrescriptionSearchIndex.exam_id.in_(exam_ids))
        _delete_rows(db, ExamLayoutInstance, ExamLayoutInstance.exam_id.in_(exam_ids))
    if campaign_ids:
        _delete_rows(db, CampaignClientExecution, CampaignClientExecution.campaign_id.in_(campaign_ids))
    if client_ids:
        _delete_rows(db, CampaignClientExecution, CampaignClientExecution.client_id.in_(client_ids))
        _delete_rows(db, RecentClientVisit, RecentClientVisit.client_id.in_(client_ids))
        _delete_rows(db, PrescriptionSearchIndex, PrescriptionSearchIndex.client_id.in_(client_ids))
        _delete_rows(db, File, File.client_id.in_(client_ids))
        _delete_rows(db, MedicalLog, MedicalLog.client_id.in_(client_ids))
        _delete_rows(db, Referral, Referral.client_id.in_(client_ids))
    if chat_ids:
        _delete_rows(db, ChatMessage, ChatMessage.chat_id.in_(chat_ids))
    _delete_rows(db, CatalogOrderObservation, CatalogOrderObservation.company_id == company_id)
    _delete_rows(db, OrderInventoryAllocation, OrderInventoryAllocation.company_id == company_id)
    _delete_rows(db, InventoryMovement, InventoryMovement.company_id == company_id)
    _delete_rows(db, InventoryBalance, InventoryBalance.company_id == company_id)
    _delete_rows(db, InventoryCompanySettings, InventoryCompanySettings.company_id == company_id)
    _delete_rows(db, CatalogDiscoveryRun, CatalogDiscoveryRun.company_id == company_id)
    _delete_rows(db, CatalogVariant, CatalogVariant.company_id == company_id)
    _delete_rows(db, CatalogProduct, CatalogProduct.company_id == company_id)
    if billing_ids:
        _delete_rows(db, Billing, Billing.id.in_(billing_ids))
    if order_ids:
        _delete_rows(db, Order, Order.id.in_(order_ids))
    if contact_order_ids:
        _delete_rows(db, ContactLensOrder, ContactLensOrder.id.in_(contact_order_ids))
    if appointment_ids:
        _delete_rows(db, Appointment, Appointment.id.in_(appointment_ids))
    if exam_ids:
        _delete_rows(db, OpticalExam, OpticalExam.id.in_(exam_ids))
    if client_ids:
        _delete_rows(db, Client, Client.id.in_(client_ids))
    if clinic_ids:
        _delete_rows(db, Settings, Settings.clinic_id.in_(clinic_ids))
        _delete_rows(db, ClinicHolidayOverride, ClinicHolidayOverride.clinic_id.in_(clinic_ids))
        _delete_rows(db, Campaign, Campaign.clinic_id.in_(clinic_ids))
        _delete_rows(db, Chat, Chat.clinic_id.in_(clinic_ids))
        _delete_rows(db, ExamLayout, ExamLayout.clinic_id.in_(clinic_ids))
        for lookup_model in LOOKUP_SEEDS:
            _delete_rows(db, lookup_model, lookup_model.clinic_id.in_(clinic_ids))
        _delete_rows(db, Family, Family.clinic_id.in_(clinic_ids))
    if user_ids:
        _delete_rows(db, WorkShift, WorkShift.user_id.in_(user_ids))
        _delete_rows(db, AuthSession, AuthSession.user_id.in_(user_ids))
        _delete_rows(db, TermsAcceptance, TermsAcceptance.user_id.in_(user_ids))
    _delete_rows(db, ClinicDeviceTrust, ClinicDeviceTrust.company_id == company_id)
    _delete_rows(db, ClinicDataPruneJob, ClinicDataPruneJob.company_id == company_id)
    _delete_rows(db, SoftOpticMigrationJob, SoftOpticMigrationJob.company_id == company_id)
    _delete_rows(db, User, User.company_id == company_id)
    if clinic_ids:
        _delete_rows(db, Clinic, Clinic.id.in_(clinic_ids))
    _delete_rows(db, Company, Company.id == company_id)
    db.flush()
    return True


def _seed_company_and_staff(db: Session, rng: random.Random, today: date) -> tuple[Company, Clinic, list[User]]:
    company = Company(
        name=DEMO_COMPANY_NAME,
        owner_full_name="Jordan Blake",
        contact_email=DEMO_COMPANY_EMAIL,
        contact_phone="+1 212 555 0180",
        address="245 Madison Avenue, New York, NY 10016",
        primary_theme_color="#166534",
        secondary_theme_color="#0f766e",
        default_currency=DEMO_CURRENCY,
    )
    db.add(company)
    db.flush()
    clinics = [
        Clinic(
            company_id=company.id,
            name=name,
            clinic_name=name,
            location=location,
            clinic_position=position,
            clinic_address=address,
            clinic_city=city,
            clinic_postal_code=postal_code,
            clinic_directions=f"Enter through the main entrance at {address}.",
            clinic_website="https://northstaroptical.test",
            phone_number=phone,
            email=email,
            manager_name=manager,
            license_number=license_number,
            unique_id=unique_id,
            is_active=True,
        )
        for name, location, position, address, city, postal_code, phone, email, manager, license_number, unique_id in DEMO_CLINIC_SPECS
    ]
    _add_in_batches(db, clinics)
    db.flush()
    clinic = clinics[0]
    staff_specs = [
        ("Jordan Blake", "northstar-demo-admin", DEMO_COMPANY_EMAIL, 4, None, "#166534"),
        ("Mia Chen", "mia.chen", "mia.chen@northstaroptical.test", 3, clinic.id, "#0f766e"),
        ("Avery Brooks", "avery.brooks", "avery.brooks@northstaroptical.test", 3, clinic.id, "#2563eb"),
        ("Dr. Elena Ruiz", "elena.ruiz", "elena.ruiz@northstaroptical.test", 2, clinic.id, "#7c3aed"),
        ("Dr. Nathan Cole", "nathan.cole", "nathan.cole@northstaroptical.test", 2, clinic.id, "#db2777"),
        ("Dr. Priya Shah", "priya.shah", "priya.shah@northstaroptical.test", 2, clinic.id, "#ea580c"),
        ("Dr. Thomas Grant", "thomas.grant", "thomas.grant@northstaroptical.test", 2, clinic.id, "#0891b2"),
        ("Sofia Patel", "sofia.patel", "sofia.patel@northstaroptical.test", 2, clinic.id, "#4f46e5"),
        ("Ryan Brooks", "ryan.brooks", "ryan.brooks@northstaroptical.test", 2, clinic.id, "#be123c"),
        ("Emma Lawson", "emma.lawson", "emma.lawson@northstaroptical.test", 1, clinic.id, "#64748b"),
        ("Leo Martin", "leo.martin", "leo.martin@northstaroptical.test", 1, clinic.id, "#64748b"),
        ("Nora Scott", "nora.scott", "nora.scott@northstaroptical.test", 1, clinic.id, "#64748b"),
        ("Caleb Young", "caleb.young", "caleb.young@northstaroptical.test", 1, clinic.id, "#64748b"),
    ]
    users = [
        User(
            company_id=company.id,
            clinic_id=clinic_id,
            full_name=full_name,
            username=username,
            email=email,
            phone=f"+1 212 555 {1200 + index:04d}",
            password_hash=get_password_hash(DEMO_LOGIN_PASSWORD) if role == 4 else None,
            role_level=role,
            is_active=index != len(staff_specs) - 1,
            primary_theme_color=color,
            secondary_theme_color="#ffffff",
            theme_preference="light",
            va_format="meter",
            cyl_format="minus",
            added_vacation_dates=[(today + timedelta(days=18 + index)).isoformat()] if index in {3, 5} else [],
            system_vacation_dates=[],
            auth_provider="email",
        )
        for index, (full_name, username, email, role, clinic_id, color) in enumerate(staff_specs)
    ]
    _add_in_batches(db, users)
    settings_columns = {column["name"] for column in inspect(db.connection()).get_columns("settings")}
    # Keep the demo seed compatible with staging until the unrelated Settings
    # schema rollout reaches it; Settings are supplementary screenshot data.
    if "default_currency" in settings_columns:
        db.add(
            Settings(
                clinic_id=clinic.id,
                clinic_name=clinic.name,
                clinic_email=clinic.email,
                clinic_phone=clinic.phone_number,
                clinic_address=clinic.clinic_address,
                clinic_city=clinic.clinic_city,
                clinic_postal_code=clinic.clinic_postal_code,
                clinic_website=clinic.clinic_website,
                manager_name=clinic.manager_name,
                license_number=clinic.license_number,
                primary_theme_color=company.primary_theme_color,
                secondary_theme_color=company.secondary_theme_color,
                work_start_time="08:30",
                work_end_time="18:30",
                appointment_duration=30,
                break_start_time="13:00",
                break_end_time="13:30",
                max_appointments_per_day=42,
                send_email_before_appointment=True,
                email_days_before=2,
                email_time="09:00",
                working_days="Monday,Tuesday,Wednesday,Thursday,Friday",
                va_test_distance=6,
            )
        )
    for lookup_model, names in LOOKUP_SEEDS.items():
        db.add_all([lookup_model(clinic_id=clinic.id, name=name) for name in names])
    db.flush()
    return company, clinic, users


def _seed_layouts(db: Session, clinic_id: int) -> list[ExamLayout]:
    def grid(items: list[dict[str, Any]]) -> str:
        return json.dumps({"version": 2, "grid": {"columns": 24}, "items": items}, separators=(",", ":"))

    annual_items = [
        {"id": "uncorrected-demo", "type": "uncorrected-va", "showEyeLabels": True, "x": 0, "y": 0, "w": 6},
        {"id": "old-ref-demo", "type": "old-refraction", "showEyeLabels": False, "x": 6, "y": 0, "w": 12},
        {"id": "notes-1786493404412", "type": "notes", "x": 18, "y": 0, "w": 6, "showEyeLabels": False},
        {"id": "final-subjective-demo", "type": "final-subjective", "showEyeLabels": True, "x": 0, "y": 1, "w": 14},
        {"id": "addition-1786493394727", "type": "addition", "x": 14, "y": 1, "w": 10, "showEyeLabels": False},
        {"id": "cover-test-v2-1786493354701", "type": "cover-test-v2", "x": 0, "y": 2, "w": 12, "showEyeLabels": True},
        {"id": "final-prescription-1786493346396", "type": "final-prescription", "x": 12, "y": 2, "w": 12, "showEyeLabels": False},
    ]
    definitions = [
        (
            "Comprehensive Eye Exam", "global", True,
            [
                {"id": "anamnesis-comprehensive", "type": "anamnesis", "x": 0, "y": 0, "w": 8},
                {"id": "uncorrected-comprehensive", "type": "uncorrected-va", "x": 8, "y": 0, "w": 6},
                {"id": "old-ref-comprehensive", "type": "old-refraction", "x": 14, "y": 0, "w": 10},
                {"id": "objective-comprehensive", "type": "objective", "x": 0, "y": 1, "w": 12},
                {"id": "retinoscop-comprehensive", "type": "retinoscop", "x": 12, "y": 1, "w": 12},
                {"id": "subjective-comprehensive", "type": "subjective", "x": 0, "y": 2, "w": 14},
                {"id": "final-subjective-comprehensive", "type": "final-subjective", "x": 14, "y": 2, "w": 10},
                {"id": "addition-comprehensive", "type": "addition", "x": 0, "y": 3, "w": 8},
                {"id": "final-prescription-comprehensive", "type": "final-prescription", "x": 8, "y": 3, "w": 16},
                {"id": "cover-comprehensive", "type": "cover-test-v2", "x": 0, "y": 4, "w": 12},
                {"id": "notes-comprehensive", "type": "notes", "x": 12, "y": 4, "w": 12},
            ],
        ),
        ("Annual Vision Check", "glass", False, annual_items),
        (
            "Contact Lens Comprehensive", "contact lens", False,
            [
                {"id": "anamnesis-contact", "type": "anamnesis", "x": 0, "y": 0, "w": 8},
                {"id": "old-contact", "type": "old-contact-lenses", "x": 8, "y": 0, "w": 16},
                {"id": "contact-details", "type": "contact-lens-details", "x": 0, "y": 1, "w": 12},
                {"id": "kerato-contact", "type": "keratometer-contact-lens", "x": 12, "y": 1, "w": 12},
                {"id": "contact-exam", "type": "contact-lens-exam", "x": 0, "y": 2, "w": 14},
                {"id": "over-refraction-contact", "type": "over-refraction", "x": 14, "y": 2, "w": 10},
                {"id": "topography-contact", "type": "corneal-topography", "x": 0, "y": 3, "w": 12},
                {"id": "final-contact", "type": "final-prescription", "x": 12, "y": 3, "w": 12},
                {"id": "notes-contact", "type": "notes", "x": 0, "y": 4, "w": 24},
            ],
        ),
        (
            "Contact Lens Fitting", "contact lens", False,
            [
                {"id": "anamnesis-fitting", "type": "anamnesis", "x": 0, "y": 0, "w": 10},
                {"id": "diameters-fitting", "type": "contact-lens-diameters", "x": 10, "y": 0, "w": 7},
                {"id": "kerato-fitting", "type": "keratometer-contact-lens", "x": 17, "y": 0, "w": 7},
                {"id": "details-fitting", "type": "contact-lens-details", "x": 0, "y": 1, "w": 12},
                {"id": "exam-fitting", "type": "contact-lens-exam", "x": 12, "y": 1, "w": 12},
                {"id": "over-refraction-fitting", "type": "over-refraction", "x": 0, "y": 2, "w": 12},
                {"id": "old-contact-fitting", "type": "old-contact-lenses", "x": 12, "y": 2, "w": 12},
                {"id": "notes-fitting", "type": "notes", "x": 0, "y": 3, "w": 24},
            ],
        ),
        (
            "Dry Eye Evaluation", "global", False,
            [
                {"id": "anamnesis-dry", "type": "anamnesis", "x": 0, "y": 0, "w": 10},
                {"id": "schirmer-dry", "type": "schirmer-test", "x": 10, "y": 0, "w": 7},
                {"id": "diameters-dry", "type": "contact-lens-diameters", "x": 17, "y": 0, "w": 7},
                {"id": "topography-dry", "type": "corneal-topography", "x": 0, "y": 1, "w": 12},
                {"id": "objective-dry", "type": "objective", "x": 12, "y": 1, "w": 12},
                {"id": "final-dry", "type": "final-prescription", "x": 0, "y": 2, "w": 12},
                {"id": "notes-dry", "type": "notes", "x": 12, "y": 2, "w": 12},
            ],
        ),
        (
            "Pediatric & Binocular Vision", "global", False,
            [
                {"id": "anamnesis-pediatric", "type": "anamnesis", "x": 0, "y": 0, "w": 8},
                {"id": "uncorrected-pediatric", "type": "uncorrected-va", "x": 8, "y": 0, "w": 8},
                {"id": "stereo-pediatric", "type": "stereo-test", "x": 16, "y": 0, "w": 8},
                {"id": "cover-pediatric", "type": "cover-test-v2", "x": 0, "y": 1, "w": 12},
                {"id": "motor-pediatric", "type": "ocular-motor-assessment", "x": 12, "y": 1, "w": 12},
                {"id": "npc-pediatric", "type": "npc", "x": 0, "y": 2, "w": 8},
                {"id": "fusion-pediatric", "type": "fusion-range", "x": 8, "y": 2, "w": 8},
                {"id": "maddox-pediatric", "type": "maddox-rod", "x": 16, "y": 2, "w": 8},
                {"id": "final-pediatric", "type": "final-prescription", "x": 0, "y": 3, "w": 12},
                {"id": "notes-pediatric", "type": "notes", "x": 12, "y": 3, "w": 12},
            ],
        ),
        (
            "Myopia Management Review", "global", False,
            [
                {"id": "old-ref-myopia", "type": "old-refraction", "x": 0, "y": 0, "w": 10},
                {"id": "kerato-myopia", "type": "keratometer", "x": 10, "y": 0, "w": 7},
                {"id": "topography-myopia", "type": "corneal-topography", "x": 17, "y": 0, "w": 7},
                {"id": "objective-myopia", "type": "objective", "x": 0, "y": 1, "w": 12},
                {"id": "subjective-myopia", "type": "subjective", "x": 12, "y": 1, "w": 12},
                {"id": "final-myopia", "type": "final-prescription", "x": 0, "y": 2, "w": 14},
                {"id": "notes-myopia", "type": "notes", "x": 14, "y": 2, "w": 10},
            ],
        ),
        (
            "Progressive Lens Consultation", "glass", False,
            [
                {"id": "old-ref-progressive", "type": "old-refraction", "x": 0, "y": 0, "w": 12},
                {"id": "subjective-progressive", "type": "subjective", "x": 12, "y": 0, "w": 12},
                {"id": "addition-progressive", "type": "addition", "x": 0, "y": 1, "w": 10},
                {"id": "final-subjective-progressive", "type": "final-subjective", "x": 10, "y": 1, "w": 14},
                {"id": "final-progressive", "type": "final-prescription", "x": 0, "y": 2, "w": 16},
                {"id": "notes-progressive", "type": "notes", "x": 16, "y": 2, "w": 8},
            ],
        ),
        (
            "Computer Vision Assessment", "glass", False,
            [
                {"id": "anamnesis-computer", "type": "anamnesis", "x": 0, "y": 0, "w": 8},
                {"id": "uncorrected-computer", "type": "uncorrected-va", "x": 8, "y": 0, "w": 8},
                {"id": "npc-computer", "type": "npc", "x": 16, "y": 0, "w": 8},
                {"id": "subjective-computer", "type": "subjective", "x": 0, "y": 1, "w": 14},
                {"id": "addition-computer", "type": "addition", "x": 14, "y": 1, "w": 10},
                {"id": "final-computer", "type": "final-prescription", "x": 0, "y": 2, "w": 14},
                {"id": "notes-computer", "type": "notes", "x": 14, "y": 2, "w": 10},
            ],
        ),
        (
            "Dilated Refraction Review", "global", False,
            [
                {"id": "uncorrected-dilated", "type": "uncorrected-va", "x": 0, "y": 0, "w": 6},
                {"id": "objective-dilated", "type": "objective", "x": 6, "y": 0, "w": 9},
                {"id": "retinoscop-dilated", "type": "retinoscop-dilation", "x": 15, "y": 0, "w": 9},
                {"id": "final-subjective-dilated", "type": "final-subjective", "x": 0, "y": 1, "w": 12},
                {"id": "final-dilated", "type": "final-prescription", "x": 12, "y": 1, "w": 12},
                {"id": "notes-dilated", "type": "notes", "x": 0, "y": 2, "w": 24},
            ],
        ),
        (
            "Low Vision Assessment", "global", False,
            [
                {"id": "anamnesis-lowvision", "type": "anamnesis", "x": 0, "y": 0, "w": 8},
                {"id": "uncorrected-lowvision", "type": "uncorrected-va", "x": 8, "y": 0, "w": 8},
                {"id": "old-ref-lowvision", "type": "old-refraction", "x": 16, "y": 0, "w": 8},
                {"id": "subjective-lowvision", "type": "subjective", "x": 0, "y": 1, "w": 12},
                {"id": "final-lowvision", "type": "final-prescription", "x": 12, "y": 1, "w": 12},
                {"id": "notes-lowvision", "type": "notes", "x": 0, "y": 2, "w": 24},
            ],
        ),
        (
            "Keratoconus Lens Review", "contact lens", False,
            [
                {"id": "old-contact-keratoconus", "type": "old-contact-lenses", "x": 0, "y": 0, "w": 12},
                {"id": "kerato-keratoconus", "type": "keratometer-contact-lens", "x": 12, "y": 0, "w": 12},
                {"id": "topography-keratoconus", "type": "corneal-topography", "x": 0, "y": 1, "w": 12},
                {"id": "contact-exam-keratoconus", "type": "contact-lens-exam", "x": 12, "y": 1, "w": 12},
                {"id": "over-refraction-keratoconus", "type": "over-refraction", "x": 0, "y": 2, "w": 12},
                {"id": "notes-keratoconus", "type": "notes", "x": 12, "y": 2, "w": 12},
            ],
        ),
        (
            "Post-Operative Follow-up", "global", False,
            [
                {"id": "anamnesis-postop", "type": "anamnesis", "x": 0, "y": 0, "w": 10},
                {"id": "uncorrected-postop", "type": "uncorrected-va", "x": 10, "y": 0, "w": 7},
                {"id": "schirmer-postop", "type": "schirmer-test", "x": 17, "y": 0, "w": 7},
                {"id": "objective-postop", "type": "objective", "x": 0, "y": 1, "w": 12},
                {"id": "final-postop", "type": "final-prescription", "x": 12, "y": 1, "w": 12},
                {"id": "notes-postop", "type": "notes", "x": 0, "y": 2, "w": 24},
            ],
        ),
    ]
    layouts = [
        ExamLayout(
            clinic_id=clinic_id,
            name=name,
            type=layout_type,
            is_default=is_default,
            is_active=True,
            sort_index=index,
            layout_data=grid(items),
        )
        for index, (name, layout_type, is_default, items) in enumerate(definitions, start=1)
    ]
    _add_in_batches(db, layouts)
    return layouts


def _seed_clients(
    db: Session,
    *,
    company: Company,
    clinic: Clinic,
    volume: DemoVolume,
    rng: random.Random,
    today: date,
) -> tuple[list[Family], list[Client]]:
    families = [
        Family(
            company_id=company.id,
            clinic_id=clinic.id,
            name=f"{LAST_NAMES[index % len(LAST_NAMES)]} Family",
            created_date=today - timedelta(days=rng.randrange(15, 1_300)),
            notes=("Prefers back-to-back family appointments." if index % 7 == 0 else None),
        )
        for index in range(volume.families)
    ]
    _add_in_batches(db, families)

    health_funds = ("clalit", "maccabi", "meuhedet", "leumit", "Private")
    clients: list[Client] = []
    for index in range(volume.clients):
        first_name = FIRST_NAMES[index % len(FIRST_NAMES)]
        last_name = LAST_NAMES[(index * 7 + index // len(FIRST_NAMES)) % len(LAST_NAMES)]
        created = today - timedelta(days=rng.randrange(0, 1_460))
        birth_year = today.year - rng.randrange(7, 88)
        clients.append(
            Client(
                company_id=company.id,
                clinic_id=clinic.id,
                first_name=first_name,
                last_name=last_name,
                gender=("male", "female", "other")[index % 3],
                national_id=f"NSV-{100000 + index:06d}",
                date_of_birth=date(birth_year, rng.randrange(1, 13), rng.randrange(1, 28)),
                health_fund=health_funds[index % len(health_funds)],
                address_city=CITIES[index % len(CITIES)],
                address_street=STREETS[(index * 3) % len(STREETS)],
                address_number=str(10 + (index % 280)),
                postal_code=f"10{index % 900:03d}",
                phone_home=(f"+1 212 555 {3000 + index:04d}" if index % 5 == 0 else None),
                phone_work=(f"+1 646 555 {5000 + index:04d}" if index % 9 == 0 else None),
                phone_mobile=f"+1 917 555 {1000 + index:04d}",
                additional_phone=(f"+1 347 555 {7000 + index:04d}" if index % 11 == 0 else None),
                email=f"{first_name.lower()}.{last_name.lower()}.{index + 1}@northstar-demo.test",
                service_center="Midtown Manhattan",
                file_creation_date=created,
                membership_end=today + timedelta(days=rng.randrange(30, 760)),
                service_end=today + timedelta(days=rng.randrange(30, 760)),
                price_list=("Standard", "Family Care", "Premium Vision")[index % 3],
                discount_percent=(0 if index % 4 else rng.choice((5, 10, 15))),
                blocked_checks=False,
                blocked_credit=False,
                sorting_group=("Corporate", "Family", "Walk-in", "VIP")[index % 4],
                referring_party=("Self", "Dr. Lewis", "VisionCare Network", "Employer Program")[index % 4],
                file_location=f"A-{1 + index // 250:02d}",
                occupation=("Designer", "Teacher", "Software Engineer", "Student", "Attorney", "Retired")[index % 6],
                status="Active",
                notes=(
                    "Prefers text reminders and lightweight frames."
                    if index % 17 == 0
                    else "Annual review recommended." if index % 13 == 0 else None
                ),
                hidden_note=("Verify insurance eligibility before ordering." if index % 41 == 0 else None),
                family_id=families[index % len(families)].id if index % 3 else None,
                family_role=("Parent", "Child", "Partner", "Guardian")[index % 4] if index % 3 else None,
                ai_updated_date=_utc_at(created, 11) if index % 6 == 0 else None,
                client_updated_date=_utc_at(today - timedelta(days=rng.randrange(0, 45)), 12),
            )
        )
    _add_in_batches(db, clients)
    return families, clients


def _regular_order_data(index: int, status: str, rng: random.Random) -> dict[str, Any]:
    brand, model, _ = FRAME_CATALOG[index % len(FRAME_CATALOG)]
    lens_model = ("Varilux XR", "SmartLife Individual 3", "Eyezen Start", "DriveSafe")[index % 4]
    return {
        "details": {
            "order_status": status,
            "notes": ("Client approved the final frame selection." if index % 5 == 0 else ""),
            "lab": ("Essilor Lab", "Zeiss Vision Lab", "Hoya Lab")[index % 3],
        },
        "lens_frame_tabs": [
            {
                "id": f"frame-{index}",
                "type": ("Distance", "Progressive", "Computer", "Sun")[index % 4],
                "lens": {
                    "manufacturer": ("Essilor", "Zeiss", "Hoya")[index % 3],
                    "model": lens_model,
                    "material": ("1.60 Index", "1.67 Index", "1.74 Index")[index % 3],
                    "coating": ("Crizal Sapphire HR", "DuraVision Platinum", "BlueGuard")[index % 3],
                },
                "frame": {
                    "manufacturer": brand,
                    "model": model,
                    "color": ("Tortoise", "Matte Black", "Crystal", "Olive", "Navy")[index % 5],
                    "width": (48, 50, 52, 54)[index % 4],
                    "bridge": (18, 19, 20, 21)[index % 4],
                    "supplier": "Northstar Inventory",
                    "supplied_by": "Inventory" if rng.random() < 0.7 else "Supplier",
                },
            }
        ],
    }


def _contact_order_data(index: int, status: str) -> dict[str, Any]:
    brand, model, lens_type, material = CONTACT_CATALOG[index % len(CONTACT_CATALOG)]
    return {
        "contact_lens_order": {
            "supplier": brand,
            "model": model,
            "type": lens_type,
            "material": material,
            "supply_method": "Clinic pickup" if index % 3 else "Home delivery",
        },
        "details": {"order_status": status, "notes": "Replacement supply confirmed." if index % 4 == 0 else ""},
    }


def _seed_orders_and_billing(
    db: Session,
    *,
    clinic: Clinic,
    clients: Sequence[Client],
    staff: Sequence[User],
    volume: DemoVolume,
    rng: random.Random,
    today: date,
) -> tuple[list[Order], list[ContactLensOrder], list[Billing]]:
    clinical_staff = [user for user in staff if user.role_level == 2]
    regular_orders: list[Order] = []
    for index in range(volume.regular_orders):
        order_date = _weighted_history_date(rng, today)
        status = ORDER_STATUSES[(index * 3 + rng.randrange(0, 3)) % len(ORDER_STATUSES)]
        regular_orders.append(
            Order(
                client_id=clients[(index * 11) % len(clients)].id,
                clinic_id=clinic.id,
                order_date=order_date,
                type=ORDER_TYPES[index % len(ORDER_TYPES)],
                dominant_eye=("Right", "Left", "Balanced")[index % 3],
                user_id=clinical_staff[index % len(clinical_staff)].id,
                order_data=_regular_order_data(index, status, rng),
            )
        )
    _add_in_batches(db, regular_orders)

    contact_orders: list[ContactLensOrder] = []
    for index in range(volume.contact_orders):
        order_date = _weighted_history_date(rng, today)
        status = ORDER_STATUSES[(index * 5 + 1) % len(ORDER_STATUSES)]
        brand, model, lens_type, material = CONTACT_CATALOG[index % len(CONTACT_CATALOG)]
        contact_orders.append(
            ContactLensOrder(
                client_id=clients[(index * 17 + 3) % len(clients)].id,
                clinic_id=clinic.id,
                user_id=clinical_staff[(index + 2) % len(clinical_staff)].id,
                order_date=order_date,
                type=f"{lens_type} Contact Lenses",
                l_lens_type=lens_type,
                l_model=model,
                l_supplier=brand,
                l_material=material,
                l_color="Clear",
                l_quantity=6,
                l_order_quantity=(3, 6, 12)[index % 3],
                l_dx=False,
                r_lens_type=lens_type,
                r_model=model,
                r_supplier=brand,
                r_material=material,
                r_color="Clear",
                r_quantity=6,
                r_order_quantity=(3, 6, 12)[index % 3],
                r_dx=False,
                supply_in_clinic_id=clinic.id,
                order_status=status,
                advisor=("Mia Chen", "Sofia Patel", "Ryan Brooks")[index % 3],
                deliverer=("Clinic Pickup", "Courier", "Home Delivery")[index % 3],
                delivery_date=order_date + timedelta(days=7 + index % 9),
                priority=("Routine", "Priority", "Rush")[index % 3],
                guaranteed_date=order_date + timedelta(days=10 + index % 8),
                approval_date=order_date + timedelta(days=index % 3),
                cleaning_solution=("Biotrue", "Clear Care Plus", "Opti-Free Puremoist")[index % 3],
                disinfection_solution=("Biotrue", "Clear Care Plus", "RevitaLens")[index % 3],
                rinsing_solution=("Sterile Saline", "Biotrue", "Opti-Free Puremoist")[index % 3],
                notes=("Client prefers a three-month supply." if index % 6 == 0 else None),
                supplier_notes=("Confirm cylinder axis before dispatch." if lens_type == "Toric" and index % 4 == 0 else None),
                order_data=_contact_order_data(index, status),
            )
        )
    _add_in_batches(db, contact_orders)

    billings: list[Billing] = []
    line_items: list[OrderLineItem] = []
    payments: list[BillingPayment] = []
    for index, order in enumerate(regular_orders):
        frame_price = float((145, 185, 245, 310, 390)[index % 5])
        lens_price = float((165, 220, 285, 360)[index % 4])
        extras = float((0, 25, 45, 70)[index % 4])
        before_discount = frame_price + lens_price + extras
        discount_percent = float((0, 0, 5, 10)[index % 4])
        discount_amount = round(before_discount * discount_percent / 100, 2)
        total = round(before_discount - discount_amount, 2)
        payment_ratio = (1.0, 1.0, 0.7, 0.45, 0.0)[index % 5]
        billing = Billing(
            order_id=order.id,
            total_before_discount=before_discount,
            discount_amount=discount_amount,
            discount_percent=discount_percent,
            total_after_discount=total,
            prepayment_amount=round(total * payment_ratio, 2),
            installment_count=(1, 1, 2, 3)[index % 4],
            notes=("Insurance reimbursement pending." if index % 9 == 0 else None),
            currency=DEMO_CURRENCY,
        )
        billings.append(billing)
    for index, order in enumerate(contact_orders):
        unit_price = float((55, 75, 105, 145)[index % 4])
        quantity = float((1, 1, 2, 4)[index % 4])
        before_discount = unit_price * quantity
        discount_percent = float((0, 5, 10)[index % 3])
        discount_amount = round(before_discount * discount_percent / 100, 2)
        total = round(before_discount - discount_amount, 2)
        payment_ratio = (1.0, 1.0, 0.7, 0.45, 0.0)[(index + len(regular_orders)) % 5]
        billings.append(
            Billing(
                contact_lens_id=order.id,
                total_before_discount=before_discount,
                discount_amount=discount_amount,
                discount_percent=discount_percent,
                total_after_discount=total,
                prepayment_amount=round(total * payment_ratio, 2),
                installment_count=(1, 1, 3)[index % 3],
                notes=("Annual supply plan." if index % 7 == 0 else None),
                currency=DEMO_CURRENCY,
            )
        )
    _add_in_batches(db, billings)

    for index, (order, billing) in enumerate(zip(regular_orders, billings[:len(regular_orders)])):
        frame_brand, frame_model, _ = FRAME_CATALOG[index % len(FRAME_CATALOG)]
        frame_price = float((145, 185, 245, 310, 390)[index % 5])
        lens_price = float((165, 220, 285, 360)[index % 4])
        line_items.extend(
            [
                OrderLineItem(
                    billings_id=billing.id,
                    sku=f"FRM-{index % len(FRAME_CATALOG):03d}",
                    description=f"{frame_brand} {frame_model} frame",
                    supplied_by="Northstar Inventory",
                    supplied=order.order_data["details"]["order_status"] == "נמסר ללקוח",
                    price=frame_price,
                    quantity=1,
                    discount=0,
                    line_total=frame_price,
                    currency=DEMO_CURRENCY,
                ),
                OrderLineItem(
                    billings_id=billing.id,
                    sku=f"LNS-{index % 12:03d}",
                    description=f"{order.order_data['lens_frame_tabs'][0]['lens']['model']} prescription lenses",
                    supplied_by="Essilor Lab",
                    supplied=order.order_data["details"]["order_status"] == "נמסר ללקוח",
                    price=lens_price,
                    quantity=1,
                    discount=0,
                    line_total=lens_price,
                    currency=DEMO_CURRENCY,
                ),
            ]
        )
    contact_billings = billings[len(regular_orders):]
    for index, (order, billing) in enumerate(zip(contact_orders, contact_billings)):
        quantity = float((1, 1, 2, 4)[index % 4])
        unit_price = float((55, 75, 105, 145)[index % 4])
        line_items.append(
            OrderLineItem(
                billings_id=billing.id,
                sku=f"CL-{index % len(CONTACT_CATALOG):03d}",
                description=f"{order.l_supplier} {order.l_model} supply",
                supplied_by=order.l_supplier,
                supplied=order.order_status == "נמסר ללקוח",
                price=unit_price,
                quantity=quantity,
                discount=0,
                line_total=unit_price * quantity,
                currency=DEMO_CURRENCY,
            )
        )
    _add_in_batches(db, line_items)

    for index, billing in enumerate(billings):
        total = float(billing.total_after_discount or 0)
        source_order = regular_orders[index] if index < len(regular_orders) else contact_orders[index - len(regular_orders)]
        order_day = source_order.order_date or today
        paid = float(billing.prepayment_amount or 0)
        if paid:
            first_payment = round(paid * (0.55 if index % 4 == 0 else 1), 2)
            payments.append(
                BillingPayment(
                    billing_id=billing.id,
                    amount=first_payment,
                    paid_at=min(today, order_day + timedelta(days=index % 5)),
                    kind="payment",
                    currency=DEMO_CURRENCY,
                )
            )
            if paid > first_payment:
                payments.append(
                    BillingPayment(
                        billing_id=billing.id,
                        amount=round(paid - first_payment, 2),
                    paid_at=min(today, order_day + timedelta(days=12 + index % 11)),
                    kind="payment",
                    currency=DEMO_CURRENCY,
                    )
                )
    _add_in_batches(db, payments)
    return regular_orders, contact_orders, billings


def _seed_appointments(
    db: Session,
    *,
    clinic: Clinic,
    clients: Sequence[Client],
    staff: Sequence[User],
    layouts: Sequence[ExamLayout],
    volume: DemoVolume,
    today: date,
) -> list[Appointment]:
    clinicians = [user for user in staff if user.role_level in {2, 3}]
    slots = ("08:30", "09:00", "09:30", "10:15", "11:00", "11:30", "14:00", "14:30", "15:15", "16:00", "16:30", "17:15")
    past_days = _business_days(today - timedelta(days=365), today - timedelta(days=1))
    future_days = _business_days(today, today + timedelta(days=95))
    appointments: list[Appointment] = []

    def add_schedule(count: int, days: Sequence[date], client_offset: int) -> None:
        for index in range(count):
            day_position = index % len(days)
            cycle = index // len(days)
            exam_index = (index + client_offset) % len(EXAM_NAMES)
            appointments.append(
                Appointment(
                    client_id=clients[(index * 13 + client_offset) % len(clients)].id,
                    clinic_id=clinic.id,
                    user_id=clinicians[(cycle + day_position) % len(clinicians)].id,
                    date=days[day_position],
                    time=slots[(cycle + day_position * 2) % len(slots)],
                    duration=(30, 30, 45, 60)[(index + client_offset) % 4],
                    exam_name=EXAM_NAMES[exam_index],
                    exam_layout_id=layouts[exam_index % len(layouts)].id,
                    note=(
                        "First visit — allow extra time for history."
                        if index % 19 == 0
                        else "Bring current glasses and contact lens boxes." if index % 23 == 0 else None
                    ),
                )
            )

    add_schedule(volume.appointments_past, past_days, 0)
    add_schedule(volume.appointments_future, future_days, 41)
    _add_in_batches(db, appointments)
    email_logs = [
        EmailLog(
            appointment_id=appointment.id,
            email_address=clients[(index * 13) % len(clients)].email or "",
            sent_at=_utc_at(appointment.date or today, 9),
            success=index % 37 != 0,
            error_message="Mailbox temporarily unavailable" if index % 37 == 0 else None,
        )
        for index, appointment in enumerate(appointments[: min(520, len(appointments))])
        if appointment.date and appointment.date >= today - timedelta(days=120)
    ]
    _add_in_batches(db, email_logs)
    return appointments


def _prescription_values(index: int) -> dict[str, Any]:
    """Return a varied, complete refraction shared by the relevant cards."""
    r_sph = round(-4.5 + (index % 37) * 0.25, 2)
    l_sph = round(r_sph + (-0.5, -0.25, 0, 0.25)[index % 4], 2)
    r_cyl = round(-0.25 * (1 + index % 7), 2)
    l_cyl = round(-0.25 * (1 + (index + 3) % 7), 2)
    return {
        "r_sph": r_sph,
        "l_sph": l_sph,
        "r_cyl": r_cyl,
        "l_cyl": l_cyl,
        "r_ax": (index * 13 + 5) % 180,
        "l_ax": (index * 17 + 11) % 180,
        "r_pris": 0 if index % 9 else 0.5,
        "l_pris": 0 if index % 11 else 0.5,
        "r_base": "Out" if index % 9 == 0 else "",
        "l_base": "In" if index % 11 == 0 else "",
        "r_va": ("6/6", "6/6-1", "6/7.5")[index % 3],
        "l_va": ("6/6", "6/6-1", "6/7.5")[(index + 1) % 3],
        "r_ad": (1.0, 1.25, 1.5, 1.75, 2.0)[index % 5],
        "l_ad": (1.0, 1.25, 1.5, 1.75, 2.0)[index % 5],
        "r_pd": (30.5, 31, 31.5, 32)[index % 4],
        "l_pd": (30.5, 31, 31.5, 32)[(index + 1) % 4],
        "comb_va": "6/6",
        "comb_pd": (61.5, 62, 62.5, 63)[index % 4],
    }


def _component_payload(component_type: str, card_id: str, index: int) -> dict[str, Any]:
    """Create renderer-compatible, populated clinical values for one layout card."""
    rx = _prescription_values(index)
    contact_brand, contact_model, lens_type, material = CONTACT_CATALOG[index % len(CONTACT_CATALOG)]
    if component_type == "anamnesis":
        return {
            "medications": "None reported" if index % 4 else "Seasonal allergy medication",
            "allergies": "No known drug allergies" if index % 5 else "Latex sensitivity",
            "family_history": ("Father treated for glaucoma" if index % 7 == 0 else "No glaucoma or macular degeneration reported"),
            "previous_treatments": "Lubricating drops as needed" if index % 3 == 0 else "Routine annual eye examinations",
            "lazy_eye": "No" if index % 8 else "Childhood patching, stable",
            "contact_lens_wear": index % 3 == 0,
            "contact_lens_type": lens_type if index % 3 == 0 else "",
            "started_wearing_since": str(2010 + index % 13) if index % 3 == 0 else "",
            "additional_notes": ("Reports increased screen use; discussed 20-20-20 breaks." if index % 2 else "Driving comfort and night glare reviewed."),
        }
    if component_type == "uncorrected-va":
        return {"r_fv": ("6/18", "6/12", "6/9")[index % 3], "l_fv": ("6/18", "6/12", "6/9")[(index + 1) % 3], "r_iv": "6/9", "l_iv": "6/9", "r_nv_j": "J3", "l_nv_j": "J3"}
    if component_type in {"old-refraction", "old-refraction-extension"}:
        return {**rx, "r_sph": round(rx["r_sph"] - 0.25, 2), "l_sph": round(rx["l_sph"] - 0.25, 2), "r_j": "J1", "l_j": "J1", "r_pd_far": rx["r_pd"], "l_pd_far": rx["l_pd"], "r_pd_close": 29.5, "l_pd_close": 29.5, "comb_pd_far": rx["comb_pd"], "comb_pd_close": 59}
    if component_type == "objective":
        return {key: rx[key] for key in ("r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax")} | {"r_se": round(rx["r_sph"] + rx["r_cyl"] / 2, 2), "l_se": round(rx["l_sph"] + rx["l_cyl"] / 2, 2)}
    if component_type in {"retinoscop", "retinoscop-dilation"}:
        return {key: rx[key] for key in ("r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax")} | {"r_reflex": "Bright and neutral", "l_reflex": "Bright and neutral"}
    if component_type == "subjective":
        return {**rx, "r_fa": "6/6", "l_fa": "6/6", "r_fa_tuning": "Plano", "l_fa_tuning": "Plano", "r_ph": "6/6", "l_ph": "6/6", "r_pd_far": rx["r_pd"], "l_pd_far": rx["l_pd"], "r_pd_close": 29.5, "l_pd_close": 29.5, "comb_pd_far": rx["comb_pd"], "comb_pd_close": 59}
    if component_type == "final-subjective":
        return {**rx, "r_pr_h": rx["r_pris"], "l_pr_h": rx["l_pris"], "r_base_h": rx["r_base"], "l_base_h": rx["l_base"], "r_pr_v": 0, "l_pr_v": 0, "r_base_v": "", "l_base_v": "", "r_j": "J1", "l_j": "J1", "r_pd_far": rx["r_pd"], "l_pd_far": rx["l_pd"], "r_pd_close": 29.5, "l_pd_close": 29.5, "comb_pd_far": rx["comb_pd"], "comb_pd_close": 59}
    if component_type == "final-prescription":
        return {**rx, "r_high": 18, "l_high": 18, "r_diam": 65, "l_diam": 65, "comb_high": 18}
    if component_type == "addition":
        add = rx["r_ad"]
        return {"r_fcc": add, "l_fcc": add, "r_read": add, "l_read": add, "r_int": round(add - 0.5, 2), "l_int": round(add - 0.5, 2), "r_bif": add, "l_bif": add, "r_mul": add, "l_mul": add, "r_j": "J1", "l_j": "J1", "r_iop": 14 + index % 5, "l_iop": 13 + index % 5}
    if component_type == "keratometer":
        return {"r_k1": 43.0 + (index % 8) * 0.1, "r_k2": 43.8 + (index % 7) * 0.1, "r_axis": (index * 11) % 180, "l_k1": 43.1 + (index % 8) * 0.1, "l_k2": 43.9 + (index % 7) * 0.1, "l_axis": (index * 13) % 180}
    if component_type == "corneal-topography":
        return {"title": "Corneal Topography", "r_note": "Regular central pattern; no ectatic change noted.", "l_note": "Regular central pattern; mild inferior steepening monitored."}
    if component_type == "cover-test-v2":
        return {"cc_far_horizontal_prism": 2, "cc_far_horizontal_deviation": "Exophoria", "cc_near_horizontal_prism": 4, "cc_near_horizontal_deviation": "Exophoria", "cc_far_vertical_prism": 0, "cc_far_vertical_deviation": "Iso", "cc_near_vertical_prism": 0, "cc_near_vertical_deviation": "Iso", "sc_far_horizontal_prism": 4, "sc_far_horizontal_deviation": "Exophoria", "sc_near_horizontal_prism": 6, "sc_near_horizontal_deviation": "Exophoria", "sc_far_vertical_prism": 0, "sc_far_vertical_deviation": "Iso", "sc_near_vertical_prism": 0, "sc_near_vertical_deviation": "Iso"}
    if component_type == "stereo-test":
        return {"fly_result": True, "circle_score": 8 + index % 2, "circle_max": 9}
    if component_type == "ocular-motor-assessment":
        return {"ocular_motility": "Full and smooth in all gazes", "acc_od": 10 + index % 4, "acc_os": 10 + index % 3, "npc_break": 6 + index % 3, "npc_recovery": 8 + index % 3}
    if component_type == "npc":
        return {"ocular_motility": "Full and smooth", "eye_out_at_break": "None", "npc_break": 6 + index % 3, "npc_recovery": 8 + index % 3}
    if component_type == "fusion-range":
        return {"fv_base_in": 12, "fv_base_in_recovery": 8, "fv_base_out": 18, "fv_base_out_recovery": 12, "nv_base_in": 16, "nv_base_in_recovery": 10, "nv_base_out": 24, "nv_base_out_recovery": 16}
    if component_type == "maddox-rod":
        return {"schema_version": 2, "with_horizontal_prism": 1, "with_horizontal_direction": "EXO", "with_vertical_prism": 0, "with_vertical_direction": "R/L", "without_horizontal_prism": 2, "without_horizontal_direction": "EXO", "without_vertical_prism": 0, "without_vertical_direction": "L/R"}
    if component_type == "schirmer-test":
        return {"r_mm": 10 + index % 8, "l_mm": 10 + (index + 2) % 8, "r_but": 7 + index % 5, "l_but": 7 + (index + 1) % 5}
    if component_type == "contact-lens-diameters":
        return {"pupil_diameter": 3.2 + (index % 4) * 0.1, "corneal_diameter": 11.7 + (index % 3) * 0.1, "eyelid_aperture": 10.5 + (index % 3) * 0.2}
    if component_type == "keratometer-contact-lens":
        return {"r_rh": 43.25, "r_rv": 43.75, "r_avg": 43.5, "r_cyl": -0.5, "r_ax": rx["r_ax"], "r_ecc": 0.52, "l_rh": 43.5, "l_rv": 44.0, "l_avg": 43.75, "l_cyl": -0.5, "l_ax": rx["l_ax"], "l_ecc": 0.53}
    if component_type == "contact-lens-details":
        values = {"lens_type": lens_type, "model": contact_model, "supplier": contact_brand, "material": material, "color": "Clear", "quantity": 6, "order_quantity": (3, 6, 12)[index % 3], "dx": False}
        return {f"{eye}_{field}": value for eye in ("r", "l") for field, value in values.items()}
    if component_type == "old-contact-lenses":
        return {"r_bc": 8.6, "l_bc": 8.6, "r_diam": 14.0, "l_diam": 14.0, "r_sph": rx["r_sph"], "l_sph": rx["l_sph"], "r_cyl": rx["r_cyl"], "l_cyl": rx["l_cyl"], "r_ax": rx["r_ax"], "l_ax": rx["l_ax"], "r_va": "6/6", "l_va": "6/6", "r_j": "J1", "l_j": "J1", "r_lens_type": lens_type, "l_lens_type": lens_type, "r_model": contact_model, "l_model": contact_model, "r_supplier": contact_brand, "l_supplier": contact_brand, "comb_va": "6/6", "comb_j": "J1"}
    if component_type == "contact-lens-exam":
        return {"r_bc": 8.6, "l_bc": 8.6, "r_bc_2": 0, "l_bc_2": 0, "r_oz": 8.0, "l_oz": 8.0, "r_diam": 14.0, "l_diam": 14.0, "r_sph": rx["r_sph"], "l_sph": rx["l_sph"], "r_cyl": rx["r_cyl"], "l_cyl": rx["l_cyl"], "r_ax": rx["r_ax"], "l_ax": rx["l_ax"], "r_read_ad": rx["r_ad"], "l_read_ad": rx["l_ad"], "r_va": "6/6", "l_va": "6/6", "r_j": "J1", "l_j": "J1", "comb_va": "6/6"}
    if component_type == "over-refraction":
        return {**{key: rx[key] for key in ("r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax", "r_va", "l_va")}, "r_j": "J1", "l_j": "J1", "comb_va": "6/6", "comb_j": "J1", "r_add": rx["r_ad"], "l_add": rx["l_ad"], "r_florescent": "Even alignment", "l_florescent": "Even alignment", "r_bio_m": "Clear cornea", "l_bio_m": "Clear cornea"}
    if component_type == "notes":
        notes = ("Reviewed updated prescription and visual ergonomics. Client is comfortable with the care plan.", "Discussed lens options, adaptation expectations, and a 12-month follow-up.", "Ocular health findings stable. Advised to return sooner for pain, flashes, or sudden visual change.")
        return {"card_instance_id": card_id, "title": ("Clinical Assessment", "Treatment Plan", "Follow-up Notes")[index % 3], "note": notes[index % len(notes)]}
    return {}


def _exam_payload(index: int, layout_data: str) -> dict[str, Any]:
    """Populate every card in a v2 layout using its real card ID as the data key."""
    try:
        items = json.loads(layout_data).get("items", [])
    except (TypeError, json.JSONDecodeError):
        items = []
    return {
        f"{item['type']}-{item['id']}": _component_payload(item["type"], item["id"], index)
        for item in items
        if item.get("type") and item.get("id")
    }


def _seed_exams_and_clinical_history(
    db: Session,
    *,
    clinic: Clinic,
    clients: Sequence[Client],
    staff: Sequence[User],
    layouts: Sequence[ExamLayout],
    volume: DemoVolume,
    rng: random.Random,
    today: date,
) -> list[OpticalExam]:
    clinicians = [user for user in staff if user.role_level == 2]
    exams = [
        OpticalExam(
            client_id=clients[(index * 19) % len(clients)].id,
            clinic_id=clinic.id,
            clinic=clinic.name,
            user_id=clinicians[index % len(clinicians)].id,
            exam_date=today - timedelta(days=rng.randrange(0, 760)),
            test_name=EXAM_NAMES[index % len(EXAM_NAMES)],
            dominant_eye=("Right", "Left", "Balanced")[index % 3],
            type=("contact-lens" if index % 6 == 2 else "exam"),
        )
        for index in range(volume.exams)
    ]
    _add_in_batches(db, exams)
    instances = [
        ExamLayoutInstance(
            exam_id=exams[index].id,
            layout_id=layouts[index % len(layouts)].id,
            is_active=True,
            order=0,
            # Layout-instance IDs are optional in persisted component payloads;
            # omitting them keeps this high-volume seed as insert-only.
            exam_data=_exam_payload(index, layouts[index % len(layouts)].layout_data),
            layout_data=layouts[index % len(layouts)].layout_data,
        )
        for index in range(len(exams))
    ]
    _add_in_batches(db, instances)
    search_rows: list[PrescriptionSearchIndex] = []
    for index, instance in enumerate(instances):
        prescription = _prescription_values(index)
        exam = exams[index]
        for eye in ("right", "left"):
            search_rows.append(
                PrescriptionSearchIndex(
                    source_type="exam_layout",
                    source_id=instance.id,
                    client_id=exam.client_id,
                    clinic_id=clinic.id,
                    exam_id=exam.id,
                    layout_instance_id=instance.id,
                    card_type="final-prescription",
                    source_date=exam.exam_date,
                    eye=eye,
                    sph=prescription["r_sph" if eye == "right" else "l_sph"],
                    cyl=prescription["r_cyl" if eye == "right" else "l_cyl"],
                    ax=prescription["r_ax" if eye == "right" else "l_ax"],
                    va="6/6",
                    pd=31.5,
                )
            )
    _add_in_batches(db, search_rows)

    referrals = [
        Referral(
            client_id=clients[(index * 31) % len(clients)].id,
            clinic_id=clinic.id,
            user_id=clinicians[index % len(clinicians)].id,
            referral_notes=("Please assess persistent dry-eye symptoms and ocular surface comfort." if index % 2 else "Please assess retinal health following reported flashes."),
            prescription_notes="Current prescription attached. Client requests a written summary.",
            date=today - timedelta(days=rng.randrange(0, 440)),
            type=("Ophthalmology", "Dry Eye Specialist", "Retina Clinic")[index % 3],
            urgency_level=("Routine", "Priority", "Urgent")[index % 3],
            recipient=("Dr. Hannah Lee", "Dr. Marcus Green", "Dr. Olivia Ford")[index % 3],
            referral_data={"status": ("Sent", "Acknowledged", "Completed")[index % 3]},
        )
        for index in range(volume.referrals)
    ]
    _add_in_batches(db, referrals)
    _add_in_batches(
        db,
        [
            ReferralEye(
                referral_id=referral.id,
                eye=eye,
                sph=round(-2.5 + (index % 10) * 0.25, 2),
                cyl=round(-0.25 * (index % 5), 2),
                ax=(index * 15) % 180,
                va=1.0,
                add_power=1.5 if index % 4 == 0 else None,
                pd=31.5,
            )
            for index, referral in enumerate(referrals)
            for eye in ("R", "L")
        ],
    )
    _add_in_batches(
        db,
        [
            MedicalLog(
                client_id=clients[(index * 23) % len(clients)].id,
                clinic_id=clinic.id,
                user_id=clinicians[index % len(clinicians)].id,
                log_date=today - timedelta(days=rng.randrange(0, 540)),
                log=(
                    "Reviewed ocular comfort and advised regular screen breaks."
                    if index % 2 else "Updated spectacle wear history and discussed adaptation expectations."
                ),
            )
            for index in range(volume.medical_logs)
        ],
    )
    return exams


def _create_catalog_variant(
    *,
    company_id: int,
    product: CatalogProduct,
    attributes: dict[str, Any],
    sku: str,
    barcode: str,
    cost: float,
    retail: float,
) -> CatalogVariant:
    product_data = {
        "brand": product.brand,
        "model": product.model,
        "product_type": product.product_type,
        "material": product.material,
        "preferred_supplier": product.preferred_supplier,
        "replacement_schedule": product.replacement_schedule,
    }
    return CatalogVariant(
        company_id=company_id,
        product_id=product.id,
        attributes=attributes,
        normalized_fingerprint=normalized_variant_fingerprint(product.category, product_data, attributes),
        sku=sku,
        barcode=barcode,
        default_cost=cost,
        default_retail=retail,
        currency=DEMO_CURRENCY,
        is_stockable=True,
    )


def _seed_inventory(
    db: Session,
    *,
    company: Company,
    clinic: Clinic,
    staff: Sequence[User],
    regular_orders: Sequence[Order],
    contact_orders: Sequence[ContactLensOrder],
    volume: DemoVolume,
    rng: random.Random,
    today: date,
) -> list[CatalogVariant]:
    products: list[CatalogProduct] = []
    variants: list[CatalogVariant] = []
    for index in range(volume.frames // 2):
        brand, model, material = FRAME_CATALOG[index % len(FRAME_CATALOG)]
        supplier = FRAME_SUPPLIERS[index % len(FRAME_SUPPLIERS)]
        product_data = {
            "brand": brand,
            "model": f"{model} {1 + index // len(FRAME_CATALOG)}",
            "product_type": "Optical Frame",
            "material": material,
            "preferred_supplier": supplier,
            "replacement_schedule": None,
        }
        products.append(
            CatalogProduct(
                company_id=company.id,
                category="frame",
                normalized_key=f"frame|{normalized_product_key(product_data)}",
                **product_data,
            )
        )
    for index in range(volume.contacts // 4):
        brand, model, lens_type, material = CONTACT_CATALOG[index % len(CONTACT_CATALOG)]
        supplier = CONTACT_SUPPLIERS[index % len(CONTACT_SUPPLIERS)]
        product_data = {
            "brand": brand,
            "model": f"{model} {1 + index // len(CONTACT_CATALOG)}",
            "product_type": lens_type,
            "material": material,
            "preferred_supplier": supplier,
            "replacement_schedule": ("Daily" if lens_type == "Daily" else "Monthly"),
        }
        products.append(
            CatalogProduct(
                company_id=company.id,
                category="contact_lens",
                normalized_key=f"contact_lens|{normalized_product_key(product_data)}",
                **product_data,
            )
        )
    _add_in_batches(db, products)

    frame_products = [product for product in products if product.category == "frame"]
    contact_products = [product for product in products if product.category == "contact_lens"]
    for index in range(volume.frames):
        product = frame_products[index % len(frame_products)]
        attributes = {
            "color": ("Tortoise", "Matte Black", "Crystal", "Olive", "Navy", "Rose Gold")[index % 6],
            "eye_size": (46, 48, 50, 52, 54)[index % 5],
            "bridge": (18, 19, 20, 21)[index % 4],
            "temple_length": (135, 140, 145)[index % 3],
        }
        variants.append(
            _create_catalog_variant(
                company_id=company.id,
                product=product,
                attributes=attributes,
                sku=f"NS-FRM-{index + 1:04d}",
                barcode=f"810000{index + 1:06d}",
                cost=float(55 + (index % 8) * 14),
                retail=float(145 + (index % 8) * 42),
            )
        )
    sphere_values = (-6.0, -5.5, -4.5, -3.5, -2.5, -1.5, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0)
    for index in range(volume.contacts):
        product = contact_products[index % len(contact_products)]
        product_variant_round = index // len(contact_products)
        attributes: dict[str, Any] = {
            "sph": sphere_values[(index + product_variant_round) % len(sphere_values)],
            "bc": 8.5 if (index + product_variant_round) % 2 else 8.6,
            "dia": 14.2 if (index + product_variant_round) % 3 else 14.1,
            "pack_size": (30, 90, 6)[(index + product_variant_round) % 3],
        }
        if "Toric" in (product.product_type or ""):
            attributes.update({"cyl": -0.75 if index % 2 else -1.25, "axis": (10, 90, 180)[index % 3]})
        variants.append(
            _create_catalog_variant(
                company_id=company.id,
                product=product,
                attributes=attributes,
                sku=f"NS-CL-{index + 1:04d}",
                barcode=f"820000{index + 1:06d}",
                cost=float(22 + (index % 7) * 9),
                retail=float(55 + (index % 7) * 22),
            )
        )
    _add_in_batches(db, variants)

    balances: list[InventoryBalance] = []
    for index, variant in enumerate(variants):
        on_hand = 0 if index % 19 == 0 else 4 + (index * 7) % 54
        balances.append(
            InventoryBalance(
                company_id=company.id,
                clinic_id=clinic.id,
                variant_id=variant.id,
                on_hand=on_hand,
                reserved=0,
                reorder_point=(5, 8, 12, 16)[index % 4],
                target_quantity=(24, 36, 48, 60)[index % 4],
                version=1,
            )
        )
    _add_in_batches(db, balances)
    balance_by_variant = {balance.variant_id: balance for balance in balances}

    allocations: list[OrderInventoryAllocation] = []
    observations: list[CatalogOrderObservation] = []
    reserved_by_variant: dict[int, int] = {}
    candidate_orders = list(regular_orders[-min(480, len(regular_orders)):])
    for index, order in enumerate(candidate_orders):
        variant = variants[index % len(variants)]
        status = str((order.order_data or {}).get("details", {}).get("order_status") or "")
        is_delivered = status == "נמסר ללקוח"
        source = "inventory" if index % 4 else "supplier_ordered"
        lifecycle = "consumed" if is_delivered else ("supplier_ordered" if source == "supplier_ordered" else "reserved")
        allocations.append(
            OrderInventoryAllocation(
                company_id=company.id,
                clinic_id=clinic.id,
                variant_id=variant.id,
                order_id=order.id,
                component="frame",
                quantity=1,
                fulfillment_source=source,
                lifecycle_state=lifecycle,
                snapshot_fingerprint=variant.normalized_fingerprint,
                consumed_at=_utc_at(order.order_date, 15) if is_delivered and order.order_date else None,
            )
        )
        if lifecycle == "reserved":
            reserved_by_variant[variant.id] = reserved_by_variant.get(variant.id, 0) + 1
        if order.order_date:
            observations.append(
                CatalogOrderObservation(
                    company_id=company.id,
                    clinic_id=clinic.id,
                    variant_id=variant.id,
                    order_id=order.id,
                    component="frame",
                    observed_on=order.order_date,
                    quantity=1,
                )
            )
    for index, order in enumerate(contact_orders[-min(180, len(contact_orders)):]):
        variant = variants[volume.frames + (index % max(1, len(variants) - volume.frames))]
        source = "inventory" if index % 3 else "supplier_ordered"
        is_delivered = order.order_status == "נמסר ללקוח"
        lifecycle = "consumed" if is_delivered else ("supplier_ordered" if source == "supplier_ordered" else "reserved")
        allocations.append(
            OrderInventoryAllocation(
                company_id=company.id,
                clinic_id=clinic.id,
                variant_id=variant.id,
                contact_lens_order_id=order.id,
                component="contact_right",
                quantity=1,
                fulfillment_source=source,
                lifecycle_state=lifecycle,
                snapshot_fingerprint=variant.normalized_fingerprint,
                consumed_at=_utc_at(order.order_date, 15) if is_delivered and order.order_date else None,
            )
        )
        if lifecycle == "reserved":
            reserved_by_variant[variant.id] = reserved_by_variant.get(variant.id, 0) + 1
        if order.order_date:
            observations.append(
                CatalogOrderObservation(
                    company_id=company.id,
                    clinic_id=clinic.id,
                    variant_id=variant.id,
                    contact_lens_order_id=order.id,
                    component="contact_right",
                    observed_on=order.order_date,
                    quantity=1,
                )
            )
    for variant_id, reserved in reserved_by_variant.items():
        balance = balance_by_variant[variant_id]
        balance.reserved = min(reserved, balance.on_hand)
    _add_in_batches(db, allocations)
    _add_in_batches(db, observations)

    inventory_actor = next(user for user in staff if user.role_level == 3)
    movements: list[InventoryMovement] = []
    for index, balance in enumerate(balances):
        initial = max(balance.on_hand + 12, 18)
        movements.extend(
            [
                InventoryMovement(
                    company_id=company.id,
                    clinic_id=clinic.id,
                    variant_id=balance.variant_id,
                    balance_id=balance.id,
                    movement_type="import",
                    on_hand_delta=initial,
                    reserved_delta=0,
                    reason="Opening inventory import",
                    actor_user_id=inventory_actor.id,
                    idempotency_key=f"northstar-demo-opening-{balance.variant_id}",
                    movement_metadata={"source": "demo-seed"},
                    created_at=_utc_at(today - timedelta(days=180 + index % 60), 9),
                ),
                InventoryMovement(
                    company_id=company.id,
                    clinic_id=clinic.id,
                    variant_id=balance.variant_id,
                    balance_id=balance.id,
                    movement_type="consume",
                    on_hand_delta=-(initial - balance.on_hand),
                    reserved_delta=0,
                    reason="Historical fulfilled orders",
                    actor_user_id=inventory_actor.id,
                    idempotency_key=f"northstar-demo-demand-{balance.variant_id}",
                    movement_metadata={"source": "demo-seed", "component": "frame"},
                    created_at=_utc_at(today - timedelta(days=20 + index % 80), 15),
                ),
            ]
        )
    _add_in_batches(db, movements)
    db.add(
        InventoryCompanySettings(
            company_id=company.id,
            default_reorder_point=8,
            default_target_quantity=36,
            discovery_intro_acknowledged_at=_utc_at(today - timedelta(days=60)),
        )
    )
    db.flush()
    return variants


def _seed_supporting_activity(
    db: Session,
    *,
    clinic: Clinic,
    clients: Sequence[Client],
    staff: Sequence[User],
    today: date,
) -> None:
    clinic_staff = [user for user in staff if user.clinic_id == clinic.id and user.is_active]
    past_workdays = _business_days(today - timedelta(days=150), today)
    shifts = [
        WorkShift(
            user_id=user.id,
            start_time="08:30",
            end_time="17:30",
            duration_minutes=540 if (day_index + user_index) % 5 else 510,
            date=work_day.isoformat(),
            status="completed",
        )
        for user_index, user in enumerate(clinic_staff)
        for day_index, work_day in enumerate(past_workdays)
        if (day_index + user_index) % 9 != 0
    ]
    _add_in_batches(db, shifts)

    campaigns = [
        Campaign(
            clinic_id=clinic.id,
            name=name,
            filters=filters,
            email_enabled=True,
            email_content=content,
            sms_enabled=index % 2 == 0,
            sms_content="Northstar Vision Group: your eye-care reminder is ready.",
            whatsapp_enabled=index == 2,
            whatsapp_template_name="vision_recall",
            whatsapp_content="It is time to schedule your annual vision review.",
            active=index != 3,
            active_since=_utc_at(today - timedelta(days=60 + index * 20)),
            mail_sent=True,
            sms_sent=index % 2 == 0,
            whatsapp_sent=index == 2,
            emails_sent_count=180 + index * 63,
            sms_sent_count=80 + index * 21,
            whatsapp_sent_count=50 if index == 2 else 0,
            cycle_type=("monthly", "quarterly", "once", "daily")[index],
            cycle_custom_days=90 if index == 1 else None,
            last_executed=_utc_at(today - timedelta(days=2 + index * 4)),
            execute_once_per_client=index == 2,
        )
        for index, (name, filters, content) in enumerate(
            (
                ("Annual Exam Recall", "last_exam > 11 months", "Your annual comprehensive eye exam is due."),
                ("Contact Lens Renewal", "contact_lens_supply < 30 days", "Let us help keep your contact lens supply uninterrupted."),
                ("Dry Eye Check-in", "dry_eye_follow_up", "We would love to hear how your comfort plan is working."),
                ("New Frame Collection", "recent_order", "New optical frame arrivals are now available in Midtown."),
            )
        )
    ]
    _add_in_batches(db, campaigns)
    executions = [
        CampaignClientExecution(
            campaign_id=campaigns[index % len(campaigns)].id,
            client_id=clients[(index * 29) % len(clients)].id,
            executed_at=_utc_at(today - timedelta(days=index % 42), 10),
            status="failed" if index % 29 == 0 else "success",
            error_message="Email address bounced" if index % 29 == 0 else None,
            channel=("email", "sms", "whatsapp")[index % 3],
        )
        for index in range(220)
    ]
    _add_in_batches(db, executions)
    _add_in_batches(
        db,
        [
            RecentClientVisit(
                user_id=clinic_staff[index % len(clinic_staff)].id,
                clinic_id=clinic.id,
                client_id=clients[(index * 37) % len(clients)].id,
                visited_at=_utc_at(today - timedelta(hours=index * 3), 10),
            )
            for index in range(min(45, len(clients)))
        ],
    )
    chat = Chat(clinic_id=clinic.id, title="Northstar Operations Notes")
    db.add(chat)
    db.flush()
    _add_in_batches(
        db,
        [
            ChatMessage(
                chat_id=chat.id,
                type="user" if index % 2 == 0 else "assistant",
                content=(
                    "Please review the low-stock contact lens variants before Friday."
                    if index % 2 == 0 else "I found several high-velocity variants that should be reordered this week."
                ),
                timestamp=_utc_at(today - timedelta(days=index), 11),
            )
            for index in range(12)
        ],
    )


def seed_demo_clinic(db: Session, volume: DemoVolume = DemoVolume()) -> dict[str, int]:
    """Replace the isolated demo account and return counts for verification/tests."""
    rng = random.Random(DEMO_RANDOM_SEED)
    today = date.today()
    # Supabase staging can need several minutes to cascade-delete thousands of
    # owned demo clients. Scope the longer timeout to this one seed transaction.
    if db.bind and db.bind.dialect.name == "postgresql":
        db.execute(text("SET LOCAL statement_timeout = '15min'"))
    delete_demo_company(db)
    company, clinic, staff = _seed_company_and_staff(db, rng, today)
    layouts = _seed_layouts(db, clinic.id)
    families, clients = _seed_clients(
        db,
        company=company,
        clinic=clinic,
        volume=volume,
        rng=rng,
        today=today,
    )
    regular_orders, contact_orders, billings = _seed_orders_and_billing(
        db,
        clinic=clinic,
        clients=clients,
        staff=staff,
        volume=volume,
        rng=rng,
        today=today,
    )
    appointments = _seed_appointments(
        db,
        clinic=clinic,
        clients=clients,
        staff=staff,
        layouts=layouts,
        volume=volume,
        today=today,
    )
    exams = _seed_exams_and_clinical_history(
        db,
        clinic=clinic,
        clients=clients,
        staff=staff,
        layouts=layouts,
        volume=volume,
        rng=rng,
        today=today,
    )
    variants = _seed_inventory(
        db,
        company=company,
        clinic=clinic,
        staff=staff,
        regular_orders=regular_orders,
        contact_orders=contact_orders,
        volume=volume,
        rng=rng,
        today=today,
    )
    _seed_supporting_activity(db, clinic=clinic, clients=clients, staff=staff, today=today)
    db.flush()
    return {
        "company_id": company.id,
        "clinic_id": clinic.id,
        "users": len(staff),
        "families": len(families),
        "clients": len(clients),
        "appointments": len(appointments),
        "exams": len(exams),
        "regular_orders": len(regular_orders),
        "contact_orders": len(contact_orders),
        "billings": len(billings),
        "variants": len(variants),
    }


def _volume_for_scale(scale: int) -> DemoVolume:
    if scale < 1:
        raise ValueError("scale must be at least 1")
    baseline = DemoVolume()
    return DemoVolume(**{field: value * scale for field, value in baseline.__dict__.items()})


def _database_description(db: Session) -> str:
    url = make_url(str(db.get_bind().url))
    return "/".join(str(part) for part in (url.get_backend_name(), url.host or "local", url.database or "") if part)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed a rerunnable, rich Northstar demo company and clinic.")
    parser.add_argument("--execute", action="store_true", help="Perform the write. Omit for a no-write preview.")
    parser.add_argument("--scale", type=int, default=1, help="Multiply the default showcase volume (default: 1).")
    parser.add_argument("--compact", action="store_true", help="Seed the smaller verification volume instead of showcase volume.")
    parser.add_argument(
        "--allow-production",
        action="store_true",
        help="Required in APP_ENV=production; staging/development does not need this flag.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if settings.APP_ENV == "production" and not args.allow_production:
        raise SystemExit("Refusing to seed production without --allow-production.")
    volume = DemoVolume.compact() if args.compact else _volume_for_scale(args.scale)
    db = SessionLocal()
    try:
        existing = db.query(Company.id).filter(Company.contact_email == DEMO_COMPANY_EMAIL).scalar()
        action = "replace" if existing else "create"
        if not args.execute:
            print(f"No-write preview: would {action} demo account on {_database_description(db)}.")
            print(f"volume clients={volume.clients} orders={volume.regular_orders + volume.contact_orders} exams={volume.exams}")
            return
        counts = seed_demo_clinic(db, volume)
        db.commit()
        print(f"Demo account {action}d on {_database_description(db)}.")
        print(" ".join(f"{key}={value}" for key, value in counts.items()))
        print(f"login={DEMO_COMPANY_EMAIL} password={DEMO_LOGIN_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
