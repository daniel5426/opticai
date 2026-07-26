import os
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

from database import Base
from models import (
    Appointment,
    Billing,
    BillingPayment,
    Campaign,
    CampaignClientExecution,
    Client,
    Company,
    ContactLensOrder,
    EmailLog,
    Family,
    Order,
    OrderLineItem,
    Referral,
    ReferralEye,
)


def _session_factory():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _connection_record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _client(db, *, family_id=None):
    client = Client(company_id=1, clinic_id=None, family_id=family_id, first_name="Delete")
    db.add(client)
    db.flush()
    return client


def _company(db):
    company = Company(id=1, name="Delete", owner_full_name="Owner")
    db.add(company)
    db.flush()


def test_order_delete_cascades_through_billing_children():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        _company(db)
        client = _client(db)
        order = Order(client_id=client.id, order_data={})
        db.add(order)
        db.flush()
        billing = Billing(order_id=order.id)
        db.add(billing)
        db.flush()
        db.add_all([
            BillingPayment(billing_id=billing.id, amount=10, paid_at=date(2026, 7, 15), kind="payment"),
            OrderLineItem(billings_id=billing.id, description="Frame"),
        ])
        db.commit()

        db.delete(order)
        db.commit()

        assert db.query(Billing).count() == 0
        assert db.query(BillingPayment).count() == 0
        assert db.query(OrderLineItem).count() == 0


def test_client_delete_cascades_all_owned_records():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        _company(db)
        client = _client(db)
        order = Order(client_id=client.id, order_data={})
        contact_order = ContactLensOrder(client_id=client.id, order_data={})
        referral = Referral(client_id=client.id, referral_notes="Delete", referral_data={})
        appointment = Appointment(client_id=client.id)
        campaign = Campaign(name="Delete", clinic_id=None)
        db.add_all([order, contact_order, referral, appointment, campaign])
        db.flush()

        billing = Billing(order_id=order.id)
        contact_billing = Billing(contact_lens_id=contact_order.id)
        db.add_all([billing, contact_billing])
        db.flush()
        db.add_all([
            OrderLineItem(billings_id=billing.id),
            BillingPayment(billing_id=contact_billing.id, amount=5, paid_at=date(2026, 7, 15), kind="payment"),
            ReferralEye(referral_id=referral.id, eye="R"),
            EmailLog(appointment_id=appointment.id, email_address="test@example.com", success=True),
            CampaignClientExecution(campaign_id=campaign.id, client_id=client.id),
        ])
        db.commit()

        db.delete(client)
        db.commit()

        for model in (
            Order,
            ContactLensOrder,
            Billing,
            BillingPayment,
            OrderLineItem,
            Referral,
            ReferralEye,
            Appointment,
            EmailLog,
            CampaignClientExecution,
        ):
            assert db.query(model).count() == 0
        assert db.query(Campaign).count() == 1


def test_family_delete_unlinks_clients():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        _company(db)
        family = Family(company_id=1, name="Delete")
        db.add(family)
        db.flush()
        client = _client(db, family_id=family.id)
        db.commit()

        db.delete(family)
        db.commit()
        db.refresh(client)

        assert client.family_id is None
