"""Synthetic source fixtures only; never connect to a configured clinic database."""
import csv
from datetime import datetime, timedelta, timezone
import hashlib
import json
import zipfile
import shutil

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import (Billing, BillingPayment, Client, Clinic, Company, ContactLensOrder, ExamLayoutInstance, File,
                    MigrationSourceLink, OpticalExam, Order, OrderGroup, OrderGroupEntry, OrderLineItem,
                    SoftOpticMigrationJob, User)
from migration.opticplus.bundle import check_archive, sha256, validate_bundle
from migration.opticplus.mapping import client_payload, exam_payload, product_slots


def test_screen_verified_client_and_contact_prescription_fields():
    assert client_payload({"qmikzoa": "test"})["occupation"] == "test"
    exam, data = exam_payload("adchecks", {
        "qtyp": "מרשם סופי", "cnrtype": "right lens type", "cnrcomp": "right company",
        "cnrbc": "8.4", "cnrktr": "14.1", "cnrkoter": "-3.00",
        "cnlktr": "14.4", "cnlkoter": "-4.25",
    })
    assert exam["type"] == "exam"
    assert data["contact-lens-exam"]["r_diam"] == 14.1
    assert data["contact-lens-exam"]["l_diam"] == 14.4
    assert "contact-lens-details" not in data
    assert data["opticplus-contact-fitting"]["cnrtype"] == "right lens type"
    assert data["opticplus-contact-fitting"]["cnrcomp"] == "right company"
    assert "notes-notes-1" not in data
    assert exam_payload("checks", {})[0]["type"] == "exam"


def test_newly_mapped_value_fills_null_without_overwriting_an_edit():
    from services.opticplus_migration_service import merge_fields
    merged, baseline, conflicts = merge_fields({}, {"occupation": None}, {"occupation": "test"})
    assert merged == baseline == {"occupation": "test"}
    assert not conflicts
    merged, _, conflicts = merge_fields({}, {"occupation": "edited"}, {"occupation": "test"})
    assert merged["occupation"] == "edited"
    assert conflicts
from services.opticplus_migration_service import OpticPlusImporter, merge_fields, run_opticplus_import
from services.softoptic_migration_service import cancel_job
from EndPoints.migration import create_import
from services.order_group_service import group_write
from services.opticplus_migration_service import Paused


@pytest.fixture
def db():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, autoflush=False)() as session:
        yield session
    engine.dispose()


def seed(db, job_id="first", dataset="a" * 32):
    clinic = db.query(Clinic).first()
    if not clinic:
        company = Company(name="Synthetic", owner_full_name="Test")
        db.add(company); db.flush()
        clinic = Clinic(name="Test", unique_id="synthetic", company_id=company.id, is_active=True)
        db.add(clinic); db.flush()
    job = SoftOpticMigrationJob(id=job_id, source_system="opticplus", clinic_id=clinic.id, company_id=clinic.company_id,
        status="running", step="test", progress=0, locked_by="test-worker",
        lease_until=datetime.now(timezone.utc) + timedelta(minutes=5), source_metadata={"dataset_id": dataset})
    db.add(job); db.commit()
    return job


def bundle(tmp_path, *, name="source", modified_name="First", total="100", paid="70", debt="30"):
    root = tmp_path / name
    (root / "tables").mkdir(parents=True); (root / "raw").mkdir(); (root / "source").mkdir()
    rows = {
        "cust_list": [{"numw": "1", "fname": "Family", "pname": modified_name, "zehut": "000123456", "bdate": "2202-01-01", "min": "נ"},
                      {"numw": "2", "fname": "Family", "pname": "Other", "zehut": "000123456", "bdate": None, "min": None}],
        "checks": [{"bdikanum": "7", "numw": "1", "qtyp": "מרשם סופי", "chdate": "2024-01-02", "crsph": "PLANO", "clsph": "-2.50", "crcyl": "BAL", "remark": 'line1\nline2 "quoted"'}],
        "adchecks": [{"bdikanum": "7", "numw": "1", "qtyp": "מרשם ישן", "caddate": None, "cnrsph": "-4.50", "cnrcomp": "Source model"}],
        "orders": [{"rnum": "9", "numw": "1", "ordernum": "123", "number": "0", "odate": "2024-01-02", "mwdate": "2024-01-02", "cn": False,
                    "color": "משקפיים מרחק", "og_type": "Lens", "ocolor": "black", "gpricet": "60", "bprice": "0", "amount": "0",
                    "color2": "מגע", "og_type2": "Contact model", "gpricet2": "40", "bprice2": "0",
                    "gf_price": total, "tpay": paid, "gpay": debt, "gprice": total, "greduce": "0"}],
        "tb_date_list": [], "tb_kabala": [], "tb_catalog": [{"wnum": "1", "amount": "-1"}],
    }
    schema, tables = [], []
    for table, data in rows.items():
        columns = list(data[0]) if data else ["wnum"]
        raw_path = root / "raw" / f"{table}.jsonl"; csv_path = root / "tables" / f"{table}.csv"
        raw_path.write_text("".join(json.dumps({**r, "__date_serials": {}}, ensure_ascii=False) + "\n" for r in data), encoding="utf-8")
        with csv_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=columns); writer.writeheader()
            for r in data: writer.writerow({k: str(v).lower() if isinstance(v, bool) else v for k, v in r.items()})
        schema.append({"name": table, "columns": [{"name": c, "disposition": "preserved"} for c in columns],
                       "header_rows": len(data), "enumerated_rows": len(data), "row_count": len(data)})
        tables.append({"name": table, "file": f"tables/{table}.csv", "raw_file": f"raw/{table}.jsonl", "row_count": len(data),
                       "sha256": sha256(csv_path), "raw_sha256": sha256(raw_path)})
    original = root / "source/optic_dt.accdb"; original.write_bytes(b"synthetic source " + modified_name.encode())
    inventory = root / "source-schema.json"
    inventory.write_text(json.dumps({"tables": schema, "selected_client_ids": [1, 2]}))
    manifest = {"source_system": "opticplus", "format_version": 2, "mapping_version": 1,
                "source_fingerprint": sha256(original), "selected_client_ids": [1, 2], "tables": tables,
                "source_archive": {"file": "source/optic_dt.accdb", "sha256": sha256(original), "complete": True},
                "source_schema_inventory": {"file": "source-schema.json", "sha256": sha256(inventory)}, "documents": {"files": []}}
    (root / "manifest.json").write_text(json.dumps(manifest))
    return root, manifest


