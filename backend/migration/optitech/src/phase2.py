from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path
import re
import sys
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

CURRENT_FILE = Path(__file__).resolve()
for path in (CURRENT_FILE.parents[4], CURRENT_FILE.parents[3]):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.append(path_str)

from sqlalchemy.orm import Session

try:
    from database import SessionLocal
    from models import Client, Clinic, Family, User
except ModuleNotFoundError:
    from backend.database import SessionLocal
    from backend.models import Client, Clinic, Family, User

from .reader import iter_exported_rows
from .lookups import LookupCatalog, ensure_lookup_extracts, load_lookup_catalog, lookup_name
from .records import (
    NormalizedClientSeed,
    NormalizedFamilySeed,
    NormalizedUserSeed,
    normalize_client_row,
    normalize_family_seed,
    normalize_user_row,
)
from .trace import (
    OPTITECH_SOURCE_SYSTEM,
    build_trace_payload,
    cleanup_phase2_rows,
    can_resume_source_link,
    load_trace_index,
    upsert_source_link,
)
from .validate_phase2 import (
    create_unmapped_field_report,
    default_report_dir,
    finalize_unmapped_field_report,
    record_unmapped_values,
    write_phase2_reports,
)


INACTIVE_USER_NAMES = {
    "ראשונה הפעלה",
    "בדיקת מחשב",
    "הסטוריה",
    "לא ידוע",
    "לפי בקשה",
    "לפי מרשם קודם",
    "לפי קיים",
    "מרשם רופא",
    "מחיר הצעת",
}
FAMILY_NAME_KEY_PATTERN = re.compile(r"[\s'\"`׳״-]+")
UPSERT_BATCH_SIZE = 1000
_batch_progress_callback: ContextVar[Optional[Callable[[str, Dict[str, int]], None]]] = ContextVar(
    "optitech_phase2_batch_progress_callback",
    default=None,
)


@dataclass
class DomainCounters:
    processed: int = 0
    created: int = 0
    updated: int = 0
    recreated: int = 0
    skipped: int = 0

    def as_dict(self) -> Dict[str, int]:
        return {
            "processed": self.processed,
            "created": self.created,
            "updated": self.updated,
            "recreated": self.recreated,
            "skipped": self.skipped,
        }


def emit_batch_progress(domain: str, counters: DomainCounters) -> None:
    callback = _batch_progress_callback.get()
    if callback:
        callback(domain, counters.as_dict())


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 2 OptiTech clients/users migration")
    parser.add_argument("--target-clinic-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--clients-only", action="store_true")
    parser.add_argument("--users-only", action="store_true")
    parser.add_argument("--cleanup-phase2", action="store_true")
    parser.add_argument("--report-dir", type=Path, default=default_report_dir())
    return parser.parse_args(argv)


def normalize_family_name_key(value: str) -> str:
    return FAMILY_NAME_KEY_PATTERN.sub("", value).strip().lower()


def choose_family_name(members: Sequence[NormalizedClientSeed], family_id: int) -> Tuple[str, bool, bool]:
    head_name = next(
        (
            member.last_name
            for member in members
            if member.source_per_id == family_id and member.last_name
        ),
        None,
    )
    if head_name:
        return head_name, True, False

    grouped_counts: Counter[str] = Counter()
    original_by_key: Dict[str, Counter[str]] = defaultdict(Counter)
    for member in members:
        if not member.last_name:
            continue
        key = normalize_family_name_key(member.last_name)
        if not key:
            continue
        grouped_counts[key] += 1
        original_by_key[key][member.last_name] += 1

    if not grouped_counts:
        return f"משפחה {family_id}", False, False

    winning_key = max(grouped_counts.items(), key=lambda item: (item[1], item[0]))[0]
    winning_original = max(
        original_by_key[winning_key].items(),
        key=lambda item: (item[1], item[0]),
    )[0]
    is_mixed = len(grouped_counts) > 1
    return winning_original, False, is_mixed


