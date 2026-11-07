from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import (
    Billing,
    BillingPayment,
    Client,
    Clinic,
    Company,
    ExamLayoutInstance,
    OpticalExam,
    Order,
    OrderLineItem,
    TrashAuditEvent,
    TrashItem,
    TrashJob,
    User,
)
from services.trash_service import _utcnow, claim_next_job, move_to_trash, request_purge, restore_item


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


def _seed(db, *, role_level: int = 2):
    company = Company(name="Trash test", owner_full_name="Owner")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="Clinic", unique_id="trash-test-clinic")
    db.add(clinic)
    db.flush()
    user = User(
        company_id=company.id,
        clinic_id=clinic.id,
        username=f"user-{role_level}",
        full_name="Test User",
        role_level=role_level,
    )
    client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Ada", last_name="Lovelace")
    db.add_all([user, client])
    db.flush()
    return company, clinic, user, client


def test_order_trash_preserves_children_and_normal_queries_hide_it():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        _company, clinic, worker, client = _seed(db)
        order = Order(client_id=client.id, clinic_id=clinic.id, order_date=date(2026, 9, 1), order_data={})
        db.add(order)
        db.flush()
        billing = Billing(order_id=order.id, total_after_discount=125)
        db.add(billing)
        db.flush()
        db.add_all([
            BillingPayment(billing_id=billing.id, amount=25, paid_at=date(2026, 9, 1), kind="payment"),
            OrderLineItem(billings_id=billing.id, description="Frame", quantity=1),
        ])
        db.commit()

        item = move_to_trash(db, worker, "order", order.id)

        assert db.query(Order).filter(Order.id == order.id).first() is None
        deleted_order = db.query(Order).execution_options(include_deleted=True).filter(Order.id == order.id).one()
        assert deleted_order.trash_item_id == item.id
        assert db.query(Billing).filter(Billing.id == billing.id).count() == 1
        assert db.query(BillingPayment).filter(BillingPayment.billing_id == billing.id).count() == 1
        assert db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing.id).count() == 1
        assert item.included_counts == {"order": 1, "billing": 1, "billing_payment": 1, "order_line_item": 1}
        assert db.query(TrashAuditEvent).filter(TrashAuditEvent.event_type == "deleted").count() == 1

        result = restore_item(db, worker, item.id)

        assert result["status"] == "restored"
        assert db.query(Order).filter(Order.id == order.id).one().trash_item_id is None
        assert db.query(BillingPayment).filter(BillingPayment.billing_id == billing.id).count() == 1


def test_client_restore_does_not_restore_child_from_earlier_batch():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        _company, clinic, worker, client = _seed(db)
        earlier_order = Order(client_id=client.id, clinic_id=clinic.id, order_data={})
        active_order = Order(client_id=client.id, clinic_id=clinic.id, order_data={})
        db.add_all([earlier_order, active_order])
        db.commit()

        earlier_item = move_to_trash(db, worker, "order", earlier_order.id)
        client_item = move_to_trash(db, worker, "client", client.id)

        assert client_item.included_counts["client"] == 1
        assert client_item.included_counts["order"] == 1
        restore_item(db, worker, client_item.id)

        assert db.query(Client).filter(Client.id == client.id).one()
        assert db.query(Order).filter(Order.id == active_order.id).one()
        assert db.query(Order).filter(Order.id == earlier_order.id).first() is None

        restore_item(db, worker, earlier_item.id)
        assert db.query(Order).filter(Order.id == earlier_order.id).one()


def test_restore_rejects_expired_item_and_viewer_cannot_delete():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        _company, clinic, worker, client = _seed(db)
        order = Order(client_id=client.id, clinic_id=clinic.id, order_data={})
        viewer = User(company_id=worker.company_id, clinic_id=clinic.id, username="viewer", role_level=1)
        db.add_all([order, viewer])
        db.commit()

        with pytest.raises(HTTPException) as denied:
            move_to_trash(db, viewer, "order", order.id)
        assert denied.value.status_code == 403

        item = move_to_trash(db, worker, "order", order.id)
        item.expires_at = _utcnow() - timedelta(seconds=1)
        db.commit()
        with pytest.raises(HTTPException) as expired:
            restore_item(db, worker, item.id)
        assert expired.value.status_code == 409


