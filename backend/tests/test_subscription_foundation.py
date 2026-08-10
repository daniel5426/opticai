from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from EndPoints.subscriptions import _invoice_subscription_id, _stripe_event_dict, _subscription_period
from models import Clinic, Company, Subscription, User
from services.plan_catalog import plan_catalog, require_plan
from services.subscription_service import access_mode, apply_stripe_status, create_pending_subscription, usage, validate_plan_change


def _db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _company(db):
    company = Company(name="Test", owner_full_name="Owner")
    db.add(company)
    db.flush()
    return company


def test_launch_plan_catalog_is_exact():
    plans = plan_catalog()
    assert (plans["essential"].amount_minor, plans["essential"].clinic_limit, plans["essential"].staff_limit) == (43_000, 1, 5)
    assert (plans["growth"].amount_minor, plans["growth"].clinic_limit, plans["growth"].staff_limit) == (99_900, 3, 15)
    assert (plans["network"].amount_minor, plans["network"].clinic_limit, plans["network"].staff_limit) == (189_000, 6, 35)
    assert all(plans[code].trial_days == 30 for code in ("essential", "growth", "network"))


def test_pending_subscription_snapshots_selected_plan_limits():
    db = _db()
    company = _company(db)
    subscription = create_pending_subscription(db, company.id, "growth")
    assert subscription.status == "pending_checkout"
    assert subscription.clinic_limit == 3
    assert subscription.staff_limit == 15


def test_usage_counts_only_active_resources_and_includes_owner():
    db = _db()
    company = _company(db)
    db.add_all([
        Clinic(company_id=company.id, name="One", unique_id="one", is_active=True),
        Clinic(company_id=company.id, name="Old", unique_id="old", is_active=False),
        User(company_id=company.id, username="owner", email="owner@example.com", role_level=4, is_active=True),
        User(company_id=company.id, username="inactive", email="inactive@example.com", is_active=False),
    ])
    db.flush()
    assert usage(db, company.id) == {"clinics": 1, "staff": 1}


def test_downgrade_rejects_usage_above_target():
    db = _db()
    company = _company(db)
    subscription = Subscription(id="s", company_id=company.id, plan_code="growth", status="active", clinic_limit=3, staff_limit=15)
    db.add(subscription)
    for index in range(2):
        db.add(Clinic(company_id=company.id, name=f"Clinic {index}", unique_id=f"c{index}", is_active=True))
    db.flush()
    try:
        validate_plan_change(db, subscription, require_plan("essential"))
        assert False, "expected a plan limit error"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 409


def test_out_of_order_stripe_event_does_not_regress_projection():
    now = datetime.utcnow()
    subscription = Subscription(id="s", company_id=1, plan_code="essential", status="active", stripe_event_created_at=now)
    assert apply_stripe_status(subscription, "past_due", event_created_at=now - timedelta(minutes=1)) is False
    assert subscription.status == "active"


def test_past_due_becomes_read_only_after_grace():
    now = datetime.utcnow()
    subscription = Subscription(id="s", company_id=1, plan_code="essential", status="past_due", grace_ends_at=now + timedelta(days=1))
    assert access_mode(subscription, now) == "full"
    assert access_mode(subscription, now + timedelta(days=8)) == "read_only"


def test_current_stripe_billing_shapes_are_supported():
    period = 1_800_000_000
    assert _subscription_period(
        {"items": {"data": [{"current_period_end": period}]}},
        "current_period_end",
    ) == datetime.fromtimestamp(period, UTC)
    assert _invoice_subscription_id(
        {"parent": {"subscription_details": {"subscription": "sub_current"}}}
    ) == "sub_current"


def test_stripe_sdk_event_objects_are_normalized_to_dicts():
    class StripeEvent:
        def to_dict(self):
            return {"id": "evt_test", "data": {"object": {"metadata": {}}}}

    assert _stripe_event_dict(StripeEvent())["data"]["object"]["metadata"] == {}
