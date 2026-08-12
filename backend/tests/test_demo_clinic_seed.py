import json
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

from database import Base
from models import (  # noqa: E402
    Appointment,
    Billing,
    BillingPayment,
    CatalogProduct,
    CatalogVariant,
    Clinic,
    Client,
    Company,
    ContactLensOrder,
    ExamLayout,
    ExamLayoutInstance,
    InventoryBalance,
    OpticalExam,
    Order,
    OrderLineItem,
    User,
)
from scripts.seed_demo_clinic import (  # noqa: E402
    DEMO_CLINIC_SPECS,
    DEMO_COMPANY_EMAIL,
    DEMO_CURRENCY,
    DemoVolume,
    seed_demo_clinic,
)


def test_demo_seed_is_rerunnable_and_builds_connected_records():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    volume = DemoVolume.compact()

    with factory() as db:
        first = seed_demo_clinic(db, volume)
        db.commit()
        second = seed_demo_clinic(db, volume)
        db.commit()

        company = db.query(Company).filter(Company.contact_email == DEMO_COMPANY_EMAIL).one()
        assert db.query(Company).filter(Company.contact_email == DEMO_COMPANY_EMAIL).count() == 1
        assert db.query(Clinic).filter(Clinic.company_id == company.id).count() == len(DEMO_CLINIC_SPECS)
        assert db.query(User).filter(User.company_id == company.id).count() == first["users"]
        assert db.query(Client).filter(Client.company_id == company.id).count() == volume.clients
        assert db.query(Order).count() == volume.regular_orders
        assert db.query(ContactLensOrder).count() == volume.contact_orders
        assert db.query(Billing).count() == volume.regular_orders + volume.contact_orders
        assert company.default_currency == DEMO_CURRENCY
        assert db.query(Billing).filter(Billing.currency != DEMO_CURRENCY).count() == 0
        assert db.query(BillingPayment).filter(BillingPayment.currency != DEMO_CURRENCY).count() == 0
        assert db.query(OrderLineItem).filter(OrderLineItem.currency != DEMO_CURRENCY).count() == 0
        assert db.query(OpticalExam).count() == volume.exams
        assert db.query(ExamLayout).count() == 13
        assert db.query(ExamLayoutInstance).count() == volume.exams
        annual_layout = db.query(ExamLayout).filter(ExamLayout.name == "Annual Vision Check").one()
        annual_data = json.loads(annual_layout.layout_data)
        assert annual_data["version"] == 2
        assert annual_data["grid"]["columns"] == 24
        assert len(annual_data["items"]) == 7
        assert db.query(Appointment).count() == volume.appointments_past + volume.appointments_future
        assert db.query(CatalogVariant).filter(CatalogVariant.company_id == company.id).count() == volume.frames + volume.contacts
        assert db.query(CatalogVariant).filter(CatalogVariant.company_id == company.id, CatalogVariant.currency != DEMO_CURRENCY).count() == 0
        assert (
            db.query(func.count(func.distinct(CatalogProduct.preferred_supplier)))
            .filter(CatalogProduct.company_id == company.id)
            .scalar()
        ) >= 8
        assert db.query(InventoryBalance).filter(InventoryBalance.reserved <= InventoryBalance.on_hand).count() == (
            volume.frames + volume.contacts
        )
        assert second["clients"] == first["clients"] == volume.clients
