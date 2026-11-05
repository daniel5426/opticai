import csv
import zipfile
from datetime import date

import pytest
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
    ExamLayoutInstance,
    MigrationSourceLink,
    OpticalExam,
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
    resume_job,
    _safe_extract_zip,
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
                "turn_name",
                "send_sms_email",
                "discount_type",
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
                    "turn_name": "ד\"ר הלפרט",
                    "send_sms_email": "1",
                    "discount_type": "1",
                }
            )
    with (export_dir / "t_discount_types.csv").open("w", newline="", encoding="utf-8") as handle:
        csv.writer(handle).writerows([["discount_code", "discount_name"], ["1", "PriceList 1"]])
    bundle_path = tmp_path / "bundle.zip"
    with zipfile.ZipFile(bundle_path, "w") as archive:
        archive.write(export_dir / "account.csv", "account.csv")
        archive.write(export_dir / "t_discount_types.csv", "t_discount_types.csv")
    return bundle_path, export_dir


def test_safe_extract_zip_normalizes_windows_member_paths(tmp_path):
    bundle_path = tmp_path / "windows-bundle.zip"
    with zipfile.ZipFile(bundle_path, "w") as archive:
        archive.writestr(r"tables\tblCitys.csv", "CityId,CityName\r\n1,Haifa\r\n")

    destination = tmp_path / "extracted"
    _safe_extract_zip(bundle_path, destination)

    assert (destination / "tables" / "tblCitys.csv").read_bytes() == b"CityId,CityName\r\n1,Haifa\r\n"


def test_safe_extract_zip_rejects_windows_path_traversal(tmp_path):
    bundle_path = tmp_path / "unsafe-bundle.zip"
    with zipfile.ZipFile(bundle_path, "w") as archive:
        archive.writestr(r"..\outside.csv", "not allowed")

    with pytest.raises(Exception, match="Invalid migration archive"):
        _safe_extract_zip(bundle_path, tmp_path / "extracted")

    assert not (tmp_path / "outside.csv").exists()


def _seed_job(db, bundle_path, job_id="job1", client_import_limit=None, clinic_unique_id="clinic-a", username="admin"):
    company = Company(name="A", owner_full_name="Owner")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="Clinic", unique_id=clinic_unique_id)
    user = User(company_id=company.id, clinic_id=None, username=username, role_level=4, is_active=True)
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
        # SoftOptic keeps the referring party in account.turn_name.
        imported = db.query(Client).filter_by(clinic_id=clinic.id).one()
        assert imported.referring_party == 'ד"ר הלפרט'
        # account.send_sms_email is the client's notifications opt-in.
        assert imported.send_notifications is True
        # account.discount_type is a t_discount_types code; the client gets its name as the price list.
        assert imported.price_list == "PriceList 1"
        assert (
            db.query(MigrationSourceLink)
            .filter_by(source_system=SOFTOPTIC_SOURCE_SYSTEM, clinic_id=clinic.id, target_model="Client")
            .count()
            == 1
        )
        first_client_link = (
            db.query(MigrationSourceLink)
            .filter_by(source_system=SOFTOPTIC_SOURCE_SYSTEM, clinic_id=clinic.id, target_model="Client")
            .one()
        )
        assert first_client_link.raw_payload["first_name"] == "שם"
        assert first_client_link.raw_payload["account_code"] == "101"
        assert len(first_client_link.raw_payload_sha256) == 64
        assert first_client_link.migration_job_id == job.id

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
        latest_client_link = (
            db.query(MigrationSourceLink)
            .filter_by(source_system=SOFTOPTIC_SOURCE_SYSTEM, clinic_id=clinic.id, target_model="Client")
            .one()
        )
        assert latest_client_link.migration_job_id == second_job.id


