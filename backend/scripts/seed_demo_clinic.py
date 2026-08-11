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
import random
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

from sqlalchemy import func
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
    "Contact Lens Follow-up",
    "Dry Eye Evaluation",
    "Pediatric Vision Assessment",
    "Myopia Management Review",
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
)


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
    LookupSupplier: ("Essilor", "Zeiss", "CooperVision", "Alcon", "Bausch + Lomb"),
    LookupClinic: ("Midtown", "Optical Lab", "Contact Lens Desk"),
    LookupOrderType: ORDER_TYPES + ("Contact Lens Supply",),
    LookupLensModel: ("Varilux XR", "SmartLife Individual 3", "Eyezen Start", "DriveSafe"),
    LookupColor: ("Tortoise", "Matte Black", "Crystal", "Olive", "Rose Gold", "Navy"),
    LookupMaterial: ("Acetate", "Titanium", "Stainless Steel", "Silicone Hydrogel"),
    LookupCoating: ("Crizal Sapphire HR", "DuraVision Platinum", "BlueGuard", "Polarized"),
    LookupManufacturer: ("Moscot", "Ray-Ban", "Oliver Peoples", "Lindberg", "Acuvue"),
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
    )
    db.add(company)
    db.flush()
    clinic = Clinic(
        company_id=company.id,
        name=DEMO_CLINIC_NAME,
        clinic_name=DEMO_CLINIC_NAME,
        location="Midtown Manhattan",
        clinic_position="Suite 810",
        clinic_address="245 Madison Avenue",
        clinic_city="New York",
        clinic_postal_code="10016",
        clinic_directions="Enter through the Madison Avenue lobby and take the elevators to the eighth floor.",
        clinic_website="https://northstaroptical.test",
        phone_number="+1 212 555 0180",
        email="midtown@northstaroptical.test",
        manager_name="Mia Chen",
        license_number="NY-OPT-44821",
        unique_id="northstar-demo-midtown",
        is_active=True,
    )
    db.add(clinic)
    db.flush()
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
    layouts = [
        ExamLayout(
            clinic_id=clinic_id,
            name="Comprehensive Eye Exam",
            type="global",
            is_default=True,
            is_active=True,
            sort_index=1,
            layout_data='{"rows":[{"id":"history","cards":[{"id":"anamnesis-demo","type":"anamnesis"}]},{"id":"refraction","cards":[{"id":"subjective-demo","type":"subjective"},{"id":"final-demo","type":"final-prescription"}]},{"id":"notes","cards":[{"id":"notes-demo","type":"notes"}]}],"customWidths":{}}',
        ),
        ExamLayout(
            clinic_id=clinic_id,
            name="Annual Vision Check",
            type="glass",
            is_active=True,
            sort_index=2,
            layout_data='{"rows":[{"id":"vision","cards":[{"id":"uncorrected-demo","type":"uncorrected-va"},{"id":"old-ref-demo","type":"old-refraction"}]},{"id":"final","cards":[{"id":"final-subjective-demo","type":"final-subjective"}]}],"customWidths":{}}',
        ),
        ExamLayout(
            clinic_id=clinic_id,
            name="Contact Lens Follow-up",
            type="contact lens",
            is_active=True,
            sort_index=3,
            layout_data='{"rows":[{"id":"contact","cards":[{"id":"contact-details-demo","type":"contact-lens-details"},{"id":"contact-exam-demo","type":"contact-lens-exam"}]},{"id":"topography","cards":[{"id":"kerato-contact-demo","type":"keratometer-contact-lens"},{"id":"notes-contact-demo","type":"notes"}]}],"customWidths":{}}',
        ),
        ExamLayout(
            clinic_id=clinic_id,
            name="Dry Eye Evaluation",
            type="global",
            is_active=True,
            sort_index=4,
            layout_data='{"rows":[{"id":"dry-eye","cards":[{"id":"schirmer-demo","type":"schirmer-test"},{"id":"topography-demo","type":"corneal-topography"}]},{"id":"notes","cards":[{"id":"notes-dry-demo","type":"notes"}]}],"customWidths":{}}',
        ),
        ExamLayout(
            clinic_id=clinic_id,
            name="Pediatric Vision Assessment",
            type="global",
            is_active=True,
            sort_index=5,
            layout_data='{"rows":[{"id":"pediatric","cards":[{"id":"cover-demo","type":"cover-test-v2"},{"id":"stereo-demo","type":"stereo-test"}]},{"id":"final","cards":[{"id":"final-pediatric-demo","type":"final-prescription"}]}],"customWidths":{}}',
        ),
        ExamLayout(
            clinic_id=clinic_id,
            name="Myopia Management Review",
            type="global",
            is_active=True,
            sort_index=6,
            layout_data='{"rows":[{"id":"myopia","cards":[{"id":"kerato-demo","type":"keratometer"},{"id":"subjective-myopia-demo","type":"subjective"}]},{"id":"notes","cards":[{"id":"notes-myopia-demo","type":"notes"}]}],"customWidths":{}}',
        ),
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
        frame_price = float((430, 520, 690, 880, 1_090)[index % 5])
        lens_price = float((520, 680, 840, 1_120)[index % 4])
        extras = float((0, 75, 125, 175)[index % 4])
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
        )
        billings.append(billing)
    for index, order in enumerate(contact_orders):
        unit_price = float((260, 310, 390, 460)[index % 4])
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
            )
        )
    _add_in_batches(db, billings)

    for index, (order, billing) in enumerate(zip(regular_orders, billings[:len(regular_orders)])):
        frame_brand, frame_model, _ = FRAME_CATALOG[index % len(FRAME_CATALOG)]
        frame_price = float((430, 520, 690, 880, 1_090)[index % 5])
        lens_price = float((520, 680, 840, 1_120)[index % 4])
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
                ),
            ]
        )
    contact_billings = billings[len(regular_orders):]
    for index, (order, billing) in enumerate(zip(contact_orders, contact_billings)):
        quantity = float((1, 1, 2, 4)[index % 4])
        unit_price = float((260, 310, 390, 460)[index % 4])
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
                )
            )
            if paid > first_payment:
                payments.append(
                    BillingPayment(
                        billing_id=billing.id,
                        amount=round(paid - first_payment, 2),
                        paid_at=min(today, order_day + timedelta(days=12 + index % 11)),
                        kind="payment",
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


def _exam_payload(index: int, layout_instance_id: int | None = None) -> dict[str, Any]:
    instance = {"layout_instance_id": layout_instance_id} if layout_instance_id else {}
    return {
        "anamnesis-anamnesis-demo": {
            **instance,
            "medications": "None reported" if index % 4 else "Seasonal allergy medication",
            "allergies": "No known drug allergies",
            "family_history": "No glaucoma history reported",
            "contact_lens_wear": index % 3 == 0,
        },
        "subjective-subjective-demo": {
            **instance,
            "r_sph": round(-3.25 + (index % 24) * 0.25, 2),
            "l_sph": round(-3.0 + (index % 20) * 0.25, 2),
            "r_cyl": round(-0.25 * (index % 7), 2),
            "l_cyl": round(-0.25 * ((index + 2) % 7), 2),
            "r_ax": (index * 13) % 180,
            "l_ax": (index * 17) % 180,
            "r_va": "6/6",
            "l_va": "6/6",
            "comb_va": "6/6",
        },
        "final-prescription-final-demo": {
            **instance,
            "r_sph": round(-3.0 + (index % 24) * 0.25, 2),
            "l_sph": round(-2.75 + (index % 20) * 0.25, 2),
            "r_cyl": round(-0.25 * (index % 7), 2),
            "l_cyl": round(-0.25 * ((index + 2) % 7), 2),
            "r_ax": (index * 13) % 180,
            "l_ax": (index * 17) % 180,
            "r_va": "6/6",
            "l_va": "6/6",
            "r_pd": 31.5,
            "l_pd": 31.5,
            "comb_va": "6/6",
        },
        "notes-notes-demo": {
            **instance,
            "card_instance_id": "notes-demo",
            "title": "Clinical Notes",
            "note": "Discussed visual habits, ergonomic screen distance, and the annual review plan.",
        },
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
    instance_count = max(1, int(volume.exams * 0.62))
    instances = [
        ExamLayoutInstance(
            exam_id=exams[index].id,
            layout_id=layouts[index % len(layouts)].id,
            is_active=True,
            order=0,
            # Layout-instance IDs are optional in persisted component payloads;
            # omitting them keeps this high-volume seed as insert-only.
            exam_data=_exam_payload(index),
            layout_data=layouts[index % len(layouts)].layout_data,
        )
        for index in range(instance_count)
    ]
    _add_in_batches(db, instances)
    search_rows: list[PrescriptionSearchIndex] = []
    for index, instance in enumerate(instances):
        payload = instance.exam_data
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
                    sph=payload["final-prescription-final-demo"]["r_sph" if eye == "right" else "l_sph"],
                    cyl=payload["final-prescription-final-demo"]["r_cyl" if eye == "right" else "l_cyl"],
                    ax=payload["final-prescription-final-demo"]["r_ax" if eye == "right" else "l_ax"],
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
        currency="ILS",
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
        product_data = {
            "brand": brand,
            "model": f"{model} {1 + index // len(FRAME_CATALOG)}",
            "product_type": "Optical Frame",
            "material": material,
            "preferred_supplier": "Northstar Frames",
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
        product_data = {
            "brand": brand,
            "model": f"{model} {1 + index // len(CONTACT_CATALOG)}",
            "product_type": lens_type,
            "material": material,
            "preferred_supplier": brand,
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
                cost=float(190 + (index % 8) * 45),
                retail=float(490 + (index % 8) * 120),
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
                cost=float(75 + (index % 7) * 18),
                retail=float(150 + (index % 7) * 45),
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