def build_family_seeds(
    client_seeds: Sequence[NormalizedClientSeed],
) -> Tuple[List[NormalizedFamilySeed], Dict[str, Any]]:
    members_by_family: Dict[int, List[NormalizedClientSeed]] = defaultdict(list)
    for seed in client_seeds:
        if seed.family_id:
            members_by_family[seed.family_id].append(seed)

    family_seeds: List[NormalizedFamilySeed] = []
    mixed_family_examples: List[Dict[str, Any]] = []
    head_matched_count = 0
    fallback_count = 0
    for family_id in sorted(members_by_family):
        members = members_by_family[family_id]
        family_name, used_head_name, is_mixed = choose_family_name(members, family_id)
        if used_head_name:
            head_matched_count += 1
        if family_name.startswith("משפחה "):
            fallback_count += 1
        if is_mixed and len(mixed_family_examples) < 20:
            mixed_family_examples.append(
                {
                    "legacy_family_id": family_id,
                    "family_name": family_name,
                    "member_last_names": sorted({member.last_name for member in members if member.last_name}),
                }
            )
        family_seeds.append(
            normalize_family_seed(
                family_id,
                family_name,
                [member.source_per_id for member in members if member.source_per_id is not None],
                raw_row_ref=f"tblPerData_FamId:FamId={family_id}",
            )
        )

    summary = {
        "source_family_count": len(family_seeds),
        "head_name_match_count": head_matched_count,
        "fallback_name_count": fallback_count,
        "mixed_last_name_family_sample": mixed_family_examples,
    }
    return family_seeds, summary


def client_payload_from_seed(
    seed: NormalizedClientSeed,
    *,
    clinic_id: int,
    company_id: int,
    family_target_id: Optional[int],
    catalog: Optional[LookupCatalog] = None,
) -> Dict[str, Any]:
    catalog = catalog or {}
    referrer_parts = [
        lookup_name(catalog, "tblRefs", seed.referral_id),
        lookup_name(catalog, "tblRefsSub1", seed.referral_sub1_id),
        lookup_name(catalog, "tblRefsSub2", seed.referral_sub2_id),
    ]
    return {
        "company_id": company_id,
        "clinic_id": clinic_id,
        "first_name": seed.first_name,
        "last_name": seed.last_name,
        "gender": seed.gender,
        "national_id": seed.national_id,
        "date_of_birth": seed.date_of_birth,
        "health_fund": None,
        "address_city": lookup_name(catalog, "tblCitys", seed.city_id),
        "address_street": seed.address,
        "address_number": None,
        "postal_code": seed.postal_code,
        "phone_home": seed.phone_home,
        "phone_work": seed.phone_work,
        "phone_mobile": seed.phone_mobile,
        "fax": seed.fax,
        "email": seed.email,
        "service_center": None,
        "file_creation_date": None,
        "membership_end": None,
        "service_end": None,
        "price_list": None,
        "discount_percent": None,
        "blocked_checks": None,
        "blocked_credit": None,
        "sorting_group": None,
        "referring_party": " / ".join(part for part in referrer_parts if part) or None,
        "file_location": None,
        "occupation": seed.occupation,
        "status": None,
        "notes": seed.notes,
        "hidden_note": seed.hidden_note,
        "family_id": family_target_id,
        "family_role": None,
    }


def client_unmapped_fields(seed: NormalizedClientSeed) -> Dict[str, Any]:
    return {
        "source_user_id": seed.source_user_id,
        "city_id": seed.city_id,
        "discount_id": seed.discount_id,
        "group_id": seed.group_id,
        "referral_id": seed.referral_id,
        "referral_sub1_id": seed.referral_sub1_id,
        "referral_sub2_id": seed.referral_sub2_id,
        "mailing_list": seed.mailing_list,
        "wants_laser": seed.wants_laser,
        "laser_date": seed.laser_date,
        "legacy_family_id": seed.family_id,
    }


def build_user_full_name(seed: NormalizedUserSeed) -> str:
    if seed.full_name:
        return seed.full_name
    legacy_user_id = seed.legacy_user_id if seed.legacy_user_id is not None else "unknown"
    return f"User {legacy_user_id}"


def map_user_role(source_role_level: Optional[int]) -> int:
    if source_role_level == 5:
        return 4
    if source_role_level == 4:
        return 3
    return 2


def build_username(seed: NormalizedUserSeed, source_fingerprint: Optional[str] = None) -> str:
    legacy_user_id = seed.legacy_user_id if seed.legacy_user_id is not None else "unknown"
    namespace = re.sub(r"[^a-zA-Z0-9]", "", source_fingerprint or "source")[:12].lower() or "source"
    return f"optitech-{namespace}-user-{legacy_user_id}"