def test_populated_clinic_data_is_allowed_and_preserved(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        job, clinic = _seed_job(db, bundle_path)
        existing = Client(company_id=clinic.company_id, clinic_id=clinic.id, first_name="Existing")
        db.add(existing)
        db.commit()
        existing_id = existing.id

        assert_safe_to_import(db, clinic.id)
        run_softoptic_import(db, job=job, storage=None, on_progress=lambda **kwargs: None)

        assert db.get(Client, existing_id).first_name == "Existing"
        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 2


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
        link = db.query(MigrationSourceLink).filter_by(target_model="Client", target_id=imported_clients[0].id).one()
        assert link.raw_payload["account_code"] == "101"
        db.refresh(job)
        assert job.import_summary["client_import_limit"] == 1
        assert job.import_summary["client_imported_count"] == 1


def test_resume_preserves_uncheckpointed_clinical_rows_for_idempotent_resume(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        job, clinic = _seed_job(db, bundle_path)
        job.status = "failed"
        job.bundle_storage_bucket = "migration-bundles"
        job.bundle_storage_key = "jobs/job1.zip"
        job.checkpoint = {"completed_phases": ["validation", "cleanup", "clients"]}
        client = Client(company_id=clinic.company_id, clinic_id=clinic.id, first_name="Imported")
        db.add(client)
        db.flush()
        exam = OpticalExam(client_id=client.id, clinic_id=clinic.id, test_name="Partial")
        db.add(exam)
        db.flush()
        exam_id = exam.id
        db.add(ExamLayoutInstance(exam_id=exam.id, exam_data={}))
        db.add_all([
            MigrationSourceLink(
                source_system=SOFTOPTIC_SOURCE_SYSTEM,
                source_table="account.csv",
                raw_row_ref="account.csv:account_code=101",
                source_primary_key_parts=[["account_code", "101"]],
                target_model="Client",
                target_id=client.id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                migration_job_id=job.id,
                payload={},
            ),
            MigrationSourceLink(
                source_system=SOFTOPTIC_SOURCE_SYSTEM,
                source_table="optic_eye_tests.csv",
                raw_row_ref="optic_eye_tests.csv:code=1:account_code=101",
                source_primary_key_parts=[["code", "1"], ["account_code", "101"]],
                target_model="OpticalExam",
                target_id=exam.id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                migration_job_id=job.id,
                payload={},
            ),
        ])
        db.commit()

        resume_job(db, job)

        assert db.get(OpticalExam, exam_id) is not None
        assert db.query(ExamLayoutInstance).count() == 1
        assert db.get(Client, client.id) is not None
        assert db.query(MigrationSourceLink).filter_by(target_model="OpticalExam").count() == 1
        assert db.query(MigrationSourceLink).filter_by(target_model="Client").count() == 1
        assert job.status == "queued"


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


def test_client_id_collision_and_resume_mapping(tmp_path):
    from migration.pipeline.steps import migrate_clients_and_families
    SessionLocal = _session_factory()
    bundle, export = _write_bundle(tmp_path, client_count=2)
    with SessionLocal() as db:
        job, clinic = _seed_job(db, bundle)
        other_company = Company(name="Other", owner_full_name="Owner")
        db.add(other_company)
        db.flush()
        other_clinic = Clinic(company_id=other_company.id, name="Other", unique_id="other-clinic")
        db.add(other_clinic)
        db.flush()
        collision_id = int(f"{clinic.id}101")
        existing = Client(id=collision_id, company_id=other_company.id, clinic_id=other_clinic.id, first_name="Keep")
        db.add(existing)
        db.commit()
        trace = dict(source_system="softoptic", company_id=job.company_id, migration_job_id=job.id)
        mapping, _ = migrate_clients_and_families(db, str(export), clinic.company, target_clinic_id=clinic.id, trace_context=trace)
        assert mapping["101"] != collision_id
        assert db.get(Client, collision_id).first_name == "Keep"
        resumed, _ = migrate_clients_and_families(db, str(export), clinic.company, return_only=True, target_clinic_id=clinic.id, trace_context=trace)
        assert resumed == mapping
        # Recovery between the data commit and phase checkpoint must not duplicate clients.
        repeated, _ = migrate_clients_and_families(db, str(export), clinic.company, target_clinic_id=clinic.id, trace_context=trace)
        assert repeated == mapping
        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 2


def test_failed_batch_rolls_back_and_reports_error(tmp_path, monkeypatch):
    from sqlalchemy.exc import IntegrityError
    SessionLocal = _session_factory()
    bundle, _ = _write_bundle(tmp_path, client_count=2)
    with SessionLocal() as db:
        job, clinic = _seed_job(db, bundle)
        updates = []
        def fail(*args, **kwargs):
            raise IntegrityError("private SQL", {"name": "private patient"}, Exception("duplicate client ID"))
        monkeypatch.setattr(db, "bulk_save_objects", fail)
        run_softoptic_import(db, job=job, storage=None, on_progress=lambda **kw: updates.append(kw))
        assert updates[-1]["status"] == "failed"
        assert updates[-1]["error"] == "duplicate client ID"
        assert "private patient" not in str(updates[-1])
        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 0


def test_single_client_selection_preserves_other_imports_and_rejects_mismatch(tmp_path):
    import json
    SessionLocal = _session_factory()
    bundle, export = _write_bundle(tmp_path)
    (export / "manifest.json").write_text(json.dumps({"client_account_code": "101"}))
    with zipfile.ZipFile(bundle, "a") as archive:
        archive.write(export / "manifest.json", "manifest.json")
    with SessionLocal() as db:
        job, clinic = _seed_job(db, bundle)
        keep = Client(company_id=clinic.company_id, clinic_id=clinic.id, first_name="Keep")
        db.add(keep)
        db.flush()
        keep_id = keep.id
        db.add(MigrationSourceLink(source_system="softoptic", source_table="account.csv", target_model="Client",
            target_id=keep_id, clinic_id=clinic.id, company_id=clinic.company_id,
            raw_row_ref="old-client", source_primary_key_parts=[["account_code", "999"]], raw_payload={"account_code": "999"}))
        job.source_metadata = {"client_account_code": "101"}
        db.commit()
        def progress(**kwargs):
            update_job(db, job, **kwargs)
        run_softoptic_import(db, job=job, storage=None, on_progress=progress)
        assert job.status == "completed"
        assert db.get(Client, keep_id).first_name == "Keep"
        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 2
        job.source_metadata = {"client_account_code": "102"}
        db.commit()
        run_softoptic_import(db, job=job, storage=None, on_progress=progress)
        assert job.status == "failed"
        assert job.error == "softoptic.selectionMismatch"
        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 2


def test_single_client_option_is_validated_and_bound_by_api(tmp_path):
    from EndPoints.migration import create_import
    from fastapi import HTTPException
    SessionLocal = _session_factory()
    bundle, _ = _write_bundle(tmp_path)
    with SessionLocal() as db:
        job, clinic = _seed_job(db, bundle)
        job.status = "completed"
        db.commit()
        user = db.get(User, job.user_id)
        payload = {"clinic_id": clinic.id, "source_system": "softoptic", "options": {"client_account_code": "23470"}}
        for bad in [True, 23470, "", "12x", "1" * 31]:
            with pytest.raises(HTTPException) as error:
                create_import({**payload, "options": {"client_account_code": bad}}, db, user)
            assert error.value.status_code == 422
        result = create_import(payload, db, user)
        assert db.get(SoftOpticMigrationJob, result["id"]).source_metadata["client_account_code"] == "23470"
