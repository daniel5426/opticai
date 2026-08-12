from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from EndPoints.inventory import _inventory_demand_events
from database import Base
from models import Billing, BillingPayment, Client, Clinic, Company, ContactLensOrder, Order, OrderLineItem
from services.analytics_service import build_company_analytics, percent_change, resolve_analytics_window


def test_analytics_window_is_inclusive_and_uses_equal_previous_period():
    window = resolve_analytics_window(date(2026, 8, 1), date(2026, 8, 7))

    assert window.days == 7
    assert window.bucket == "day"
    assert window.previous_start == date(2026, 7, 25)
    assert window.previous_end == date(2026, 7, 31)


@pytest.mark.parametrize(
    ("start", "end", "expected"),
    [
        (date(2026, 7, 1), date(2026, 8, 14), "day"),
        (date(2026, 3, 1), date(2026, 8, 27), "week"),
        (date(2025, 8, 1), date(2026, 8, 1), "month"),
    ],
)
def test_analytics_window_selects_adaptive_bucket(start, end, expected):
    assert resolve_analytics_window(start, end).bucket == expected


def test_analytics_window_rejects_reversed_dates():
    with pytest.raises(HTTPException) as error:
        resolve_analytics_window(date(2026, 8, 2), date(2026, 8, 1))

    assert error.value.status_code == 422


def test_zero_comparison_is_new_instead_of_infinite():
    assert percent_change(10, 0) is None
    assert percent_change(0, 0) == 0


def test_inventory_demand_prefers_observation_but_keeps_manual_consumption():
    observation = SimpleNamespace(
        order_id=7,
        contact_lens_order_id=None,
        component="frame",
        variant_id=11,
        observed_on=date(2026, 8, 5),
        quantity=2,
    )
    matched_movement = SimpleNamespace(
        order_id=7,
        contact_lens_order_id=None,
        movement_metadata={"component": "frame"},
        variant_id=11,
        created_at=datetime(2026, 8, 5, 10, tzinfo=timezone.utc),
        on_hand_delta=-2,
    )
    manual_movement = SimpleNamespace(
        order_id=None,
        contact_lens_order_id=None,
        movement_metadata={"reason": "manual use"},
        variant_id=12,
        created_at=datetime(2026, 8, 6, 10, tzinfo=timezone.utc),
        on_hand_delta=-1,
    )

    events = _inventory_demand_events(
        [observation],
        [matched_movement, manual_movement],
        date(2026, 8, 1),
    )

    assert [(event["source"], event["variant_id"], event["quantity"]) for event in events] == [
        ("observation", 11, 2),
        ("movement", 12, 1),
    ]


def test_company_analytics_uses_weighted_aov_net_payments_and_as_of_outstanding():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        company = Company(name="Prysm", owner_full_name="Owner")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Main", unique_id="main")
        db.add(clinic)
        db.flush()
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Client")
        db.add(client)
        db.flush()

        previous_order = Order(client_id=client.id, clinic_id=clinic.id, order_date=date(2026, 7, 31), type="glasses")
        regular_order = Order(client_id=client.id, clinic_id=clinic.id, order_date=date(2026, 8, 1), type="glasses")
        contact_order = ContactLensOrder(
            client_id=client.id,
            clinic_id=clinic.id,
            order_date=date(2026, 8, 7),
            type="contacts",
        )
        db.add_all([previous_order, regular_order, contact_order])
        db.flush()
        previous_billing = Billing(order_id=previous_order.id, total_after_discount=50)
        regular_billing = Billing(order_id=regular_order.id, total_after_discount=100)
        contact_billing = Billing(contact_lens_id=contact_order.id, total_after_discount=300)
        db.add_all([previous_billing, regular_billing, contact_billing])
        db.flush()
        db.add_all(
            [
                BillingPayment(billing_id=regular_billing.id, amount=80, paid_at=date(2026, 8, 7), kind="payment"),
                BillingPayment(billing_id=regular_billing.id, amount=-20, paid_at=date(2026, 8, 7), kind="adjustment"),
                OrderLineItem(
                    billings_id=regular_billing.id,
                    description="Frame",
                    quantity=1,
                    line_total=100,
                ),
                OrderLineItem(
                    billings_id=contact_billing.id,
                    description="Contacts",
                    quantity=2,
                    line_total=300,
                ),
            ]
        )
        usd_billing = Billing(
            order_id=regular_order.id,
            total_after_discount=250,
            currency="USD",
        )
        db.add(usd_billing)
        db.commit()

        result = build_company_analytics(
            db,
            company_id=company.id,
            window=resolve_analytics_window(date(2026, 8, 1), date(2026, 8, 7)),
        )
        usd_result = build_company_analytics(
            db,
            company_id=company.id,
            window=resolve_analytics_window(date(2026, 8, 1), date(2026, 8, 7)),
            currency="USD",
        )

    metrics = {metric["key"]: metric for metric in result["metrics"]}
    assert metrics["sales"]["value"] == 400
    assert metrics["sales"]["previous"] == 50
    assert metrics["collected"]["value"] == 60
    assert metrics["aov"]["value"] == 200
    assert metrics["outstanding"]["value"] == 390
    assert metrics["outstanding"]["previous"] == 50
    usd_metrics = {metric["key"]: metric for metric in usd_result["metrics"]}
    assert usd_result["currency"] == "USD"
    assert usd_metrics["sales"]["value"] == 250
    assert usd_metrics["sales"]["previous"] == 0