def user_payload_from_seed(
    seed: NormalizedUserSeed,
    *,
    clinic_id: int,
    company_id: int,
    source_fingerprint: Optional[str] = None,
) -> Dict[str, Any]:
    full_name = build_user_full_name(seed)
    return {
        "company_id": company_id,
        "clinic_id": clinic_id,
        "full_name": full_name,
        "username": build_username(seed, source_fingerprint),
        "email": None,
        "phone": seed.phone_mobile or seed.phone_home,
        "password": None,
        "role_level": map_user_role(seed.role_level),
        "is_active": False,
        "auth_provider": "email",
    }


def user_unmapped_fields(seed: NormalizedUserSeed) -> Dict[str, Any]:
    return {
        "phone_home": seed.phone_home,
        "phone_mobile": seed.phone_mobile,
        "fax": seed.fax,
        "address": seed.address,
        "postal_code": seed.postal_code,
        "city_id": seed.city_id,
        "birth_date": seed.birth_date,
        "salary": seed.salary,
        "comment": seed.comment,
        "user_tz": seed.user_tz,
        "legacy_password_present": seed.legacy_password_present,
        "is_diagnostic_user": seed.is_diagnostic_user,
        "is_employee": seed.is_employee,
        "legacy_role_level": seed.role_level,
    }


def family_payload_from_seed(
    seed: NormalizedFamilySeed,
    *,
    clinic_id: int,
    company_id: int,
) -> Dict[str, Any]:
    return {
        "clinic_id": clinic_id,
        "company_id": company_id,
        "name": seed.family_name,
        "notes": None,
    }


def family_unmapped_fields(seed: NormalizedFamilySeed) -> Dict[str, Any]:
    return {
        "legacy_family_id": seed.legacy_family_id,
        "member_source_per_ids": list(seed.member_source_per_ids),
    }


def apply_payload(model: Any, payload: Mapping[str, Any]) -> None:
    for field_name, value in payload.items():
        setattr(model, field_name, value)


def ensure_username_available(db: Session, username: str, *, existing_user_id: Optional[int]) -> None:
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user and existing_user.id != existing_user_id:
        raise ValueError(f"Username collision for migrated user: {username}")


def resolve_target_binding(db: Session, clinic_id: int) -> Clinic:
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if clinic is None:
        raise ValueError(f"Clinic {clinic_id} not found")
    if not clinic.is_active:
        raise ValueError(f"Clinic {clinic_id} is inactive")
    return clinic


def batched(items: Sequence[Any], batch_size: int = UPSERT_BATCH_SIZE) -> Iterable[Sequence[Any]]:
    for start in range(0, len(items), batch_size):
        yield items[start:start + batch_size]


def upsert_families(
    db: Session,
    *,
    family_seeds: Sequence[NormalizedFamilySeed],
    clinic_id: int,
    company_id: int,
    unmapped_report: Dict[str, Dict[str, Dict[str, Any]]],
    migration_job_id: Optional[str] = None,
) -> Tuple[Dict[int, int], DomainCounters]:
    counters = DomainCounters()
    family_target_ids: Dict[int, int] = {}
    links_by_raw_ref, targets_by_id = load_trace_index(db, clinic_id=clinic_id, target_model="Family")

    for seed_batch in batched(family_seeds):
        pending_creates: List[Tuple[NormalizedFamilySeed, Dict[str, Any], Dict[str, Any], Optional[Any], Family]] = []
        pending_updates: List[Tuple[NormalizedFamilySeed, Dict[str, Any], Dict[str, Any], Optional[Any], Family]] = []

        for seed in seed_batch:
            counters.processed += 1
            if seed.legacy_family_id is None:
                counters.skipped += 1
                continue
            payload = family_payload_from_seed(seed, clinic_id=clinic_id, company_id=company_id)
            unmapped_fields = family_unmapped_fields(seed)
            record_unmapped_values(unmapped_report, domain="families", values=unmapped_fields)

            link = links_by_raw_ref.get(seed.source_ref.raw_row_ref or "")
            if link and not can_resume_source_link(link, migration_job_id):
                counters.skipped += 1
                if link.target_id in targets_by_id:
                    family_target_ids[seed.legacy_family_id] = link.target_id
                continue
            family = targets_by_id.get(link.target_id) if link else None
            if family is None:
                family = Family(**payload)
                db.add(family)
                pending_creates.append((seed, payload, unmapped_fields, link, family))
                if link is None:
                    counters.created += 1
                else:
                    counters.recreated += 1
            else:
                apply_payload(family, payload)
                pending_updates.append((seed, payload, unmapped_fields, link, family))
                counters.updated += 1

        if pending_creates:
            db.flush()

        for seed, payload, unmapped_fields, link, family in pending_creates + pending_updates:
            targets_by_id[family.id] = family
            trace_payload = build_trace_payload(seed, payload, unmapped_fields)
            saved_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="Family",
                target_id=family.id,
                clinic_id=clinic_id,
                company_id=company_id,
                payload=trace_payload,
                migration_job_id=migration_job_id,
                existing_link=link,
            )
            links_by_raw_ref[saved_link.raw_row_ref] = saved_link
            family_target_ids[seed.legacy_family_id] = family.id

        if pending_creates or pending_updates:
            db.flush()
        emit_batch_progress("families", counters)
    return family_target_ids, counters


