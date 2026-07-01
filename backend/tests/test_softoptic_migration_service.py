import csv
import zipfile
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import (
    Billing,
    BillingPayment,
    Client,
    Clinic,
    Company,
    MigrationSourceLink,
    Order,
    OrderLineItem,
    SoftOpticMigrationJob,
    User,
)
from services.softoptic_migration_service import (
    SOFTOPTIC_SOURCE_SYSTEM,
    assert_safe_to_import,
    complete_bundle_direct_upload,
    cleanup_previous_softoptic_import,
    prepare_bundle_direct_upload,
    run_softoptic_import,
    softoptic_bundle_storage_location,
    update_job,
    validate_export_bundle,
)


def _session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal


def _write_bundle(tmp_path, first_name="שם", client_count=1):
    export_dir = tmp_path / "export"
    export_dir.mkdir()
    with (export_dir / "account.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "account_code",
                "account_type",
                "branch_code",
                "head_of_family",
                "first_name",
                "last_name",
            ],
        )
        writer.writeheader()
        for index in range(client_count):
            account_code = str(101 + index)
            writer.writerow(
                {
                    "account_code": account_code,
                    "account_type": "CUST",
                    "branch_code": "A",
                    "head_of_family": account_code,
                    "first_name": first_name,
                    "last_name": "כהן",
                }
            )
    bundle_path = tmp_path / "bundle.zip"
    with zipfile.ZipFile(bundle_path, "w") as archive:
        archive.write(export_dir / "account.csv", "account.csv")
    return bundle_path, export_dir