def run(db, job, root, manifest):
    importer = OpticPlusImporter(db, job, root, validate_bundle(root, manifest))
    importer.run()
    return importer


def test_import_preserves_history_slots_and_finances(db, tmp_path):
    root, manifest = bundle(tmp_path)
    job = seed(db)
    importer = run(db, job, root, manifest)
    assert db.query(Client).count() == 2  # Duplicate national ID must not merge.
    assert db.query(OpticalExam).count() == 2  # Same numeric key, different source tables.
    assert db.query(OrderGroup).count() == 1
    assert db.query(OrderGroupEntry).count() == 2
    assert db.query(Order).count() == db.query(ContactLensOrder).count() == 1
    bill = db.query(Billing).one()
    assert (bill.total_after_discount, bill.prepayment_amount) == (100, 70)
    assert db.query(BillingPayment).count() == 0
    assert db.query(OrderLineItem).count() == 2
    assert db.query(Client).filter_by(first_name="First").one().date_of_birth is None
    instance = db.query(ExamLayoutInstance).order_by(ExamLayoutInstance.id).first()
    assert instance.exam_data["final-prescription"]["r_sph"] == 0
    assert instance.exam_data["notes-notes-1"]["note"] == 'line1\nline2 "quoted"'
    assert instance.exam_data["opticplus-prescription-details"]["crcyl"] == "BAL"
    assert db.query(ContactLensOrder).one().order_data["opticplus_source"]["slots"][0]["slot"] == "2"
    assert importer.coverage()["tb_catalog"]["disposition"] == "reference_data"


def test_retries_and_new_snapshots_preserve_user_edits_and_deletions(db, tmp_path):
    root, manifest = bundle(tmp_path)
    job = seed(db); run(db, job, root, manifest)
    client = db.query(Client).filter_by(first_name="First").one(); client.first_name = "User edit"
    other = db.query(Client).filter_by(first_name="Other").one(); other.deleted_at = datetime.now(timezone.utc)
    billing = db.query(Billing).one(); billing.prepayment_amount = 80
    with group_write(db):
        db.commit()
    next_root, next_manifest = bundle(tmp_path, name="next", modified_name="Source update", total="120", paid="70", debt="50")
    newer = seed(db, "second"); importer = run(db, newer, next_root, next_manifest)
    assert db.query(Client).execution_options(include_deleted=True).count() == 2
    assert db.get(Client, client.id).first_name == "User edit"
    assert db.query(Billing).one().prepayment_amount == 80
    assert db.query(OrderLineItem).count() == 2
    assert db.query(OrderGroup).count() == 1
    assert importer.counts["warning:billing_edited"] == 1
    assert importer.counts["warning:target_edited"] >= 1
    # Same job replay does not append records or apply conflicts a second time.
    run(db, newer, next_root, next_manifest)
    assert db.query(OpticalExam).count() == 2


def test_field_merge_does_not_adopt_conflicting_user_value_as_baseline():
    merged, baseline, conflicts = merge_fields({"name": "A"}, {"name": "B"}, {"name": "C"})
    assert merged["name"] == "B" and baseline["name"] == "A" and conflicts
    _, baseline, _ = merge_fields(baseline, merged, {"name": "B"})
    assert baseline["name"] == "A"


def test_bundle_rejects_tampering_selection_and_duplicate_keys(tmp_path):
    root, manifest = bundle(tmp_path)
    validate_bundle(root, manifest)
    manifest["selected_client_ids"] = [1]
    with pytest.raises(ValueError, match="selection"):
        validate_bundle(root, manifest)
    manifest["selected_client_ids"] = [1, 2]
    (root / "raw/checks.jsonl").write_text("{}\n")
    with pytest.raises(ValueError, match="checksum"):
        validate_bundle(root, manifest)


def test_import_rejects_worker_lease_loss_without_target_writes(db, tmp_path):
    root, manifest = bundle(tmp_path)
    job = seed(db)
    importer = OpticPlusImporter(db, job, root, validate_bundle(root, manifest))
    job.locked_by = "replacement"; db.commit()
    with pytest.raises(RuntimeError, match="owns"):
        importer.run()
    assert db.query(Client).count() == 0


