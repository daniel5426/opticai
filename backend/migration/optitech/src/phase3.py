from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date, datetime
import mimetypes
from pathlib import Path
import shutil
import sys
from typing import Any, Dict, Iterable, Iterator, List, Mapping, Optional, Sequence, Tuple

CURRENT_FILE = Path(__file__).resolve()
for path in (CURRENT_FILE.parents[4], CURRENT_FILE.parents[3]):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.append(path_str)

from sqlalchemy.orm import Session
from sqlalchemy import text

try:
    from models import (
        Appointment,
        Clinic,
        ContactLensOrder,
        ExamLayoutInstance,
        File,
        MedicalLog,
        OpticalExam,
        Order,
    )
    from services.prescription_search_index import rebuild_clinic_prescription_search_index
except ModuleNotFoundError:
    from backend.models import (
        Appointment,
        Clinic,
        ContactLensOrder,
        ExamLayoutInstance,
        File,
        MedicalLog,
        OpticalExam,
        Order,
    )
    from backend.services.prescription_search_index import rebuild_clinic_prescription_search_index

from .exam_layouts import (
    CONTACT_LENS_COMPONENTS,
    GLASSES_COMPONENTS,
    build_instance_layout_data,
    ensure_phase3_exam_layouts,
)
from .lookups import LookupCatalog, ensure_lookup_extracts, load_lookup_catalog, lookup_name
from .phase2 import apply_payload, batched, resolve_target_binding
from .reader import WORKSPACE_ROOT, current_scans_dir, iter_exported_rows
from .records import (
    NormalizedAppointmentSeed,
    NormalizedContactLensExamSeed,
    NormalizedFileSeed,
    NormalizedGlassesExamSeed,
    NormalizedMedicalNoteSeed,
    NormalizedOrderSeed,
    normalize_appointment_row,
    normalize_contact_lens_exam_row,
    normalize_file_row,
    normalize_glasses_exam_row,
    normalize_medical_note_row,
    normalize_order_row,
)
from .trace import (
    OPTITECH_SOURCE_SYSTEM,
    build_trace_payload,
    load_phase2_client_identity_map,
    load_phase2_user_identity_map,
    load_target_rows,
    load_trace_links,
    upsert_source_link,
)
from .validate_phase3 import (
    create_unmapped_field_report,
    default_report_dir,
    finalize_unmapped_field_report,
    record_unmapped_values,
    write_phase3_reports,
)


PHASE3_DOMAINS: Tuple[str, ...] = (
    "glasses_exams",
    "contact_lens_exams",
    "orders",
    "files",
    "medical_notes",
    "appointments",
)
PRESCRIPTION_INDEX_DOMAINS = {"glasses_exams", "contact_lens_exams", "orders"}
DOMAIN_BATCH_SIZES: Mapping[str, int] = {
    "glasses_exams": 500,
    "contact_lens_exams": 500,
    "orders": 1000,
    "files": 200,
    "medical_notes": 500,
    "appointments": 500,
}
MIGRATED_SCANS_DIR = WORKSPACE_ROOT / "artifacts" / "migrated_scans"


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


@dataclass(frozen=True)
class GlassesOrderMatch:
    source_ref: str
    dominant_eye: Optional[str]
    final_prescription: Dict[str, Any]


@dataclass(frozen=True)
class ContactLensOrderMatch:
    source_ref: str
    details: Dict[str, Any]
    exam: Dict[str, Any]
    diameters: Dict[str, Any]
    keratometer: Dict[str, Any]
    order_block: Dict[str, Any]


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 3 OptiTech direct migration")
    parser.add_argument("--target-clinic-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--domains", nargs="*", choices=PHASE3_DOMAINS)
    parser.add_argument("--report-dir", type=Path, default=default_report_dir())
    return parser.parse_args(argv)


def iter_batches(items: Iterable[Any], batch_size: int) -> Iterator[List[Any]]:
    batch: List[Any] = []
    for item in items:
        batch.append(item)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def iso_date(value: Optional[date]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def stringify_base(value: Optional[float]) -> Optional[str]:
    if value is None:
        return None
    if float(value).is_integer():
        return str(int(value))
    return str(value)


def strip_none(payload: Mapping[str, Any]) -> Dict[str, Any]:
    return {key: value for key, value in payload.items() if value is not None}


def record_skip(
    skipped_rows: List[Dict[str, Any]],
    *,
    domain: str,
    reason: str,
    raw_row_ref: Optional[str],
    source_per_id: Optional[int],
    source_user_id: Optional[int],
) -> None:
    skipped_rows.append(
        {
            "domain": domain,
            "reason": reason,
            "raw_row_ref": raw_row_ref,
            "source_per_id": source_per_id,
            "source_user_id": source_user_id,
        }
    )


def record_unresolved(
    unresolved_dependencies: List[Dict[str, Any]],
    *,
    domain: str,
    dependency: str,
    raw_row_ref: Optional[str],
    source_per_id: Optional[int],
    source_user_id: Optional[int],
    source_value: Any,
) -> None:
    unresolved_dependencies.append(
        {
            "domain": domain,
            "dependency": dependency,
            "raw_row_ref": raw_row_ref,
            "source_per_id": source_per_id,
            "source_user_id": source_user_id,
            "source_value": source_value,
        }
    )


def resolve_user_target_id(
    *,
    source_user_id: Optional[int],
    user_map: Mapping[int, int],
    unresolved_dependencies: List[Dict[str, Any]],
    domain: str,
    raw_row_ref: Optional[str],
    source_per_id: Optional[int],
) -> Optional[int]:
    if source_user_id in (None, 0):
        return None
    target_user_id = user_map.get(source_user_id)
    if target_user_id is None:
        record_unresolved(
            unresolved_dependencies,
            domain=domain,
            dependency="phase2_user_trace",
            raw_row_ref=raw_row_ref,
            source_per_id=source_per_id,
            source_user_id=source_user_id,
            source_value=source_user_id,
        )
    return target_user_id


def resolve_lookup_value(
    catalog: LookupCatalog,
    *,
    table_name: str,
    key: Optional[int],
    unresolved_dependencies: List[Dict[str, Any]],
    domain: str,
    raw_row_ref: Optional[str],
    source_per_id: Optional[int],
    source_user_id: Optional[int],
    dependency_name: str,
) -> Optional[str]:
    value = lookup_name(catalog, table_name, key)
    if key not in (None, 0) and value is None:
        record_unresolved(
            unresolved_dependencies,
            domain=domain,
            dependency=dependency_name,
            raw_row_ref=raw_row_ref,
            source_per_id=source_per_id,
            source_user_id=source_user_id,
            source_value=key,
        )
    return value


def build_notes_text(parts: Sequence[Tuple[str, Optional[str]]]) -> Optional[str]:
    lines = []
    for label, value in parts:
        normalized = normalize_note_value(value)
        if normalized:
            lines.append(f"{label}: {normalized}")
    return "\n".join(lines) if lines else None


def normalize_note_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = (
        value.replace("\\r\\n", "\n")
        .replace("\\n", "\n")
        .replace("\\r", "\n")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
    )
    normalized_lines: List[str] = []
    previous_blank = False
    for line in (part.strip() for part in text.split("\n")):
        if not line:
            if normalized_lines and not previous_blank:
                normalized_lines.append("")
            previous_blank = True
            continue
        normalized_lines.append(line)
        previous_blank = False
    while normalized_lines and normalized_lines[0] == "":
        normalized_lines.pop(0)
    while normalized_lines and normalized_lines[-1] == "":
        normalized_lines.pop()
    return "\n".join(normalized_lines) if normalized_lines else None


def normalize_prism_pair(prism: Optional[float], base: Optional[float]) -> Tuple[Optional[float], Optional[str]]:
    effective_prism = None if prism in (None, 0, 0.0) else prism
    effective_base = stringify_base(base) if effective_prism is not None and base not in (None, 0, 0.0) else None
    return effective_prism, effective_base


def parse_frame_size(raw_value: Optional[str]) -> Dict[str, Optional[int]]:
    if raw_value is None:
        return {"width": None, "bridge": None, "length": None}
    tokens = [token for token in "".join(ch if ch.isdigit() else " " for ch in raw_value).split() if token]
    if not tokens:
        return {"width": None, "bridge": None, "length": None}
    values = [int(token) for token in tokens[:3]]
    width = values[0] if len(values) >= 1 else None
    bridge = values[1] if len(values) >= 2 else None
    length = values[2] if len(values) >= 3 else None
    return {"width": width, "bridge": bridge, "length": length}


def calculate_appointment_duration_minutes(start_time: Optional[str], end_time: Optional[str]) -> int:
    if not start_time or not end_time:
        return 30
    start = datetime.strptime(start_time, "%H:%M:%S")
    end = datetime.strptime(end_time, "%H:%M:%S")
    delta_minutes = int((end - start).total_seconds() // 60)
    return delta_minutes if delta_minutes > 0 else 30


def build_exam_notes_payload(
    *,
    layout_instance_id: int,
    note: Optional[str],
) -> Optional[Dict[str, Any]]:
    if not note:
        return None
    return {
        "layout_instance_id": layout_instance_id,
        "card_instance_id": "notes-1",
        "title": "הערות",
        "note": note,
    }


def build_glasses_objective_payload(
    seed: NormalizedGlassesExamSeed,
    *,
    layout_instance_id: int,
) -> Optional[Dict[str, Any]]:
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "r_sph": seed.objective.get("r_sph"),
            "l_sph": seed.objective.get("l_sph"),
            "r_cyl": seed.objective.get("r_cyl"),
            "l_cyl": seed.objective.get("l_cyl"),
            "r_ax": seed.objective.get("r_ax"),
            "l_ax": seed.objective.get("l_ax"),
            "r_se": seed.objective.get("r_se"),
            "l_se": seed.objective.get("l_se"),
        }
    )
    return payload if len(payload) > 1 else None


