"""OpticPlus imports: bounded transactions, source ownership and edit protection."""
from __future__ import annotations

from collections import Counter, defaultdict
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import hashlib
from itertools import islice
import json
import mimetypes
from pathlib import Path
import shutil
import tempfile
from typing import Any
from uuid import uuid4

from sqlalchemy import Date, DateTime, select
from sqlalchemy.orm import Session

from models import (Appointment, Billing, BillingPayment, Client, Clinic, ContactLensOrder,
                    ExamLayoutInstance, File, MedicalLog, MigrationSourceLink, OpticalExam,
                    Order, OrderGroup, OrderGroupEntry, OrderLineItem, SoftOpticMigrationJob)
from models import LookupSupplier, LookupLensModel, LookupManufacturer, LookupFrameModel, CatalogProduct, CatalogVariant
from migration.opticplus.clinical import (CLINICAL_TABLES, REFERENCE_TABLES, CLINICAL_REVISION, card_data, client_history,
                                         supplemental_cards, field_disposition, clinical_source_key)
from migration.opticplus.repair import relocate_clinical_fields
from services.inventory_service import create_product, create_variant
from migration.opticplus.bundle import check_archive, checked_file, iter_rows, source_id, validate_bundle
from migration.opticplus.mapping import (billing_payload, clean, client_payload, date_value,
                                        exam_payload, json_value, layout_data, money, product_slots, visible_source, order_product_data)
from migration.optitech.src.repair import merge_layout, include_live_card_aliases
from services.order_group_service import group_write, order_groups_available
from services.prescription_search_index import rebuild_exam_instance_index, rebuild_order_index, rebuild_contact_lens_order_index
from services.softoptic_migration_service import _safe_extract_zip, update_job, SOFTOPTIC_LEASE_SECONDS

BATCH_SIZE = 250
MODELS = {m.__name__: m for m in [Client, OpticalExam, ExamLayoutInstance, Order, ContactLensOrder,
                                  OrderGroup, OrderGroupEntry, Billing, OrderLineItem, MedicalLog, Appointment, File]}
MODELS.update({m.__name__: m for m in [LookupSupplier, LookupLensModel, LookupManufacturer, LookupFrameModel, CatalogProduct, CatalogVariant]})


class LeaseLost(RuntimeError):
    pass


class Paused(RuntimeError):
    pass