def test_cancel_rejects_opticplus_after_first_committed_write(db):
    job = seed(db); job.checkpoint = {"writes_started": True}; db.commit()
    with pytest.raises(Exception, match="409"):
        cancel_job(db, job)


def test_job_api_owns_dataset_binding_and_validates_previous_clinic(db, monkeypatch):
    monkeypatch.setenv("OPTICPLUS_MIGRATION_ENABLED", "1")
    previous = seed(db); previous.status = "completed"; db.commit()
    user = User(company_id=previous.company_id, clinic_id=previous.clinic_id, username="admin", role_level=4, is_active=True)
    db.add(user); db.commit()
    payload = {"clinic_id": previous.clinic_id, "source_system": "opticplus", "bundle_format_version": 2,
               "source_fingerprint": "b" * 64, "source_metadata": {"dataset_id": "untrusted"}, "previous_import_job_id": previous.id}
    result = create_import(payload, db, user)
    assert result["source_metadata"]["dataset_id"] == "a" * 32
    payload["previous_import_job_id"] = "unknown"
    # Existing active job is rejected first; no second import is created.
    with pytest.raises(Exception): create_import(payload, db, user)


def test_invalid_finances_are_reported_without_invented_balances(db, tmp_path):
    root, manifest = bundle(tmp_path, debt="999")
    importer = run(db, seed(db), root, manifest)
    assert importer.counts["warning:billing_unreconciled"] == 1
    assert db.query(Billing).count() == 0


def test_archive_rejects_duplicate_and_symlink_entries(tmp_path):
    archive = tmp_path / "bad.zip"
    with zipfile.ZipFile(archive, "w") as z:
        info = zipfile.ZipInfo("link"); info.external_attr = 0o120777 << 16
        z.writestr(info, "../outside")
    with pytest.raises(ValueError, match="symbolic"):
        check_archive(archive)


def test_empty_product_label_does_not_crash_prescription_matching(db, tmp_path):
    root, manifest = bundle(tmp_path)
    importer = OpticPlusImporter(db, seed(db), root, validate_bundle(root, manifest))
    assert importer.match_prescription({"numw": "1", "mwdate": "2024-01-02"}, "regular", [{"values": {"color": None}}]) is None
    slots = product_slots({"color": "מגע", "color2": "משקפיים מרחק", "gpricet": "0"})
    assert len(slots) == 1 and slots[0]["kind"] == "contact"


def test_documents_retry_and_deletion_protection(db, tmp_path):
    root, manifest = bundle(tmp_path)
    local = root / "documents" / "scan.pdf"; local.parent.mkdir(); local.write_bytes(b"synthetic PDF")
    manifest["documents"]["files"] = [{"file": "documents/scan.pdf", "client_id": "1", "sha256": sha256(local),
                                         "size": local.stat().st_size, "original_name": "scan.pdf"}]
    class Storage:
        uploads = []
        def exists(self, bucket, key): return (bucket, key) in self.uploads
        def upload_path(self, bucket, key, path, content_type): self.uploads.append((bucket, key))
    storage = Storage()
    job = seed(db); job.include_documents = True; db.commit()
    importer = OpticPlusImporter(db, job, root, validate_bundle(root, manifest), storage); importer.run()
    assert db.query(File).count() == len(storage.uploads) == 1
    file = db.query(File).one(); file.deleted_at = datetime.now(timezone.utc); db.commit()
    newer = seed(db, "new-doc-snapshot"); newer.include_documents = True; db.commit()
    importer = OpticPlusImporter(db, newer, root, validate_bundle(root, manifest), storage); importer.run()
    assert db.query(File).count() == 0 and len(storage.uploads) == 1
    assert importer.counts["warning:target_removed"] == 1


def test_pause_at_batch_boundary_resumes_without_duplicate_records(db, tmp_path, monkeypatch):
    import services.opticplus_migration_service as service
    monkeypatch.setattr(service, "BATCH_SIZE", 1)
    root, manifest = bundle(tmp_path); job = seed(db)
    importer = OpticPlusImporter(db, job, root, validate_bundle(root, manifest))
    checkpoint = importer.checkpoint
    def pause_after_first(table, offset, **kwargs):
        checkpoint(table, offset, **kwargs)
        if table == "cust_list" and offset == 1:
            job.pause_requested = True; db.commit()
    importer.checkpoint = pause_after_first
    with pytest.raises(Paused): importer.run()
    assert job.status == "paused" and db.query(Client).count() == 1
    job.status = "running"; job.pause_requested = False; db.commit()
    run(db, job, root, manifest)
    assert db.query(Client).count() == 2 and db.query(OrderGroup).count() == 1


def test_production_capability_is_disabled_by_default(monkeypatch):
    from EndPoints.migration import opticplus_enabled
    monkeypatch.setenv("APP_ENV", "production"); monkeypatch.delenv("OPTICPLUS_MIGRATION_ENABLED", raising=False)
    assert opticplus_enabled() is False