def build_glasses_subjective_payload(
    seed: NormalizedGlassesExamSeed,
    *,
    layout_instance_id: int,
) -> Optional[Dict[str, Any]]:
    r_pris, r_base = normalize_prism_pair(seed.subjective.get("r_pris"), seed.subjective.get("r_base"))
    l_pris, l_base = normalize_prism_pair(seed.subjective.get("l_pris"), seed.subjective.get("l_base"))
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "r_sph": seed.subjective.get("r_sph"),
            "l_sph": seed.subjective.get("l_sph"),
            "r_cyl": seed.subjective.get("r_cyl"),
            "l_cyl": seed.subjective.get("l_cyl"),
            "r_ax": seed.subjective.get("r_ax"),
            "l_ax": seed.subjective.get("l_ax"),
            "r_pris": r_pris,
            "l_pris": l_pris,
            "r_base": r_base,
            "l_base": l_base,
            "r_va": seed.subjective.get("r_va"),
            "l_va": seed.subjective.get("l_va"),
            "comb_va": seed.subjective.get("comb_va"),
            "r_ph": seed.subjective.get("r_ph"),
            "l_ph": seed.subjective.get("l_ph"),
            "r_pd_close": seed.subjective.get("r_pd_close"),
            "l_pd_close": seed.subjective.get("l_pd_close"),
            "comb_pd_close": seed.subjective.get("comb_pd_close"),
            "r_pd_far": seed.subjective.get("r_pd_far"),
            "l_pd_far": seed.subjective.get("l_pd_far"),
            "comb_pd_far": seed.subjective.get("comb_pd_far"),
        }
    )
    return payload if len(payload) > 1 else None


def build_glasses_final_subjective_payload(
    seed: NormalizedGlassesExamSeed,
    *,
    layout_instance_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    r_pris, r_base = normalize_prism_pair(seed.final_prescription.get("r_pris"), seed.final_prescription.get("r_base"))
    l_pris, l_base = normalize_prism_pair(seed.final_prescription.get("l_pris"), seed.final_prescription.get("l_base"))
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "r_sph": seed.final_prescription.get("r_sph"),
            "l_sph": seed.final_prescription.get("l_sph"),
            "r_cyl": seed.final_prescription.get("r_cyl"),
            "l_cyl": seed.final_prescription.get("l_cyl"),
            "r_ax": seed.final_prescription.get("r_ax"),
            "l_ax": seed.final_prescription.get("l_ax"),
            "r_pris": r_pris,
            "l_pris": l_pris,
            "r_base": r_base,
            "l_base": l_base,
            "r_va": seed.final_prescription.get("r_va"),
            "l_va": seed.final_prescription.get("l_va"),
            "comb_va": seed.final_prescription.get("comb_va"),
            "r_j": seed.additional.get("r_j_final"),
            "l_j": seed.additional.get("l_j_final"),
            "r_pd_far": seed.final_prescription.get("r_pd_far"),
            "l_pd_far": seed.final_prescription.get("l_pd_far"),
            "comb_pd_far": seed.final_prescription.get("comb_pd_far"),
            "r_pd_close": seed.final_prescription.get("r_pd_close"),
            "l_pd_close": seed.final_prescription.get("l_pd_close"),
            "comb_pd_close": seed.final_prescription.get("comb_pd_close"),
        }
    )
    if layout_instance_id is None:
        payload.pop("layout_instance_id", None)
    return payload if set(payload) - {"layout_instance_id"} else None


def build_glasses_final_prescription_payload(
    seed: NormalizedGlassesExamSeed,
    *,
    layout_instance_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    r_pris, r_base = normalize_prism_pair(seed.final_prescription.get("r_pris"), seed.final_prescription.get("r_base"))
    l_pris, l_base = normalize_prism_pair(seed.final_prescription.get("l_pris"), seed.final_prescription.get("l_base"))
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "r_sph": seed.final_prescription.get("r_sph"),
            "l_sph": seed.final_prescription.get("l_sph"),
            "r_cyl": seed.final_prescription.get("r_cyl"),
            "l_cyl": seed.final_prescription.get("l_cyl"),
            "r_ax": seed.final_prescription.get("r_ax"),
            "l_ax": seed.final_prescription.get("l_ax"),
            "r_pris": r_pris,
            "l_pris": l_pris,
            "r_base": r_base,
            "l_base": l_base,
            "r_va": seed.final_prescription.get("r_va"),
            "l_va": seed.final_prescription.get("l_va"),
            "comb_va": seed.final_prescription.get("comb_va"),
            "r_ad": seed.additional.get("r_read_final"),
            "l_ad": seed.additional.get("l_read_final"),
            "r_pd": seed.final_prescription.get("r_pd_far"),
            "l_pd": seed.final_prescription.get("l_pd_far"),
            "comb_pd": seed.final_prescription.get("comb_pd_far"),
            "r_high": seed.additional.get("r_high"),
            "l_high": seed.additional.get("l_high"),
        }
    )
    if layout_instance_id is None:
        payload.pop("layout_instance_id", None)
    return payload if set(payload) - {"layout_instance_id"} else None


def build_glasses_addition_payload(
    seed: NormalizedGlassesExamSeed,
    *,
    layout_instance_id: int,
) -> Optional[Dict[str, Any]]:
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "r_read": seed.additional.get("r_read"),
            "l_read": seed.additional.get("l_read"),
            "r_int": seed.additional.get("r_int"),
            "l_int": seed.additional.get("l_int"),
            "r_bif": seed.additional.get("r_bif"),
            "l_bif": seed.additional.get("l_bif"),
            "r_mul": seed.additional.get("r_mul"),
            "l_mul": seed.additional.get("l_mul"),
            "r_j": seed.additional.get("r_j"),
            "l_j": seed.additional.get("l_j"),
            "r_iop": seed.additional.get("iop_right"),
            "l_iop": seed.additional.get("iop_left"),
        }
    )
    return payload if len(payload) > 1 else None


def build_glasses_exam_data(
    seed: NormalizedGlassesExamSeed,
    *,
    layout_instance_id: int,
) -> Dict[str, Any]:
    exam_data: Dict[str, Any] = {}
    objective = build_glasses_objective_payload(seed, layout_instance_id=layout_instance_id)
    subjective = build_glasses_subjective_payload(seed, layout_instance_id=layout_instance_id)
    final_subjective = build_glasses_final_subjective_payload(seed, layout_instance_id=layout_instance_id)
    final_prescription = build_glasses_final_prescription_payload(seed, layout_instance_id=layout_instance_id)
    addition = build_glasses_addition_payload(seed, layout_instance_id=layout_instance_id)
    notes = build_exam_notes_payload(
        layout_instance_id=layout_instance_id,
        note=build_notes_text(
            (
                ("Comments", seed.comments),
                ("Objective Comment", seed.objective_comment),
                ("Recheck Date", iso_date(seed.recheck_date)),
            )
        ),
    )
    if objective:
        exam_data["objective"] = objective
    if subjective:
        exam_data["subjective"] = subjective
    if final_subjective:
        exam_data["final-subjective"] = final_subjective
    if final_prescription:
        exam_data["final-prescription"] = final_prescription
    if addition:
        exam_data["addition"] = addition
    if notes:
        exam_data["notes-notes-1"] = notes
    return exam_data


def build_contact_lens_details_payload(
    seed: NormalizedContactLensExamSeed,
    *,
    catalog: LookupCatalog,
    unresolved_dependencies: List[Dict[str, Any]],
    domain: str,
    raw_row_ref: Optional[str],
    layout_instance_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "l_lens_type": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensTypes",
                key=seed.lens_catalog.get("l_type_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_type_left",
            ),
            "l_model": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensBrands",
                key=seed.lens_catalog.get("l_brand_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_brand_left",
            ),
            "l_supplier": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensManuf",
                key=seed.lens_catalog.get("l_manufacturer_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_manufacturer_left",
            ),
            "l_material": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensChecksMater",
                key=seed.lens_catalog.get("l_material_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_material_left",
            ),
            "l_color": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensChecksTint",
                key=seed.lens_catalog.get("l_tint_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_tint_left",
            ),
            "r_lens_type": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensTypes",
                key=seed.lens_catalog.get("r_type_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_type_right",
            ),
            "r_model": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensBrands",
                key=seed.lens_catalog.get("r_brand_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_brand_right",
            ),
            "r_supplier": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensManuf",
                key=seed.lens_catalog.get("r_manufacturer_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_manufacturer_right",
            ),
            "r_material": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensChecksMater",
                key=seed.lens_catalog.get("r_material_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_material_right",
            ),
            "r_color": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensChecksTint",
                key=seed.lens_catalog.get("r_tint_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_tint_right",
            ),
        }
    )
    if layout_instance_id is None:
        payload.pop("layout_instance_id", None)
    return payload if payload else None


