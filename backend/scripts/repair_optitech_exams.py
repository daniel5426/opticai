"""Preview or explicitly apply a scoped repair using retained raw snapshots.

Usage: python scripts/repair_optitech_exams.py --job-id ID --report PATH
Add --apply --target-host HOST to apply after reviewing the report.
A fresh extracted bundle may be provided with --extracts-dir to resolve lookups
and recover omitted source fields, missing clinical records, and cancellation.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--extracts-dir", type=Path)
    parser.add_argument("--source-per-id", type=int)
    parser.add_argument("--confirmed-source-job-id", help="Confirm a fresh export belongs to this original source database/job")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--target-host")
    args = parser.parse_args()
    from sqlalchemy import text
    from sqlalchemy.engine import make_url
    from config import settings
    from database import SessionLocal
    from models import Clinic, ContactLensOrder, MigrationJob, MigrationSourceLink, ExamLayoutInstance, OpticalExam, Order
    from migration.optitech.src.records import normalize_glasses_exam_row, normalize_contact_lens_exam_row
    from migration.optitech.src.phase3 import build_glasses_exam_data, build_contact_lens_exam_data, iter_glasses_exam_seeds, iter_file_seeds, upsert_files
    from migration.optitech.src.clinical_cards import resolve_seed_bases
    from migration.optitech.src.exam_layouts import build_instance_layout_data, GLASSES_COMPONENTS, CONTACT_LENS_COMPONENTS
    from migration.optitech.src.lookups import load_lookup_catalog
    from migration.optitech.src.reader import use_bundle_paths, iter_exported_rows
    from migration.optitech.src.repair import merge_imported_data, merge_layout, include_live_card_aliases
    from migration.optitech.src.clinical_import import import_clinical_exams
    from migration.optitech.src.trace import load_phase2_client_identity_map, load_phase2_user_identity_map
    from services.prescription_search_index import rebuild_exam_instance_index
    from migration.optitech.src.validate_phase3 import create_unmapped_field_report
    from services.file_storage_service import get_file_storage_service
    from dataclasses import replace
    target = make_url(settings.DATABASE_URL)
    print(json.dumps({"backend": target.get_backend_name(), "host": target.host, "database": target.database, "username": target.username}))
    if args.apply and (not args.target_host or args.target_host != target.host):
        parser.error("--apply requires --target-host matching the configured database")
    if args.apply and args.extracts_dir and args.confirmed_source_job_id != args.job_id:
        parser.error("Applying a fresh export requires --confirmed-source-job-id matching --job-id after verifying the source database")
    if args.extracts_dir and not args.extracts_dir.is_dir():
        parser.error("--extracts-dir must be an existing exported table directory")
    # No local historic lookup may substitute for this job's source lookup.
    extracts = args.extracts_dir or Path('/__no_optitech_source_bundle__')
    report = {"job_id": args.job_id, "apply": args.apply, "records": [], "clinical": None, "cancellations": [], "attachments": [], "attachment_import": None, "consolidation_candidates": [], "limitations": []}
    documents = extracts.parent / "documents"
    with use_bundle_paths(extracts, documents if documents.is_dir() else None), SessionLocal() as db:
        if not args.apply and not args.extracts_dir and target.get_backend_name() == 'postgresql':
            db.execute(text('SET TRANSACTION READ ONLY'))
        job = db.get(MigrationJob, args.job_id)
        if not job or job.source_system != 'optitech':
            parser.error("OptiTech migration job not found")
        catalog = load_lookup_catalog()
        # Fresh bundles are indexed using parsed dates; source exports can differ
        # in their date spelling while referring to the same exam.
        from migration.optitech.src.records import parse_access_date
        fresh = {}
        for table in ('tblCrdGlassChecks', 'tblCrdClensChecks'):
            for row in iter_exported_rows(table):
                key = (table, str(row.get('PerId')), parse_access_date(row.get('CheckDate')))
                if key in fresh:
                    parser.error(f'Ambiguous duplicate exam key in {table}; inspect the source before repair')
                fresh[key] = row
        fresh_glasses = {}
        if args.extracts_dir:
            for fresh_seed in iter_glasses_exam_seeds():
                if args.source_per_id is None or fresh_seed.source_per_id == args.source_per_id:
                    fresh_glasses[(str(fresh_seed.source_per_id), fresh_seed.check_date)] = fresh_seed
        link_query = db.query(MigrationSourceLink).filter_by(migration_job_id=job.id, clinic_id=job.clinic_id,
                  source_system='optitech', target_model='ExamLayoutInstance')
        if args.source_per_id is not None:
            link_query = link_query.filter(MigrationSourceLink.source_per_id == args.source_per_id)
        links = link_query.all()
        for link in links:
            if link.source_table not in ('tblCrdGlassChecks', 'tblCrdClensChecks'):
                continue
            instance = db.get(ExamLayoutInstance, link.target_id)
            if not instance:
                continue
            exam = db.get(OpticalExam, instance.exam_id)
            if not exam or exam.clinic_id != job.clinic_id:
                continue
            raw_link = db.query(MigrationSourceLink).filter_by(migration_job_id=job.id, clinic_id=job.clinic_id,
                source_system='optitech', target_model='OpticalExam', target_id=exam.id, source_table=link.source_table).first()
            raw = raw_link.raw_payload if raw_link else None
            old_payload = (link.payload or {}).get('target_payload', {})
            baseline = old_payload.get('exam_data')
            if not isinstance(raw, dict) or not isinstance(baseline, dict):
                report['records'].append({'exam_id': exam.id, 'skipped': 'missing_raw_or_import_baseline'})
                continue
            row = fresh.get((link.source_table, str(raw.get('PerId')), parse_access_date(raw.get('CheckDate'))), raw)
            if link.source_table == 'tblCrdGlassChecks':
                seed = resolve_seed_bases(normalize_glasses_exam_row(row), catalog)
                previous = (link.payload or {}).get('normalized_seed', {}).get('extra_context', {}).get('previous_refractions', [])
                previous_rows = (link.payload or {}).get('normalized_seed', {}).get('extra_context', {}).get('previous_raw_rows', [])
                seed = fresh_glasses.get((str(seed.source_per_id), seed.check_date)) or replace(seed,
                    extra_context={**seed.extra_context, 'previous_refractions': previous, 'previous_raw_rows': previous_rows})
                corrected = build_glasses_exam_data(seed, layout_instance_id=instance.id)
                # A bundle without base lookups cannot safely correct prior bases.
                if not catalog.get('tblBases'):
                    for key in ('r_base', 'l_base'):
                        corrected.get('final-prescription', {}).pop(key, None)
            else:
                seed = normalize_contact_lens_exam_row(row)
                corrected = build_contact_lens_exam_data(seed, layout_instance_id=instance.id,
                    catalog=catalog, clinic_name=exam.clinic or '', unresolved_dependencies=[])
                required_lookups = ('tblCrdClensTypes', 'tblCrdClensBrands', 'tblCrdClensManuf',
                    'tblCrdClensChecksMater', 'tblCrdClensChecksTint', 'tblCrdClensSolClean',
                    'tblCrdClensSolDisinfect', 'tblCrdClensSolRinse')
                if not all(catalog.get(table) for table in required_lookups):
                    corrected.pop('contact-lens-details', None)
                    corrected.pop('contact-lens-order', None)
            baseline, corrected = include_live_card_aliases(baseline, instance.exam_data or {}, corrected)
            merged, conflicts = merge_imported_data(baseline, instance.exam_data or {}, corrected)
            components = GLASSES_COMPONENTS if link.source_table == 'tblCrdGlassChecks' else CONTACT_LENS_COMPONENTS
            corrected_layout = build_instance_layout_data(components, corrected)
            layout = merge_layout(instance.layout_data, build_instance_layout_data(components, merged), old_payload.get('layout_data'))
            changed = merged != instance.exam_data or layout != instance.layout_data
            report['records'].append({'exam_id': exam.id, 'changed': changed, 'conflicts': conflicts,
                'added_card_keys': sorted(set(merged) - set(instance.exam_data or {})),
                'retained_legacy_keratometry': 'keratometer-contact-lens' in (instance.exam_data or {}),
                'unresolved_bases': list(seed.extra_context.get('unresolved_bases', {}))})
            if args.apply and changed:
                instance.exam_data, instance.layout_data = merged, layout
                # Store the new import baseline, never the edited live values.
                link.payload = {**(link.payload or {}), 'clinical_mapping_version': 3,
                    'target_payload': {**old_payload, 'exam_data': corrected, 'layout_data': corrected_layout}}
                rebuild_exam_instance_index(db, instance)
        if args.extracts_dir:
            manifest_path = args.extracts_dir.parent / "manifest.json"
            if manifest_path.exists():
                manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
                document_manifest = manifest.get("documents") if isinstance(manifest.get("documents"), dict) else {}
                report["attachments"] = document_manifest.get("references") or []
            clinic = db.get(Clinic, job.clinic_id)
            child_tables = (
                "tblCrdGlassChecksGlasses", "tblCrdGlassChecksFrm", "tblCrdGlassChecksGlassesP",
                "tblCrdLVChecks", "tblCrdClensFits", "tblCrdFrpsLines",
            )
            report["consolidation_candidates"] = [
                {"source_table": candidate.source_table, "raw_row_ref": candidate.raw_row_ref, "exam_id": candidate.target_id}
                for candidate in db.query(MigrationSourceLink).filter(
                    MigrationSourceLink.migration_job_id == job.id,
                    MigrationSourceLink.clinic_id == job.clinic_id,
                    MigrationSourceLink.target_model == "OpticalExam",
                    MigrationSourceLink.source_table.in_(child_tables),
                ).all()
            ]
            clinical_counts, clinical_skips = import_clinical_exams(
                db, clinic=clinic,
                client_map=load_phase2_client_identity_map(db, clinic_id=job.clinic_id),
                user_map=load_phase2_user_identity_map(db, clinic_id=job.clinic_id),
                migration_job_id=job.id, catalog=catalog, commit_each_batch=False, preserve_existing=True,
            )
            report["clinical"] = {"counts": clinical_counts, "dispositions": clinical_skips}
            existing_file_refs = {
                value for (value,) in db.query(MigrationSourceLink.raw_row_ref).filter(
                    MigrationSourceLink.clinic_id == job.clinic_id,
                    MigrationSourceLink.target_model == "File",
                ).all()
            }
            clinical_file_seeds = [
                seed for seed in iter_file_seeds()
                if seed.source_ref.table_name != "tblPerPicture" and seed.source_ref.raw_row_ref not in existing_file_refs
            ]
            storage = get_file_storage_service() if args.apply and clinical_file_seeds else None
            file_counts, file_skips, _, missing_files = upsert_files(
                db, seeds=clinical_file_seeds, clinic=clinic,
                client_map=load_phase2_client_identity_map(db, clinic_id=job.clinic_id),
                user_map=load_phase2_user_identity_map(db, clinic_id=job.clinic_id),
                unmapped_report=create_unmapped_field_report(), dry_run=not args.apply,
                storage=storage, migration_job_id=job.id, commit_each_batch=False,
            )
            report["attachment_import"] = {
                "counts": file_counts.as_dict(), "skipped": file_skips,
                "missing": missing_files, "existing_references_preserved": len(existing_file_refs),
            }
            fresh_work = {
                str(row.get("WorkId")): row
                for row in iter_exported_rows("tblCrdBuysWorks")
                if str(row.get("Canceled", "")).strip().lower() in {"1", "-1", "true", "yes"}
                and (args.source_per_id is None or int(float(row.get("PerId") or 0)) == args.source_per_id)
            }
            order_links = db.query(MigrationSourceLink).filter(
                MigrationSourceLink.migration_job_id == job.id,
                MigrationSourceLink.clinic_id == job.clinic_id,
                MigrationSourceLink.source_system == "optitech",
                MigrationSourceLink.source_table == "tblCrdBuysWorks",
                MigrationSourceLink.target_model.in_(("Order", "ContactLensOrder")),
            ).all()
            for order_link in order_links:
                raw = order_link.raw_payload if isinstance(order_link.raw_payload, dict) else {}
                row = fresh_work.get(str(raw.get("WorkId")))
                if row is None:
                    continue
                old_target = (order_link.payload or {}).get("target_payload", {})
                model = Order if order_link.target_model == "Order" else ContactLensOrder
                target_order = db.get(model, order_link.target_id)
                if target_order is None or target_order.clinic_id != job.clinic_id:
                    report["cancellations"].append({"raw_row_ref": order_link.raw_row_ref, "skipped": "missing_target"})
                    continue
                if order_link.target_model == "Order":
                    baseline = old_target.get("order_data") if isinstance(old_target.get("order_data"), dict) else {}
                    current = target_order.order_data if isinstance(target_order.order_data, dict) else {}
                    corrected = json.loads(json.dumps(baseline))
                    corrected.setdefault("details", {})["order_status"] = "מבוטל"
                    corrected.setdefault("legacy_source", {}).setdefault("work", {}).update(
                        {"canceled": True, "original_work_status_id": row.get("WorkStatId")}
                    )
                    merged, conflicts = merge_imported_data(baseline, current, corrected)
                    changed = merged != current
                    if args.apply and changed:
                        target_order.order_data = merged
                    corrected_target_payload = {**old_target, "order_data": corrected}
                else:
                    baseline = {"order_status": old_target.get("order_status"), "order_data": old_target.get("order_data") or {}}
                    current = {"order_status": target_order.order_status, "order_data": target_order.order_data or {}}
                    corrected = json.loads(json.dumps(baseline))
                    corrected["order_status"] = "מבוטל"
                    corrected["order_data"].setdefault("legacy_source", {}).setdefault("work", {}).update(
                        {"canceled": True, "original_work_status_id": row.get("WorkStatId")}
                    )
                    merged, conflicts = merge_imported_data(baseline, current, corrected)
                    changed = merged != current
                    if args.apply and changed:
                        target_order.order_status, target_order.order_data = merged["order_status"], merged["order_data"]
                    corrected_target_payload = {**old_target, **corrected}
                if args.apply:
                    order_link.payload = {
                        **(order_link.payload or {}), "clinical_mapping_version": 3,
                        "target_payload": corrected_target_payload,
                    }
                report["cancellations"].append({
                    "raw_row_ref": order_link.raw_row_ref, "target_model": order_link.target_model,
                    "target_id": order_link.target_id, "changed": changed, "conflicts": conflicts,
                })
        else:
            report["limitations"].append(
                "A matching version-3 source bundle is required to add omitted clinical records or repair cancellation."
            )
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2))
        if args.apply:
            db.commit()
        else:
            db.rollback()
    print(f"Report: {args.report}; {len(report['records'])} records reviewed")


if __name__ == '__main__':
    main()