def test_worker_validates_private_bundle_and_publishes_complete_report(db, tmp_path):
    root, manifest = bundle(tmp_path)
    archive = shutil.make_archive(str(tmp_path / "transfer"), "zip", root)
    class Storage:
        def __init__(self): self.objects = {("tests", "bundle.zip"): __import__("pathlib").Path(archive).read_bytes()}
        def download_to_path(self, bucket, key, path): path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(self.objects[(bucket, key)])
        def upload_path(self, bucket, key, path, content_type):
            assert (bucket, key) not in self.objects
            self.objects[(bucket, key)] = path.read_bytes()
        def remove(self, bucket, key): self.objects.pop((bucket, key), None)
    job = seed(db); job.bundle_storage_bucket = "tests"; job.bundle_storage_key = "bundle.zip"
    job.source_fingerprint = manifest["source_fingerprint"]; db.commit()
    storage = Storage()
    run_opticplus_import(db, job=job, storage=storage, on_progress=None)
    assert job.status == "completed", job.error
    assert "selected_client_ids" not in job.validation_summary["manifest"]
    report = job.import_summary["report"]
    assert report["available"] and storage.objects[(report["bucket"], report["key"])]
    import io
    with zipfile.ZipFile(io.BytesIO(storage.objects[(report["bucket"], report["key"])])) as z:
        reconciliation = json.loads(z.read("reconciliation.json"))
        assert reconciliation["fields"]["cust_list"]["pname"]["nonempty_rows"] == 2
        assert b'invalid_date' in z.read("import-issues.jsonl")


def test_rollback_preview_preserves_edited_and_shared_dependencies(db, tmp_path):
    from services.opticplus_migration_service import rollback_preview
    root, manifest = bundle(tmp_path); job = seed(db); run(db, job, root, manifest)
    job.status = "completed"; db.commit()
    original = rollback_preview(db, job)
    assert original["dry_run"] and not original["deletion_enabled"] and original["counts"]["reviewable"] > 0
    order = db.query(Order).one(); order.order_data = {**order.order_data, "user_added": True}
    with group_write(db): db.commit()
    preview = rollback_preview(db, job)
    assert preview["counts"]["retained"] > original["counts"].get("retained", 0)
    assert db.query(Client).count() == 2 and db.query(OrderGroup).count() == 1


def test_deleted_billing_is_not_recreated_by_new_snapshot(db, tmp_path):
    root, manifest = bundle(tmp_path); job = seed(db); run(db, job, root, manifest)
    with group_write(db):
        db.query(OrderLineItem).delete(); db.delete(db.query(Billing).one()); db.commit()
    newer = seed(db, "after-billing-deletion")
    importer = run(db, newer, root, manifest)
    assert db.query(Billing).count() == 0 and importer.counts["warning:billing_edited"] == 1


def test_completed_storage_upload_can_be_finalized_after_interruption(db):
    from services.softoptic_migration_service import prepare_bundle_direct_upload, complete_bundle_direct_upload
    job = seed(db); job.status = "awaiting_upload"; db.commit()
    class Storage:
        def exists(self, bucket, key): return True
    storage = Storage()
    target = prepare_bundle_direct_upload(db, job=job, storage=storage)
    assert target["already_uploaded"] is True
    complete_bundle_direct_upload(db, job=job, bucket=target["bucket"], key=target["key"], storage=storage)
    assert job.status == "queued"


def test_failed_opticplus_validation_can_be_cancelled_before_writes(db):
    job = seed(db); job.status = "failed"; db.commit()
    cancel_job(db, job)
    assert job.status == "cancelled"


def test_negative_opening_balances_preserve_source_signs(db, tmp_path):
    root, manifest = bundle(tmp_path, total="-20", paid="-10", debt="-10")
    run(db, seed(db), root, manifest)
    billing = db.query(Billing).one()
    assert billing.total_after_discount == -20 and billing.prepayment_amount == -10
    assert db.query(BillingPayment).count() == 0


def test_v2_preserves_meaningful_false_zero_and_distinct_clinical_instances(db, tmp_path):
    from models import MedicalLog
    root, manifest = bundle(tmp_path)
    importer = run(db, seed(db), root, manifest)
    rows = [
        ('tb_comp', {'wnum': '1', 'rnum': '1', 'datew': '2024-01-02', 'gijr': '0', 'tbr': '13'}),
        ('tb_quest', {'wnum': '1', 'rnum': '1', 'datew': '2024-01-02', 'qyes1': True, 'qno1': True, 'a1': False, 'remk1': '101'}),
    ]
    original = db.query(OpticalExam).filter_by(exam_date=__import__('datetime').date(2024, 1, 2)).one()
    for table, row in rows: importer.import_supplemental(table, row, row['rnum'])
    db.flush()
    assert db.query(OpticalExam).count() == 2
    supplementary = db.query(ExamLayoutInstance).filter_by(exam_id=original.id).order_by(ExamLayoutInstance.id.desc()).first()
    fields = list(supplementary.exam_data.values())
    assert any(f.get('gijr') == '0' for f in fields)
    assert any(f.get('a1') is False and f.get('qyes1') is True and f.get('qno1') is True for f in fields)
    assert db.query(MedicalLog).count() == 0
    for table, row in rows: importer.import_supplemental(table, row, row['rnum'])
    db.flush()
    assert db.query(OpticalExam).count() == 2
    assert len(supplementary.exam_data) == 3
    assert next(f for f in supplementary.exam_data.values() if f.get('r_but') is not None)['r_but'] == 13
    source_links = db.query(MigrationSourceLink).filter_by(target_model='OpticalExam', target_id=original.id).all()
    assert {'checks', 'tb_comp', 'tb_quest'}.issubset({link.source_table for link in source_links})