def _canonical(value):
    return json.dumps(json_value(value), sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _hash(value):
    return hashlib.sha256(_canonical(value).encode()).hexdigest()


def merge_fields(baseline: dict, current: dict, incoming: dict) -> tuple[dict, dict, list]:
    missing, conflicts = object(), []
    def merge(old, live, new, path):
        if isinstance(new, dict) and isinstance(live, dict) and (isinstance(old, dict) or old is missing):
            result, next_old = dict(live), dict(old) if isinstance(old, dict) else {}
            for key, value in new.items():
                merged, recorded = merge(old.get(key, missing) if isinstance(old, dict) else missing,
                                         live.get(key, missing), value, f"{path}.{key}" if path else key)
                if merged is not missing: result[key] = merged
                if recorded is not missing: next_old[key] = recorded
            return result, next_old
        if old is missing and (live is missing or live is None) or live == old:
            return new, new
        # Ownership survives a coincidental later source match to a user edit.
        conflicts.append({"path": path, "reason": "deleted_after_import" if live is missing else "changed_after_import"})
        return live, old
    merged, next_baseline = merge(baseline, current, incoming, "")
    return merged, next_baseline, conflicts


def rollback_preview(db: Session, job: SoftOpticMigrationJob) -> dict:
    """Read-only ownership/dependency review. Never substitutes clinic pruning."""
    if job.status in {"queued", "running", "awaiting_upload"}:
        raise ValueError("Pause the import before reviewing rollback")
    links = db.query(MigrationSourceLink).filter_by(source_system="opticplus", clinic_id=job.clinic_id,
                                                    migration_job_id=job.id).all()
    owned, retained = {}, {}
    by_model = defaultdict(list)
    for link in links:
        if not (link.payload or {}).get("reference_only"): by_model[link.target_model].append(link)
    for name, model_links in by_model.items():
        model = MODELS.get(name)
        if model is None: continue
        by_id = {link.target_id: link for link in model_links}
        for start in range(0, len(by_id), 500):
            for target in db.query(model).execution_options(include_deleted=True).filter(model.id.in_(list(by_id)[start:start + 500])):
                identity = (model.__tablename__, target.id)
                owned[identity] = target
                baseline = (by_id[target.id].payload or {}).get("baseline")
                if getattr(target, "deleted_at", None) or getattr(target, "merged_into_client_id", None):
                    retained[identity] = "removed_or_merged"
                elif not isinstance(baseline, dict) or any(json_value(getattr(target, k)) != v for k, v in baseline.items()):
                    retained[identity] = "edited_or_unverified"
    # Billing is owned as one reconciled group unit, rather than per payment.
    importer = OpticPlusImporter(db, job, Path("."), {})
    for link in by_model.get("OrderGroup", []):
        billing = db.query(Billing).filter_by(order_group_id=link.target_id).first()
        if not billing: continue
        group_id = (OrderGroup.__tablename__, link.target_id)
        identity = (Billing.__tablename__, billing.id)
        owned[identity] = billing
        if importer.finance_state(billing) != (link.payload or {}).get("finance_baseline"):
            retained[group_id] = retained[identity] = "billing_edited"
    # Every inbound FK must belong to this footprint. Propagate protected child
    # records to parents so a cascade cannot erase shared or edited data.
    from database import Base
    from models import PrescriptionSearchIndex
    dependencies = []
    ids_by_table = defaultdict(list)
    for table, target_id in owned: ids_by_table[table].append(target_id)
    for table in Base.metadata.tables.values():
        if table.name in {MigrationSourceLink.__tablename__, PrescriptionSearchIndex.__tablename__}: continue
        if "id" not in table.c: continue
        for fk in table.foreign_keys:
            parents = ids_by_table.get(fk.column.table.name, [])
            for start in range(0, len(parents), 500):
                for child_id, parent_id in db.execute(select(table.c.id, fk.parent).where(fk.parent.in_(parents[start:start + 500]))):
                    child, parent = (table.name, child_id), (fk.column.table.name, parent_id)
                    dependencies.append((child, parent))
                    if child not in owned: retained[parent] = "shared_dependency"
    changed = True
    while changed:
        changed = False
        for child, parent in dependencies:
            if child in retained and parent not in retained:
                retained[parent] = "protected_dependency"; changed = True
    counts = Counter("retained" if key in retained else "reviewable" for key in owned)
    return {"dry_run": True, "job_id": job.id, "counts": dict(counts),
            "retained_reasons": dict(Counter(retained.values())), "deletion_enabled": False}


class OpticPlusImporter:
    def __init__(self, db: Session, job: SoftOpticMigrationJob, root: Path, validation: dict, storage=None):
        self.db, self.job, self.root, self.validation, self.storage = db, job, root, validation, storage
        self.dataset = (job.source_metadata or {}).get("dataset_id")
        if not isinstance(self.dataset, str) or not self.dataset or len(self.dataset) > 64:
            raise ValueError("Missing server-owned OpticPlus dataset binding")
        self.worker = job.locked_by
        self.counts = Counter((job.import_summary or {}).get("counts") or {})
        self.issues = list((job.import_summary or {}).get("issue_examples") or [])[:100]
        self.clients = {}
        self.links, self.targets = {}, {}
        self.exam_candidates = defaultdict(list)
        self.suppliers = {}
        self.clinical_keys = {}
        self.report_path = root / "import-issues.jsonl"
        self.attempt = uuid4().hex
        self.pending_report = None

    def ref(self, table, key, suffix=""):
        return f"opticplus:{self.dataset}:{table}:{key}" + (f":{suffix}" if suffix else "")

    def issue(self, code, table, key, **details):
        self.counts[f"warning:{code}"] += 1
        item = {"code": code, "table": table, "key": str(key), **details}
        # Full diagnostics are private report data, not an unbounded job JSON.
        with self.report_path.open("a", encoding="utf-8") as f:
            f.write(_canonical(item) + "\n")
        if len(self.issues) < 100:
            self.issues.append(item)

    def guard(self):
        job = self.db.query(SoftOpticMigrationJob).filter_by(id=self.job.id).populate_existing().with_for_update().one()
        if job.locked_by != self.worker or job.status != "running":
            raise LeaseLost("OpticPlus worker no longer owns this job")
        lease = job.lease_until
        if lease is not None:
            lease = lease.replace(tzinfo=timezone.utc) if lease.tzinfo is None else lease
            if lease < datetime.now(timezone.utc):
                raise LeaseLost("OpticPlus worker lease expired")
        clinic = self.db.query(Clinic).filter_by(id=job.clinic_id).populate_existing().with_for_update().first()
        if not clinic or not clinic.is_active or clinic.company_id != job.company_id or clinic.maintenance_mode:
            raise ValueError("OpticPlus target clinic is unavailable")
        if job.pause_requested:
            update_job(self.db, job, status="paused", step="opticplus.paused")
            raise Paused()

    def prime(self, refs, *, reset=True):
        if reset: self.links, self.targets = {}, {}
        links = self.db.query(MigrationSourceLink).filter(
            MigrationSourceLink.source_system == "opticplus", MigrationSourceLink.clinic_id == self.job.clinic_id,
            MigrationSourceLink.target_model.in_(list(MODELS)),
            MigrationSourceLink.raw_row_ref.in_(list(refs))).all()
        by_model = defaultdict(list)
        for link in links:
            self.links[(link.target_model, link.raw_row_ref)] = link
            by_model[link.target_model].append(link.target_id)
        for name, ids in by_model.items():
            if name not in MODELS:
                continue
            for target in self.db.query(MODELS[name]).execution_options(include_deleted=True).filter(MODELS[name].id.in_(ids)).all():
                self.targets[(name, target.id)] = target

    def upsert(self, model, ref, raw, values, *, table, key, patient=None):
        name = model.__name__
        if model in {OpticalExam, MedicalLog, Order, ContactLensOrder, OrderGroup, File, Appointment} and "company_id" in model.__table__.columns:
            values = {**values, "company_id": self.job.company_id}
        link = self.links.get((name, ref))
        target = self.targets.get((name, link.target_id)) if link else None
        if target is not None and getattr(target, "clinic_id", self.job.clinic_id) != self.job.clinic_id:
            raise ValueError("OpticPlus source link points outside target clinic")
        if target is not None and hasattr(target, "company_id") and target.company_id != self.job.company_id:
            raise ValueError("OpticPlus source link points outside target company")
        if target is not None and model is ExamLayoutInstance:
            exam = self.db.get(OpticalExam, target.exam_id)
            if not exam or exam.clinic_id != self.job.clinic_id:
                raise ValueError("OpticPlus layout belongs outside target clinic")
        if target is not None and model is OrderGroupEntry:
            group = self.db.get(OrderGroup, target.group_id)
            if not group or group.clinic_id != self.job.clinic_id:
                raise ValueError("OpticPlus entry belongs outside target clinic")
        if link and (target is None or getattr(target, "deleted_at", None) or getattr(target, "merged_into_client_id", None)):
            self.issue("target_removed", table, key, target_model=name)
            return None
        if link and patient and link.source_per_id is not None and str(link.source_per_id) != patient:
            self.issue("source_patient_changed", table, key, target_model=name)
            return None
        incoming = json_value(values)
        if target is not None and model is ExamLayoutInstance:
            self.repair_v1_layout(target, link, table, key)
        if target is None:
            target = model(**values)
            self.db.add(target)
            self.db.flush()
            link = MigrationSourceLink(source_system="opticplus", source_table=table, raw_row_ref=ref,
                source_primary_key_parts={"key": str(key), "dataset_id": self.dataset},
                target_model=name, target_id=target.id, clinic_id=self.job.clinic_id,
                company_id=self.job.company_id, payload={})
            if patient:
                link.source_per_id = int(patient)
            self.db.add(link)
            self.links[(name, ref)] = link
            self.targets[(name, target.id)] = target
            next_baseline = incoming
            self.counts[f"created:{name}"] += 1
        else:
            baseline = (link.payload or {}).get("baseline")
            if not isinstance(baseline, dict):
                self.issue("missing_baseline", table, key, target_model=name)
                return target
            if "company_id" in values and "company_id" not in baseline and getattr(target, "company_id", None) == self.job.company_id:
                baseline = {**baseline, "company_id": self.job.company_id}
            current = {k: json_value(getattr(target, k)) for k in values}
            if model is ExamLayoutInstance:
                old, live, corrected, live_layout, old_layout, moved, repair_conflicts = relocate_clinical_fields(
                    baseline.get("exam_data", {}), target.exam_data or {}, incoming.get("exam_data", {}),
                    target.layout_data, baseline.get("layout_data"))
                old, corrected = include_live_card_aliases(old, live, corrected)
                baseline = {**baseline, "exam_data": old, "layout_data": old_layout}
                current = {**current, "exam_data": live, "layout_data": live_layout}
                if moved:
                    link.payload = {**link.payload, "clinical_repair": {
                        "revision": CLINICAL_REVISION, "moved_fields": moved,
                        "previous_layout": target.layout_data}}
                for conflict in repair_conflicts:
                    self.issue("clinical_move_conflict", table, key, **conflict)
                # Explicit source blanks clear only import-owned clinical fields.
                # A missing optional source column must not erase a prior value.
                for card_key, old_card in old.items():
                    card = corrected.get(card_key)
                    if not isinstance(old_card, dict): continue
                    if isinstance(card, dict) and card.get("source_table") == table:
                        for field in old_card:
                            if field in raw and raw[field] in (None, "") and field not in card:
                                card[field] = None
                    if card is None and card_key.startswith("notes-") and "remark" in raw and not clean(raw["remark"]):
                        corrected[card_key] = {"card_instance_id": old_card.get("card_instance_id", "notes-1"),
                                               "title": old_card.get("title", "OpticPlus"), "note": None}
                generated_layout = layout_data(corrected)
                owned_layout = json.loads(live_layout) == json.loads(old_layout)
                if owned_layout:
                    # Reflow importer-owned placement only. Manual positioning,
                    # deletion or additional cards always keeps its own layout.
                    current["layout_data"] = baseline["layout_data"] = live_layout
                incoming = {**incoming, "exam_data": corrected,
                            "layout_data": generated_layout if owned_layout else merge_layout(live_layout, generated_layout, old_layout)}
            merged, next_baseline, conflicts = merge_fields(baseline, current, incoming)
            for conflict in conflicts:
                self.issue("target_edited", table, key, target_model=name, **conflict)
            changed = False
            for k, value in merged.items():
                col = model.__table__.columns[k]
                if value is not None and isinstance(col.type, DateTime):
                    value = datetime.fromisoformat(value)
                elif value is not None and isinstance(col.type, Date):
                    value = date.fromisoformat(value)
                if getattr(target, k) != value:
                    setattr(target, k, value)
                    changed = True
            if changed:
                self.counts[f"updated:{name}"] += 1
        link.payload = {**(link.payload or {}), "mapping_version": 2, "clinical_revision": CLINICAL_REVISION, "baseline": next_baseline}
        link.migration_job_id = self.job.id
        link.raw_payload, link.raw_payload_sha256 = raw, _hash(raw)
        link.raw_captured_at = datetime.now(timezone.utc)
        return target

    def repair_v1_layout(self, target, link, table, key):
        if (link.payload or {}).get("mapping_version", 1) >= 2:
            return
        baseline = deepcopy((link.payload or {}).get("baseline") or {})
        old, live = baseline.get("exam_data", {}), deepcopy(target.exam_data or {})
        removed = set()
        raw = link.raw_payload or {}
        for field in list(old):
            retired = field == "contact-lens-details" or (
                field.startswith("notes-") and old[field].get("note") == visible_source(raw))
            if not retired: continue
            if live.get(field) != old[field]:
                self.issue("legacy_card_edited", table, key, card=field)
                continue
            removed.add(old[field].get("card_instance_id", "notes-1" if field.startswith("notes-") else field + "-1"))
            live.pop(field, None); old.pop(field, None)
        for field, value in old.items():
            if isinstance(value, dict) and value.get("comb_va") == raw.get("cvisus") and raw.get("cvisus") is not None:
                if (live.get(field) or {}).get("comb_va") == value["comb_va"]:
                    live[field].pop("comb_va", None); value.pop("comb_va", None)
        for owner, name in [(baseline, "layout_data")]:
            try:
                layout = json.loads(owner.get(name) or "{}")
                layout["items"] = [i for i in layout.get("items", []) if i.get("id") not in removed]
                owner[name] = _canonical(layout)
            except (ValueError, TypeError): pass
        try:
            layout = json.loads(target.layout_data or "{}")
            layout["items"] = [i for i in layout.get("items", []) if i.get("id") not in removed]
            target.layout_data = _canonical(layout)
        except (ValueError, TypeError): pass
        target.exam_data = live
        link.payload = {**(link.payload or {}), "baseline": baseline,
                        "v1_repair": {"retired_card_ids": sorted(removed)}}

    def link_existing(self, model_name, target_id, ref, raw, table, key, *, patient=None, reference_only=False):
        link = self.links.get((model_name, ref))
        if link is None:
            link = self.db.query(MigrationSourceLink).filter_by(source_system="opticplus", clinic_id=self.job.clinic_id,
                target_model=model_name, raw_row_ref=ref).first()
        if link is None:
            link = MigrationSourceLink(source_system="opticplus", clinic_id=self.job.clinic_id,
                company_id=self.job.company_id, source_table=table, raw_row_ref=ref,
                source_primary_key_parts={"key": str(key), "dataset_id": self.dataset},
                source_per_id=int(patient) if patient else None, target_model=model_name, target_id=target_id, payload={})
            self.db.add(link)
        elif link.target_id != target_id:
            raise ValueError("OpticPlus source placement cannot change silently")
        link.raw_payload, link.raw_payload_sha256 = raw, _hash(raw)
        link.raw_captured_at = datetime.now(timezone.utc)
        link.migration_job_id = self.job.id
        link.payload = {**(link.payload or {}), "mapping_version": 2, **({"reference_only": True} if reference_only else {})}
        self.links[(model_name, ref)] = link
        return link

    def import_clinical_cards(self, table, row, key, patient, kind, fields, *, when=None, cards=None):
        placement_ref = self.ref(table, key, "assessment")
        self.prime([placement_ref], reset=False)
        placement = self.links.get(("OpticalExam", placement_ref))
        if placement:
            exam = self.db.get(OpticalExam, placement.target_id)
            if not exam or exam.deleted_at or exam.clinic_id != self.job.clinic_id:
                self.issue("target_removed", table, key); return
        else:
            candidates = []
            if when and table != "cust_list":
                candidates = self.db.query(OpticalExam).join(MigrationSourceLink,
                    (MigrationSourceLink.target_id == OpticalExam.id) & (MigrationSourceLink.target_model == "OpticalExam")).filter(
                    MigrationSourceLink.source_system == "opticplus", MigrationSourceLink.clinic_id == self.job.clinic_id,
                    MigrationSourceLink.raw_row_ref.like(f"opticplus:{self.dataset}:%"),
                    MigrationSourceLink.source_table.in_(["checks", "adchecks"]),
                    OpticalExam.client_id == self.clients[patient], OpticalExam.exam_date == when).all()
            if len(candidates) == 1:
                exam = candidates[0]
            else:
                group = str(when) if when else f"undated:{table}:{key}"
                group_ref = self.ref("assessment", patient, group)
                self.prime([group_ref], reset=False)
                exam = self.upsert(OpticalExam, group_ref, row,
                    {**self.scope(patient), "exam_date": when, "type": "exam",
                     "test_name": "opticplus.exam.history" if table == "cust_list" else "opticplus.exam.assessment"},
                    table=table, key=key, patient=patient)
            if exam is None: return
        self.link_existing("OpticalExam", exam.id, placement_ref, row, table, key, patient=patient)
        if when and exam.exam_date != when:
            self.issue("assessment_date_changed", table, key)
        layout_ref = self.ref("assessment-layout", exam.id)
        self.prime([layout_ref], reset=False)
        link = self.links.get(("ExamLayoutInstance", layout_ref))
        baseline = (link.payload or {}).get("baseline", {}) if link else {}
        data = deepcopy(baseline.get("exam_data") or {})
        fields["source_card_type"] = kind
        # Each source row owns its card instance, including repeated same-date tests.
        if cards is None:
            cards = {f"{kind}-{fields['card_instance_id']}": fields}
        else:
            for name, block in list(data.items()):
                source = block.get("opticplus_source", {}) if isinstance(block, dict) else {}
                if isinstance(block, dict) and ((block.get("source_table") == table and str(block.get("source_key")) == str(key)) or
                        (source.get("table") == table and str(source.get("key")) == str(key))):
                    cleared = {field: None for field in block if field in row and row[field] in (None, "")}
                    cleared.update({target: None for field, target in source.get("fields", {}).items()
                                    if field in row and row[field] in (None, "")})
                    data.pop(name)
                    if name not in cards and cleared:
                        metadata = {field: value for field, value in block.items() if field in {
                            "card_instance_id", "source_card_type", "source_table", "source_key", "opticplus_source"}}
                        data[name] = {**metadata, **cleared}
        data.update(cards)
        instance = self.upsert(ExamLayoutInstance, layout_ref, row,
            {"exam_id": exam.id, "is_active": True, "exam_data": data, "layout_data": layout_data(data)},
            table=table, key=key, patient=patient)
        if not instance: return
        self.link_existing("ExamLayoutInstance", instance.id, self.ref(table, key, "clinical-source"), row,
                           table, key, patient=patient)
        self.db.flush()
        rebuild_exam_instance_index(self.db, instance)
        # Retain evidence, but remove untouched v1 technical dumps from clinical history.
        old_ref = self.ref(table, key)
        self.prime([old_ref], reset=False)
        old_link = self.links.get(("MedicalLog", old_ref))
        old_log = self.targets.get(("MedicalLog", old_link.target_id)) if old_link else None
        if old_log and not old_log.deleted_at:
            owned = (old_link.payload or {}).get("baseline") or {}
            if owned and all(json_value(getattr(old_log, k)) == v for k, v in owned.items()):
                old_log.deleted_at = datetime.now(timezone.utc)
                old_link.payload = {**old_link.payload, "superseded_by_exam_id": exam.id}
            else: self.issue("legacy_history_edited", table, key)

    def scope(self, patient=None):
        values = {"clinic_id": self.job.clinic_id}
        if patient is not None:
            values["client_id"] = self.clients[patient]
        return values

    def import_client(self, row):
        pk = source_id(row["numw"])
        values = {**client_payload(row), **self.scope(), "company_id": self.job.company_id}
        target = self.upsert(Client, self.ref("cust_list", pk), row, values, table="cust_list", key=pk, patient=pk)
        if target:
            self.clients[pk] = target.id
            history = client_history(row)
            if history:
                kind = "opticplus-legacy-history"
                self.import_clinical_cards("cust_list", row, pk, pk, kind,
                    card_data(kind, history, table="cust_list", key=pk))
        for field in ["bdate", "cdate"]:
            if row.get(field) and not date_value(row[field], past_only=field == "bdate"):
                self.issue("invalid_date", "cust_list", pk, field=field)

    def import_exam(self, table, row):
        pk, patient = source_id(row["bdikanum"]), source_id(row["numw"])
        if patient not in self.clients:
            self.issue("client_removed", table, pk); return
        values, data = exam_payload(table, row)
        target = self.upsert(OpticalExam, self.ref(table, pk), row,
            {**values, **self.scope(patient)}, table=table, key=pk, patient=patient)
        if not target:
            return
        if values["exam_date"] is None:
            self.issue("missing_or_invalid_date", table, pk)
        instance = self.upsert(ExamLayoutInstance, self.ref(table, pk, "layout"), row,
            {"exam_id": target.id, "is_active": True, "exam_data": data, "layout_data": layout_data(data)},
            table=table, key=pk, patient=patient)
        if instance:
            rebuild_exam_instance_index(self.db, instance)

    def finance_state(self, billing):
        if billing is None:
            return None
        fields = [c.name for c in Billing.__table__.columns if c.name != "id"]
        group = self.db.get(OrderGroup, billing.order_group_id)
        return {"payer_client_id": group.payer_client_id if group else None,
                "billing": json_value({k: getattr(billing, k) for k in fields}),
                "payments": [json_value({c.name: getattr(p, c.name) for c in BillingPayment.__table__.columns})
                             for p in self.db.query(BillingPayment).filter_by(billing_id=billing.id).order_by(BillingPayment.id)],
                "items": [json_value({c.name: getattr(p, c.name) for c in OrderLineItem.__table__.columns})
                          for p in self.db.query(OrderLineItem).filter_by(billings_id=billing.id).order_by(OrderLineItem.id)]}

    def import_order(self, row):
        pk, patient = source_id(row["rnum"]), source_id(row["numw"])
        if patient not in self.clients:
            self.issue("client_removed", "orders", pk); return
        if date_value(row.get("odate"), past_only=True) is None:
            self.issue("missing_or_invalid_date", "orders", pk, field="odate")
        group_ref = self.ref("orders", pk, "group")
        group = self.upsert(OrderGroup, group_ref, row,
            {"clinic_id": self.job.clinic_id, "payer_client_id": self.clients[patient],
             "opened_date": date_value(row.get("odate"), past_only=True), "legacy_write_protected": True},
            table="orders", key=pk, patient=patient)
        if not group:
            return
        group_link = self.links[("OrderGroup", group_ref)]
        billing = self.db.query(Billing).filter_by(order_group_id=group.id).first()
        previous_finance = (group_link.payload or {}).get("finance_baseline")
        finance_edited = (previous_finance is not None and (billing is None or self.finance_state(billing) != previous_finance)) or (billing is not None and previous_finance is None)
        slots = product_slots(row)
        kinds = sorted({slot["kind"] for slot in slots}) or ["regular"]
        previous_kinds = (group_link.payload or {}).get("entry_kinds")
        if previous_kinds and previous_kinds != kinds:
            self.issue("order_kind_changed", "orders", pk)
            return
        group_link.payload = {**group_link.payload, "entry_kinds": kinds}
        entries = {}
        for position, kind in enumerate(kinds):
            cls = ContactLensOrder if kind == "contact" else Order
            source = {"legacy_order_number": row.get("ordernum"), "slots": [s for s in slots if s["kind"] == kind],
                      "exam_source_date": row.get("mwdate"), "notes": clean(row.get("gremk")),
                      "extras": {k: v for k, v in row.items() if k.startswith("oth") and v not in (None, "")}}
            source["context"] = {k: v for k, v in row.items() if not k.startswith("__") and k not in {"numw", "rnum", "number"}
                                 and k not in {field + suffix for suffix in ("", "2") for field in source["slots"][0]["values"]}}
            product_data = order_product_data(kind, source["slots"], self.suppliers)
            prescription = self.match_prescription(row, kind, source["slots"])
            order_data = {"opticplus_source": source, "details": {"notes": clean(row.get("gremk"))}}
            if prescription:
                source["prescription_source_ref"] = prescription[0]
                order_data.update({k: v for k, v in prescription[1].items() if not k.startswith(("notes-", "opticplus-"))})
            else:
                self.issue("prescription_association_unresolved", "orders", pk, kind=kind)
            # Ordered products take precedence over any descriptions on the prescription.
            order_data.update(product_data)
            values = {**self.scope(patient), "order_date": date_value(row.get("odate"), past_only=True),
                      "type": "contact-lens" if kind == "contact" else "glasses",
                      "order_data": order_data}
            if kind == "contact":
                for field, value in (product_data.get("contact-lens-details") or {}).items():
                    values[field] = value
            target = self.upsert(cls, self.ref("orders", pk, kind), row, values, table="orders", key=pk, patient=patient)
            if not target:
                continue
            entry = self.upsert(OrderGroupEntry, self.ref("orders", pk, f"entry-{kind}"), row,
                {"group_id": group.id, "position": position,
                 "contact_lens_id" if kind == "contact" else "order_id": target.id}, table="orders", key=pk)
            if entry:
                entries[kind] = entry.id
            if kind == "contact":
                rebuild_contact_lens_order_index(self.db, target)
            else:
                rebuild_order_index(self.db, target)
        if finance_edited:
            self.issue("billing_edited", "orders", pk)
            return
        priced_slots = []
        for slot in slots:
            for field in ["bprice", "gpricet"]:
                value = slot["values"].get(field)
                if value in (None, ""): continue
                try: amount = money(value)
                except ValueError:
                    self.issue("invalid_component_amount", "orders", pk, slot=slot["slot"], field=field)
                    continue
                if amount != 0: priced_slots.append((slot, field, amount))
        for index in range(1, 4):
            field = f"othp{index}"
            if row.get(field) in (None, ""): continue
            try: amount = money(row[field])
            except ValueError:
                self.issue("invalid_component_amount", "orders", pk, field=field); continue
            if amount:
                priced_slots.append(({"slot": f"extra{index}", "kind": kinds[0] if len(kinds) == 1 else None}, field, amount))
        incoming_lines = {f"{s['slot']}:{field}" for s, field, _ in priced_slots}
        if previous_finance and any(item.get("source_slot") not in incoming_lines for item in previous_finance.get("items", [])):
            self.issue("source_components_removed", "orders", pk)
            return
        try:
            finance = billing_payload(row)
        except ValueError:
            self.issue("billing_unreconciled", "orders", pk)
            return
        if abs(money(finance["total_before_discount"]) - money(finance["discount_amount"]) - money(finance["total_after_discount"])) > money("0.01"):
            self.issue("source_discount_mismatch", "orders", pk)
        if billing is None:
            billing = Billing(order_group_id=group.id, **finance)
            self.db.add(billing); self.db.flush()
        else:
            for k, v in finance.items():
                setattr(billing, k, v)
        # Preserve product amounts without inferring an eye, pair or quantity.
        # Stable line refs prevent duplicates across retries and new snapshots.
        for slot, field, amount in priced_slots:
            slot_key = f"{slot['slot']}:{field}"
            self.upsert(OrderLineItem, self.ref("orders", pk, f"line-{slot_key}"), row,
                {"billings_id": billing.id, "source_entry_id": entries.get(slot["kind"]),
                 "source_slot": slot_key, "description": (clean(row.get("otht" + field[-1])) or clean(row.get("oth" + field[-1]))) if field.startswith("othp") else
                    f"OpticPlus · {clean(slot.get('values', {}).get('ob_type' if field == 'bprice' else 'og_type')) or slot_key}",
                 "line_total": float(amount), "currency": "ILS", "manually_edited": False},
                table="orders", key=pk)
        self.db.flush()
        group_link.payload = {**group_link.payload, "finance_baseline": self.finance_state(billing)}
        self.counts["reconciled:orders"] += 1

    def index_prescriptions(self):
        live = set(r[0] for r in self.db.query(MigrationSourceLink.raw_row_ref).join(
            OpticalExam, OpticalExam.id == MigrationSourceLink.target_id).filter(
            MigrationSourceLink.source_system == "opticplus", MigrationSourceLink.target_model == "OpticalExam",
            MigrationSourceLink.clinic_id == self.job.clinic_id, OpticalExam.clinic_id == self.job.clinic_id,
            MigrationSourceLink.raw_row_ref.like(f"opticplus:{self.dataset}:%")))
        self.exam_candidates.clear()
        for table in ["checks", "adchecks"]:
            for row in iter_rows(self.root, self.validation["tables"][table]):
                if clean(row.get("qtyp")) not in {"מרשם סופי", "מרשם נסיוני"}:
                    continue
                when = date_value(row.get("chdate" if table == "checks" else "caddate"), past_only=True)
                ref = self.ref(table, source_id(row["bdikanum"]))
                if not when or ref not in live: continue
                _, data = exam_payload(table, row)
                self.exam_candidates[(table, source_id(row["numw"]), when)].append((ref, clean(row.get("ct")),
                    {k: v for k, v in data.items() if not k.startswith("notes-")}))

    def match_prescription(self, row, kind, slots):
        when = date_value(row.get("mwdate"), past_only=True)
        if not when: return None
        table = "adchecks" if kind == "contact" else "checks"
        candidates = self.exam_candidates.get((table, source_id(row["numw"]), when), [])
        usages = {clean((clean(s["values"].get("color")) or "").replace("משקפיים", "", 1)) for s in slots} - {None}
        if kind == "regular" and usages:
            # Two distinct usage prescriptions cannot collapse into one pair.
            if len(usages) != 1: return None
            candidates = [c for c in candidates if c[1] in usages]
        if len(candidates) != 1: return None
        return candidates[0][0], candidates[0][2]

    def import_supplemental(self, table, row, key):
        if table in REFERENCE_TABLES and (self.job.source_metadata or {}).get("include_reference_data") is False:
            return
        lookups = {"sapakim": [(LookupSupplier, "shem sapak")],
                   "tb_ad_catalog": [(LookupManufacturer, "hevra"), (LookupLensModel, "typ")],
                   "tb_catalog": [(LookupManufacturer, "hevra"), (LookupFrameModel, "degem")]}
        if table in REFERENCE_TABLES:
            self.link_existing("Clinic", self.job.clinic_id, self.ref(table, key, "reference"), row,
                               table, key, reference_only=True)
        if table in lookups:
            for model, column in lookups[table]:
                name = clean(row.get(column))
                if not name: continue
                ref = self.ref(table, key, model.__name__)
                existing = self.db.query(model).filter_by(clinic_id=self.job.clinic_id, name=name).first()
                linked = self.links.get((model.__name__, ref))
                if linked and (linked.payload or {}).get("reference_only"):
                    self.link_existing(model.__name__, linked.target_id, ref, row, table, key, reference_only=True)
                    self.counts[f"reused:{model.__name__}"] += 1
                elif existing and (not linked or linked.target_id != existing.id):
                    self.link_existing(model.__name__, existing.id, ref, row, table, key, reference_only=True)
                    self.counts[f"reused:{model.__name__}"] += 1
                else:
                    self.upsert(model, ref, row, {"clinic_id": self.job.clinic_id, "name": name}, table=table, key=key)
            if table == "tb_catalog": self.import_frame(row, key)
            return
        parent = {"person_remarks": "numw", "tb_comp": "wnum", "tb_gnrl_tests": "wnum", "tb_quest": "wnum"}.get(table)
        if not parent: return
        try: patient = source_id(row.get(parent))
        except ValueError:
            self.issue("unresolved_patient", table, key); return
        if patient not in self.clients:
            self.issue("client_removed", table, key); return
        if table in CLINICAL_TABLES:
            if date_value(row.get("datew"), past_only=True) is None:
                self.issue("missing_or_invalid_date", table, key, field="datew")
            kind, fields, cards = supplemental_cards(table, row, key)
            self.import_clinical_cards(table, row, key, patient, kind, fields, when=date_value(row.get("datew"), past_only=True), cards=cards)
        else:
            text = clean(row.get("teur"))
            if text:
                self.upsert(MedicalLog, self.ref(table, key), row,
                    {**self.scope(patient), "log_date": date_value(row.get("datew")), "log": text},
                    table=table, key=key, patient=patient)

    def import_frame(self, row, key):
        if not clean(row.get("hevra")) or not clean(row.get("degem")):
            self.issue("catalog_product_incomplete", "tb_catalog", key); return
        # Source stock (-1 in this transfer) is never used to create a balance.
        from services.inventory_service import normalized_product_key, normalized_variant_fingerprint
        product_data = {"brand": clean(row["hevra"]), "model": clean(row["degem"])}
        existing_product = self.db.query(CatalogProduct).filter_by(company_id=self.job.company_id, category="frame",
            normalized_key="frame|" + normalized_product_key(product_data)).first()
        if existing_product and existing_product.archived_at:
            self.issue("catalog_product_archived", "tb_catalog", key); return
        variant_ref = self.ref("tb_catalog", key, "variant")
        self.prime([variant_ref], reset=False)
        owned = self.links.get(("CatalogVariant", variant_ref))
        owned_variant = self.targets.get(("CatalogVariant", owned.target_id)) if owned else None
        if owned_variant and (owned_variant.company_id != self.job.company_id or
                owned_variant.archived_at or not existing_product or owned_variant.product_id != existing_product.id):
            self.issue("catalog_identity_changed_or_archived", "tb_catalog", key); return
        product = create_product(self.db, company_id=self.job.company_id, category="frame",
            data=product_data)
        prices = {}
        for source, destination in [("cprice", "default_cost"), ("sprice", "default_retail")]:
            if source not in row: continue
            if row[source] in (None, ""):
                prices[destination] = None; continue
            try:
                value = money(row[source])
                if value < 0: raise ValueError()
                prices[destination] = float(value)
            except ValueError: self.issue("catalog_price_invalid", "tb_catalog", key, field=source)
        attributes = {"color": clean(row.get("color")), "eye_size": clean(row.get("godel"))}
        fingerprint = normalized_variant_fingerprint("frame", product_data, attributes)
        existing_variant = self.db.query(CatalogVariant).filter_by(company_id=self.job.company_id, normalized_fingerprint=fingerprint).first()
        if existing_variant and existing_variant.archived_at:
            self.issue("catalog_variant_archived", "tb_catalog", key); return
        variant = create_variant(self.db, company_id=self.job.company_id, product=product,
            data={"attributes": {"color": clean(row.get("color")), "eye_size": clean(row.get("godel"))},
                  "is_stockable": False, "currency": "ILS", **prices})
        self.link_existing("CatalogProduct", product.id, self.ref("tb_catalog", key, "product"), row, "tb_catalog", key, reference_only=True)
        if owned and (owned.payload or {}).get("baseline") is not None:
            self.upsert(CatalogVariant, variant_ref, row, prices, table="tb_catalog", key=key)
        link = self.link_existing("CatalogVariant", variant.id, variant_ref, row, "tb_catalog", key, reference_only=True)
        if not existing_variant and not owned:
            link.payload = {**link.payload, "baseline": json_value(prices)}

    def field_coverage(self):
        result = {}
        for table in self.validation.get("schema", {}).get("tables", []):
            name = table["name"].casefold()
            result[name] = {column["name"]: {**self.validation.get("fields", {}).get(name, {}).get(column["name"].casefold(), {}),
                "disposition": "excluded_secret" if column.get("disposition") == "excluded_secret"
                else field_disposition(name, column["name"].casefold())} for column in table.get("columns", [])}
        return result

    def import_documents(self):
        phase = "documents"
        if phase in (self.job.checkpoint or {}).get("completed_phases", []): return
        documents = (self.validation["manifest"].get("documents") or {})
        files = documents.get("files", []) if self.job.include_documents else []
        offset = int((self.job.checkpoint or {}).get("opticplus_offsets", {}).get(phase, 0))
        while offset < len(files):
            self.guard()
            batch = files[offset:offset + BATCH_SIZE]
            keyed = [(self.ref("documents", f"{source_id(d['client_id'])}:{d['sha256']}"), d) for d in batch]
            self.prime([ref for ref, _ in keyed])
            for ref, doc in keyed:
                patient = source_id(doc["client_id"])
                if patient not in self.clients:
                    self.issue("client_removed", phase, doc["sha256"]); continue
                link = self.links.get(("File", ref))
                if link:
                    # Immutable source documents: do not reupload or resurrect deleted files.
                    target = self.targets.get(("File", link.target_id))
                    if not target or target.deleted_at: self.issue("target_removed", phase, doc["sha256"])
                    continue
                if not self.storage: raise ValueError("Document storage is unavailable")
                local = checked_file(self.root, doc)
                bucket = "clinic-files"
                key = f"clinics/{self.job.clinic_id}/migration/opticplus/{self.dataset}/{patient}/{doc['sha256']}"
                content_type = mimetypes.guess_type(doc["original_name"])[0] or "application/octet-stream"
                # Content-addressed immutable keys also make crash/retry uploads safe.
                if not self.storage.exists(bucket, key): self.storage.upload_path(bucket, key, local, content_type)
                self.upsert(File, ref, doc, {**self.scope(patient), "file_name": doc["original_name"],
                    "original_file_name": doc["original_name"], "storage_bucket": bucket, "storage_key": key,
                    "file_size": local.stat().st_size, "file_type": content_type, "notes": "OpticPlus"},
                    table=phase, key=doc["sha256"], patient=patient)
            offset += len(batch)
            self.checkpoint(phase, offset)
        self.guard()
        if self.job.include_documents:
            for code in ["missing_referenced_count", "unresolved_references"]:
                if documents.get(code): self.issue(code, phase, "references", count=documents[code])
        self.checkpoint(phase, offset, done=True)

    def checkpoint(self, table, offset, *, done=False):
        cp = dict(self.job.checkpoint or {})
        offsets = {**cp.get("opticplus_offsets", {}), table: offset}
        completed = set(cp.get("completed_phases") or [])
        if done:
            completed.add(table)
        parts = list(cp.get("opticplus_report_parts") or [])
        if self.storage and self.job.bundle_storage_bucket and self.report_path.exists() and self.report_path.stat().st_size:
            key = f"clinics/{self.job.clinic_id}/opticplus-migrations/{self.job.id}/issues/{self.attempt}-{table}-{offset}.jsonl"
            self.pending_report = (self.job.bundle_storage_bucket, key)
            self.storage.upload_path(self.job.bundle_storage_bucket, key, self.report_path, "application/x-ndjson")
            parts.append(key)
        self.job.checkpoint = {**cp, "opticplus_offsets": offsets, "completed_phases": sorted(completed),
                               "writes_started": True, "opticplus_report_parts": parts}
        self.job.import_summary = {"counts": dict(self.counts), "issue_examples": self.issues,
                                   "coverage": self.coverage(), "mapping_version": 2, "source_bundle_retained": bool(self.job.bundle_storage_key)}
        self.job.step = f"opticplus.{table}"
        self.job.progress = min(96, 20 + round(76 * len(completed) / max(1, len(self.validation["tables"]))))
        self.job.heartbeat_at = datetime.now(timezone.utc)
        self.job.lease_until = self.job.heartbeat_at + timedelta(seconds=SOFTOPTIC_LEASE_SECONDS)
        uploaded = self.pending_report is not None
        self.db.commit()
        self.pending_report = None
        if uploaded and self.report_path.exists(): self.report_path.write_text("", encoding="utf-8")

    def coverage(self):
        mapped = {"cust_list", "checks", "adchecks", "orders"}
        visible = {"person_remarks", "tb_comp", "tb_gnrl_tests", "tb_quest"}
        result = {name: {"rows": count, "disposition": "empty" if not count else "mapped" if name in mapped else
                       "visibly_preserved" if name in visible else "reference_data" if name in REFERENCE_TABLES else "reference_data" if name in REFERENCE_TABLES else "archive_only"}
                for name, count in self.validation["counts"].items()}
        if (self.job.source_metadata or {}).get("include_reference_data") is False:
            for name in REFERENCE_TABLES & result.keys():
                if result[name]["rows"]: result[name] = {**result[name], "disposition": "archive_only", "reference_import_skipped": True}
        for table in self.validation.get("schema", {}).get("unrecognized_tables", []):
            result[table["name"]] = {"rows": table["row_count"], "disposition": "archive_only"}
        return result

    def run(self):
        if not order_groups_available(self.db):
            raise ValueError("Order-group schema must be deployed before OpticPlus import")
        # Rebuild the patient map on resume, including only live imported clients.
        for link, client in self.db.query(MigrationSourceLink, Client).join(Client, Client.id == MigrationSourceLink.target_id).filter(
            MigrationSourceLink.source_system == "opticplus", MigrationSourceLink.clinic_id == self.job.clinic_id,
            MigrationSourceLink.target_model == "Client", Client.clinic_id == self.job.clinic_id,
            Client.company_id == self.job.company_id, MigrationSourceLink.raw_row_ref.like(f"opticplus:{self.dataset}:cust_list:%")):
            if not client.deleted_at and not client.merged_into_client_id:
                self.clients[str(link.source_per_id)] = client.id
        tables = self.validation["tables"]
        requested = (self.job.source_metadata or {}).get("selected_client_ids")
        if requested is not None and {source_id(i) for i in requested} != {source_id(i) for i in self.validation["manifest"].get("selected_client_ids", [])}:
            raise ValueError("OpticPlus patient selection differs from requested scope")
        # Keep v1/v2 pilot identities while namespacing new supplemental sequences by patient.
        for link in self.db.query(MigrationSourceLink).filter(
                MigrationSourceLink.source_system == "opticplus", MigrationSourceLink.clinic_id == self.job.clinic_id,
                MigrationSourceLink.source_table.in_(CLINICAL_TABLES),
                MigrationSourceLink.target_model.in_(["OpticalExam", "MedicalLog"]),
                MigrationSourceLink.raw_row_ref.like(f"opticplus:{self.dataset}:%")):
            key = str((link.source_primary_key_parts or {}).get("key", ""))
            if link.source_per_id and (link.raw_row_ref == self.ref(link.source_table, key) or link.raw_row_ref.startswith(self.ref(link.source_table, key) + ":")):
                self.clinical_keys[(link.source_table, str(link.source_per_id), key.split(":")[-1])] = key
        if "sapakim" in tables:
            for supplier_row in iter_rows(self.root, tables["sapakim"]):
                for code in [supplier_row.get("code sapak"), supplier_row.get("rnum")]:
                    if code is not None and clean(supplier_row.get("shem sapak")):
                        self.suppliers[str(code).removesuffix('.0')] = clean(supplier_row["shem sapak"])
        ordered = [t for t in ["cust_list", "checks", "adchecks", "orders"] if t in tables] + sorted(set(tables) - {"cust_list", "checks", "adchecks", "orders"})
        for table in ordered:
            if table == "orders": self.index_prescriptions()
            rows = iter_rows(self.root, tables[table])
            offset = int((self.job.checkpoint or {}).get("opticplus_offsets", {}).get(table, 0))
            if table in set((self.job.checkpoint or {}).get("completed_phases") or []):
                continue
            def keyed_rows(source, table_name):
                occurrences = Counter()
                field = {"cust_list": "numw", "checks": "bdikanum", "adchecks": "bdikanum", "orders": "rnum",
                         "person_remarks": None, "tb_comp": "rnum", "tb_gnrl_tests": "rnum", "tb_quest": "rnum",
                         "tb_catalog": "wnum", "tb_ad_catalog": "wnum", "sapakim": "rnum"}.get(table_name)
                for row in source:
                    if table_name in CLINICAL_TABLES:
                        try:
                            composite = clinical_source_key(row)
                            patient, sequence = composite.split(":")
                            key = self.clinical_keys.get((table_name, patient, sequence), composite)
                        except ValueError:
                            digest = _hash(row); occurrences[digest] += 1
                            key = f"{digest}:{occurrences[digest]}"
                    elif field: key = source_id(row[field])
                    else:
                        digest = _hash(row); occurrences[digest] += 1
                        key = f"{digest}:{occurrences[digest]}"
                    yield key, row
            rows = islice(keyed_rows(rows, table), offset, None)
            while True:
                batch = list(islice(rows, BATCH_SIZE))
                self.guard()
                if not batch:
                    self.checkpoint(table, offset, done=True); break
                keyed = batch
                refs = []
                for key, _ in keyed:
                    refs.extend(self.ref(table, key, suffix) for suffix in ["", "layout", "group", "regular", "contact", "entry-regular", "entry-contact",
                        "line-1:bprice", "line-1:gpricet", "line-2:bprice", "line-2:gpricet",
                        "line-extra1:othp1", "line-extra2:othp2", "line-extra3:othp3", *[m.__name__ for m in [LookupSupplier, LookupManufacturer, LookupLensModel, LookupFrameModel]]])
                self.prime(refs)
                with group_write(self.db):
                    for key, row in keyed:
                        if table == "cust_list": self.import_client(row)
                        elif table in {"checks", "adchecks"}: self.import_exam(table, row)
                        elif table == "orders": self.import_order(row)
                        else: self.import_supplemental(table, row, key)
                        self.counts[f"processed:{table}"] += 1
                    self.db.flush()
                    offset += len(batch)
                    self.checkpoint(table, offset)
        self.import_documents()
        self.guard()
        report = {"counts": dict(self.counts), "coverage": self.coverage(), "fields": self.field_coverage(), "mapping_version": 2, "clinical_revision": CLINICAL_REVISION,
                  "validation_warnings": self.validation["warnings"], "excluded_tables": self.validation.get("schema", {}).get("excluded_tables", [])}
        (self.root / "reconciliation.json").write_text(_canonical(report), encoding="utf-8")
        return report


def run_opticplus_import(db, *, job, storage, on_progress):
    root = Path(tempfile.mkdtemp(prefix="opticplus-import-"))
    worker = job.locked_by
    importer = None
    try:
        bundle = root / "bundle.zip"
        if job.bundle_storage_bucket and job.bundle_storage_key:
            if storage is None: raise ValueError("Migration storage is unavailable")
            storage.download_to_path(job.bundle_storage_bucket, job.bundle_storage_key, bundle)
        elif job.bundle_path:
            bundle = Path(job.bundle_path)
        else: raise ValueError("Migration bundle is missing")
        check_archive(bundle)
        extracted = root / "export"
        _safe_extract_zip(bundle, extracted)
        manifest = json.loads((extracted / "manifest.json").read_text(encoding="utf-8-sig"))
        validation = validate_bundle(extracted, manifest, job.client_import_limit)
        if manifest["source_fingerprint"] != job.source_fingerprint:
            raise ValueError("OpticPlus source fingerprint does not match job")
        importer = OpticPlusImporter(db, job, extracted, validation, storage)
        importer.guard()
        job.validation_summary = {"manifest": {k: manifest[k] for k in ["source_system", "format_version", "mapping_version", "source_archive", "source_fingerprint"]},
                                  "counts": validation["counts"], "warnings": validation["warnings"]}
        db.commit()
        report = importer.run()
        summary = {**(job.import_summary or {}), "reconciliation": report}
        if storage and job.bundle_storage_bucket:
            reports = root / "reports"; reports.mkdir()
            for name in ["reconciliation.json"]:
                if (extracted / name).exists(): shutil.copy2(extracted / name, reports / name)
            with (reports / "import-issues.jsonl").open("wb") as output:
                for index, part in enumerate((job.checkpoint or {}).get("opticplus_report_parts", [])):
                    local = root / f"part-{index}.jsonl"
                    storage.download_to_path(job.bundle_storage_bucket, part, local)
                    with local.open("rb") as source: shutil.copyfileobj(source, output)
                    local.unlink()
            archive = Path(shutil.make_archive(str(root / "report"), "zip", reports))
            key = f"clinics/{job.clinic_id}/opticplus-migrations/{job.id}/report-{importer.attempt}.zip"
            importer.pending_report = (job.bundle_storage_bucket, key)
            storage.upload_path(job.bundle_storage_bucket, key, archive, "application/zip")
            summary["report"] = {"bucket": job.bundle_storage_bucket, "key": key, "available": True}
        importer.guard()
        update_job(db, job, status="completed", progress=100, step="opticplus.completed", import_summary=summary)
        importer.pending_report = None
    except (Paused, LeaseLost):
        db.rollback()
    except Exception as exc:
        db.rollback()
        current = db.query(SoftOpticMigrationJob).filter_by(id=job.id).populate_existing().with_for_update().one()
        if current.locked_by == worker and current.status == "running":
            update_job(db, current, status="failed", step="opticplus.failed", error=str(exc), errors=[str(exc)])
    finally:
        if importer and importer.pending_report and storage:
            try: storage.remove(*importer.pending_report)
            except Exception: pass
        shutil.rmtree(root, ignore_errors=True)