def upsert_clients(
    db: Session,
    *,
    client_seeds: Sequence[NormalizedClientSeed],
    family_target_ids: Mapping[int, int],
    clinic_id: int,
    company_id: int,
    unmapped_report: Dict[str, Dict[str, Dict[str, Any]]],
    migration_job_id: Optional[str] = None,
    catalog: Optional[LookupCatalog] = None,
) -> Tuple[DomainCounters, List[Dict[str, Any]]]:
    counters = DomainCounters()
    skipped_rows: List[Dict[str, Any]] = []
    links_by_raw_ref, targets_by_id = load_trace_index(db, clinic_id=clinic_id, target_model="Client")

    for seed_batch in batched(client_seeds):
        pending_creates: List[Tuple[NormalizedClientSeed, Dict[str, Any], Dict[str, Any], Optional[Any], Client]] = []
        pending_updates: List[Tuple[NormalizedClientSeed, Dict[str, Any], Dict[str, Any], Optional[Any], Client]] = []

        for seed in seed_batch:
            counters.processed += 1
            if seed.source_ref.raw_row_ref is None:
                counters.skipped += 1
                skipped_rows.append({"domain": "clients", "reason": "missing_raw_row_ref", "source_per_id": seed.source_per_id})
                continue
            family_target_id = family_target_ids.get(seed.family_id) if seed.family_id else None
            payload = client_payload_from_seed(
                seed,
                clinic_id=clinic_id,
                company_id=company_id,
                family_target_id=family_target_id,
                catalog=catalog,
            )
            unmapped_fields = client_unmapped_fields(seed)
            record_unmapped_values(unmapped_report, domain="clients", values=unmapped_fields)

            link = links_by_raw_ref.get(seed.source_ref.raw_row_ref)
            if link and not can_resume_source_link(link, migration_job_id):
                counters.skipped += 1
                skipped_rows.append(
                    {
                        "domain": "clients",
                        "reason": "existing_non_resumable_import",
                        "source_per_id": seed.source_per_id,
                    }
                )
                continue
            client = targets_by_id.get(link.target_id) if link else None
            if client is None:
                client = Client(**payload)
                db.add(client)
                pending_creates.append((seed, payload, unmapped_fields, link, client))
                if link is None:
                    counters.created += 1
                else:
                    counters.recreated += 1
            else:
                apply_payload(client, payload)
                pending_updates.append((seed, payload, unmapped_fields, link, client))
                counters.updated += 1

        if pending_creates:
            db.flush()

        for seed, payload, unmapped_fields, link, client in pending_creates + pending_updates:
            targets_by_id[client.id] = client
            trace_payload = build_trace_payload(seed, payload, unmapped_fields)
            saved_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="Client",
                target_id=client.id,
                clinic_id=clinic_id,
                company_id=company_id,
                payload=trace_payload,
                migration_job_id=migration_job_id,
                existing_link=link,
            )
            links_by_raw_ref[saved_link.raw_row_ref] = saved_link

        if pending_creates or pending_updates:
            db.flush()
        emit_batch_progress("clients", counters)
    return counters, skipped_rows