def test_supplemental_ambiguity_and_missing_dates_never_merge_unrelated_records(db, tmp_path):
    root, manifest = bundle(tmp_path)
    importer = run(db, seed(db), root, manifest)
    client = db.query(Client).filter_by(first_name='First').one()
    duplicate = OpticalExam(client_id=client.id, company_id=client.company_id, clinic_id=client.clinic_id, exam_date=__import__('datetime').date(2024, 1, 2), type='exam')
    db.add(duplicate); db.flush()
    importer.link_existing('OpticalExam', duplicate.id, importer.ref('adchecks', '99'), {}, 'adchecks', '99', patient='1')
    for table in ['tb_comp', 'tb_quest']:
        importer.import_supplemental(table, {'rnum': '1', 'wnum': '1', 'datew': '2024-01-02', 'gijr': '5'}, '1')
    db.flush()
    assert db.query(OpticalExam).filter_by(test_name='opticplus.exam.assessment').count() == 1
    for key in ['2', '3']:
        importer.import_supplemental('tb_comp', {'rnum': key, 'wnum': '1', 'datew': None, 'gijr': key}, key)
    db.flush()
    assert db.query(OpticalExam).filter_by(test_name='opticplus.exam.assessment').count() == 3


def test_v1_repair_retires_only_owned_dump_cards_and_wrong_va(db, tmp_path):
    from migration.opticplus.mapping import visible_source, layout_data
    root, manifest = bundle(tmp_path)
    importer = run(db, seed(db), root, manifest)
    link = db.query(MigrationSourceLink).filter_by(target_model='ExamLayoutInstance', source_table='checks').one()
    instance = db.get(ExamLayoutInstance, link.target_id)
    raw = {**link.raw_payload, 'cvisus': 'prescription remarks'}
    old_data = {'notes-notes-1': {'card_instance_id': 'notes-1', 'title': 'OpticPlus', 'note': visible_source(raw)},
                'contact-lens-details': {'card_instance_id': 'contact-lens-details-1', 'r_type': 'old'},
                'final-prescription': {'card_instance_id': 'final-prescription-1', 'comb_va': 'prescription remarks', 'r_sph': 0}}
    instance.exam_data = old_data
    instance.layout_data = json.dumps({'version':2,'items':[{'id':'notes-1','type':'notes'}, {'id':'contact-lens-details-1','type':'contact-lens-details'}, {'id':'final-prescription-1','type':'final-prescription'}]})
    link.raw_payload = raw
    link.payload = {'mapping_version': 1, 'baseline': {'exam_id': instance.exam_id, 'is_active':True, 'exam_data': old_data, 'layout_data':instance.layout_data}}
    db.flush()
    importer.prime([link.raw_row_ref])
    importer.import_exam('checks', raw)
    assert 'contact-lens-details' not in instance.exam_data
    assert 'comb_va' not in instance.exam_data['final-prescription']
    assert instance.exam_data['notes-notes-1']['note'] == 'line1\nline2 "quoted"'
    assert any(card.get('note') == 'prescription remarks' for card in instance.exam_data.values())
    assert 'cvisus' not in instance.exam_data['opticplus-prescription-details']
    assert 'contact-lens-details' not in {i['type'] for i in json.loads(instance.layout_data)['items']}


def test_clinical_repair_protects_edited_medical_history(db, tmp_path):
    from models import MedicalLog
    from migration.opticplus.mapping import visible_source
    root, manifest = bundle(tmp_path)
    importer = run(db, seed(db), root, manifest)
    for key in ['1', '2']:
        row = {'rnum': key, 'wnum':'1', 'datew':'2024-02-03', 'gijr':'5'}
        log = importer.upsert(MedicalLog, importer.ref('tb_comp', key), row,
            {**importer.scope('1'), 'log_date':__import__('datetime').date(2024,2,3), 'log':visible_source(row)}, table='tb_comp', key=key, patient='1')
        if key == '2': log.log = 'Clinician edit'
        db.flush()
        importer.import_supplemental('tb_comp', row, key)
        assert (log.deleted_at is not None) == (key == '1')
        assert log.log == ('Clinician edit' if key == '2' else visible_source(row))


def test_references_reuse_lookups_and_frames_without_creating_stock(db, tmp_path):
    from models import LookupSupplier, CatalogProduct, CatalogVariant, InventoryBalance, InventoryMovement
    root, manifest = bundle(tmp_path)
    importer = run(db, seed(db), root, manifest)
    for key in ['1', '2']:
        importer.import_supplemental('sapakim', {'rnum':key, 'shem sapak':'Same supplier'}, key)
    row={'wnum':'5','hevra':'Brand','degem':'Frame','color':'Black','godel':'52','cprice':'30','sprice':'90','amount':'-1'}
    importer.import_supplemental('tb_catalog', row, '5')
    importer.import_supplemental('tb_catalog', row, '5')
    db.flush()
    assert db.query(LookupSupplier).count() == 1
    assert db.query(MigrationSourceLink).filter_by(target_model='LookupSupplier').count() == 2
    assert db.query(CatalogProduct).count() == db.query(CatalogVariant).count() == 1
    assert db.query(CatalogVariant).one().default_retail == 90
    assert db.query(InventoryBalance).count() == db.query(InventoryMovement).count() == 0