def build_contact_lens_exam_payload(
    seed: NormalizedContactLensExamSeed,
    *,
    layout_instance_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "l_bc": seed.lens_values.get("l_bc_1"),
            "l_bc_2": seed.lens_values.get("l_bc_2"),
            "l_oz": seed.lens_values.get("l_oz"),
            "l_diam": seed.lens_values.get("l_diam"),
            "l_sph": seed.lens_values.get("l_sph"),
            "l_cyl": seed.lens_values.get("l_cyl"),
            "l_ax": seed.lens_values.get("l_ax"),
            "l_read_ad": seed.lens_values.get("l_add"),
            "l_va": seed.lens_values.get("l_va"),
            "r_bc": seed.lens_values.get("r_bc_1"),
            "r_bc_2": seed.lens_values.get("r_bc_2"),
            "r_oz": seed.lens_values.get("r_oz"),
            "r_diam": seed.lens_values.get("r_diam"),
            "r_sph": seed.lens_values.get("r_sph"),
            "r_cyl": seed.lens_values.get("r_cyl"),
            "r_ax": seed.lens_values.get("r_ax"),
            "r_read_ad": seed.lens_values.get("r_add"),
            "r_va": seed.lens_values.get("r_va"),
            "comb_va": seed.lens_values.get("comb_va"),
        }
    )
    if layout_instance_id is None:
        payload.pop("layout_instance_id", None)
    return payload if payload else None


def build_contact_lens_diameters_payload(
    seed: NormalizedContactLensExamSeed,
    *,
    layout_instance_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "pupil_diameter": seed.pupil_diameter,
            "corneal_diameter": seed.corneal_diameter,
        }
    )
    if layout_instance_id is None:
        payload.pop("layout_instance_id", None)
    return payload if payload else None


def build_contact_lens_keratometer_payload(
    seed: NormalizedContactLensExamSeed,
    *,
    layout_instance_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    left_rh = seed.keratometry.get("l_h")
    left_rv = seed.keratometry.get("l_v")
    right_rh = seed.keratometry.get("r_h")
    right_rv = seed.keratometry.get("r_v")
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "l_rh": left_rh,
            "l_rv": left_rv,
            "l_avg": ((left_rh + left_rv) / 2.0) if left_rh is not None and left_rv is not None else None,
            "l_cyl": abs(left_rh - left_rv) if left_rh is not None and left_rv is not None else None,
            "l_ax": seed.keratometry.get("l_h_axis"),
            "r_rh": right_rh,
            "r_rv": right_rv,
            "r_avg": ((right_rh + right_rv) / 2.0) if right_rh is not None and right_rv is not None else None,
            "r_cyl": abs(right_rh - right_rv) if right_rh is not None and right_rv is not None else None,
            "r_ax": seed.keratometry.get("r_h_axis"),
        }
    )
    if layout_instance_id is None:
        payload.pop("layout_instance_id", None)
    return payload if payload else None


def build_contact_lens_order_payload(
    seed: NormalizedContactLensExamSeed,
    *,
    catalog: LookupCatalog,
    clinic_name: str,
    unresolved_dependencies: List[Dict[str, Any]],
    domain: str,
    raw_row_ref: Optional[str],
    layout_instance_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    payload = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "branch": clinic_name,
            "supply_in_branch": clinic_name,
            "cleaning_solution": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensSolClean",
                key=seed.care_solutions.get("clean_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_clean_solution",
            ),
            "disinfection_solution": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensSolDisinfect",
                key=seed.care_solutions.get("disinfect_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_disinfection_solution",
            ),
            "rinsing_solution": resolve_lookup_value(
                catalog,
                table_name="tblCrdClensSolRinse",
                key=seed.care_solutions.get("rinse_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain=domain,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="clens_rinsing_solution",
            ),
        }
    )
    if layout_instance_id is None:
        payload.pop("layout_instance_id", None)
    return payload if payload else None


def build_contact_lens_exam_data(
    seed: NormalizedContactLensExamSeed,
    *,
    layout_instance_id: int,
    catalog: LookupCatalog,
    clinic_name: str,
    unresolved_dependencies: List[Dict[str, Any]],
) -> Dict[str, Any]:
    exam_data: Dict[str, Any] = {}
    schirmer = strip_none(
        {
            "layout_instance_id": layout_instance_id,
            "r_mm": seed.tear_metrics.get("schirmer_right"),
            "l_mm": seed.tear_metrics.get("schirmer_left"),
            "r_but": seed.tear_metrics.get("but"),
            "l_but": seed.tear_metrics.get("but_left"),
        }
    )
    if len(schirmer) > 1:
        exam_data["schirmer-test"] = schirmer
    diameters = build_contact_lens_diameters_payload(seed, layout_instance_id=layout_instance_id)
    if diameters:
        exam_data["contact-lens-diameters"] = diameters
    keratometer = build_contact_lens_keratometer_payload(seed, layout_instance_id=layout_instance_id)
    if keratometer:
        exam_data["keratometer-contact-lens"] = keratometer
    details = build_contact_lens_details_payload(
        seed,
        catalog=catalog,
        unresolved_dependencies=unresolved_dependencies,
        domain="contact_lens_exams",
        raw_row_ref=seed.source_ref.raw_row_ref,
        layout_instance_id=layout_instance_id,
    )
    if details:
        exam_data["contact-lens-details"] = details
    cl_exam = build_contact_lens_exam_payload(seed, layout_instance_id=layout_instance_id)
    if cl_exam:
        exam_data["contact-lens-exam"] = cl_exam
    order_block = build_contact_lens_order_payload(
        seed,
        catalog=catalog,
        clinic_name=clinic_name,
        unresolved_dependencies=unresolved_dependencies,
        domain="contact_lens_exams",
        raw_row_ref=seed.source_ref.raw_row_ref,
        layout_instance_id=layout_instance_id,
    )
    if order_block:
        exam_data["contact-lens-order"] = order_block
    notes = build_exam_notes_payload(
        layout_instance_id=layout_instance_id,
        note=build_notes_text(
            (
                ("Comments", seed.comments),
                ("Recheck Date", iso_date(seed.recheck_date)),
            )
        ),
    )
    if notes:
        exam_data["notes-notes-1"] = notes
    return exam_data


def build_glasses_order_match(seed: NormalizedGlassesExamSeed) -> GlassesOrderMatch:
    return GlassesOrderMatch(
        source_ref=seed.source_ref.raw_row_ref or "",
        dominant_eye=seed.dominant_eye,
        final_prescription=build_glasses_final_prescription_payload(seed) or {},
    )


def build_contact_lens_order_match(
    seed: NormalizedContactLensExamSeed,
    *,
    catalog: LookupCatalog,
    clinic_name: str,
    unresolved_dependencies: List[Dict[str, Any]],
    domain: str,
) -> ContactLensOrderMatch:
    return ContactLensOrderMatch(
        source_ref=seed.source_ref.raw_row_ref or "",
        details=build_contact_lens_details_payload(
            seed,
            catalog=catalog,
            unresolved_dependencies=unresolved_dependencies,
            domain=domain,
            raw_row_ref=seed.source_ref.raw_row_ref,
        )
        or {},
        exam=build_contact_lens_exam_payload(seed) or {},
        diameters=build_contact_lens_diameters_payload(seed) or {},
        keratometer=build_contact_lens_keratometer_payload(seed) or {},
        order_block=build_contact_lens_order_payload(
            seed,
            catalog=catalog,
            clinic_name=clinic_name,
            unresolved_dependencies=unresolved_dependencies,
            domain=domain,
            raw_row_ref=seed.source_ref.raw_row_ref,
        )
        or {},
    )


def build_order_exact_key(source_per_id: Optional[int], check_date: Optional[date]) -> Optional[Tuple[int, str]]:
    if source_per_id is None or check_date is None:
        return None
    return source_per_id, check_date.isoformat()


def classify_work_type(
    work_type_id: Optional[int],
    catalog: LookupCatalog,
    *,
    unresolved_dependencies: List[Dict[str, Any]],
    raw_row_ref: Optional[str],
    source_per_id: Optional[int],
    source_user_id: Optional[int],
) -> Tuple[str, str]:
    work_type_name = resolve_lookup_value(
        catalog,
        table_name="tblCrdBuysWorkTypes",
        key=work_type_id,
        unresolved_dependencies=unresolved_dependencies,
        domain="orders",
        raw_row_ref=raw_row_ref,
        source_per_id=source_per_id,
        source_user_id=source_user_id,
        dependency_name="work_type",
    )
    if work_type_id == 1:
        return "ContactLensOrder", "contact-lens"
    if work_type_id == 2:
        return "Order", "service"
    return "Order", "glasses" if work_type_name or work_type_id == 0 else "glasses"