def upsert_users(
    db: Session,
    *,
    user_seeds: Sequence[NormalizedUserSeed],
    clinic_id: int,
    company_id: int,
    unmapped_report: Dict[str, Dict[str, Dict[str, Any]]],
    source_fingerprint: Optional[str] = None,
    migration_job_id: Optional[str] = None,
) -> Tuple[DomainCounters, List[Dict[str, Any]], List[Dict[str, Any]]]:
    counters = DomainCounters()
    skipped_rows: List[Dict[str, Any]] = []
    user_username_map: List[Dict[str, Any]] = []
    links_by_raw_ref, targets_by_id = load_trace_index(db, clinic_id=clinic_id, target_model="User")

    for seed_batch in batched(user_seeds):
        pending_creates: List[Tuple[NormalizedUserSeed, Dict[str, Any], Dict[str, Any], Optional[Any], User]] = []
        pending_updates: List[Tuple[NormalizedUserSeed, Dict[str, Any], Dict[str, Any], Optional[Any], User]] = []

        for seed in seed_batch:
            if seed.legacy_user_id == 0:
                counters.skipped += 1
                skipped_rows.append({"domain": "users", "reason": "sentinel_user_id_zero", "source_user_id": 0})
                continue
            counters.processed += 1
            payload = user_payload_from_seed(
                seed,
                clinic_id=clinic_id,
                company_id=company_id,
                source_fingerprint=source_fingerprint,
            )
            unmapped_fields = user_unmapped_fields(seed)
            record_unmapped_values(unmapped_report, domain="users", values=unmapped_fields)

            link = links_by_raw_ref.get(seed.source_ref.raw_row_ref or "")
            if link and not can_resume_source_link(link, migration_job_id):
                counters.skipped += 1
                skipped_rows.append(
                    {
                        "domain": "users",
                        "reason": "existing_non_resumable_import",
                        "source_user_id": seed.source_user_id,
                    }
                )
                continue
            user = targets_by_id.get(link.target_id) if link else None
            existing_user_id = user.id if user is not None else None
            ensure_username_available(db, payload["username"], existing_user_id=existing_user_id)
            if user is None:
                user = User(**payload)
                db.add(user)
                pending_creates.append((seed, payload, unmapped_fields, link, user))
                if link is None:
                    counters.created += 1
                else:
                    counters.recreated += 1
            else:
                apply_payload(user, payload)
                pending_updates.append((seed, payload, unmapped_fields, link, user))
                counters.updated += 1

        if pending_creates:
            db.flush()

        for seed, payload, unmapped_fields, link, user in pending_creates + pending_updates:
            targets_by_id[user.id] = user
            trace_payload = build_trace_payload(seed, payload, unmapped_fields)
            saved_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="User",
                target_id=user.id,
                clinic_id=clinic_id,
                company_id=company_id,
                payload=trace_payload,
                migration_job_id=migration_job_id,
                existing_link=link,
            )
            links_by_raw_ref[saved_link.raw_row_ref] = saved_link
            user_username_map.append(
                {
                    "source_user_id": seed.legacy_user_id,
                    "username": payload["username"],
                    "full_name": payload["full_name"],
                    "role_level": payload["role_level"],
                    "is_active": payload["is_active"],
                    "target_user_id": user.id,
                }
            )

        if pending_creates or pending_updates:
            db.flush()
        emit_batch_progress("users", counters)
    return counters, skipped_rows, user_username_map


def load_client_seeds() -> List[NormalizedClientSeed]:
    return [normalize_client_row(row) for row in iter_exported_rows("tblPerData")]


def load_user_seeds() -> List[NormalizedUserSeed]:
    return [normalize_user_row(row) for row in iter_exported_rows("tblUsers")]