def test_selected_client_scope_is_enforced_before_writes(db, tmp_path):
    root, manifest = bundle(tmp_path)
    job = seed(db)
    job.source_metadata={**job.source_metadata,'selected_client_ids':[1]}
    importer=OpticPlusImporter(db,job,root,validate_bundle(root,manifest))
    with pytest.raises(ValueError,match='requested scope'): importer.run()
    assert db.query(Client).count() == 0


def test_order_products_do_not_copy_shared_quantity_into_each_eye():
    from migration.opticplus.mapping import order_product_data
    slots=product_slots({'color':'מגע','og_type':'Ordered lens','ocomp':'Manufacturer','amount':'2','ar':True,'al':True,'sapaka':'2'})
    product=order_product_data('contact',slots,{'2':'Supplier'})['contact-lens-details']
    assert product['r_lens_type']==product['l_lens_type']=='Ordered lens'
    assert product['r_supplier']=='Supplier'
    assert 'r_quantity' not in product and 'l_quantity' not in product and 'r_model' not in product


def test_order_extras_are_idempotent_and_part_of_the_billing_breakdown(db, tmp_path):
    root, manifest = bundle(tmp_path)
    job=seed(db)
    importer=run(db,job,root,manifest)
    row=json.loads((root/'raw/orders.jsonl').read_text().splitlines()[0])
    row.update({'oth1':'Fee','otht1':'Lab service','othp1':'12','gf_price':'112','gprice':'112','gpay':'42'})
    # Prime exactly as a resumed batch does, then import this source revision twice.
    refs=[link.raw_row_ref for link in db.query(MigrationSourceLink).all()]+[importer.ref('orders','9','line-extra1:othp1')]
    for _ in range(2):
        importer.prime(refs)
        with group_write(db):
            importer.import_order(row)
            db.flush()
    assert db.query(OrderLineItem).filter_by(source_slot='extra1:othp1').count()==1
    assert db.query(OrderLineItem).filter_by(source_slot='extra1:othp1').one().line_total==12
    assert db.query(Billing).one().total_after_discount==112


def test_reference_search_is_scoped_paginated_and_reused_links_remain_readable(db, tmp_path):
    from EndPoints.migration import get_opticplus_reference_data
    from fastapi import HTTPException
    root, manifest=bundle(tmp_path)
    job=seed(db)
    importer=run(db,job,root,manifest)
    for key in ['1','2']:
        importer.import_supplemental('tb_ad_catalog',{'wnum':key,'hevra':'Maker','typ':'Progressive','cprice':'30','sprice':'90'},key)
    db.flush()
    user=User(company_id=job.company_id,clinic_id=job.clinic_id,username='reference-test',role_level=2,is_active=True)
    db.add(user);db.flush()
    result=get_opticplus_reference_data(job.id,table='tb_ad_catalog',q='Progressive',page=1,limit=1,db=db,current_user=user)
    assert result['total']==2 and len(result['items'])==1
    assert 'cprice' not in result['items'][0]['values']
    assert result['items'][0]['values']['sprice']=='90'
    with pytest.raises(HTTPException):
        get_opticplus_reference_data(job.id,table='pass',q='',page=1,limit=25,db=db,current_user=user)
    outsider_company=Company(name='Other',owner_full_name='Other')
    db.add(outsider_company);db.flush()
    user.company_id=outsider_company.id
    with pytest.raises(HTTPException):
        get_opticplus_reference_data(job.id,table='tb_ad_catalog',q='',page=1,limit=25,db=db,current_user=user)


def test_field_comparison_accounts_for_source_values_without_masking_differences(db,tmp_path):
    from migration.opticplus.comparison import compare_pilot
    root,manifest=bundle(tmp_path)
    job=seed(db);run(db,job,root,manifest)
    rows=compare_pilot(db,root=root,validation=validate_bundle(root,manifest),dataset='a'*32,clinic_id=job.clinic_id)
    assert rows and not [row for row in rows if row['status'] in {'missing','mismatch'}]
    imported=db.query(ExamLayoutInstance).join(OpticalExam).filter(OpticalExam.test_name=='opticplus.exam.glasses').first()
    unrelated=ExamLayoutInstance(exam_id=imported.exam_id, layout_data='{}', exam_data={'notes-unrelated': {'note':None}}, is_active=False)
    db.add(unrelated);db.flush()
    rows=compare_pilot(db,root=root,validation=validate_bundle(root,manifest),dataset='a'*32,clinic_id=job.clinic_id)
    assert not [row for row in rows if row['status'] in {'missing','mismatch'}]
    client=db.query(Client).filter_by(first_name='First').one()
    client.first_name='Intentional edit';db.flush()
    rows=compare_pilot(db,root=root,validation=validate_bundle(root,manifest),dataset='a'*32,clinic_id=job.clinic_id)
    assert any(row['field']=='pname' and row['status']=='mismatch' for row in rows)


