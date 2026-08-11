import sys
import os
import csv
import json
import re
import uuid
import hashlib
import mimetypes
from datetime import datetime, timedelta, timezone
import time
from typing import Dict, Optional, Any, List, Tuple, Iterator, Generator, Set
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# Ensure both project root and backend folder are importable regardless of CWD
_BASE_DIR = os.path.dirname(__file__)
_BACKEND_DIR = os.path.abspath(os.path.join(_BASE_DIR, '..'))
_PROJECT_ROOT = os.path.abspath(os.path.join(_BASE_DIR, '..', '..'))
for _p in (_PROJECT_ROOT, _BACKEND_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Allow very large CSV fields from legacy exports
try:
    csv.field_size_limit(sys.maxsize)
except Exception:
    pass

from sqlalchemy.orm import Session
from sqlalchemy import select, text, func

from database import SessionLocal
from models import (
    Company,
    Clinic,
    User,
    Family,
    Client,
    MedicalLog,
    OpticalExam,
    ExamLayout,
    ExamLayoutInstance,
    ContactLensOrder,
    Referral,
    File,
    Appointment,
    Billing,
    BillingPayment,
    OrderLineItem,
    Order,
    LookupSupplier,
    LookupClinic,
    LookupOrderType,
    LookupReferralType,
    LookupLensModel,
    LookupColor,
    LookupMaterial,
    LookupCoating,
    LookupManufacturer,
    LookupFrameModel,
    LookupContactLensType,
    LookupContactEyeLensType,
    LookupContactEyeMaterial,
    LookupCleaningSolution,
    LookupDisinfectionSolution,
    LookupRinsingSolution,
    MigrationSourceLink,
)
from services.lookup_defaults import seed_default_lookup_values_for_clinic


# ------------------------------
# Utility helpers
# ------------------------------

MIGRATED_FILES_DIR = os.environ.get(
    "LEGACY_FILES_OUTPUT_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "migrated_files")),
)


def _source_snapshot_json(value: Any) -> Any:
    """Return a JSON-safe copy of a parsed source row without normalization."""
    if isinstance(value, dict):
        return {str(key): _source_snapshot_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_source_snapshot_json(item) for item in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _source_snapshot_hash(payload: Dict[str, Any]) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def source_row_ref(
    *,
    source_table: str,
    source_row: Dict[str, Any],
    identifier_fields: Tuple[str, ...] = (),
    row_number: Optional[int] = None,
) -> str:
    """Build the stable source identifier used by migration trace links."""
    raw_payload = _source_snapshot_json(dict(source_row))
    primary_key_parts = [
        [field, str(source_row.get(field) or "")]
        for field in identifier_fields
        if source_row.get(field) not in (None, "")
    ]
    if not primary_key_parts:
        primary_key_parts = [["row_sha256", _source_snapshot_hash(raw_payload)]]
    if row_number is not None:
        primary_key_parts.append(["row_number", str(row_number)])
    return f"{source_table}:" + ":".join(
        f"{field}={value}" for field, value in primary_key_parts
    )


def existing_job_source_refs(
    db: Session,
    trace_context: Optional[Dict[str, Any]],
    *,
    target_model: str,
    source_tables: Tuple[str, ...],
) -> Set[str]:
    """Return rows already persisted by this job, for safe idempotent resume."""
    if not trace_context:
        return set()
    return {
        raw_row_ref
        for (raw_row_ref,) in db.query(MigrationSourceLink.raw_row_ref).filter(
            MigrationSourceLink.source_system == trace_context["source_system"],
            MigrationSourceLink.migration_job_id == trace_context["migration_job_id"],
            MigrationSourceLink.target_model == target_model,
            MigrationSourceLink.source_table.in_(source_tables),
        )
    }


def record_raw_source_link(
    db: Session,
    trace_context: Optional[Dict[str, Any]],
    *,
    target_model: str,
    target_id: int,
    clinic_id: Optional[int],
    source_table: str,
    source_row: Dict[str, Any],
    identifier_fields: Tuple[str, ...] = (),
    row_number: Optional[int] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    """Store the exact parsed input row that created a migrated record."""
    if not trace_context or target_id is None or clinic_id is None:
        return

    raw_payload = _source_snapshot_json(dict(source_row))
    primary_key_parts = [
        [field, str(source_row.get(field) or "")]
        for field in identifier_fields
        if source_row.get(field) not in (None, "")
    ]
    if not primary_key_parts:
        primary_key_parts = [["row_sha256", _source_snapshot_hash(raw_payload)]]
    if row_number is not None:
        primary_key_parts.append(["row_number", str(row_number)])
    raw_row_ref = source_row_ref(
        source_table=source_table,
        source_row=source_row,
        identifier_fields=identifier_fields,
        row_number=row_number,
    )

    db.add(
        MigrationSourceLink(
            source_system=trace_context["source_system"],
            source_table=source_table,
            raw_row_ref=raw_row_ref,
            source_primary_key_parts=primary_key_parts,
            target_model=target_model,
            target_id=target_id,
            clinic_id=clinic_id,
            company_id=trace_context["company_id"],
            migration_job_id=trace_context["migration_job_id"],
            raw_payload=raw_payload,
            raw_payload_sha256=_source_snapshot_hash(raw_payload),
            raw_captured_at=datetime.now(timezone.utc),
            payload=payload or {"job_id": trace_context["migration_job_id"]},
        )
    )

MIGRATED_LAYOUT_COMPONENTS: List[str] = [
    "old-ref",
    "old-refraction",
    "old-refraction-extension",
    "objective",
    "subjective",
    "addition",
    "final-subjective",
    "final-prescription",
    "compact-prescription",
    "retinoscop",
    "retinoscop-dilation",
    "uncorrected-va",
    "keratometer",
    "keratometer-full",
    "corneal-topography",
    "cover-test-v2",
    "anamnesis",
    "schirmer-test",
    "contact-lens-diameters",
    "sensation-vision-stability",
    "fusion-range",
    "maddox-rod",
    "stereo-test",
    "rg",
]


def clean_legacy_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if len(s) >= 2 and s[0] == "'" and s[-1] == "'":
        s = s[1:-1]
    s = s.strip()
    if not s or s.isspace():
        return None
    lowered = s.lower()
    if lowered in ("null", "none", "nan"):
        return None
    return s

def parse_date(value: Optional[str]) -> Optional[datetime.date]:
    value = clean_legacy_text(value)
    if not value:
        return None
    if re.fullmatch(r"\d{1,5}", value):
        serial = int(value)
        if 1 <= serial <= 60000:
            try:
                return (datetime(1899, 12, 30) + timedelta(days=serial)).date()
            except Exception:
                return None
    # Try common formats from legacy DB
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    # Fallback: try to parse first 10 chars if timestamp-like
    try:
        return datetime.fromisoformat(value[:10]).date()
    except Exception:
        return None


def serialize_number(value: Optional[str]) -> Optional[str]:
    value = clean_legacy_text(value)
    if value is None:
        return None
    s = str(value).strip()
    s = s.replace(",", ".")

    if not re.fullmatch(r"[+-]?\d+(?:\.\d+)?", s):
        return None
    return s


def parse_optical_float(value: Optional[str]) -> Optional[float]:
    s = clean_legacy_text(value)
    if s is None:
        return None
    lowered = s.lower()
    if lowered in ("plano", "pl", "plan", "0", "+0", "-0"):
        return 0.0
    s = s.replace(",", ".")
    if re.fullmatch(r"[+-]?\d+(?:\.\d+)?", s):
        if "." in s:
            try:
                return float(s)
            except ValueError:
                return None
        sign = -1 if s.startswith("-") else 1
        digits = s.lstrip("+-")
        if len(digits) <= 2:
            try:
                return sign * float(digits)
            except ValueError:
                return None
        try:
            return sign * (int(digits[:-2] or "0") + int(digits[-2:]) / 100.0)
        except ValueError:
            return None
    return None


def parse_optical_value(value: Optional[str]) -> Optional[Any]:
    """Parse known optical numbers without discarding legacy text values."""
    cleaned = clean_legacy_text(value)
    if cleaned is None:
        return None
    parsed = parse_optical_float(cleaned)
    return parsed if parsed is not None else cleaned


def parse_float(value: Optional[str]) -> Optional[float]:
    serialized = serialize_number(value)
    if serialized is None:
        return None
    try:
        return float(serialized)
    except ValueError:
        return None


def parse_int(value: Optional[str]) -> Optional[int]:
    serialized = serialize_number(value)
    if serialized is None:
        return None
    try:
        return int(float(serialized))
    except ValueError:
        return None


def parse_visual_acuity(value: Optional[str]) -> Optional[Any]:
    """Preserve VA text while normalizing SoftOptic's bare meter denominators."""
    cleaned = clean_legacy_text(value)
    if cleaned is None:
        return None

    # SoftOptic stores meter VA as a denominator without the displayed ``6/``
    # prefix (for example ``9+2`` means ``6/9+2``).  Do not mistake these
    # values for decimal VA in the shared UI.
    match = re.fullmatch(r"(\d+(?:\.\d+)?)([+-]\d+)?", cleaned)
    if not match:
        return cleaned
    denominator = float(match.group(1))
    if not 3 <= denominator <= 190:
        return cleaned
    normalized_denominator = f"{denominator:g}"
    return f"6/{normalized_denominator}{match.group(2) or ''}"


def normalize_base_value(value: Optional[str]) -> Optional[str]:
    s = clean_legacy_text(value)
    if s is None:
        return None
    aliases = {
        "BI": "IN", "BASE IN": "IN", "IN": "IN",
        "BO": "OUT", "BASE OUT": "OUT", "OUT": "OUT",
        "BU": "UP", "BASE UP": "UP", "UP": "UP",
        "BD": "DOWN", "BASE DOWN": "DOWN", "DOWN": "DOWN",
    }
    return aliases.get(s.upper(), s)


def parse_bool_flag(value: Optional[str]) -> Optional[bool]:
    s = clean_legacy_text(value)
    if s is None:
        return None
    s = s.lower()
    if s in ("1", "true", "t", "yes", "y"):
        return True
    if s in ("0", "false", "f", "no", "n"):
        return False
    return None


def normalize_j_value(value: Optional[str]) -> Optional[str]:
    s = clean_legacy_text(value)
    if s is None:
        return None
    if re.fullmatch(r"(?i)j\d+\+?", s):
        return "J" + s[1:]
    if re.fullmatch(r"\d+", s):
        return f"J{s}"
    return s


def to_iso_date_string(value: Optional[str]) -> Optional[str]:
    parsed = parse_date(value)
    if parsed is not None:
        return parsed.isoformat()
    return clean_legacy_text(value)


def create_composite_client_id(clinic_id: Optional[int], account_code: str) -> int:
    if clinic_id is None:
        clinic_id = 0
    account_code_clean = "".join(ch for ch in str(account_code) if ch.isdigit())
    if not account_code_clean:
        raise ValueError(f"account_code '{account_code}' cannot be converted to numeric ID")
    client_id_prefix = os.environ.get("MIGRATION_CLIENT_ID_PREFIX")
    if client_id_prefix is not None:
        prefix_clean = "".join(ch for ch in str(client_id_prefix) if ch.isdigit())
        if not prefix_clean:
            raise ValueError("MIGRATION_CLIENT_ID_PREFIX must contain at least one digit")
        return int(f"{prefix_clean}{account_code_clean}")
    return int(f"{clinic_id}{account_code_clean}")


def extract_account_code_from_id(client_id: int, clinic_id: Optional[int] = None) -> str:
    client_id_str = str(client_id)
    if clinic_id is None:
        for possible_clinic_id in range(1, 1000):
            clinic_id_str = str(possible_clinic_id)
            if client_id_str.startswith(clinic_id_str):
                return client_id_str[len(clinic_id_str):]
        return client_id_str
    clinic_id_str = str(clinic_id)
    if client_id_str.startswith(clinic_id_str):
        return client_id_str[len(clinic_id_str):]
    return client_id_str


@lru_cache(maxsize=32)
def _get_csv_dialect(path: str, encoding: str) -> Optional[csv.Dialect]:
    try:
        with open(path, "r", newline="", encoding=encoding, errors="strict") as f:
            sample = f.read(32768)
            f.seek(0)
            try:
                return csv.Sniffer().sniff(sample, delimiters=",;\t|")
            except Exception:
                return csv.excel
    except Exception:
        return None


def _detect_csv_encoding_and_dialect(path: str) -> Tuple[str, csv.Dialect]:
    candidate_encodings = [
        "utf-8",
        "utf-8-sig",
        "cp1255",
        "windows-1255",
        "iso-8859-8",
        "latin-1",
    ]
    for enc in candidate_encodings:
        dialect = _get_csv_dialect(path, enc)
        if dialect is not None:
            try:
                with open(path, "r", newline="", encoding=enc, errors="strict") as f:
                    f.read(1)
                return enc, dialect
            except UnicodeDecodeError:
                continue
    return "latin-1", csv.excel


def _resolve_csv_max_rows(max_items: Optional[int]) -> Optional[int]:
    if max_items is not None:
        return max_items
    env_value = os.environ.get("CSV_MAX_ROWS")
    if env_value is None:
        return None
    try:
        parsed = int(env_value)
    except ValueError:
        return None
    return parsed if parsed > 0 else None


def read_csv(csv_dir: str, filename: str, max_items: Optional[int] = None) -> List[Dict[str, Any]]:
    path = os.path.join(csv_dir, filename)
    if not os.path.exists(path):
        return []
    encoding, dialect = _detect_csv_encoding_and_dialect(path)
    max_rows = _resolve_csv_max_rows(max_items)
    result = []
    with open(path, "r", newline="", encoding=encoding, errors="ignore" if encoding == "latin-1" else "strict") as f:
        # SoftOptic exports use standard doubled double quotes inside quoted
        # text fields. csv.Sniffer can incorrectly infer doublequote=False,
        # which shifts every field after a comma in that text.
        reader = csv.DictReader(f, dialect=dialect, doublequote=True)
        for count, row in enumerate(reader):
            if max_rows is not None and count >= max_rows:
                print(f"[csv] {filename}: reached max_rows limit ({max_rows}), stopping", flush=True)
                break
            result.append(row)
    return result


def read_csv_streaming(csv_dir: str, filename: str, max_items: Optional[int] = None) -> Generator[Dict[str, Any], None, None]:
    path = os.path.join(csv_dir, filename)
    if not os.path.exists(path):
        return
    encoding, dialect = _detect_csv_encoding_and_dialect(path)
    max_rows = _resolve_csv_max_rows(max_items)
    with open(path, "r", newline="", encoding=encoding, errors="ignore" if encoding == "latin-1" else "strict") as f:
        # See read_csv: keep the detected delimiter, but require standard
        # doubled-quote handling for SoftOptic text fields.
        reader = csv.DictReader(f, dialect=dialect, doublequote=True)
        count = 0
        for row in reader:
            if max_rows is not None and count >= max_rows:
                print(f"[csv] {filename}: reached max_rows limit ({max_rows}), stopping after {count} rows", flush=True)
                break
            yield row
            count += 1


def build_default_migrated_layout_data() -> str:
    legacy_columns = {
        "old-ref": 3,
        "old-refraction": 8,
        "old-refraction-extension": 12,
        "objective": 4,
        "subjective": 8,
        "final-subjective": 9,
        "final-prescription": 8,
        "compact-prescription": 8,
        "addition": 6,
        "retinoscop": 7,
        "retinoscop-dilation": 6,
        "uncorrected-va": 3,
        "keratometer": 4,
        "keratometer-full": 9,
        "corneal-topography": 1,
        "cover-test": 4,
        "cover-test-v2": 8,
        "notes": 5,
        "anamnesis": 11,
        "schirmer-test": 2,
        "contact-lens-diameters": 2,
        "contact-lens-details": 10,
        "keratometer-contact-lens": 7,
        "contact-lens-exam": 7,
        "old-contact-lenses": 13,
        "over-refraction": 9,
        "sensation-vision-stability": 5,
        "fusion-range": 5,
        "maddox-rod": 6,
        "stereo-test": 4,
        "rg": 3,
        "ocular-motor-assessment": 5,
    }
    grid_columns = 24
    items = []
    for idx, component_type in enumerate(MIGRATED_LAYOUT_COMPONENTS, start=1):
        legacy_width = legacy_columns.get(component_type, 1)
        width = max(1, min(grid_columns, int((legacy_width / 16) * grid_columns + 0.5)))
        items.append(
            {
                "id": f"{component_type}-1",
                "type": component_type,
                "showEyeLabels": True,
                "x": 0,
                "y": idx - 1,
                "w": width,
            }
        )
    return json.dumps({"version": 2, "grid": {"columns": grid_columns}, "items": items})


def build_contact_fit_layout_data() -> str:
    components = [
        ("sensation-vision-stability", "sensation-vision-stability-1", 9),
        ("old-contact-lenses", "old-contact-lenses-1", 20),
        ("objective", "objective-1", 6),
        ("over-refraction", "over-refraction-1", 14),
        ("fusion-range", "fusion-range-1", 8),
        ("maddox-rod", "maddox-rod-1", 9),
        ("stereo-test", "stereo-test-1", 6),
        ("cover-test-v2", "cover-test-v2-1", 12),
        ("notes", "notes-1", 8),
        ("notes", "notes-2", 8),
        ("notes", "notes-3", 8),
    ]
    items = [
        {"id": card_id, "type": component_type, "showEyeLabels": True, "x": 0, "y": index, "w": width}
        for index, (component_type, card_id, width) in enumerate(components)
    ]
    return json.dumps({"version": 2, "grid": {"columns": 24}, "items": items})


def get_migrated_card_id(component_type: str) -> str:
    return f"{component_type}-1"


def _build_component_entry(component_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    card_id = get_migrated_card_id(component_type)
    block = dict(payload)
    if component_type == "old-refraction":
        tab_id = "legacy"
        block["card_id"] = card_id
        block["card_instance_id"] = tab_id
        block["tab_index"] = 0
        return {
            f"old-refraction-{card_id}-{tab_id}": block,
            component_type: block,
        }
    if component_type == "cover-test":
        tab_id = "legacy"
        block["card_id"] = card_id
        block["card_instance_id"] = tab_id
        block["tab_index"] = 0
        return {
            f"cover-test-{card_id}-{tab_id}": block,
            component_type: block,
        }
    if component_type == "notes":
        block["card_instance_id"] = card_id
        return {
            f"notes-{card_id}": block,
            component_type: block,
        }
    block["card_instance_id"] = card_id
    return {
        f"{component_type}-{card_id}": block,
        component_type: block,
    }


def build_component_entry(component_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    return _build_component_entry(component_type, payload)


def load_file_blob_map(csv_dir: str) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    rows_iter = read_csv_streaming(csv_dir, "account_files_blob.csv")
    if rows_iter is None:
        return mapping
    for row in rows_iter:
        code = clean_legacy_text(row.get("code"))
        blob_hex = clean_legacy_text(row.get("file_blob"))
        if code and blob_hex:
            mapping[code] = blob_hex
    return mapping


def guess_file_extension_and_type(blob_bytes: bytes, file_name: Optional[str]) -> Tuple[str, Optional[str]]:
    guessed_ext = ""
    guessed_type: Optional[str] = None

    if file_name:
        _, guessed_ext = os.path.splitext(file_name)
        guessed_type = mimetypes.guess_type(file_name)[0]

    if blob_bytes.startswith(b"%PDF"):
        return ".pdf", "application/pdf"
    if blob_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png", "image/png"
    if blob_bytes.startswith(b"\xff\xd8\xff"):
        return ".jpg", "image/jpeg"
    if blob_bytes.startswith(b"GIF87a") or blob_bytes.startswith(b"GIF89a"):
        return ".gif", "image/gif"
    if blob_bytes.startswith(b"{\\rtf"):
        return ".rtf", "application/rtf"
    if blob_bytes.startswith(b"PK\x03\x04"):
        return guessed_ext or ".zip", guessed_type or "application/zip"
    if blob_bytes.startswith(bytes.fromhex("d0cf11e0a1b11ae1")):
        return guessed_ext or ".doc", guessed_type or "application/msword"
    return guessed_ext or ".bin", guessed_type or "application/octet-stream"


def write_legacy_blob_file(file_code: str, raw_file_name: Optional[str], blob_hex: Optional[str]) -> Tuple[Optional[str], Optional[int], Optional[str], Optional[str]]:
    if not blob_hex:
        return None, None, None, None
    normalized = blob_hex[2:] if blob_hex.startswith("0x") else blob_hex
    try:
        blob_bytes = bytes.fromhex(normalized)
    except ValueError:
        return None, None, None, None

    ext, mime_type = guess_file_extension_and_type(blob_bytes, raw_file_name)
    base_name = clean_legacy_text(raw_file_name)
    if base_name:
        if ext and not os.path.splitext(base_name)[1]:
            saved_name = f"{base_name}{ext}"
        else:
            saved_name = base_name
    else:
        saved_name = f"legacy-file-{file_code}{ext}"

    os.makedirs(MIGRATED_FILES_DIR, exist_ok=True)
    path = os.path.join(MIGRATED_FILES_DIR, f"{file_code}{ext}")
    with open(path, "wb") as out:
        out.write(blob_bytes)
    return path, len(blob_bytes), mime_type, saved_name


# ------------------------------
# Bootstrap: company, clinics, admin user, exam layout
# ------------------------------

def get_or_create_company(db: Session) -> Company:
    company = db.execute(select(Company)).scalars().first()
    if company:
        return company
    company = Company(
        name="Migrated Optical Company",
        owner_full_name="System Administrator",
        contact_email="admin@opticai.local",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def get_company_by_id(db: Session, company_id: int) -> Optional[Company]:
    return db.get(Company, company_id)


def get_clinic_by_id(db: Session, clinic_id: int) -> Optional[Clinic]:
    return db.get(Clinic, clinic_id)


def get_clinic_by_unique_id(db: Session, clinic_unique_id: str) -> Optional[Clinic]:
    return db.execute(select(Clinic).where(Clinic.unique_id == clinic_unique_id)).scalars().first()


def resolve_existing_clinic(db: Session, clinic_identifier: str) -> Optional[Clinic]:
    identifier = clean_legacy_text(clinic_identifier)
    if not identifier:
        return None
    if identifier.isdigit():
        clinic = get_clinic_by_id(db, int(identifier))
        if clinic:
            return clinic
    return get_clinic_by_unique_id(db, identifier)


def get_or_create_admin_user(db: Session, company: Company, clinic: Optional[Clinic] = None) -> User:
    query = select(User).where(User.company_id == company.id, User.role_level == 4)
    if clinic is not None:
        query = query.where(User.clinic_id == clinic.id)
    user = db.execute(query).scalars().first()
    if user:
        return user
    username = "admin" if clinic is None else f"migration-admin-{clinic.id}"
    user = User(
        company_id=company.id,
        clinic_id=clinic.id if clinic else None,
        full_name="Migration Administrator" if clinic else "System Administrator",
        username=username,
        email=f"{username}@opticai.local",
        phone=None,
        password_hash=None,
        role_level=4,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_clinic(db: Session, company: Company, branch_code: str) -> Clinic:
    unique_id = f"BRANCH_{branch_code}"
    clinic = db.execute(select(Clinic).where(Clinic.unique_id == unique_id)).scalars().first()
    if clinic:
        return clinic
    clinic = Clinic(
        company_id=company.id,
        name=f"Branch {branch_code}",
        unique_id=unique_id,
        is_active=True,
    )
    db.add(clinic)
    db.flush()
    seed_default_lookup_values_for_clinic(db, clinic.id)
    db.commit()
    db.refresh(clinic)
    return clinic


def get_or_create_default_exam_layout(db: Session, clinic: Optional[Clinic]) -> ExamLayout:
    # Use a single default layout per clinic name
    name = "Default Migrated Layout"
    q = select(ExamLayout).where(ExamLayout.name == name)
    if clinic is not None:
        q = q.where(ExamLayout.clinic_id == clinic.id)
    layout = db.execute(q).scalars().first()
    if layout:
        return layout
    layout = ExamLayout(
        clinic_id=clinic.id if clinic else None,
        name=name,
        layout_data=build_default_migrated_layout_data(),
        is_default=True,
        is_active=True,
    )
    db.add(layout)
    db.commit()
    db.refresh(layout)
    return layout


# ------------------------------
# Lookup upsert helpers
# ------------------------------

def upsert_lookup_simple(db: Session, model, name: str, clinic_id: int):
    if not name:
        return None
    name = name.strip()
    if not name:
        return None
    existing = (
        db.execute(
            select(model)
            .where(model.clinic_id == clinic_id)
            .where(model.name == name)
        )
        .scalars()
        .first()
    )
    if existing:
        return existing
    obj = model(clinic_id=clinic_id, name=name)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ------------------------------
# Builders for JSON exam_data per mapping
# ------------------------------

def build_objective(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    r = {
        "r_sph": parse_float(row.get("ob_sph_right")),
        "l_sph": parse_float(row.get("ob_sph_left")),
        "r_cyl": parse_float(row.get("ob_cyl_right")),
        "l_cyl": parse_float(row.get("ob_cyl_left")),
        "r_ax": parse_int(row.get("ob_ax_right")),
        "l_ax": parse_int(row.get("ob_ax_left")),
    }
    if any(v is not None for v in r.values()):
        return r
    return None


def build_keratometer(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    r = {
        "r_k1": keratometer_mm(row.get("cr_rv_right")),
        "l_k1": keratometer_mm(row.get("cr_rv_left")),
        "r_k2": keratometer_mm(row.get("cr_rh_right")),
        "l_k2": keratometer_mm(row.get("cr_rh_left")),
        "r_axis": parse_int(row.get("cr_ax_right")),
        "l_axis": parse_int(row.get("cr_ax_left")),
    }
    if any(v is not None for v in r.values()):
        return r
    return None


def normalize_keratometer_pair(primary: Any, counterpart: Any) -> Tuple[Optional[float], Optional[float]]:
    """Return (diopters, mm), detecting mislabeled legacy values."""
    first = parse_float(primary)
    second = parse_float(counterpart)
    values = [value for value in (first, second) if value is not None]
    dpt = next((value for value in values if 35 <= value <= 60), None)
    mm = next((value for value in values if 6 <= value <= 10), None)
    if dpt is None and mm:
        dpt = round(337.5 / mm, 2)
    if mm is None and dpt:
        mm = round(337.5 / dpt, 2)
    return dpt, mm


def keratometer_mm(value: Any) -> Optional[float]:
    return normalize_keratometer_pair(value, None)[1]


OLD_REFRACTION_TYPE_ALIASES = {
    "מרחק": "רחוק", "רחוק": "רחוק", "קרוב": "קרוב", "קריאה": "קרוב",
    "מחשב": "קרוב", "למחשב": "קרוב", "מולטיפוקל": "מולטיפוקל", "ביפוקל": "ביפוקל",
}


def _has_extended_old_refraction_fields(expanded: Dict[str, Any]) -> bool:
    """Whether one old-refraction set needs the Extension-only fields."""
    field_suffixes = (
        "r_prisv", "l_prisv", "r_basev", "l_basev",
        "r_pd", "l_pd", "b_pd",
        "r_far_pd", "l_far_pd", "b_far_pd",
        "r_near_pd", "l_near_pd", "b_near_pd",
    )
    for index in range(1, 4):
        for suffix in field_suffixes:
            value = clean_legacy_text(expanded.get(f"old{index}_{suffix}"))
            if value is not None and value not in {"0", "0.0", "0.00"}:
                return True
    return False


def build_old_refraction_tabs(expanded: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not expanded:
        return {}
    result: Dict[str, Any] = {}
    component_type = (
        "old-refraction-extension"
        if _has_extended_old_refraction_fields(expanded)
        else "old-refraction"
    )
    card_id = get_migrated_card_id(component_type)
    tabs = []
    for index in range(1, 4):
        prefix = f"old{index}"
        legacy_type = clean_legacy_text(expanded.get(f"{prefix}_type"))
        glasses_type = OLD_REFRACTION_TYPE_ALIASES.get(legacy_type or "")
        block = {
            "r_sph": parse_optical_value(expanded.get(f"{prefix}_r_sph")),
            "l_sph": parse_optical_value(expanded.get(f"{prefix}_l_sph")),
            "r_cyl": parse_optical_value(expanded.get(f"{prefix}_r_cyl")),
            "l_cyl": parse_optical_value(expanded.get(f"{prefix}_l_cyl")),
            "r_ax": parse_int(expanded.get(f"{prefix}_r_ax")),
            "l_ax": parse_int(expanded.get(f"{prefix}_l_ax")),
            "r_va": parse_visual_acuity(expanded.get(f"{prefix}_r_va")),
            "l_va": parse_visual_acuity(expanded.get(f"{prefix}_l_va")),
            "r_ad": parse_optical_value(expanded.get(f"{prefix}_r_add")),
            "l_ad": parse_optical_value(expanded.get(f"{prefix}_l_add")),
            "r_j": normalize_j_value(expanded.get(f"{prefix}_r_j")),
            "l_j": normalize_j_value(expanded.get(f"{prefix}_l_j")),
            "comb_va": parse_visual_acuity(expanded.get(f"{prefix}_b_va")),
            "r_glasses_type": glasses_type,
            "l_glasses_type": glasses_type,
            "legacy_glasses_type": legacy_type,
            "card_id": card_id,
            "card_instance_id": str(index),
            "tab_index": index - 1,
        }
        if component_type == "old-refraction-extension":
            block.update({
                "r_pr_h": parse_float(expanded.get(f"{prefix}_r_prish")),
                "l_pr_h": parse_float(expanded.get(f"{prefix}_l_prish")),
                "r_base_h": normalize_base_value(expanded.get(f"{prefix}_r_baseh")),
                "l_base_h": normalize_base_value(expanded.get(f"{prefix}_l_baseh")),
                "r_pr_v": parse_float(expanded.get(f"{prefix}_r_prisv")),
                "l_pr_v": parse_float(expanded.get(f"{prefix}_l_prisv")),
                "r_base_v": normalize_base_value(expanded.get(f"{prefix}_r_basev")),
                "l_base_v": normalize_base_value(expanded.get(f"{prefix}_l_basev")),
                "r_pd_far": parse_float(expanded.get(f"{prefix}_r_far_pd") or expanded.get(f"{prefix}_r_pd")),
                "l_pd_far": parse_float(expanded.get(f"{prefix}_l_far_pd") or expanded.get(f"{prefix}_l_pd")),
                "comb_pd_far": parse_float(expanded.get(f"{prefix}_b_far_pd") or expanded.get(f"{prefix}_b_pd")),
                "r_pd_close": parse_float(expanded.get(f"{prefix}_r_near_pd")),
                "l_pd_close": parse_float(expanded.get(f"{prefix}_l_near_pd")),
                "comb_pd_close": parse_float(expanded.get(f"{prefix}_b_near_pd")),
                "comb_j": normalize_j_value(expanded.get(f"{prefix}_b_j")),
            })
        else:
            block.update({
                "r_pris": parse_float(expanded.get(f"{prefix}_r_prish")),
                "l_pris": parse_float(expanded.get(f"{prefix}_l_prish")),
                "r_base": normalize_base_value(expanded.get(f"{prefix}_r_baseh")),
                "l_base": normalize_base_value(expanded.get(f"{prefix}_l_baseh")),
            })
        meaningful = any(v is not None for k, v in block.items() if k not in {"card_id", "card_instance_id", "tab_index"})
        if not meaningful:
            continue
        result[f"{component_type}-{card_id}-{index}"] = block
        tabs.append({"id": str(index), "index": len(tabs), **({"type": glasses_type} if glasses_type else {})})
    if tabs:
        result["__ui"] = {"tabsByCard": {f"{component_type}:{card_id}": tabs}}
    return result


def build_subjective(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    r = {
        "r_sph": parse_float(row.get("sb_sph_right")),
        "l_sph": parse_float(row.get("sb_sph_left")),
        "r_cyl": parse_float(row.get("sb_cyl_right")),
        "l_cyl": parse_float(row.get("sb_cyl_left")),
        "r_ax": parse_int(row.get("sb_ax_right")),
        "l_ax": parse_int(row.get("sb_ax_left")),
        "r_pris": parse_float(row.get("sb_pris_right")),
        "l_pris": parse_float(row.get("sb_pris_left")),
        "r_base": row.get("sb_base_right") or None,
        "l_base": row.get("sb_base_left") or None,
        "r_va": parse_float(row.get("sb_va_right")),
        "l_va": parse_float(row.get("sb_va_left")),
        "comb_va": parse_float(row.get("sb_va")),
        "r_pd_close": parse_float(row.get("pd_n_right")),
        "l_pd_close": parse_float(row.get("pd_n_left")),
        "comb_pd_close": parse_float(row.get("pd_n")),
        "r_pd_far": parse_float(row.get("pd_f_right")),
        "l_pd_far": parse_float(row.get("pd_f_left")),
        "comb_pd_far": parse_float(row.get("pd_f")),
    }
    if any(v is not None for v in r.values()):
        return r
    return None


def build_addition(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    r = {
        "r_read": parse_float(row.get("read_right")),
        "l_read": parse_float(row.get("read_left")),
    }
    if any(v is not None for v in r.values()):
        return r
    return None


def build_old_refraction(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    r = {
        "r_sph": parse_float(row.get("or_sph_right")),
        "l_sph": parse_float(row.get("or_sph_left")),
        "r_cyl": parse_float(row.get("or_cyl_right")),
        "l_cyl": parse_float(row.get("or_cyl_left")),
        "r_ax": parse_int(row.get("or_ax_right")),
        "l_ax": parse_int(row.get("or_ax_left")),
        "r_ad": parse_float(row.get("or_add_right")),
        "l_ad": parse_float(row.get("or_add_left")),
        "r_va": parse_float(row.get("or_va_r")),
        "l_va": parse_float(row.get("or_va_l")),
        "comb_va": parse_float(row.get("or_va_b")),
    }
    if any(v is not None for v in r.values()):
        return r
    return None


def _normalize_value(value: Any, filter_zero: bool = False) -> Optional[Any]:
    if value is None:
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return None
        lowered = trimmed.lower()
        if lowered in ("null", "none", "nan"):
            return None
        if filter_zero and trimmed == "0":
            return None
        return trimmed
    return value


def _pick_value(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None, parser=None, filter_zero: bool = False):
    expanded_keys = expanded_keys or []
    row_keys = row_keys or []
    if expanded:
        for key in expanded_keys:
            if key is None:
                continue
            value = _normalize_value(expanded.get(key), filter_zero=filter_zero)
            if value is not None:
                return parser(value) if parser else value
    for key in row_keys:
        if key is None:
            continue
        value = _normalize_value(row.get(key), filter_zero=filter_zero)
        if value is not None:
            return parser(value) if parser else value
    return None


def _get_str(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None, filter_zero: bool = False) -> Optional[str]:
    value = _pick_value(expanded, row, expanded_keys, row_keys, filter_zero=filter_zero)
    if value is None:
        return None
    return str(value)


def _get_float(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[float]:
    return _pick_value(expanded, row, expanded_keys, row_keys, parse_float)


def _get_optical_float(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[float]:
    return _pick_value(expanded, row, expanded_keys, row_keys, parse_optical_float)


def _get_optical_value(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[Any]:
    return _pick_value(expanded, row, expanded_keys, row_keys, parse_optical_value)


def _get_base(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[str]:
    return _pick_value(expanded, row, expanded_keys, row_keys, normalize_base_value)


def _get_int(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[int]:
    return _pick_value(expanded, row, expanded_keys, row_keys, parse_int)


def _get_bool(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[bool]:
    return _pick_value(expanded, row, expanded_keys, row_keys, parse_bool_flag)


def _get_va(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[Any]:
    return _pick_value(expanded, row, expanded_keys, row_keys, parse_visual_acuity)


def _build_old_ref_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "source": _get_str(expanded, row, ["old1_source"], None, True),
        "contacts": _get_str(expanded, row, ["old1_lens"], None, True),
    }
    if any(data.values()):
        return data
    return None


def _build_objective_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_optical_value(expanded, row, ["obj_r_sph"], ["ob_right_sph"]),
        "l_sph": _get_optical_value(expanded, row, ["obj_l_sph"], ["ob_left_sph"]),
        "r_cyl": _get_optical_value(expanded, row, ["obj_r_cyl"], ["ob_right_cyl"]),
        "l_cyl": _get_optical_value(expanded, row, ["obj_l_cyl"], ["ob_left_cyl"]),
        "r_ax": _get_int(expanded, row, ["obj_r_ax"], ["ob_right_ax"]),
        "l_ax": _get_int(expanded, row, ["obj_l_ax"], ["ob_left_ax"]),
        "r_se": _get_optical_float(expanded, row, ["ob_right_se"], ["ob_right_se"]),
        "l_se": _get_optical_float(expanded, row, ["ob_left_se"], ["ob_left_se"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_subjective_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_fa": _get_str(expanded, row, ["sb_right_fa"], ["sb_right_fa"]),
        "l_fa": _get_str(expanded, row, ["sb_left_fa"], ["sb_left_fa"]),
        "r_fa_tuning": _get_float(expanded, row, ["sb_right_fa_add"], ["sb_right_fa_add"]),
        "l_fa_tuning": _get_float(expanded, row, ["sb_left_fa_add"], ["sb_left_fa_add"]),
        "r_sph": _get_optical_value(expanded, row, ["sub_r_sph"], ["sb_right_sph"]),
        "l_sph": _get_optical_value(expanded, row, ["sub_l_sph"], ["sb_left_sph"]),
        "r_cyl": _get_optical_value(expanded, row, ["sub_r_cyl"], ["sb_right_cyl"]),
        "l_cyl": _get_optical_value(expanded, row, ["sub_l_cyl"], ["sb_left_cyl"]),
        "r_ax": _get_int(expanded, row, ["sub_r_ax"], ["sb_right_ax"]),
        "l_ax": _get_int(expanded, row, ["sub_l_ax"], ["sb_left_ax"]),
        "r_pris": _get_float(expanded, row, ["sub_r_prish"], ["sb_right_pris"]),
        "l_pris": _get_float(expanded, row, ["sub_l_prish"], ["sb_left_pris"]),
        "r_base": _get_base(expanded, row, ["sub_r_baseh"], ["sb_right_base"]),
        "l_base": _get_base(expanded, row, ["sub_l_baseh"], ["sb_left_base"]),
        "r_va": _get_va(expanded, row, ["sub_r_va"], ["sb_right_va"]),
        "l_va": _get_va(expanded, row, ["sub_l_va"], ["sb_left_va"]),
        "r_ph": _get_str(expanded, row, ["sub_r_ph"], ["sb_right_ph"]),
        "l_ph": _get_str(expanded, row, ["sub_l_ph"], ["sb_left_ph"]),
        "r_pd_close": _get_float(expanded, row, ["sb_right_near_pd"], ["sb_right_near_pd"]),
        "l_pd_close": _get_float(expanded, row, ["sb_left_near_pd"], ["sb_left_near_pd"]),
        "r_pd_far": _get_float(expanded, row, ["patient_r_pd"], ["sb_right_far_pd"]),
        "l_pd_far": _get_float(expanded, row, ["patient_l_pd"], ["sb_left_far_pd"]),
        "comb_va": _get_va(expanded, row, ["sub_b_va"], ["sb_mid_va"]),
        "comb_pd_close": _get_float(None, row, None, ["sb_mid_near_pd"]),
        "comb_pd_far": _get_float(expanded, row, ["patient_b_pd", "sub_b_pd"], ["sb_mid_far_pd"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_addition_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_fcc": _get_optical_value(expanded, row, ["add_right_fcc"], ["add_right_fcc"]),
        "l_fcc": _get_optical_value(expanded, row, ["add_left_fcc"], ["add_left_fcc"]),
        "r_read": _get_float(expanded, row, ["add_right_read", "sub_r_read"], ["add_right_read"]),
        "l_read": _get_float(expanded, row, ["add_left_read", "sub_l_read"], ["add_left_read"]),
        "r_int": _get_float(expanded, row, ["add_right_int", "sub_r_int"], ["add_right_int"]),
        "l_int": _get_float(expanded, row, ["add_left_int", "sub_l_int"], ["add_left_int"]),
        "r_bif": _get_float(expanded, row, ["add_right_bif", "sub_r_bif"], ["add_right_bif"]),
        "l_bif": _get_float(expanded, row, ["add_left_bif", "sub_l_bif"], ["add_left_bif"]),
        "r_mul": _get_float(expanded, row, ["add_right_mul", "sub_r_mul"], ["add_right_mul"]),
        "l_mul": _get_float(expanded, row, ["add_left_mul", "sub_l_mul"], ["add_left_mul"]),
        "r_j": normalize_j_value(_get_str(expanded, row, ["add_right_j", "sub_r_j"], ["add_right_j"])),
        "l_j": normalize_j_value(_get_str(expanded, row, ["add_left_j", "sub_l_j"], ["add_left_j"])),
        "r_iop": _get_float(expanded, row, ["bio_r_iop"], ["iop_right"]),
        "l_iop": _get_float(expanded, row, ["bio_l_iop"], ["iop_left"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_old_refraction_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_optical_value(expanded, row, ["or_right_sph"], ["or_right_sph"]),
        "l_sph": _get_optical_value(expanded, row, ["or_left_sph"], ["or_left_sph"]),
        "r_cyl": _get_optical_value(expanded, row, ["or_right_cyl"], ["or_right_cyl"]),
        "l_cyl": _get_optical_value(expanded, row, ["or_left_cyl"], ["or_left_cyl"]),
        "r_ax": _get_int(expanded, row, ["or_right_ax"], ["or_right_ax"]),
        "l_ax": _get_int(expanded, row, ["or_left_ax"], ["or_left_ax"]),
        "r_pris": _get_float(expanded, row, ["or_right_pris"], ["or_right_pris"]),
        "l_pris": _get_float(expanded, row, ["or_left_pris"], ["or_left_pris"]),
        "r_base": _get_base(expanded, row, ["or_right_base"], ["or_right_base"]),
        "l_base": _get_base(expanded, row, ["or_left_base"], ["or_left_base"]),
        "r_va": _get_va(expanded, row, ["or_right_va"], ["or_right_va"]),
        "l_va": _get_va(expanded, row, ["or_left_va"], ["or_left_va"]),
        "r_ad": _get_optical_float(expanded, row, ["or_right_add"], ["or_right_add"]),
        "l_ad": _get_optical_float(expanded, row, ["or_left_add"], ["or_left_add"]),
        "comb_va": _get_va(expanded, row, ["or_mid_va"], ["or_mid_va"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_old_refraction_extension_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_optical_value(expanded, row, ["old1_r_sph"]),
        "l_sph": _get_optical_value(expanded, row, ["old1_l_sph"]),
        "r_cyl": _get_optical_value(expanded, row, ["old1_r_cyl"]),
        "l_cyl": _get_optical_value(expanded, row, ["old1_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["old1_r_ax"]),
        "l_ax": _get_int(expanded, row, ["old1_l_ax"]),
        "r_pr_h": _get_float(expanded, row, ["old1_r_prish"]),
        "l_pr_h": _get_float(expanded, row, ["old1_l_prish"]),
        "r_base_h": _get_base(expanded, row, ["old1_r_baseh"]),
        "l_base_h": _get_base(expanded, row, ["old1_l_baseh"]),
        "r_pr_v": _get_float(expanded, row, ["old1_r_prisv"]),
        "l_pr_v": _get_float(expanded, row, ["old1_l_prisv"]),
        "r_base_v": _get_base(expanded, row, ["old1_r_basev"]),
        "l_base_v": _get_base(expanded, row, ["old1_l_basev"]),
        "r_va": _get_va(expanded, row, ["old1_r_va"]),
        "l_va": _get_va(expanded, row, ["old1_l_va"]),
        "r_ad": _get_optical_float(expanded, row, ["old1_r_add"]),
        "l_ad": _get_optical_float(expanded, row, ["old1_l_add"]),
        "r_j": normalize_j_value(_get_str(expanded, row, ["old1_r_j"])),
        "l_j": normalize_j_value(_get_str(expanded, row, ["old1_l_j"])),
        "r_pd_far": _get_float(expanded, row, ["old1_r_pd"]),
        "l_pd_far": _get_float(expanded, row, ["old1_l_pd"]),
        "comb_va": _get_va(expanded, row, ["old1_b_va"]),
        "comb_pd_far": _get_float(expanded, row, ["old1_b_pd"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_final_subjective_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_optical_value(expanded, row, ["sub_f_r_sph"]),
        "l_sph": _get_optical_value(expanded, row, ["sub_f_l_sph"]),
        "r_cyl": _get_optical_value(expanded, row, ["sub_f_r_cyl"]),
        "l_cyl": _get_optical_value(expanded, row, ["sub_f_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["sub_f_r_ax"]),
        "l_ax": _get_int(expanded, row, ["sub_f_l_ax"]),
        "r_pris": _get_float(expanded, row, ["sub_f_r_prish"]),
        "l_pris": _get_float(expanded, row, ["sub_f_l_prish"]),
        "r_base": _get_base(expanded, row, ["sub_f_r_baseh"]),
        "l_base": _get_base(expanded, row, ["sub_f_l_baseh"]),
        "r_va": _get_va(expanded, row, ["sub_f_r_va"]),
        "l_va": _get_va(expanded, row, ["sub_f_l_va"]),
        "r_j": normalize_j_value(_get_str(expanded, row, ["sub_f_r_j"])),
        "l_j": normalize_j_value(_get_str(expanded, row, ["sub_f_l_j"])),
        "r_pd_far": _get_float(expanded, row, ["sub_f_r_far_pd"]),
        "l_pd_far": _get_float(expanded, row, ["sub_f_l_far_pd"]),
        "r_pd_close": _get_float(expanded, row, ["sub_f_r_near_pd"]),
        "l_pd_close": _get_float(expanded, row, ["sub_f_l_near_pd"]),
        "comb_pd_far": _get_float(expanded, row, ["sub_f_b_far_pd"]),
        "comb_pd_close": _get_float(expanded, row, ["sub_f_b_near_pd"]),
        "comb_va": _get_va(expanded, row, ["sub_f_b_va"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_final_prescription_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_optical_value(expanded, row, ["sub_f_r_sph"]),
        "l_sph": _get_optical_value(expanded, row, ["sub_f_l_sph"]),
        "r_cyl": _get_optical_value(expanded, row, ["sub_f_r_cyl"]),
        "l_cyl": _get_optical_value(expanded, row, ["sub_f_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["sub_f_r_ax"]),
        "l_ax": _get_int(expanded, row, ["sub_f_l_ax"]),
        "r_pris": _get_float(expanded, row, ["sub_f_r_prish"]),
        "l_pris": _get_float(expanded, row, ["sub_f_l_prish"]),
        "r_base": _get_base(expanded, row, ["sub_f_r_baseh"]),
        "l_base": _get_base(expanded, row, ["sub_f_l_baseh"]),
        "r_va": _get_va(expanded, row, ["sub_f_r_va"]),
        "l_va": _get_va(expanded, row, ["sub_f_l_va"]),
        "r_ad": _get_optical_float(expanded, row, ["sub_r_add_at"]),
        "l_ad": _get_optical_float(expanded, row, ["sub_l_add_at"]),
        "r_pd_far": _get_float(expanded, row, ["sub_f_r_far_pd"]),
        "l_pd_far": _get_float(expanded, row, ["sub_f_l_far_pd"]),
        "r_pd_close": _get_float(expanded, row, ["sub_f_r_near_pd"]),
        "l_pd_close": _get_float(expanded, row, ["sub_f_l_near_pd"]),
        "comb_va": _get_va(expanded, row, ["sub_f_b_va"]),
        "comb_pd_far": _get_float(expanded, row, ["sub_f_b_far_pd"]),
        "comb_pd_close": _get_float(expanded, row, ["sub_f_b_near_pd"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_compact_prescription_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_optical_value(expanded, row, ["sub_f_r_sph"]),
        "l_sph": _get_optical_value(expanded, row, ["sub_f_l_sph"]),
        "r_cyl": _get_optical_value(expanded, row, ["sub_f_r_cyl"]),
        "l_cyl": _get_optical_value(expanded, row, ["sub_f_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["sub_f_r_ax"]),
        "l_ax": _get_int(expanded, row, ["sub_f_l_ax"]),
        "r_pris": _get_float(expanded, row, ["sub_f_r_prish"]),
        "l_pris": _get_float(expanded, row, ["sub_f_l_prish"]),
        "r_base": _get_base(expanded, row, ["sub_f_r_baseh"]),
        "l_base": _get_base(expanded, row, ["sub_f_l_baseh"]),
        "r_va": _get_va(expanded, row, ["sub_f_r_va"]),
        "l_va": _get_va(expanded, row, ["sub_f_l_va"]),
        "r_ad": _get_optical_float(expanded, row, ["sub_r_add_at"]),
        "l_ad": _get_optical_float(expanded, row, ["sub_l_add_at"]),
        "r_pd": _get_float(expanded, row, ["sub_f_r_far_pd"]),
        "l_pd": _get_float(expanded, row, ["sub_f_l_far_pd"]),
        "comb_va": _get_va(expanded, row, ["sub_f_b_va"]),
        "comb_pd": _get_float(expanded, row, ["sub_f_b_far_pd"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_retinoscop_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_optical_value(expanded, row, ["obj_r_sph"]),
        "l_sph": _get_optical_value(expanded, row, ["obj_l_sph"]),
        "r_cyl": _get_optical_value(expanded, row, ["obj_r_cyl"]),
        "l_cyl": _get_optical_value(expanded, row, ["obj_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["obj_r_ax"]),
        "l_ax": _get_int(expanded, row, ["obj_l_ax"]),
        "r_reflex": _get_str(expanded, row, ["obj_r_reflax"]),
        "l_reflex": _get_str(expanded, row, ["obj_l_reflax"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_retinoscop_dilation_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_optical_value(expanded, row, ["obj_w_r_sph"]),
        "l_sph": _get_optical_value(expanded, row, ["obj_w_l_sph"]),
        "r_cyl": _get_optical_value(expanded, row, ["obj_w_r_cyl"]),
        "l_cyl": _get_optical_value(expanded, row, ["obj_w_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["obj_w_r_ax"]),
        "l_ax": _get_int(expanded, row, ["obj_w_l_ax"]),
        "r_reflex": _get_str(expanded, row, ["obj_w_r_reflax"]),
        "l_reflex": _get_str(expanded, row, ["obj_w_l_reflax"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_uncorrected_va_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_fv": _get_str(expanded, row, ["anam_unva_r_fv"]),
        "l_fv": _get_str(expanded, row, ["anam_unva_l_fv"]),
        "r_iv": _get_str(expanded, row, ["anam_unva_r_fv_cm"]),
        "l_iv": _get_str(expanded, row, ["anam_unva_l_fv_cm"]),
        "r_nv_j": _get_str(expanded, row, ["anam_unva_r_nv_j"]),
        "l_nv_j": _get_str(expanded, row, ["anam_unva_l_nv_j"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_keratometer_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_k1": _get_float(expanded, row, ["obj_k_r_dpt1"]),
        "r_k2": _get_float(expanded, row, ["obj_k_r_dpt2"]),
        "l_k1": _get_float(expanded, row, ["obj_k_l_dpt1"]),
        "l_k2": _get_float(expanded, row, ["obj_k_l_dpt2"]),
        "r_axis": _get_int(expanded, row, ["obj_k_r_mer1"]),
        "l_axis": _get_int(expanded, row, ["obj_k_l_mer1"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_keratometer_full_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    r_dpt_1, r_mm_1 = normalize_keratometer_pair(expanded.get("obj_k_r_dpt1") if expanded else None, expanded.get("obj_k_r_mm1") if expanded else None)
    r_dpt_2, r_mm_2 = normalize_keratometer_pair(expanded.get("obj_k_r_dpt2") if expanded else None, expanded.get("obj_k_r_mm2") if expanded else None)
    l_dpt_1, l_mm_1 = normalize_keratometer_pair(expanded.get("obj_k_l_dpt1") if expanded else None, expanded.get("obj_k_l_mm1") if expanded else None)
    l_dpt_2, l_mm_2 = normalize_keratometer_pair(expanded.get("obj_k_l_dpt2") if expanded else None, expanded.get("obj_k_l_mm2") if expanded else None)
    data = {
        "r_dpt_k1": r_dpt_1, "r_dpt_k2": r_dpt_2,
        "l_dpt_k1": l_dpt_1, "l_dpt_k2": l_dpt_2,
        "r_mm_k1": r_mm_1, "r_mm_k2": r_mm_2,
        "l_mm_k1": l_mm_1, "l_mm_k2": l_mm_2,
        "r_mer_k1": _get_float(expanded, row, ["obj_k_r_mer1"]),
        "r_mer_k2": _get_float(expanded, row, ["obj_k_r_mer2"]),
        "l_mer_k1": _get_float(expanded, row, ["obj_k_l_mer1"]),
        "l_mer_k2": _get_float(expanded, row, ["obj_k_l_mer2"]),
        "r_astig": None,
        "l_astig": None,
    }
    if data["r_dpt_k1"] is not None and data["r_dpt_k2"] is not None:
        data["r_astig"] = abs(data["r_dpt_k1"] - data["r_dpt_k2"]) > 0
    if data["l_dpt_k1"] is not None and data["l_dpt_k2"] is not None:
        data["l_astig"] = abs(data["l_dpt_k1"] - data["l_dpt_k2"]) > 0
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_corneal_topography_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "l_note": _get_str(expanded, row, ["obj_l_cor_map"], None, True),
        "r_note": _get_str(expanded, row, ["obj_r_cor_map"], None, True),
        "title": _get_str(expanded, row, ["obj_cor_map"], None, True),
    }
    if any(data.values()):
        return data
    return None


def _build_anamnesis_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    contact_lens_wear = _get_bool(expanded, row, ["anam_c_lens"])
    data = {
        "medications": _get_str(expanded, row, ["anam_medicine", "anam_medicine_rem"], None, True),
        "allergies": _get_str(expanded, row, ["anam_allergy", "anam_allergy_rem"], None, True),
        "family_history": _get_str(expanded, row, ["anam_f_illness", "anam_f_illness_rem"], None, True),
        "previous_treatments": _get_str(expanded, row, ["anam_p_treat", "anam_p_treat_rem"], None, True),
        "lazy_eye": _get_str(expanded, row, ["anam_l_eye", "anam_l_eye_rem"], None, True),
        "contact_lens_wear": contact_lens_wear,
        "started_wearing_since": _get_str(expanded, row, ["anam_start_before", "anam_start_before_p"], None, True),
        "stopped_wearing_since": _get_str(expanded, row, ["anam_stop_before", "anam_stop_before_p"], None, True),
        "additional_notes": _get_str(expanded, row, ["anam_remarks"], None, True),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_cover_test_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "deviation_type": _get_str(expanded, row, ["bino_ct_hp_type", "bino_ct_ht_type"], ["bino_ct_hp_type", "bino_ct_ht_type"], True),
        "deviation_direction": _get_str(expanded, row, ["bino_ct_selection"], ["bino_ct_selection"], True),
        "fv_1": _get_float(expanded, row, ["bino_ct_fv_exo_p"], ["bino_ct_fv_exo_p"]),
        "fv_2": _get_float(expanded, row, ["bino_ct_fv_eso_p"], ["bino_ct_fv_eso_p"]),
        "nv_1": _get_float(expanded, row, ["bino_ct_nv_exo_p"], ["bino_ct_nv_exo_p"]),
        "nv_2": _get_float(expanded, row, ["bino_ct_nv_eso_p"], ["bino_ct_nv_eso_p"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_fusion_range_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "fv_base_in": _get_float(expanded, row, ["bino_fr_fv_in_b"]),
        "fv_base_in_recovery": _get_float(expanded, row, ["bino_fr_fv_in_r"]),
        "fv_base_out": _get_float(expanded, row, ["bino_fr_fv_out_b"]),
        "fv_base_out_recovery": _get_float(expanded, row, ["bino_fr_fv_out_r"]),
        "nv_base_in": _get_float(expanded, row, ["bino_fr_nv_in_b"]),
        "nv_base_in_recovery": _get_float(expanded, row, ["bino_fr_nv_in_r"]),
        "nv_base_out": _get_float(expanded, row, ["bino_fr_nv_out_b"]),
        "nv_base_out_recovery": _get_float(expanded, row, ["bino_fr_nv_out_r"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_maddox_rod_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "schema_version": 2,
        "with_horizontal_prism": _get_optical_value(expanded, row, ["bino_mr_h_with"]),
        "with_horizontal_direction": _get_str(expanded, row, ["bino_mr_h_addw"]),
        "with_vertical_prism": _get_optical_value(expanded, row, ["bino_mt_v_with"]),
        "with_vertical_direction": _get_str(expanded, row, ["bino_mr_v_addw"]),
        "without_horizontal_prism": _get_optical_value(expanded, row, ["bino_mr_h_no"]),
        "without_horizontal_direction": _get_str(expanded, row, ["bino_mr_h_addn"]),
        "without_vertical_prism": _get_optical_value(expanded, row, ["bino_mr_v_no"]),
        "without_vertical_direction": _get_str(expanded, row, ["bino_mr_v_addn"]),
    }
    if any(v is not None for k, v in data.items() if k != "schema_version"):
        return data
    return None


def _build_stereo_test_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    fly_result = _get_bool(expanded, row, ["bino_st_fly"])
    data = {
        "fly_result": fly_result,
        "circle_9_score": _get_float(expanded, row, ["bino_st_cir_9"]),
        "circle_3_score": _get_float(expanded, row, ["bino_st_cir_3"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_rg_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    # Legacy codes have no reliable codebook; a wrong semantic mapping is worse
    # than an intentionally empty card.
    return None


def _build_schirmer_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_mm": _get_float(expanded, row, ["bio_shirmer_r_mm", "bio_shirmer_r"]),
        "l_mm": _get_float(expanded, row, ["bio_shirmer_l_mm", "bio_shirmer_l"]),
        "r_but": _get_float(expanded, row, ["bio_r_but"]),
        "l_but": _get_float(expanded, row, ["bio_l_but"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_contact_lens_diameters_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "pupil_diameter": _get_float(expanded, row, ["bio_pupil_diam"]),
        "corneal_diameter": _get_float(expanded, row, ["bio_cornia_diam"]),
        "eyelid_aperture": _get_float(expanded, row, ["bio_eyelid_distance"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_sensation_vision_stability_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sensation": _get_str(expanded, row, ["bio_r_lach", "bio_r_lens"], ["bio_r_lach", "bio_r_lens"], True),
        "l_sensation": _get_str(expanded, row, ["bio_l_lach", "bio_l_lens"], ["bio_l_lach", "bio_l_lens"], True),
        "r_vision": _get_str(expanded, row, ["fun_r_macula", "fun_r_pupil"], ["fun_r_macula", "fun_r_pupil"], True),
        "l_vision": _get_str(expanded, row, ["fun_l_macula", "fun_l_pupil"], ["fun_l_macula", "fun_l_pupil"], True),
        "r_stability": _get_str(expanded, row, ["fun_r_diska"], ["fun_r_diska"], True),
        "l_stability": _get_str(expanded, row, ["fun_l_diska"], ["fun_l_diska"], True),
        "r_movement": _get_str(expanded, row, ["bino_mw_exo"], ["bino_mw_exo"], True),
        "l_movement": _get_str(expanded, row, ["bino_mw_eso"], ["bino_mw_eso"], True),
        "r_recommendations": _get_str(expanded, row, ["subjective_remarks"], ["subjective_remarks"], True),
        "l_recommendations": _get_str(expanded, row, ["bino_remarks"], ["bino_remarks"], True),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def build_exam_data_from_eye_tests(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    builders: List[Tuple[str, Any]] = [
        ("old-ref", _build_old_ref_component),
        ("objective", _build_objective_component),
        ("subjective", _build_subjective_component),
        ("addition", _build_addition_component),
        ("final-subjective", _build_final_subjective_component),
        ("final-prescription", _build_final_prescription_component),
        ("compact-prescription", _build_compact_prescription_component),
        ("retinoscop", _build_retinoscop_component),
        ("retinoscop-dilation", _build_retinoscop_dilation_component),
        ("uncorrected-va", _build_uncorrected_va_component),
        ("keratometer-full", _build_keratometer_full_component),
        ("corneal-topography", _build_corneal_topography_component),
        ("anamnesis", _build_anamnesis_component),
        ("fusion-range", _build_fusion_range_component),
        ("maddox-rod", _build_maddox_rod_component),
        ("stereo-test", _build_stereo_test_component),
        ("rg", _build_rg_component),
        ("schirmer-test", _build_schirmer_component),
        ("contact-lens-diameters", _build_contact_lens_diameters_component),
    ]
    for key, builder in builders:
        block = builder(row, expanded)
        if block:
            data.update(_build_component_entry(key, block))
    old_tabs = build_old_refraction_tabs(expanded)
    if old_tabs:
        data.update(old_tabs)
    else:
        block = _build_old_refraction_component(row, expanded)
        if block:
            data.update(_build_component_entry("old-refraction", block))
    warnings: List[str] = []
    for component_key, block in data.items():
        if not isinstance(block, dict) or component_key == "__ui":
            continue
        card_instance_id = block.get("card_instance_id")
        if card_instance_id and component_key.endswith(str(card_instance_id)):
            continue
        for eye in ("r", "l", "comb"):
            far, near = block.get(f"{eye}_pd_far"), block.get(f"{eye}_pd_close")
            if isinstance(far, (int, float)) and isinstance(near, (int, float)) and near > far:
                warning = f"{component_key}: {eye.upper()} Near PD ({near}) exceeds Far PD ({far})"
                if warning not in warnings:
                    warnings.append(warning)
    if warnings:
        data["migration_warnings"] = warnings
    return data


def build_contact_fit_exam_data(row: Dict[str, Any]) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    observation = {
        "r_sensation": clean_legacy_text(row.get("obs_right_feeling")),
        "l_sensation": clean_legacy_text(row.get("obs_left_feeling")),
        "r_vision": clean_legacy_text(row.get("obs_right_sight")),
        "l_vision": clean_legacy_text(row.get("obs_left_sight")),
        "r_stability": clean_legacy_text(row.get("obs_right_stability")),
        "l_stability": clean_legacy_text(row.get("obs_left_stability")),
        "r_movement": clean_legacy_text(row.get("obs_right_movement")),
        "l_movement": clean_legacy_text(row.get("obs_left_movement")),
        "r_recommendations": clean_legacy_text(row.get("obs_right_recommend")),
        "l_recommendations": clean_legacy_text(row.get("obs_left_recommend")),
    }
    if any(v is not None for v in observation.values()):
        data.update(_build_component_entry("sensation-vision-stability", observation))

    old_lenses = {
        "r_lens_type": clean_legacy_text(row.get("old_right_type")), "l_lens_type": clean_legacy_text(row.get("old_left_type")),
        "r_supplier": clean_legacy_text(row.get("old_right_manuf")), "l_supplier": clean_legacy_text(row.get("old_left_manuf")),
        "r_model": clean_legacy_text(row.get("old_right_model")), "l_model": clean_legacy_text(row.get("old_left_model")),
        "r_bc": parse_float(row.get("old_right_bc")), "l_bc": parse_float(row.get("old_left_bc")),
        "r_diam": parse_float(row.get("old_right_diam")), "l_diam": parse_float(row.get("old_left_diam")),
        "r_sph": parse_optical_value(row.get("old_right_sph")), "l_sph": parse_optical_value(row.get("old_left_sph")),
        "r_cyl": parse_optical_value(row.get("old_right_cyl")), "l_cyl": parse_optical_value(row.get("old_left_cyl")),
        "r_ax": parse_int(row.get("old_right_ax")), "l_ax": parse_int(row.get("old_left_ax")),
        "r_va": parse_visual_acuity(row.get("old_right_va")), "l_va": parse_visual_acuity(row.get("old_left_va")),
        "r_j": normalize_j_value(row.get("old_right_j")), "l_j": normalize_j_value(row.get("old_left_j")),
        "comb_va": parse_visual_acuity(row.get("old_both_va")), "comb_j": normalize_j_value(row.get("old_both_j")),
    }
    if any(v is not None for v in old_lenses.values()): data.update(_build_component_entry("old-contact-lenses", old_lenses))

    objective = {
        "r_sph": parse_optical_value(row.get("obj_right_sph")), "l_sph": parse_optical_value(row.get("obj_left_sph")),
        "r_cyl": parse_optical_value(row.get("obj_right_cyl")), "l_cyl": parse_optical_value(row.get("obj_left_cyl")),
        "r_ax": parse_int(row.get("obj_right_ax")), "l_ax": parse_int(row.get("obj_left_ax")),
    }
    if any(v is not None for v in objective.values()): data.update(_build_component_entry("objective", objective))
    over = {
        "r_sph": parse_optical_value(row.get("or_right_sph")), "l_sph": parse_optical_value(row.get("or_left_sph")),
        "r_cyl": parse_optical_value(row.get("or_right_cyl")), "l_cyl": parse_optical_value(row.get("or_left_cyl")),
        "r_ax": parse_int(row.get("or_right_ax")), "l_ax": parse_int(row.get("or_left_ax")),
        "r_add": parse_optical_value(row.get("or_right_add")), "l_add": parse_optical_value(row.get("or_left_add")),
        "r_va": parse_visual_acuity(row.get("or_right_va")), "l_va": parse_visual_acuity(row.get("or_left_va")),
        "r_j": normalize_j_value(row.get("or_right_j")), "l_j": normalize_j_value(row.get("or_left_j")),
        "r_florescent": clean_legacy_text(row.get("or_right_florescent")), "l_florescent": clean_legacy_text(row.get("or_left_florescent")),
        "r_bio_m": clean_legacy_text(row.get("or_right_biom")), "l_bio_m": clean_legacy_text(row.get("or_left_biom")),
        "comb_va": parse_visual_acuity(row.get("or_both_va")), "comb_j": normalize_j_value(row.get("or_both_j")),
    }
    if any(v is not None for v in over.values()): data.update(_build_component_entry("over-refraction", over))
    for builder_key, builder in (("maddox-rod", _build_maddox_rod_component), ("stereo-test", _build_stereo_test_component), ("fusion-range", _build_fusion_range_component)):
        block = builder(row, row)
        if block: data.update(_build_component_entry(builder_key, block))
    notes = [("Fit remark", row.get("fit_remark")), ("Observation remarks", row.get("obs_remarks")), ("Fit remarks", row.get("fit_remarks"))]
    note_index = 0
    for title, raw_note in notes:
        note = clean_legacy_text(raw_note)
        if not note: continue
        note_index += 1
        card_id = f"notes-{note_index}"
        data[f"notes-{card_id}"] = {"card_instance_id": card_id, "title": title, "note": note}
        if "notes" not in data: data["notes"] = data[f"notes-{card_id}"]
    return data


def load_expanded_eye_tests(csv_dir: str, valid_account_codes: Set[str]) -> Dict[str, Dict[str, Any]]:
    mapping: Dict[str, Dict[str, Any]] = {}
    rows_iter = read_csv_streaming(csv_dir, "optic_exp_eyetests.csv")
    if rows_iter is None:
        return mapping
    for row in rows_iter:
        account_code_str = clean_legacy_text(row.get("account_code"))
        if not account_code_str or account_code_str not in valid_account_codes:
            continue
        code_str = clean_legacy_text(row.get("code"))
        if not code_str or code_str in mapping:
            continue
        mapping[code_str] = row
    return mapping


def parse_frame_dimensions(raw_value: Optional[str]) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    value = clean_legacy_text(raw_value)
    if not value:
        return None, None, None
    parts = [float(match) for match in re.findall(r"\d+(?:\.\d+)?", value)]
    if len(parts) >= 3:
        return parts[0], parts[1], parts[2]
    if len(parts) == 1:
        return parts[0], None, None
    return None, None, None


# ------------------------------
# Migration steps
# ------------------------------

def is_client_account(row: Dict[str, Any]) -> bool:
    raw = (
        row.get("account_type")
        or row.get("ACCOUNT_TYPE")
        or row.get("type")
        or row.get("Type")
        or ""
    )
    val = str(raw).strip(" '\"").upper()
    # Treat common legacy labels as clients
    return val in ("A", "CUST", "CUSTOMER")