def build_regular_order_data(
    seed: NormalizedOrderSeed,
    *,
    catalog: LookupCatalog,
    clinic_name: str,
    unresolved_dependencies: List[Dict[str, Any]],
    matched_exam: Optional[GlassesOrderMatch],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    frame_size = parse_frame_size(seed.frame.get("frame_size"))
    lens = strip_none(
        {
            "right_model": resolve_lookup_value(
                catalog,
                table_name="tblCrdGlassModel",
                key=seed.lens.get("lens_model_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="glass_model",
            ),
            "left_model": resolve_lookup_value(
                catalog,
                table_name="tblCrdGlassModel",
                key=seed.lens.get("lens_model_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="glass_model",
            ),
            "color": resolve_lookup_value(
                catalog,
                table_name="tblCrdGlassColor",
                key=seed.lens.get("lens_color_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="glass_color",
            ),
            "coating": resolve_lookup_value(
                catalog,
                table_name="tblCrdGlassCoat",
                key=seed.lens.get("lens_coat_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="glass_coat",
            ),
            "material": resolve_lookup_value(
                catalog,
                table_name="tblCrdGlassMater",
                key=seed.lens.get("lens_material_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="glass_material",
            ),
            "supplier": resolve_lookup_value(
                catalog,
                table_name="tblCrdBuysWorkSapaks",
                key=seed.supplier_id,
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="work_supplier",
            ),
        }
    )
    frame = strip_none(
        {
            "color": seed.frame.get("frame_color"),
            "supplier": resolve_lookup_value(
                catalog,
                table_name="tblCrdBuysWorkSapaks",
                key=seed.frame.get("frame_supplier_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="frame_supplier",
            ),
            "model": seed.frame.get("frame_model"),
            "manufacturer": resolve_lookup_value(
                catalog,
                table_name="tblCrdBuysWorkLabels",
                key=seed.frame.get("frame_label_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="frame_label",
            ),
            "supplied_by": resolve_lookup_value(
                catalog,
                table_name="tblCrdBuysWorkSapaks",
                key=seed.frame.get("frame_supplier_id"),
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="frame_supplier",
            ),
            "bridge": frame_size["bridge"],
            "width": frame_size["width"],
            "length": frame_size["length"],
        }
    )
    details = strip_none(
        {
            "branch": clinic_name,
            "supplier_status": resolve_lookup_value(
                catalog,
                table_name="tblCrdBuysWorkSupply",
                key=seed.work_supply_id,
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="work_supply",
            ),
            "bag_number": seed.bag_number,
            "delivered_at": iso_date(seed.delivery_date),
            "delivery_location": clinic_name,
            "manufacturing_lab": resolve_lookup_value(
                catalog,
                table_name="tblCrdBuysWorkLabs",
                key=seed.lab_id,
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="work_lab",
            ),
            "order_status": resolve_lookup_value(
                catalog,
                table_name="tblCrdBuysWorkStats",
                key=seed.work_status_id,
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=seed.source_ref.raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                dependency_name="work_status",
            ),
            "promised_date": iso_date(seed.promise_date),
            "notes": seed.comment,
            "lens_order_notes": seed.comment,
        }
    )
    order_data: Dict[str, Any] = {}
    if matched_exam and matched_exam.final_prescription:
        order_data["final-prescription"] = matched_exam.final_prescription
    if lens:
        order_data["lens"] = lens
    if frame:
        order_data["frame"] = frame
    if details:
        order_data["details"] = details
    unmapped_fields = {
        "frame_size_raw": seed.frame.get("frame_size"),
        "frame_sold": seed.frame.get("frame_sold"),
        "diameter": seed.lens.get("diameter"),
        "segment": seed.lens.get("segment"),
        "work_type_id": seed.work_type_id,
    }
    return order_data, unmapped_fields


def build_contact_lens_order_payloads(
    seed: NormalizedOrderSeed,
    *,
    clinic: Clinic,
    catalog: LookupCatalog,
    unresolved_dependencies: List[Dict[str, Any]],
    matched_exam: Optional[ContactLensOrderMatch],
) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    status_name = resolve_lookup_value(
        catalog,
        table_name="tblCrdBuysWorkStats",
        key=seed.work_status_id,
        unresolved_dependencies=unresolved_dependencies,
        domain="orders",
        raw_row_ref=seed.source_ref.raw_row_ref,
        source_per_id=seed.source_per_id,
        source_user_id=seed.source_user_id,
        dependency_name="work_status",
    )
    scalar_payload = {
        "client_id": None,
        "clinic_id": clinic.id,
        "user_id": None,
        "order_date": seed.work_date,
        "type": "contact-lens",
        "supply_in_clinic_id": clinic.id,
        "order_status": status_name,
        "delivery_date": seed.delivery_date,
        "guaranteed_date": seed.promise_date,
        "cleaning_solution": matched_exam.order_block.get("cleaning_solution") if matched_exam else None,
        "disinfection_solution": matched_exam.order_block.get("disinfection_solution") if matched_exam else None,
        "rinsing_solution": matched_exam.order_block.get("rinsing_solution") if matched_exam else None,
        "notes": seed.comment,
        "supplier_notes": None,
        "order_data": {},
    }
    order_data: Dict[str, Any] = {}
    if matched_exam:
        if matched_exam.details:
            order_data["contact-lens-details"] = matched_exam.details
        if matched_exam.exam:
            order_data["contact-lens-exam"] = matched_exam.exam
        if matched_exam.diameters:
            order_data["contact-lens-diameters"] = matched_exam.diameters
        if matched_exam.keratometer:
            order_data["keratometer-contact-lens"] = matched_exam.keratometer
        order_block = dict(matched_exam.order_block)
    else:
        order_block = {}
    order_block.update(
        strip_none(
            {
                "branch": clinic.name,
                "supply_in_branch": clinic.name,
                "order_status": status_name,
                "delivery_date": iso_date(seed.delivery_date),
                "guaranteed_date": iso_date(seed.promise_date),
                "notes": seed.comment,
            }
        )
    )
    if order_block:
        order_data["contact-lens-order"] = order_block
    scalar_payload["order_data"] = order_data
    unmapped_fields = {
        "bag_number": seed.bag_number,
        "work_supply_id": seed.work_supply_id,
        "work_type_id": seed.work_type_id,
        "frame_fields": seed.frame,
        "lens_fields": seed.lens,
    }
    return scalar_payload, order_data, unmapped_fields


def build_medical_log_text(seed: NormalizedMedicalNoteSeed) -> Optional[str]:
    return build_notes_text(
        (
            ("Complaints", seed.complaints),
            ("Illnesses", seed.illnesses),
            ("Optical Diagnosis", seed.optical_diagnosis),
            ("Doctor Referral", seed.doctor_referral),
            ("Summary", seed.summary),
        )
    )


def infer_file_type(file_name: Optional[str]) -> Optional[str]:
    if not file_name:
        return None
    return mimetypes.guess_type(file_name)[0]


def build_file_notes(seed: NormalizedFileSeed) -> Optional[str]:
    return build_notes_text(
        (
            ("Description", seed.description),
            ("Notes", seed.notes),
        )
    )


def target_scan_path(clinic_id: int, seed: NormalizedFileSeed) -> Optional[Path]:
    if seed.file_name is None or seed.legacy_file_id is None or seed.source_per_id is None:
        return None
    safe_name = seed.file_name.replace("/", "_")
    return (
        MIGRATED_SCANS_DIR
        / f"clinic-{clinic_id}"
        / f"per-{seed.source_per_id}"
        / f"{seed.legacy_file_id}_{safe_name}"
    )


def copy_scan_if_needed(
    *,
    clinic_id: int,
    seed: NormalizedFileSeed,
    dry_run: bool,
) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    source_path = Path(seed.scan_path) if seed.scan_path else None
    if source_path is None or not source_path.exists():
        return None, None, None
    destination = target_scan_path(clinic_id, seed)
    if destination is None:
        return None, None, None
    if not dry_run:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, destination)
    return str(destination), source_path.stat().st_size, infer_file_type(seed.file_name)


def store_scan_if_needed(
    *,
    clinic_id: int,
    seed: NormalizedFileSeed,
    dry_run: bool,
    storage: Optional[Any],
) -> Tuple[Optional[str], Optional[str], Optional[int], Optional[str]]:
    source_path = Path(seed.scan_path) if seed.scan_path else None
    if source_path is None or not source_path.exists() or seed.legacy_file_id is None:
        return None, None, None, None
    file_type = infer_file_type(seed.file_name)
    if storage is None:
        copied_path, file_size, file_type = copy_scan_if_needed(
            clinic_id=clinic_id,
            seed=seed,
            dry_run=dry_run,
        )
        return ("legacy-local", copied_path, file_size, file_type) if copied_path else (None, None, None, None)

    safe_name = (seed.file_name or f"file-{seed.legacy_file_id}").replace("/", "_").replace("\\", "_")
    bucket = "clinic-files"
    key = f"clinics/{clinic_id}/migration/optitech/{seed.legacy_file_id}_{safe_name}"
    if not dry_run:
        if storage.exists(bucket, key):
            storage.remove(bucket, key)
        storage.upload_path(bucket, key, source_path, file_type or "application/octet-stream")
    return bucket, key, source_path.stat().st_size, file_type


def iter_glasses_exam_seeds() -> Iterator[NormalizedGlassesExamSeed]:
    for row in iter_exported_rows("tblCrdGlassChecks"):
        yield normalize_glasses_exam_row(row)


def iter_contact_lens_exam_seeds() -> Iterator[NormalizedContactLensExamSeed]:
    for row in iter_exported_rows("tblCrdClensChecks"):
        yield normalize_contact_lens_exam_row(row)


def iter_order_seeds() -> Iterator[NormalizedOrderSeed]:
    for row in iter_exported_rows("tblCrdBuysWorks"):
        yield normalize_order_row(row)


def iter_file_seeds() -> Iterator[NormalizedFileSeed]:
    for row in iter_exported_rows("tblPerPicture"):
        yield normalize_file_row(row, current_scans_dir())


def iter_medical_note_seeds() -> Iterator[NormalizedMedicalNoteSeed]:
    for row in iter_exported_rows("tblCrdDiags"):
        yield normalize_medical_note_row(row)


def iter_appointment_seeds() -> Iterator[NormalizedAppointmentSeed]:
    for row in iter_exported_rows("tblClndrApt"):
        yield normalize_appointment_row(row)


def build_glasses_match_index_from_source(
    seeds: Iterable[NormalizedGlassesExamSeed],
) -> Dict[Tuple[int, str], GlassesOrderMatch]:
    index: Dict[Tuple[int, str], GlassesOrderMatch] = {}
    for seed in seeds:
        exact_key = build_order_exact_key(seed.source_per_id, seed.check_date)
        if exact_key is None:
            continue
        index[exact_key] = build_glasses_order_match(seed)
    return index


def build_contact_lens_match_index_from_source(
    seeds: Iterable[NormalizedContactLensExamSeed],
    *,
    catalog: LookupCatalog,
    clinic_name: str,
) -> Dict[Tuple[int, str], ContactLensOrderMatch]:
    index: Dict[Tuple[int, str], ContactLensOrderMatch] = {}
    temp_unresolved: List[Dict[str, Any]] = []
    for seed in seeds:
        exact_key = build_order_exact_key(seed.source_per_id, seed.check_date)
        if exact_key is None:
            continue
        index[exact_key] = build_contact_lens_order_match(
            seed,
            catalog=catalog,
            clinic_name=clinic_name,
            unresolved_dependencies=temp_unresolved,
            domain="orders",
        )
    return index


def upsert_glasses_exams(
    db: Session,
    *,
    seeds: Iterable[NormalizedGlassesExamSeed],
    clinic: Clinic,
    client_map: Mapping[int, int],
    user_map: Mapping[int, int],
    layout_id: int,
    layout_data: str,
    unmapped_report: Dict[str, Dict[str, Dict[str, Any]]],
    migration_job_id: Optional[str] = None,
    commit_each_batch: bool = False,
) -> Tuple[DomainCounters, List[Dict[str, Any]], List[Dict[str, Any]], Dict[Tuple[int, str], GlassesOrderMatch]]:
    counters = DomainCounters()
    skipped_rows: List[Dict[str, Any]] = []
    unresolved_dependencies: List[Dict[str, Any]] = []
    match_index: Dict[Tuple[int, str], GlassesOrderMatch] = {}
    exam_links = load_trace_links(
        db,
        clinic_id=clinic.id,
        target_model="OpticalExam",
        source_table="tblCrdGlassChecks",
    )
    instance_links = load_trace_links(
        db,
        clinic_id=clinic.id,
        target_model="ExamLayoutInstance",
        source_table="tblCrdGlassChecks",
    )

    for seed_batch in iter_batches(seeds, DOMAIN_BATCH_SIZES["glasses_exams"]):
        exam_targets = load_target_rows(
            db,
            target_model="OpticalExam",
            target_ids=[
                exam_links[seed.source_ref.raw_row_ref].target_id
                for seed in seed_batch
                if seed.source_ref.raw_row_ref in exam_links
            ],
        )
        instance_targets = load_target_rows(
            db,
            target_model="ExamLayoutInstance",
            target_ids=[
                instance_links[seed.source_ref.raw_row_ref].target_id
                for seed in seed_batch
                if seed.source_ref.raw_row_ref in instance_links
            ],
        )
        pending: List[Dict[str, Any]] = []
        for seed in seed_batch:
            counters.processed += 1
            raw_row_ref = seed.source_ref.raw_row_ref
            if raw_row_ref is None or seed.source_per_id is None or seed.source_per_id not in client_map:
                counters.skipped += 1
                record_skip(
                    skipped_rows,
                    domain="glasses_exams",
                    reason="missing_phase2_client_mapping",
                    raw_row_ref=raw_row_ref,
                    source_per_id=seed.source_per_id,
                    source_user_id=seed.source_user_id,
                )
                continue
            client_id = client_map[seed.source_per_id]
            user_id = resolve_user_target_id(
                source_user_id=seed.source_user_id,
                user_map=user_map,
                unresolved_dependencies=unresolved_dependencies,
                domain="glasses_exams",
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
            )
            payload = {
                "client_id": client_id,
                "clinic_id": clinic.id,
                "clinic": clinic.name,
                "user_id": user_id,
                "exam_date": seed.check_date,
                "test_name": "OptiTech Glasses Exam",
                "dominant_eye": seed.dominant_eye,
                "type": "exam",
            }
            record_unmapped_values(
                unmapped_report,
                domain="glasses_exams",
                values={"source_user_id": seed.source_user_id},
            )
            link = exam_links.get(raw_row_ref)
            exam = exam_targets.get(link.target_id) if link else None
            if exam is None:
                exam = OpticalExam(**payload)
                db.add(exam)
                if link is None:
                    counters.created += 1
                else:
                    counters.recreated += 1
            else:
                apply_payload(exam, payload)
                counters.updated += 1
            pending.append(
                {
                    "seed": seed,
                    "client_id": client_id,
                    "user_id": user_id,
                    "exam": exam,
                    "exam_payload": payload,
                    "exam_link": link,
                    "instance_link": instance_links.get(raw_row_ref),
                    "instance": instance_targets.get(instance_links[raw_row_ref].target_id)
                    if raw_row_ref in instance_links
                    else None,
                }
            )
        if not pending:
            continue
        db.flush()
        for item in pending:
            instance_payload = {
                "exam_id": item["exam"].id,
                "layout_id": layout_id,
                "is_active": True,
                "order": 0,
                "layout_data": layout_data,
                "exam_data": {},
            }
            instance = item["instance"]
            if instance is None:
                instance = ExamLayoutInstance(**instance_payload)
                db.add(instance)
            else:
                apply_payload(instance, instance_payload)
            item["instance"] = instance
            item["instance_payload"] = instance_payload
        db.flush()
        for item in pending:
            seed = item["seed"]
            instance = item["instance"]
            instance.exam_data = build_glasses_exam_data(seed, layout_instance_id=instance.id)
            instance.layout_data = build_instance_layout_data(GLASSES_COMPONENTS, instance.exam_data)
            exam_trace_payload = build_trace_payload(
                seed,
                item["exam_payload"],
                {
                    "client_target_id": item["client_id"],
                    "user_target_id": item["user_id"],
                },
            )
            saved_exam_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="OpticalExam",
                target_id=item["exam"].id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload=exam_trace_payload,
                migration_job_id=migration_job_id,
                existing_link=item["exam_link"],
            )
            exam_links[saved_exam_link.raw_row_ref] = saved_exam_link
            instance_trace_payload = build_trace_payload(
                seed,
                {
                    **item["instance_payload"],
                    "layout_data": instance.layout_data,
                    "exam_data": instance.exam_data,
                },
                {
                    "client_target_id": item["client_id"],
                    "user_target_id": item["user_id"],
                },
            )
            saved_instance_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="ExamLayoutInstance",
                target_id=instance.id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload=instance_trace_payload,
                migration_job_id=migration_job_id,
                existing_link=item["instance_link"],
            )
            instance_links[saved_instance_link.raw_row_ref] = saved_instance_link
            exact_key = build_order_exact_key(seed.source_per_id, seed.check_date)
            if exact_key is not None:
                match_index[exact_key] = build_glasses_order_match(seed)
        db.flush()
        if commit_each_batch:
            db.commit()
    return counters, skipped_rows, unresolved_dependencies, match_index


def upsert_contact_lens_exams(
    db: Session,
    *,
    seeds: Iterable[NormalizedContactLensExamSeed],
    clinic: Clinic,
    client_map: Mapping[int, int],
    user_map: Mapping[int, int],
    layout_id: int,
    layout_data: str,
    catalog: LookupCatalog,
    unmapped_report: Dict[str, Dict[str, Dict[str, Any]]],
    migration_job_id: Optional[str] = None,
    commit_each_batch: bool = False,
) -> Tuple[DomainCounters, List[Dict[str, Any]], List[Dict[str, Any]], Dict[Tuple[int, str], ContactLensOrderMatch]]:
    counters = DomainCounters()
    skipped_rows: List[Dict[str, Any]] = []
    unresolved_dependencies: List[Dict[str, Any]] = []
    match_index: Dict[Tuple[int, str], ContactLensOrderMatch] = {}
    exam_links = load_trace_links(
        db,
        clinic_id=clinic.id,
        target_model="OpticalExam",
        source_table="tblCrdClensChecks",
    )
    instance_links = load_trace_links(
        db,
        clinic_id=clinic.id,
        target_model="ExamLayoutInstance",
        source_table="tblCrdClensChecks",
    )

    for seed_batch in iter_batches(seeds, DOMAIN_BATCH_SIZES["contact_lens_exams"]):
        exam_targets = load_target_rows(
            db,
            target_model="OpticalExam",
            target_ids=[
                exam_links[seed.source_ref.raw_row_ref].target_id
                for seed in seed_batch
                if seed.source_ref.raw_row_ref in exam_links
            ],
        )
        instance_targets = load_target_rows(
            db,
            target_model="ExamLayoutInstance",
            target_ids=[
                instance_links[seed.source_ref.raw_row_ref].target_id
                for seed in seed_batch
                if seed.source_ref.raw_row_ref in instance_links
            ],
        )
        pending: List[Dict[str, Any]] = []
        for seed in seed_batch:
            counters.processed += 1
            raw_row_ref = seed.source_ref.raw_row_ref
            if raw_row_ref is None or seed.source_per_id is None or seed.source_per_id not in client_map:
                counters.skipped += 1
                record_skip(
                    skipped_rows,
                    domain="contact_lens_exams",
                    reason="missing_phase2_client_mapping",
                    raw_row_ref=raw_row_ref,
                    source_per_id=seed.source_per_id,
                    source_user_id=seed.source_user_id,
                )
                continue
            client_id = client_map[seed.source_per_id]
            user_id = resolve_user_target_id(
                source_user_id=seed.source_user_id,
                user_map=user_map,
                unresolved_dependencies=unresolved_dependencies,
                domain="contact_lens_exams",
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
            )
            payload = {
                "client_id": client_id,
                "clinic_id": clinic.id,
                "clinic": clinic.name,
                "user_id": user_id,
                "exam_date": seed.check_date,
                "test_name": "OptiTech Contact Lens Exam",
                "dominant_eye": None,
                "type": "opticlens",
            }
            record_unmapped_values(
                unmapped_report,
                domain="contact_lens_exams",
                values={
                    "source_user_id": seed.source_user_id,
                    "pr_right": seed.lens_values.get("r_pr"),
                    "pr_left": seed.lens_values.get("l_pr"),
                    "eye_lid_key": seed.tear_metrics.get("eye_lid_key"),
                    "eye_color": seed.tear_metrics.get("eye_color"),
                },
            )
            link = exam_links.get(raw_row_ref)
            exam = exam_targets.get(link.target_id) if link else None
            if exam is None:
                exam = OpticalExam(**payload)
                db.add(exam)
                if link is None:
                    counters.created += 1
                else:
                    counters.recreated += 1
            else:
                apply_payload(exam, payload)
                counters.updated += 1
            pending.append(
                {
                    "seed": seed,
                    "client_id": client_id,
                    "user_id": user_id,
                    "exam": exam,
                    "exam_payload": payload,
                    "exam_link": link,
                    "instance_link": instance_links.get(raw_row_ref),
                    "instance": instance_targets.get(instance_links[raw_row_ref].target_id)
                    if raw_row_ref in instance_links
                    else None,
                }
            )
        if not pending:
            continue
        db.flush()
        for item in pending:
            instance_payload = {
                "exam_id": item["exam"].id,
                "layout_id": layout_id,
                "is_active": True,
                "order": 0,
                "layout_data": layout_data,
                "exam_data": {},
            }
            instance = item["instance"]
            if instance is None:
                instance = ExamLayoutInstance(**instance_payload)
                db.add(instance)
            else:
                apply_payload(instance, instance_payload)
            item["instance"] = instance
            item["instance_payload"] = instance_payload
        db.flush()
        for item in pending:
            seed = item["seed"]
            instance = item["instance"]
            instance.exam_data = build_contact_lens_exam_data(
                seed,
                layout_instance_id=instance.id,
                catalog=catalog,
                clinic_name=clinic.name,
                unresolved_dependencies=unresolved_dependencies,
            )
            instance.layout_data = build_instance_layout_data(CONTACT_LENS_COMPONENTS, instance.exam_data)
            exam_trace_payload = build_trace_payload(
                seed,
                item["exam_payload"],
                {
                    "client_target_id": item["client_id"],
                    "user_target_id": item["user_id"],
                },
            )
            saved_exam_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="OpticalExam",
                target_id=item["exam"].id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload=exam_trace_payload,
                migration_job_id=migration_job_id,
                existing_link=item["exam_link"],
            )
            exam_links[saved_exam_link.raw_row_ref] = saved_exam_link
            instance_trace_payload = build_trace_payload(
                seed,
                {
                    **item["instance_payload"],
                    "layout_data": instance.layout_data,
                    "exam_data": instance.exam_data,
                },
                {
                    "client_target_id": item["client_id"],
                    "user_target_id": item["user_id"],
                },
            )
            saved_instance_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="ExamLayoutInstance",
                target_id=instance.id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload=instance_trace_payload,
                migration_job_id=migration_job_id,
                existing_link=item["instance_link"],
            )
            instance_links[saved_instance_link.raw_row_ref] = saved_instance_link
            exact_key = build_order_exact_key(seed.source_per_id, seed.check_date)
            if exact_key is not None:
                match_index[exact_key] = build_contact_lens_order_match(
                    seed,
                    catalog=catalog,
                    clinic_name=clinic.name,
                    unresolved_dependencies=unresolved_dependencies,
                    domain="orders",
                )
        db.flush()
        if commit_each_batch:
            db.commit()
    return counters, skipped_rows, unresolved_dependencies, match_index


def upsert_orders(
    db: Session,
    *,
    seeds: Iterable[NormalizedOrderSeed],
    clinic: Clinic,
    client_map: Mapping[int, int],
    user_map: Mapping[int, int],
    catalog: LookupCatalog,
    glasses_matches: Mapping[Tuple[int, str], GlassesOrderMatch],
    contact_lens_matches: Mapping[Tuple[int, str], ContactLensOrderMatch],
    unmapped_report: Dict[str, Dict[str, Dict[str, Any]]],
    migration_job_id: Optional[str] = None,
    commit_each_batch: bool = False,
) -> Tuple[DomainCounters, List[Dict[str, Any]], List[Dict[str, Any]]]:
    counters = DomainCounters()
    skipped_rows: List[Dict[str, Any]] = []
    unresolved_dependencies: List[Dict[str, Any]] = []
    order_links = load_trace_links(db, clinic_id=clinic.id, target_model="Order")
    contact_order_links = load_trace_links(db, clinic_id=clinic.id, target_model="ContactLensOrder")

    for seed_batch in iter_batches(seeds, DOMAIN_BATCH_SIZES["orders"]):
        order_targets = load_target_rows(
            db,
            target_model="Order",
            target_ids=[
                order_links[seed.source_ref.raw_row_ref].target_id
                for seed in seed_batch
                if seed.source_ref.raw_row_ref in order_links
            ],
        )
        contact_targets = load_target_rows(
            db,
            target_model="ContactLensOrder",
            target_ids=[
                contact_order_links[seed.source_ref.raw_row_ref].target_id
                for seed in seed_batch
                if seed.source_ref.raw_row_ref in contact_order_links
            ],
        )
        pending: List[Dict[str, Any]] = []
        for seed in seed_batch:
            counters.processed += 1
            raw_row_ref = seed.source_ref.raw_row_ref
            if raw_row_ref is None or seed.source_per_id is None or seed.source_per_id not in client_map:
                counters.skipped += 1
                record_skip(
                    skipped_rows,
                    domain="orders",
                    reason="missing_phase2_client_mapping",
                    raw_row_ref=raw_row_ref,
                    source_per_id=seed.source_per_id,
                    source_user_id=seed.source_user_id,
                )
                continue
            client_id = client_map[seed.source_per_id]
            user_id = resolve_user_target_id(
                source_user_id=seed.source_user_id,
                user_map=user_map,
                unresolved_dependencies=unresolved_dependencies,
                domain="orders",
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
            )
            target_model, order_type = classify_work_type(
                seed.work_type_id,
                catalog,
                unresolved_dependencies=unresolved_dependencies,
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
            )
            exact_key = build_order_exact_key(seed.source_per_id, seed.related_exam_date)
            matched_glasses = glasses_matches.get(exact_key) if exact_key else None
            matched_contact = contact_lens_matches.get(exact_key) if exact_key else None
            if target_model == "Order":
                order_data, unmapped_fields = build_regular_order_data(
                    seed,
                    catalog=catalog,
                    clinic_name=clinic.name,
                    unresolved_dependencies=unresolved_dependencies,
                    matched_exam=matched_glasses,
                )
                payload = {
                    "client_id": client_id,
                    "clinic_id": clinic.id,
                    "order_date": seed.work_date,
                    "type": order_type,
                    "dominant_eye": matched_glasses.dominant_eye if matched_glasses else None,
                    "user_id": user_id,
                    "lens_id": None,
                    "frame_id": None,
                    "order_data": order_data,
                }
                link = order_links.get(raw_row_ref)
                target = order_targets.get(link.target_id) if link else None
            else:
                payload, order_data, unmapped_fields = build_contact_lens_order_payloads(
                    seed,
                    clinic=clinic,
                    catalog=catalog,
                    unresolved_dependencies=unresolved_dependencies,
                    matched_exam=matched_contact,
                )
                payload["client_id"] = client_id
                payload["user_id"] = user_id
                link = contact_order_links.get(raw_row_ref)
                target = contact_targets.get(link.target_id) if link else None
                if matched_contact is None:
                    record_unresolved(
                        unresolved_dependencies,
                        domain="orders",
                        dependency="contact_lens_exam_exact_match",
                        raw_row_ref=raw_row_ref,
                        source_per_id=seed.source_per_id,
                        source_user_id=seed.source_user_id,
                        source_value=iso_date(seed.related_exam_date),
                    )
            if target_model == "Order" and matched_glasses is None and seed.related_exam_date is not None:
                record_unresolved(
                    unresolved_dependencies,
                    domain="orders",
                    dependency="glasses_exam_exact_match",
                    raw_row_ref=raw_row_ref,
                    source_per_id=seed.source_per_id,
                    source_user_id=seed.source_user_id,
                    source_value=iso_date(seed.related_exam_date),
                )
            record_unmapped_values(
                unmapped_report,
                domain="orders",
                values={
                    "source_user_id": seed.source_user_id,
                    **unmapped_fields,
                },
            )
            if target is None:
                target = Order(**payload) if target_model == "Order" else ContactLensOrder(**payload)
                db.add(target)
                if link is None:
                    counters.created += 1
                else:
                    counters.recreated += 1
            else:
                apply_payload(target, payload)
                counters.updated += 1
            pending.append(
                {
                    "seed": seed,
                    "target_model": target_model,
                    "target": target,
                    "payload": payload,
                    "link": link,
                    "client_id": client_id,
                    "user_id": user_id,
                    "matched_exam_ref": matched_glasses.source_ref if matched_glasses else None,
                    "matched_contact_ref": matched_contact.source_ref if matched_contact else None,
                }
            )
        if not pending:
            continue
        db.flush()
        for item in pending:
            seed = item["seed"]
            trace_payload = build_trace_payload(
                seed,
                item["payload"],
                {
                    "client_target_id": item["client_id"],
                    "user_target_id": item["user_id"],
                    "matched_glasses_exam_source_ref": item["matched_exam_ref"],
                    "matched_contact_lens_exam_source_ref": item["matched_contact_ref"],
                },
            )
            saved_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model=item["target_model"],
                target_id=item["target"].id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload=trace_payload,
                migration_job_id=migration_job_id,
                existing_link=item["link"],
            )
            if item["target_model"] == "Order":
                order_links[saved_link.raw_row_ref] = saved_link
            else:
                contact_order_links[saved_link.raw_row_ref] = saved_link
        db.flush()
        if commit_each_batch:
            db.commit()
    return counters, skipped_rows, unresolved_dependencies


def upsert_files(
    db: Session,
    *,
    seeds: Iterable[NormalizedFileSeed],
    clinic: Clinic,
    client_map: Mapping[int, int],
    user_map: Mapping[int, int],
    unmapped_report: Dict[str, Dict[str, Dict[str, Any]]],
    dry_run: bool,
    storage: Optional[Any] = None,
    commit_each_batch: bool = False,
) -> Tuple[DomainCounters, List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    counters = DomainCounters()
    skipped_rows: List[Dict[str, Any]] = []
    unresolved_dependencies: List[Dict[str, Any]] = []
    missing_scans: List[Dict[str, Any]] = []
    file_links = load_trace_links(db, clinic_id=clinic.id, target_model="File")

    for seed_batch in iter_batches(seeds, DOMAIN_BATCH_SIZES["files"]):
        file_targets = load_target_rows(
            db,
            target_model="File",
            target_ids=[
                file_links[seed.source_ref.raw_row_ref].target_id
                for seed in seed_batch
                if seed.source_ref.raw_row_ref in file_links
            ],
        )
        pending: List[Dict[str, Any]] = []
        for seed in seed_batch:
            counters.processed += 1
            raw_row_ref = seed.source_ref.raw_row_ref
            if raw_row_ref is None or seed.source_per_id is None or seed.source_per_id not in client_map:
                counters.skipped += 1
                record_skip(
                    skipped_rows,
                    domain="files",
                    reason="missing_phase2_client_mapping",
                    raw_row_ref=raw_row_ref,
                    source_per_id=seed.source_per_id,
                    source_user_id=seed.source_user_id,
                )
                continue
            if not seed.scan_exists:
                counters.skipped += 1
                missing_scans.append(
                    {
                        "domain": "files",
                        "raw_row_ref": raw_row_ref,
                        "source_per_id": seed.source_per_id,
                        "legacy_file_id": seed.legacy_file_id,
                        "source_scan_path": seed.scan_path,
                    }
                )
                continue
            client_id = client_map[seed.source_per_id]
            uploaded_by = resolve_user_target_id(
                source_user_id=seed.source_user_id,
                user_map=user_map,
                unresolved_dependencies=unresolved_dependencies,
                domain="files",
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
            )
            storage_bucket, storage_key, file_size, file_type = store_scan_if_needed(
                clinic_id=clinic.id,
                seed=seed,
                dry_run=dry_run,
                storage=storage,
            )
            if storage_key is None:
                counters.skipped += 1
                missing_scans.append(
                    {
                        "domain": "files",
                        "raw_row_ref": raw_row_ref,
                        "source_per_id": seed.source_per_id,
                        "legacy_file_id": seed.legacy_file_id,
                        "source_scan_path": seed.scan_path,
                    }
                )
                continue
            payload = {
                "client_id": client_id,
                "clinic_id": clinic.id,
                "file_name": seed.file_name or f"optitech-file-{seed.legacy_file_id}",
                "original_file_name": seed.file_name,
                "storage_bucket": storage_bucket,
                "storage_key": storage_key,
                "file_size": file_size,
                "file_type": file_type,
                "upload_date": seed.scan_datetime,
                "uploaded_by": uploaded_by,
                "notes": build_file_notes(seed),
            }
            record_unmapped_values(
                unmapped_report,
                domain="files",
                values={
                    "source_user_id": seed.source_user_id,
                    "source_scan_path": seed.scan_path,
                },
            )
            link = file_links.get(raw_row_ref)
            target = file_targets.get(link.target_id) if link else None
            if target is None:
                target = File(**payload)
                db.add(target)
                if link is None:
                    counters.created += 1
                else:
                    counters.recreated += 1
            else:
                apply_payload(target, payload)
                counters.updated += 1
            pending.append(
                {
                    "seed": seed,
                    "target": target,
                    "payload": payload,
                    "link": link,
                    "client_id": client_id,
                    "uploaded_by": uploaded_by,
                    "storage_bucket": storage_bucket,
                    "storage_key": storage_key,
                }
            )
        if not pending:
            continue
        db.flush()
        for item in pending:
            seed = item["seed"]
            trace_payload = build_trace_payload(
                seed,
                item["payload"],
                {
                    "client_target_id": item["client_id"],
                    "user_target_id": item["uploaded_by"],
                    "source_scan_path": seed.scan_path,
                    "storage_bucket": item["storage_bucket"],
                    "storage_key": item["storage_key"],
                },
            )
            saved_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="File",
                target_id=item["target"].id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload=trace_payload,
                existing_link=item["link"],
            )
            file_links[saved_link.raw_row_ref] = saved_link
        db.flush()
        if commit_each_batch:
            db.commit()
    return counters, skipped_rows, unresolved_dependencies, missing_scans


def upsert_medical_notes(
    db: Session,
    *,
    seeds: Iterable[NormalizedMedicalNoteSeed],
    clinic: Clinic,
    client_map: Mapping[int, int],
    user_map: Mapping[int, int],
    unmapped_report: Dict[str, Dict[str, Dict[str, Any]]],
    commit_each_batch: bool = False,
) -> Tuple[DomainCounters, List[Dict[str, Any]], List[Dict[str, Any]]]:
    counters = DomainCounters()
    skipped_rows: List[Dict[str, Any]] = []
    unresolved_dependencies: List[Dict[str, Any]] = []
    links = load_trace_links(db, clinic_id=clinic.id, target_model="MedicalLog")

    for seed_batch in iter_batches(seeds, DOMAIN_BATCH_SIZES["medical_notes"]):
        targets = load_target_rows(
            db,
            target_model="MedicalLog",
            target_ids=[
                links[seed.source_ref.raw_row_ref].target_id
                for seed in seed_batch
                if seed.source_ref.raw_row_ref in links
            ],
        )
        pending: List[Dict[str, Any]] = []
        for seed in seed_batch:
            counters.processed += 1
            raw_row_ref = seed.source_ref.raw_row_ref
            if raw_row_ref is None or seed.source_per_id is None or seed.source_per_id not in client_map:
                counters.skipped += 1
                record_skip(
                    skipped_rows,
                    domain="medical_notes",
                    reason="missing_phase2_client_mapping",
                    raw_row_ref=raw_row_ref,
                    source_per_id=seed.source_per_id,
                    source_user_id=seed.source_user_id,
                )
                continue
            log_text = build_medical_log_text(seed)
            if not log_text:
                counters.skipped += 1
                record_skip(
                    skipped_rows,
                    domain="medical_notes",
                    reason="empty_medical_note",
                    raw_row_ref=raw_row_ref,
                    source_per_id=seed.source_per_id,
                    source_user_id=seed.source_user_id,
                )
                continue
            client_id = client_map[seed.source_per_id]
            user_id = resolve_user_target_id(
                source_user_id=seed.source_user_id,
                user_map=user_map,
                unresolved_dependencies=unresolved_dependencies,
                domain="medical_notes",
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
            )
            payload = {
                "client_id": client_id,
                "clinic_id": clinic.id,
                "user_id": user_id,
                "log_date": seed.check_date,
                "log": log_text,
            }
            record_unmapped_values(
                unmapped_report,
                domain="medical_notes",
                values={"source_user_id": seed.source_user_id},
            )
            link = links.get(raw_row_ref)
            target = targets.get(link.target_id) if link else None
            if target is None:
                target = MedicalLog(**payload)
                db.add(target)
                if link is None:
                    counters.created += 1
                else:
                    counters.recreated += 1
            else:
                apply_payload(target, payload)
                counters.updated += 1
            pending.append(
                {
                    "seed": seed,
                    "target": target,
                    "payload": payload,
                    "link": link,
                    "client_id": client_id,
                    "user_id": user_id,
                }
            )
        if not pending:
            continue
        db.flush()
        for item in pending:
            seed = item["seed"]
            trace_payload = build_trace_payload(
                seed,
                item["payload"],
                {
                    "client_target_id": item["client_id"],
                    "user_target_id": item["user_id"],
                },
            )
            saved_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="MedicalLog",
                target_id=item["target"].id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload=trace_payload,
                existing_link=item["link"],
            )
            links[saved_link.raw_row_ref] = saved_link
        db.flush()
        if commit_each_batch:
            db.commit()
    return counters, skipped_rows, unresolved_dependencies


def upsert_appointments(
    db: Session,
    *,
    seeds: Iterable[NormalizedAppointmentSeed],
    clinic: Clinic,
    client_map: Mapping[int, int],
    user_map: Mapping[int, int],
    unmapped_report: Dict[str, Dict[str, Dict[str, Any]]],
    commit_each_batch: bool = False,
) -> Tuple[DomainCounters, List[Dict[str, Any]], List[Dict[str, Any]]]:
    counters = DomainCounters()
    skipped_rows: List[Dict[str, Any]] = []
    unresolved_dependencies: List[Dict[str, Any]] = []
    links = load_trace_links(db, clinic_id=clinic.id, target_model="Appointment")

    for seed_batch in iter_batches(seeds, DOMAIN_BATCH_SIZES["appointments"]):
        targets = load_target_rows(
            db,
            target_model="Appointment",
            target_ids=[
                links[seed.source_ref.raw_row_ref].target_id
                for seed in seed_batch
                if seed.source_ref.raw_row_ref in links
            ],
        )
        pending: List[Dict[str, Any]] = []
        for seed in seed_batch:
            counters.processed += 1
            raw_row_ref = seed.source_ref.raw_row_ref
            if raw_row_ref is None or seed.source_per_id is None or seed.source_per_id not in client_map:
                counters.skipped += 1
                record_skip(
                    skipped_rows,
                    domain="appointments",
                    reason="missing_phase2_client_mapping",
                    raw_row_ref=raw_row_ref,
                    source_per_id=seed.source_per_id,
                    source_user_id=seed.source_user_id,
                )
                continue
            client_id = client_map[seed.source_per_id]
            user_id = resolve_user_target_id(
                source_user_id=seed.source_user_id,
                user_map=user_map,
                unresolved_dependencies=unresolved_dependencies,
                domain="appointments",
                raw_row_ref=raw_row_ref,
                source_per_id=seed.source_per_id,
            )
            note = build_notes_text(
                (
                    ("End Time", seed.end_time),
                    ("Took Place", str(seed.took_place) if seed.took_place is not None else None),
                    ("Reminder", str(seed.reminder) if seed.reminder is not None else None),
                )
            )
            payload = {
                "client_id": client_id,
                "clinic_id": clinic.id,
                "user_id": user_id,
                "date": seed.appointment_date,
                "time": seed.start_time,
                "duration": calculate_appointment_duration_minutes(seed.start_time, seed.end_time),
                "exam_name": seed.description or "OptiTech Appointment",
                "note": note,
                "google_calendar_event_id": None,
            }
            record_unmapped_values(
                unmapped_report,
                domain="appointments",
                values={"source_user_id": seed.source_user_id},
            )
            link = links.get(raw_row_ref)
            target = targets.get(link.target_id) if link else None
            if target is None:
                target = Appointment(**payload)
                db.add(target)
                if link is None:
                    counters.created += 1
                else:
                    counters.recreated += 1
            else:
                apply_payload(target, payload)
                counters.updated += 1
            pending.append(
                {
                    "seed": seed,
                    "target": target,
                    "payload": payload,
                    "link": link,
                    "client_id": client_id,
                    "user_id": user_id,
                }
            )
        if not pending:
            continue
        db.flush()
        for item in pending:
            seed = item["seed"]
            trace_payload = build_trace_payload(
                seed,
                item["payload"],
                {
                    "client_target_id": item["client_id"],
                    "user_target_id": item["user_id"],
                },
            )
            saved_link = upsert_source_link(
                db,
                source_ref=seed.source_ref,
                source_per_id=seed.source_per_id,
                source_user_id=seed.source_user_id,
                target_model="Appointment",
                target_id=item["target"].id,
                clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload=trace_payload,
                existing_link=item["link"],
            )
            links[saved_link.raw_row_ref] = saved_link
        db.flush()
        if commit_each_batch:
            db.commit()
    return counters, skipped_rows, unresolved_dependencies


def execute_phase3(
    *,
    target_clinic_id: int,
    dry_run: bool = False,
    domains: Optional[Sequence[str]] = None,
    report_dir: Optional[Path] = None,
    storage: Optional[Any] = None,
    migration_job_id: Optional[str] = None,
) -> Dict[str, Any]:
    try:
        from database import SessionLocal
    except ModuleNotFoundError:
        from backend.database import SessionLocal
    selected_domains = tuple(domains) if domains else PHASE3_DOMAINS
    report_dir = report_dir or default_report_dir()
    db = SessionLocal()
    try:
        db.execute(text("SET statement_timeout TO 0"))
        clinic = resolve_target_binding(db, target_clinic_id)
        ensure_lookup_extracts()
        catalog = load_lookup_catalog()
        client_map = load_phase2_client_identity_map(db, clinic_id=clinic.id)
        user_map = load_phase2_user_identity_map(db, clinic_id=clinic.id)
        glasses_layout, contact_lens_layout = ensure_phase3_exam_layouts(db, clinic)

        summary: Dict[str, Any] = {
            "source_system": OPTITECH_SOURCE_SYSTEM,
            "target_clinic_id": clinic.id,
            "target_company_id": clinic.company_id,
            "dry_run": dry_run,
            "domains": list(selected_domains),
        }
        skipped_rows: List[Dict[str, Any]] = []
        unresolved_dependencies: List[Dict[str, Any]] = []
        missing_scans: List[Dict[str, Any]] = []
        unmapped_report = create_unmapped_field_report()
        glasses_matches: Dict[Tuple[int, str], GlassesOrderMatch] = {}
        contact_lens_matches: Dict[Tuple[int, str], ContactLensOrderMatch] = {}

        if "glasses_exams" in selected_domains:
            counters, domain_skips, domain_unresolved, glasses_matches = upsert_glasses_exams(
                db,
                seeds=iter_glasses_exam_seeds(),
                clinic=clinic,
                client_map=client_map,
                user_map=user_map,
                layout_id=glasses_layout.id,
                layout_data=glasses_layout.layout_data,
                unmapped_report=unmapped_report,
                migration_job_id=migration_job_id,
                commit_each_batch=not dry_run,
            )
            summary["glasses_exams"] = counters.as_dict()
            skipped_rows.extend(domain_skips)
            unresolved_dependencies.extend(domain_unresolved)
            if not dry_run:
                db.commit()
        if "contact_lens_exams" in selected_domains:
            counters, domain_skips, domain_unresolved, contact_lens_matches = upsert_contact_lens_exams(
                db,
                seeds=iter_contact_lens_exam_seeds(),
                clinic=clinic,
                client_map=client_map,
                user_map=user_map,
                layout_id=contact_lens_layout.id,
                layout_data=contact_lens_layout.layout_data,
                catalog=catalog,
                unmapped_report=unmapped_report,
                migration_job_id=migration_job_id,
                commit_each_batch=not dry_run,
            )
            summary["contact_lens_exams"] = counters.as_dict()
            skipped_rows.extend(domain_skips)
            unresolved_dependencies.extend(domain_unresolved)
            if not dry_run:
                db.commit()
        if "orders" in selected_domains:
            if not glasses_matches:
                glasses_matches = build_glasses_match_index_from_source(iter_glasses_exam_seeds())
            if not contact_lens_matches:
                contact_lens_matches = build_contact_lens_match_index_from_source(
                    iter_contact_lens_exam_seeds(),
                    catalog=catalog,
                    clinic_name=clinic.name,
                )
            counters, domain_skips, domain_unresolved = upsert_orders(
                db,
                seeds=iter_order_seeds(),
                clinic=clinic,
                client_map=client_map,
                user_map=user_map,
                catalog=catalog,
                glasses_matches=glasses_matches,
                contact_lens_matches=contact_lens_matches,
                unmapped_report=unmapped_report,
                migration_job_id=migration_job_id,
                commit_each_batch=not dry_run,
            )
            summary["orders"] = counters.as_dict()
            skipped_rows.extend(domain_skips)
            unresolved_dependencies.extend(domain_unresolved)
            if not dry_run:
                db.commit()
        if "files" in selected_domains:
            counters, domain_skips, domain_unresolved, domain_missing_scans = upsert_files(
                db,
                seeds=iter_file_seeds(),
                clinic=clinic,
                client_map=client_map,
                user_map=user_map,
                unmapped_report=unmapped_report,
                dry_run=dry_run,
                storage=storage,
                commit_each_batch=not dry_run,
            )
            summary["files"] = counters.as_dict()
            skipped_rows.extend(domain_skips)
            unresolved_dependencies.extend(domain_unresolved)
            missing_scans.extend(domain_missing_scans)
            if not dry_run:
                db.commit()
        if "medical_notes" in selected_domains:
            counters, domain_skips, domain_unresolved = upsert_medical_notes(
                db,
                seeds=iter_medical_note_seeds(),
                clinic=clinic,
                client_map=client_map,
                user_map=user_map,
                unmapped_report=unmapped_report,
                commit_each_batch=not dry_run,
            )
            summary["medical_notes"] = counters.as_dict()
            skipped_rows.extend(domain_skips)
            unresolved_dependencies.extend(domain_unresolved)
            if not dry_run:
                db.commit()
        if "appointments" in selected_domains:
            counters, domain_skips, domain_unresolved = upsert_appointments(
                db,
                seeds=iter_appointment_seeds(),
                clinic=clinic,
                client_map=client_map,
                user_map=user_map,
                unmapped_report=unmapped_report,
                commit_each_batch=not dry_run,
            )
            summary["appointments"] = counters.as_dict()
            skipped_rows.extend(domain_skips)
            unresolved_dependencies.extend(domain_unresolved)
            if not dry_run:
                db.commit()

        if not dry_run and PRESCRIPTION_INDEX_DOMAINS.intersection(selected_domains):
            summary["prescription_index"] = rebuild_clinic_prescription_search_index(
                db,
                clinic.id,
                commit_each_batch=True,
            )

        summary["skipped_rows_count"] = len(skipped_rows)
        summary["unresolved_dependencies_count"] = len(unresolved_dependencies)
        summary["missing_scans_count"] = len(missing_scans)
        unmapped_source_fields = finalize_unmapped_field_report(unmapped_report)
        if dry_run:
            db.rollback()
        report_paths = write_phase3_reports(
            report_dir=report_dir,
            summary=summary,
            skipped_rows=skipped_rows,
            unresolved_dependencies=unresolved_dependencies,
            missing_scans=missing_scans,
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
        db.close()


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    result = execute_phase3(
        target_clinic_id=args.target_clinic_id,
        dry_run=args.dry_run,
        domains=args.domains,
        report_dir=args.report_dir,
    )
    print(f"phase3 summary: {result['summary']}")
    for name, path in result["report_paths"].items():
        print(f"{name}: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