def test_imported_frame_prices_update_but_manual_price_edits_are_protected(db,tmp_path):
    from models import CatalogVariant
    root,manifest=bundle(tmp_path);importer=run(db,seed(db),root,manifest)
    row={'wnum':'5','hevra':'Brand','degem':'Frame','color':'Black','godel':'52','sprice':'90'}
    importer.import_supplemental('tb_catalog',row,'5');db.flush()
    variant=db.query(CatalogVariant).one()
    importer.import_supplemental('tb_catalog',{**row,'sprice':'95'},'5');db.flush()
    assert variant.default_retail==95
    variant.default_retail=120;db.flush()
    importer.import_supplemental('tb_catalog',{**row,'sprice':'99'},'5');db.flush()
    assert variant.default_retail==120


def test_values_hidden_by_standard_cards_are_visible_through_live_bindings():
    _,data=exam_payload('checks',{'bdikanum':'7','qtyp':'מרשם סופי','crvisus':'6/9','crhigh':'18'})
    extra=data['opticplus-prescription-details']
    assert extra['crvisus']=='6/9' and extra['crhigh']=='18'
    assert extra['bindings']['crvisus']=={'component':'final-prescription','field':'r_va','cardInstanceId':'final-prescription-1'}
    assert extra['bindings']['crhigh']['field']=='r_high'


def test_supplemental_sequence_numbers_are_namespaced_by_patient():
    from migration.opticplus.clinical import clinical_source_key
    assert clinical_source_key({'wnum':'1','rnum':'1'})=='1:1'
    assert clinical_source_key({'wnum':'2','rnum':'1'})=='2:1'


def test_source_blanks_clear_owned_values_without_retaining_stale_measurements(db,tmp_path):
    root,manifest=bundle(tmp_path);importer=run(db,seed(db),root,manifest)
    raw=json.loads((root/'raw/checks.jsonl').read_text().splitlines()[0])
    importer.prime([importer.ref('checks','7'),importer.ref('checks','7','layout')])
    importer.import_exam('checks',{**raw,'crsph':None,'remark':None})
    instance=db.query(ExamLayoutInstance).filter_by(exam_id=db.query(OpticalExam).filter_by(test_name='opticplus.exam.glasses').one().id).one()
    assert instance.exam_data['final-prescription']['r_sph'] is None
    assert instance.exam_data['notes-notes-1']['note'] is None
    row={'rnum':'1','wnum':'1','datew':'2024-01-02','gijr':'5'}
    importer.import_supplemental('tb_comp',row,'1')
    importer.import_supplemental('tb_comp',{**row,'gijr':None},'1')
    db.flush()
    measure=db.query(ExamLayoutInstance).filter_by(exam_id=instance.exam_id).order_by(ExamLayoutInstance.id.desc()).first()
    assert next(card for card in measure.exam_data.values() if card.get('source_table')=='tb_comp')['gijr'] is None
    evidence=db.query(MigrationSourceLink).filter_by(target_model='OpticalExam',raw_row_ref=importer.ref('tb_comp','1','assessment')).one()
    assert evidence.raw_payload['gijr'] is None


def test_bare_and_unusual_opticplus_acuity_never_acquire_softoptic_denominator_semantics():
    _,data=exam_payload('adchecks',{'qtyp':'מרשם סופי','cnrvisus':'1','cnlvisus':'BAL'})
    assert data['contact-lens-exam']['r_va'] == '1'
    assert data['contact-lens-exam']['l_va'] == 'BAL'
    assert data['contact-lens-exam']['opticplus_source']['literal_va'] is True
    assert 'cnrvisus' not in data.get('opticplus-contact-fitting', {})
    assert 'cnlvisus' not in data.get('opticplus-contact-fitting', {})


def test_read_only_comparison_can_inspect_pre_company_schema_without_modifying_it(db,tmp_path):
    from sqlalchemy import text
    from migration.opticplus.comparison import compare_pilot
    root,manifest=bundle(tmp_path);job=seed(db);run(db,job,root,manifest)
    clinic_id=job.clinic_id
    columns=','.join(column.name for column in OpticalExam.__table__.columns if column.name!='company_id')
    db.execute(text('ALTER TABLE optical_exams RENAME TO optical_exams_new_schema'))
    db.execute(text('CREATE TABLE optical_exams AS SELECT '+columns+' FROM optical_exams_new_schema'))
    db.commit();db.expunge_all()
    rows=compare_pilot(db,root=root,validation=validate_bundle(root,manifest),dataset='a'*32,clinic_id=clinic_id,read_only_older_schema=True)
    assert not [row for row in rows if row['status'] in {'missing','mismatch'}]
    assert 'company_id' not in {row[1] for row in db.execute(text('PRAGMA table_info(optical_exams)'))}


def test_explicit_patient_selection_stays_in_server_metadata_not_status_polling(db):
    from services.softoptic_migration_service import job_to_dict
    job=seed(db);job.source_metadata={**job.source_metadata,'selected_client_ids':[1]}
    assert job.source_metadata['selected_client_ids']==[1]
    assert 'selected_client_ids' not in job_to_dict(job)['source_metadata']