def execute_phase2(
    *,
    target_clinic_id: int,
    dry_run: bool = False,
    clients_only: bool = False,
    users_only: bool = False,
    cleanup_only: bool = False,
    report_dir: Optional[Path] = None,
    migration_job_id: Optional[str] = None,
    source_fingerprint: Optional[str] = None,
    on_batch_progress: Optional[Callable[[str, Dict[str, int]], None]] = None,
) -> Dict[str, Any]:
    if clients_only and users_only:
        raise ValueError("Cannot use --clients-only and --users-only together")

    report_dir = report_dir or default_report_dir()
    db = SessionLocal()
    progress_token = _batch_progress_callback.set(on_batch_progress)
    try:
        clinic = resolve_target_binding(db, target_clinic_id)
        ensure_lookup_extracts()
        catalog = load_lookup_catalog()
        summary: Dict[str, Any] = {
            "source_system": OPTITECH_SOURCE_SYSTEM,
            "mapping_version": 2,
            "target_clinic_id": clinic.id,
            "target_company_id": clinic.company_id,
            "dry_run": dry_run,
            "clients_only": clients_only,
            "users_only": users_only,
            "cleanup_phase2": cleanup_only,
        }

        if cleanup_only:
            cleanup_counts = cleanup_phase2_rows(db, clinic_id=clinic.id)
            summary["cleanup"] = cleanup_counts
            if dry_run:
                db.rollback()
            else:
                db.commit()
            unmapped_source_fields = finalize_unmapped_field_report(create_unmapped_field_report())
            report_paths = write_phase2_reports(
                report_dir=report_dir,
                summary=summary,
                skipped_rows=[],
                family_summary={"cleanup_only": True},
                user_username_map=[],
                unmapped_source_fields=unmapped_source_fields,
            )
            return {"summary": summary, "report_paths": {name: str(path) for name, path in report_paths.items()}}

        unmapped_report = create_unmapped_field_report()
        skipped_rows: List[Dict[str, Any]] = []
        family_summary: Dict[str, Any] = {"source_family_count": 0}
        family_counters = DomainCounters()
        client_counters = DomainCounters()
        user_counters = DomainCounters()
        user_username_map: List[Dict[str, Any]] = []

        if not users_only:
            client_seeds = load_client_seeds()
            family_seeds, family_summary = build_family_seeds(client_seeds)
            family_target_ids, family_counters = upsert_families(
                db,
                family_seeds=family_seeds,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                unmapped_report=unmapped_report,
                migration_job_id=migration_job_id,
            )
            client_counters, client_skipped_rows = upsert_clients(
                db,
                client_seeds=client_seeds,
                family_target_ids=family_target_ids,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                unmapped_report=unmapped_report,
                migration_job_id=migration_job_id,
                catalog=catalog,
            )
            skipped_rows.extend(client_skipped_rows)
            summary["expected_client_source_rows"] = len(client_seeds)
            summary["expected_family_source_rows"] = len(family_seeds)
        else:
            summary["expected_client_source_rows"] = 0
            summary["expected_family_source_rows"] = 0

        if not clients_only:
            user_seeds = load_user_seeds()
            user_counters, user_skipped_rows, user_username_map = upsert_users(
                db,
                user_seeds=user_seeds,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                unmapped_report=unmapped_report,
                source_fingerprint=source_fingerprint,
                migration_job_id=migration_job_id,
            )
            skipped_rows.extend(user_skipped_rows)
            summary["expected_user_source_rows"] = len([seed for seed in user_seeds if seed.legacy_user_id != 0])
        else:
            summary["expected_user_source_rows"] = 0

        summary["families"] = family_counters.as_dict()
        summary["clients"] = client_counters.as_dict()
        summary["users"] = user_counters.as_dict()
        summary["skipped_rows_count"] = len(skipped_rows)

        unmapped_source_fields = finalize_unmapped_field_report(unmapped_report)
        if dry_run:
            db.rollback()
        else:
            db.commit()
        report_paths = write_phase2_reports(
            report_dir=report_dir,
            summary=summary,
            skipped_rows=skipped_rows,
            family_summary=family_summary,
            user_username_map=user_username_map,
            unmapped_source_fields=unmapped_source_fields,
        )
        return {
            "summary": summary,
            "report_paths": {name: str(path) for name, path in report_paths.items()},
        }
    except Exception:
        db.rollback()
        raise
    finally:
        _batch_progress_callback.reset(progress_token)
        db.close()


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    result = execute_phase2(
        target_clinic_id=args.target_clinic_id,
        dry_run=args.dry_run,
        clients_only=args.clients_only,
        users_only=args.users_only,
        cleanup_only=args.cleanup_phase2,
        report_dir=args.report_dir,
    )
    print(f"phase2 summary: {result['summary']}")
    for name, path in result["report_paths"].items():
        print(f"{name}: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