def test_only_ceo_can_queue_early_permanent_deletion():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        company, clinic, worker, client = _seed(db)
        ceo = User(company_id=company.id, username="ceo", role_level=4)
        order = Order(client_id=client.id, clinic_id=clinic.id, order_data={})
        db.add_all([ceo, order])
        db.commit()
        item = move_to_trash(db, worker, "order", order.id)

        with pytest.raises(HTTPException) as denied:
            request_purge(db, worker, item.id)
        assert denied.value.status_code == 403

        queued = request_purge(db, ceo, item.id)
        assert queued.status == "purging"
        assert db.query(TrashJob).filter(TrashJob.trash_item_id == item.id, TrashJob.job_type == "purge").count() == 1
        assert db.query(TrashItem).filter(TrashItem.id == item.id).one().status == "purging"
        assert claim_next_job(db, "staging-worker", allow_purge=False) is None
        assert claim_next_job(db, "production-worker", allow_purge=True).job_type == "purge"


def test_exam_deletion_hides_dependent_exam_cards():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        _company, clinic, worker, client = _seed(db)
        exam = OpticalExam(client_id=client.id, clinic_id=clinic.id, exam_date=date(2026, 9, 1), test_name="Annual")
        db.add(exam)
        db.flush()
        instance = ExamLayoutInstance(exam_id=exam.id, exam_data={})
        db.add(instance)
        db.commit()

        item = move_to_trash(db, worker, "exam", exam.id)
        assert db.query(ExamLayoutInstance).filter(ExamLayoutInstance.id == instance.id).first() is None
        assert db.query(ExamLayoutInstance).execution_options(include_deleted=True).filter(ExamLayoutInstance.id == instance.id).one()

        restore_item(db, worker, item.id)
        assert db.query(ExamLayoutInstance).filter(ExamLayoutInstance.id == instance.id).one()


def test_trash_counts_group_items_by_type_and_match_list_filters():
    from EndPoints.trash import count_trash_by_type, list_trash

    SessionLocal = _session_factory()
    with SessionLocal() as db:
        _company, clinic, worker, client = _seed(db)
        exams = [OpticalExam(client_id=client.id, clinic_id=clinic.id, test_name=f"Exam {index}") for index in range(2)]
        order = Order(client_id=client.id, clinic_id=clinic.id, order_data={})
        db.add_all([*exams, order])
        db.commit()
        for exam in exams:
            move_to_trash(db, worker, "exam", exam.id)
        restored = move_to_trash(db, worker, "order", order.id)
        restore_item(db, worker, restored.id)

        filters = dict(clinic_id=clinic.id, deleted_by_user_id=None, deleted_from=None, deleted_to=None, db=db, current_user=worker)
        assert count_trash_by_type(search=None, **filters) == {"exam": 2}
        page = list_trash(entity_type="exam", search=None, limit=25, offset=0, **filters)
        assert page["total"] == 2
        assert {row["root_entity_type"] for row in page["items"]} == {"exam"}
        assert count_trash_by_type(search="no-such-item", **filters) == {}


def test_overlapping_delete_with_stale_preloaded_row_reuses_trash_item():
    SessionLocal = _session_factory()
    with SessionLocal() as setup:
        _company, clinic, worker, client = _seed(setup)
        exam = OpticalExam(client_id=client.id, clinic_id=clinic.id, test_name="Checkup")
        setup.add(exam)
        setup.commit()
        exam_id, worker_id = exam.id, worker.id

    # The second request loaded the exam (as delete endpoints do) before the first one trashed it.
    with SessionLocal(expire_on_commit=False) as late, SessionLocal() as early:
        stale_exam = late.get(OpticalExam, exam_id)
        late_worker = late.get(User, worker_id)
        late.commit()
        assert stale_exam.deleted_at is None

        first = move_to_trash(early, early.get(User, worker_id), "exam", exam_id)
        second = move_to_trash(late, late_worker, "exam", exam_id)

        assert second.id == first.id
        assert late.query(TrashItem).count() == 1