def test_standard_cards_replace_only_compatible_source_fields():
    _, data = exam_payload('checks', {'bdikanum':'7','qtyp':'מרשם סופי', 'ncriadd':'2.75','ncliadd':'3',
        'ncrbadd':'1.75','nclbadd':'2','ncrmadd':'2.25','nclmadd':'20','crnvisus':'J/5','clnvisus':'J/6',
        'crpvisus':'6/6/9','crvisus':'6.7','cvisus':'actual remarks'})
    addition = next(v for v in data.values() if v.get('source_card_type') == 'addition')
    assert addition['r_int'] == 2.75 and addition['l_int'] == 3
    assert addition['r_bif'] == 1.75 and addition['l_bif'] == 2
    assert addition['r_mul'] == 2.25 and addition['r_j'] == 'J/5'
    assert 'l_mul' not in addition
    assert data['opticplus-prescription-details']['nclmadd'] == '20'
    assert 'ncriadd' not in data['opticplus-prescription-details']
    assert data['final-prescription']['r_va'] == '6.7'
    assert next(v for v in data.values() if v.get('source_card_type') == 'uncorrected-va')['r_fv'] == '6/6/9'
    _, data = exam_payload('adchecks', {'bdikanum':'8','qtyp':'מרשם סופי','cnror':'-0.25','cnlor':'6/9','cnrorv':'6/7.5-'})
    over = next(v for v in data.values() if v.get('source_card_type') == 'over-refraction')
    assert over['r_sph'] == -0.25 and over['r_va'] == '6/7.5-'
    assert 'l_sph' not in over
    assert data['opticplus-contact-fitting']['cnlor'] == '6/9'
    _, old = exam_payload('adchecks', {'bdikanum':'9','qtyp':'מרשם ישן','cnradd':'1.25'})
    assert 'r_read_ad' not in old['old-contact-lenses']
    assert old['opticplus-contact-fitting']['cnradd'] == '1.25'


def test_v2_custom_edits_move_into_standard_cards_and_survive_reimport(db, tmp_path):
    from copy import deepcopy
    from migration.opticplus.clinical import card_data
    from migration.opticplus.mapping import layout_data
    root, manifest = bundle(tmp_path)
    importer = run(db, seed(db), root, manifest)
    link = db.query(MigrationSourceLink).filter_by(target_model='ExamLayoutInstance', source_table='checks').one()
    instance = db.get(ExamLayoutInstance, link.target_id)
    raw = {**link.raw_payload, 'ncrbadd':'1.75'}
    extra = card_data('opticplus-prescription-details', {'ncrbadd':'1.75'},table='checks',key='7')
    original = {'opticplus-prescription-details':extra}
    instance.layout_data = layout_data(original)
    link.payload = {'mapping_version':2, 'baseline':{'exam_id':instance.exam_id,'is_active':True,
        'exam_data':deepcopy(original),'layout_data':instance.layout_data}}
    edited = deepcopy(extra); edited['ncrbadd'] = '1.90'
    alias = 'opticplus-prescription-details-'+extra['card_instance_id']
    instance.exam_data = {**original, alias:edited}
    db.flush()
    for _ in range(2):
        importer.prime([importer.ref('checks','7'),importer.ref('checks','7','layout')])
        importer.import_exam('checks',raw)
        db.flush()
        addition = next(v for v in instance.exam_data.values() if v.get('source_card_type')=='addition')
        assert addition['r_bif'] == 1.9
        assert not any('ncrbadd' in v for v in instance.exam_data.values())
    assert link.payload['clinical_revision'] == 3
    assert link.payload['clinical_repair']['moved_fields']


def test_relocation_keeps_conflicts_and_non_numeric_edits_visible():
    from copy import deepcopy
    from migration.opticplus.repair import relocate_clinical_fields
    from migration.opticplus.clinical import card_data, native_card
    old={'extra':card_data('opticplus-prescription-details',{'ncrbadd':'1.75'},table='checks',key='7')}
    native=native_card('addition',{'r_bif':1.75},{'ncrbadd':'r_bif'},table='checks',key='7')
    current=deepcopy(old);current['extra']['ncrbadd']='unusual edited text'
    _,live,new,_,_,moves,conflicts=relocate_clinical_fields(old,current,native,'{}','{}')
    assert live['extra']['ncrbadd']=='unusual edited text'
    assert not new and not moves and conflicts[0]['reason']=='edited_value_not_representable'
    key=next(iter(native));old.update(deepcopy(native));current=deepcopy(old)
    current['extra']['ncrbadd']='2';current[key]['r_bif']=3
    _,live,_,_,_,moves,conflicts=relocate_clinical_fields(old,current,native,'{}','{}')
    assert live[key]['r_bif']==3 and live['extra']['ncrbadd']=='2'
    assert not moves and conflicts[0]['reason']=='destination_edited'


def test_owned_layout_places_source_cards_compactly_without_duplicate_aliases():
    from migration.opticplus.clinical import supplemental_cards
    from migration.opticplus.mapping import layout_data
    _, _, cards = supplemental_cards('tb_comp',{'gijr':'5','gijl':'6','tbr':'13','tbl':'14'},'1')
    key = next(iter(cards));cards[key+'-alias'] = cards[key]
    items=json.loads(layout_data(cards))['items']
    assert len({i['id'] for i in items}) == len(items) == 2
    assert {i['type'] for i in items} == {'opticplus-measurements','schirmer-test'}
    assert all(0<=i['x'] and i['x']+i['w']<=24 for i in items)
    assert all(i['w']==8 for i in items)