def _seed_job(db, bundle_path, job_id="job1", client_import_limit=None):
    company = Company(name="A", owner_full_name="Owner")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="Clinic", unique_id="clinic-a")
    user = User(company_id=company.id, clinic_id=None, username="admin", role_level=4, is_active=True)
    db.add_all([clinic, user])
    db.flush()
    job = SoftOpticMigrationJob(
        id=job_id,
        clinic_id=clinic.id,
        company_id=company.id,
        user_id=user.id,
        status="queued",
        step="queued",
        progress=0,
        source_metadata={},
        export_summary={},
        validation_summary={},
        import_summary={},
        warnings=[],
        errors=[],
        bundle_path=str(bundle_path),
        client_import_limit=client_import_limit,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job, clinic


class FakeStorage:
    def __init__(self, exists=True):
        self.exists_result = exists
        self.upload_url_calls = []
        self.exists_calls = []

    def create_signed_upload_url(self, bucket, key):
        self.upload_url_calls.append((bucket, key))
        return f"https://storage.example/upload/{bucket}/{key}"

    def exists(self, bucket, key):
        self.exists_calls.append((bucket, key))
        return self.exists_result


def test_validate_export_bundle_counts_required_csv(tmp_path):
    _, export_dir = _write_bundle(tmp_path)

    result = validate_export_bundle(export_dir)

    assert result["errors"] == []
    assert result["counts"]["clients"] == 1
    assert result["tables"]["account.csv"] == 1


def test_softoptic_import_tracks_and_replaces_previous_run(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        job, clinic = _seed_job(db, bundle_path)
        updates = []

        run_softoptic_import(db, job=job, storage=None, on_progress=lambda **kwargs: updates.append(kwargs))

        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 1
        assert (
            db.query(MigrationSourceLink)
            .filter_by(source_system=SOFTOPTIC_SOURCE_SYSTEM, clinic_id=clinic.id, target_model="Client")
            .count()
            == 1
        )

        second_job = SoftOpticMigrationJob(
            id="job2",
            clinic_id=clinic.id,
            company_id=clinic.company_id,
            user_id=job.user_id,
            status="queued",
            step="queued",
            progress=0,
            source_metadata={},
            export_summary={},
            validation_summary={},
            import_summary={},
            warnings=[],
            errors=[],
            bundle_path=str(bundle_path),
        )
        db.add(second_job)
        db.commit()
        run_softoptic_import(db, job=second_job, storage=None, on_progress=lambda **kwargs: None)

        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 1
        assert db.query(MigrationSourceLink).filter_by(source_system=SOFTOPTIC_SOURCE_SYSTEM, clinic_id=clinic.id).count() > 0


def test_untracked_existing_data_blocks_import(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        _, clinic = _seed_job(db, bundle_path)
        db.add(Client(company_id=clinic.company_id, clinic_id=clinic.id, first_name="Existing"))
        db.commit()

        try:
            assert_safe_to_import(db, clinic.id)
            assert False, "expected guard to block"
        except RuntimeError as exc:
            assert "untracked data" in str(exc)


def test_softoptic_import_respects_client_import_limit(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path, client_count=3)

    with SessionLocal() as db:
        job, clinic = _seed_job(db, bundle_path, client_import_limit=1)

        def on_progress(**kwargs):
            current = db.get(SoftOpticMigrationJob, job.id)
            if current:
                update_job(db, current, **kwargs)

        run_softoptic_import(db, job=job, storage=None, on_progress=on_progress)

        imported_clients = db.query(Client).filter_by(clinic_id=clinic.id).all()
        assert len(imported_clients) == 1
        assert imported_clients[0].id == int(f"{clinic.id}101")
        db.refresh(job)
        assert job.import_summary["client_import_limit"] == 1
        assert job.import_summary["client_imported_count"] == 1


def test_prepare_bundle_direct_upload_requires_awaiting_upload(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        job, _ = _seed_job(db, bundle_path)

        try:
            prepare_bundle_direct_upload(db, job=job, storage=FakeStorage())
            assert False, "expected non-awaiting job to be rejected"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 409


def test_prepare_bundle_direct_upload_returns_expected_location(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        job, _ = _seed_job(db, bundle_path)
        job.status = "awaiting_upload"
        db.commit()
        storage = FakeStorage()

        result = prepare_bundle_direct_upload(db, job=job, storage=storage)
        expected_bucket, expected_key = softoptic_bundle_storage_location(job)

        assert result["bucket"] == expected_bucket
        assert result["key"] == expected_key
        assert result["signed_upload_url"].endswith(f"{expected_bucket}/{expected_key}")
        assert storage.upload_url_calls == [(expected_bucket, expected_key)]


def test_complete_bundle_direct_upload_rejects_missing_object(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        job, _ = _seed_job(db, bundle_path)
        job.status = "awaiting_upload"
        db.commit()
        bucket, key = softoptic_bundle_storage_location(job)

        try:
            complete_bundle_direct_upload(db, job=job, bucket=bucket, key=key, storage=FakeStorage(exists=False))
            assert False, "expected missing storage object to be rejected"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 409


def test_complete_bundle_direct_upload_queues_job(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        job, _ = _seed_job(db, bundle_path)
        job.status = "awaiting_upload"
        db.commit()
        bucket, key = softoptic_bundle_storage_location(job)

        updated = complete_bundle_direct_upload(db, job=job, bucket=bucket, key=key, storage=FakeStorage())

        assert updated.status == "queued"
        assert updated.progress == 12
        assert updated.step == "ממתין לעובד ייבוא"
        assert updated.bundle_storage_bucket == bucket
        assert updated.bundle_storage_key == key
        assert updated.bundle_path is None


def test_cleanup_deletes_billing_payments_before_billings(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        _, clinic = _seed_job(db, bundle_path)
        client = Client(company_id=clinic.company_id, clinic_id=clinic.id, first_name="A")
        db.add(client)
        db.flush()
        order = Order(client_id=client.id, clinic_id=clinic.id, user_id=None, order_data={})
        db.add(order)
        db.flush()
        billing = Billing(order_id=order.id, prepayment_amount=22.0)
        db.add(billing)
        db.flush()
        db.add(BillingPayment(billing_id=billing.id, amount=22.0, paid_at=date(2026, 6, 15), kind="payment"))
        db.add(OrderLineItem(billings_id=billing.id, description="Item", price=22.0))
        db.add(
            MigrationSourceLink(
                source_system=SOFTOPTIC_SOURCE_SYSTEM,
                source_table="Order",
                raw_row_ref=f"job1:Order:{order.id}",
                source_primary_key_parts=[["id", str(order.id)]],
                target_model="Order",
                target_id=order.id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload={"job_id": "job1"},
            )
        )
        db.commit()

        deleted = cleanup_previous_softoptic_import(db, clinic.id, storage=None)

        assert deleted["BillingPayment"] == 1
        assert deleted["OrderLineItem"] == 1
        assert deleted["Billing"] == 1
        assert db.query(BillingPayment).count() == 0
        assert db.query(Billing).count() == 0
        assert db.query(Order).count() == 0
