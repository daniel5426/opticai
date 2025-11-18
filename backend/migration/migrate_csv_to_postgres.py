import sys
import os
import csv
import json
import re
from datetime import datetime
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

from backend.database import SessionLocal
from backend.models import (
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
)


# ------------------------------
# Utility helpers
# ------------------------------

def parse_date(value: Optional[str]) -> Optional[datetime.date]:
    if not value:
        return None
    value = value.strip()
    if not value:
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
    if value is None:
        return None
    s = str(value).strip()
    if s == "" or s.isspace():
        return None
    
    s = s.replace(",", ".")
    
    if "." in s:
        return s
    
    if s.startswith("+") or s.startswith("-"):
        sign = s[0]
        digits = s[1:]
    else:
        sign = ""
        digits = s
    
    if not digits or not digits[0].isdigit():
        return None
    
    if len(digits) == 1:
        result = f"{sign}{digits}.0"
    else:
        units = digits[0]
        decimals = digits[1:]
        result = f"{sign}{units}.{decimals}"
    
    return result


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


def parse_visual_acuity(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    s = str(value).strip()
    if s == "" or s.isspace():
        return None
    
    match = re.match(r'^([+-]?\d+\.?\d*)', s)
    if match:
        base_str = match.group(1)
        try:
            base_value = float(base_str)
            if base_value > 1:
                return base_value / 10.0
            return base_value
        except ValueError:
            return None
    return None


def parse_bool_flag(value: Optional[str]) -> Optional[bool]:
    if value is None:
        return None
    s = str(value).strip().lower()
    if s in ("1", "true", "t", "yes", "y"):
        return True
    if s in ("0", "false", "f", "no", "n"):
        return False
    return None


def create_composite_client_id(clinic_id: Optional[int], account_code: str) -> int:
    if clinic_id is None:
        clinic_id = 0
    account_code_clean = "".join(ch for ch in str(account_code) if ch.isdigit())
    if not account_code_clean:
        raise ValueError(f"account_code '{account_code}' cannot be converted to numeric ID")
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


def read_csv(csv_dir: str, filename: str, max_items: Optional[int] = 1000) -> List[Dict[str, Any]]:
    path = os.path.join(csv_dir, filename)
    if not os.path.exists(path):
        return []
    encoding, dialect = _detect_csv_encoding_and_dialect(path)
    max_rows = max_items if max_items is not None else int(os.environ.get("CSV_MAX_ROWS", "5000"))
    result = []
    with open(path, "r", newline="", encoding=encoding, errors="ignore" if encoding == "latin-1" else "strict") as f:
        reader = csv.DictReader(f, dialect=dialect)
        for count, row in enumerate(reader):
            if count >= max_rows:
                print(f"[csv] {filename}: reached max_rows limit ({max_rows}), stopping", flush=True)
                break
            result.append(row)
    return result


def read_csv_streaming(csv_dir: str, filename: str, max_items: Optional[int] = 1000) -> Generator[Dict[str, Any], None, None]:
    path = os.path.join(csv_dir, filename)
    if not os.path.exists(path):
        return
    encoding, dialect = _detect_csv_encoding_and_dialect(path)
    max_rows = max_items if max_items is not None else int(os.environ.get("CSV_MAX_ROWS", "5000"))
    with open(path, "r", newline="", encoding=encoding, errors="ignore" if encoding == "latin-1" else "strict") as f:
        reader = csv.DictReader(f, dialect=dialect)
        count = 0
        for row in reader:
            if count >= max_rows:
                print(f"[csv] {filename}: reached max_rows limit ({max_rows}), stopping after {count} rows", flush=True)
                break
            yield row
            count += 1


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


def get_or_create_admin_user(db: Session, company: Company) -> User:
    user = db.execute(select(User).where(User.role_level == 4)).scalars().first()
    if user:
        return user
    user = User(
        company_id=company.id,
        clinic_id=None,
        full_name="System Administrator",
        username="admin",
        email="admin@opticai.local",
        phone=None,
        password="admin",
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
        layout_data=json.dumps({}),
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

def upsert_lookup_simple(db: Session, model, name: str):
    if not name:
        return None
    name = name.strip()
    if not name:
        return None
    existing = db.execute(select(model).where(model.name == name)).scalars().first()
    if existing:
        return existing
    obj = model(name=name)
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
        "r_k1": parse_float(row.get("cr_rv_right")),
        "l_k1": parse_float(row.get("cr_rv_left")),
        "r_k2": parse_float(row.get("cr_rh_right")),
        "l_k2": parse_float(row.get("cr_rh_left")),
        "r_axis": parse_int(row.get("cr_ax_right")),
        "l_axis": parse_int(row.get("cr_ax_left")),
    }
    if any(v is not None for v in r.values()):
        return r
    return None


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


def _get_int(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[int]:
    return _pick_value(expanded, row, expanded_keys, row_keys, parse_int)


def _get_bool(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[bool]:
    return _pick_value(expanded, row, expanded_keys, row_keys, parse_bool_flag)


def _get_va(expanded: Optional[Dict[str, Any]], row: Dict[str, Any], expanded_keys: Optional[List[str]] = None, row_keys: Optional[List[str]] = None) -> Optional[float]:
    return _pick_value(expanded, row, expanded_keys, row_keys, parse_visual_acuity)


def _build_old_ref_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "role": _get_str(expanded, row, ["old1_type"], None, True),
        "source": _get_str(expanded, row, ["old1_source"], None, True),
        "contacts": _get_str(expanded, row, ["old1_lens"], None, True),
    }
    if any(data.values()):
        return data
    return None


def _build_objective_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_float(expanded, row, ["obj_r_sph"], ["ob_right_sph"]),
        "l_sph": _get_float(expanded, row, ["obj_l_sph"], ["ob_left_sph"]),
        "r_cyl": _get_float(expanded, row, ["obj_r_cyl"], ["ob_right_cyl"]),
        "l_cyl": _get_float(expanded, row, ["obj_l_cyl"], ["ob_left_cyl"]),
        "r_ax": _get_int(expanded, row, ["obj_r_ax"], ["ob_right_ax"]),
        "l_ax": _get_int(expanded, row, ["obj_l_ax"], ["ob_left_ax"]),
        "r_se": _get_float(expanded, row, ["ob_right_se"]),
        "l_se": _get_float(expanded, row, ["ob_left_se"]),
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
        "r_sph": _get_float(expanded, row, ["sub_r_sph"], ["sb_right_sph"]),
        "l_sph": _get_float(expanded, row, ["sub_l_sph"], ["sb_left_sph"]),
        "r_cyl": _get_float(expanded, row, ["sub_r_cyl"], ["sb_right_cyl"]),
        "l_cyl": _get_float(expanded, row, ["sub_l_cyl"], ["sb_left_cyl"]),
        "r_ax": _get_int(expanded, row, ["sub_r_ax"], ["sb_right_ax"]),
        "l_ax": _get_int(expanded, row, ["sub_l_ax"], ["sb_left_ax"]),
        "r_pris": _get_float(expanded, row, ["sub_r_prish"], ["sb_right_pris"]),
        "l_pris": _get_float(expanded, row, ["sub_l_prish"], ["sb_left_pris"]),
        "r_base": _get_str(expanded, row, ["sub_r_baseh"], ["sb_right_base"]),
        "l_base": _get_str(expanded, row, ["sub_l_baseh"], ["sb_left_base"]),
        "r_va": _get_va(expanded, row, ["sub_r_va"], ["sb_right_va"]),
        "l_va": _get_va(expanded, row, ["sub_l_va"], ["sb_left_va"]),
        "r_ph": _get_str(expanded, row, ["sub_r_ph"], ["sb_right_ph"]),
        "l_ph": _get_str(expanded, row, ["sub_l_ph"], ["sb_left_ph"]),
        "r_pd_close": _get_float(expanded, row, ["sb_right_near_pd"], ["sb_right_near_pd"]),
        "l_pd_close": _get_float(expanded, row, ["sb_left_near_pd"], ["sb_left_near_pd"]),
        "r_pd_far": _get_float(expanded, row, ["patient_r_pd"], ["sb_right_far_pd"]),
        "l_pd_far": _get_float(expanded, row, ["patient_l_pd"], ["sb_left_far_pd"]),
        "comb_va": _get_va(expanded, row, ["sub_b_va"], ["sb_mid_va"]),
        "comb_pd_close": _get_float(expanded, row, ["sub_b_pd"], ["sb_mid_near_pd"]),
        "comb_pd_far": _get_float(expanded, row, ["patient_b_pd"], ["sb_mid_far_pd"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_addition_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_fcc": _get_str(expanded, row, ["add_right_fcc"], ["add_right_fcc"]),
        "l_fcc": _get_str(expanded, row, ["add_left_fcc"], ["add_left_fcc"]),
        "r_read": _get_float(expanded, row, ["add_right_read", "sub_r_read"], ["add_right_read"]),
        "l_read": _get_float(expanded, row, ["add_left_read", "sub_l_read"], ["add_left_read"]),
        "r_int": _get_float(expanded, row, ["add_right_int", "sub_r_int"], ["add_right_int"]),
        "l_int": _get_float(expanded, row, ["add_left_int", "sub_l_int"], ["add_left_int"]),
        "r_bif": _get_float(expanded, row, ["add_right_bif", "sub_r_bif"], ["add_right_bif"]),
        "l_bif": _get_float(expanded, row, ["add_left_bif", "sub_l_bif"], ["add_left_bif"]),
        "r_mul": _get_float(expanded, row, ["add_right_mul", "sub_r_mul"], ["add_right_mul"]),
        "l_mul": _get_float(expanded, row, ["add_left_mul", "sub_l_mul"], ["add_left_mul"]),
        "r_j": _get_str(expanded, row, ["add_right_j", "sub_r_j"], ["add_right_j"]),
        "l_j": _get_str(expanded, row, ["add_left_j", "sub_l_j"], ["add_left_j"]),
        "r_iop": _get_float(expanded, row, ["bio_r_iop"], ["iop_right"]),
        "l_iop": _get_float(expanded, row, ["bio_l_iop"], ["iop_left"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_old_refraction_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_float(expanded, row, ["or_right_sph"], ["or_right_sph"]),
        "l_sph": _get_float(expanded, row, ["or_left_sph"], ["or_left_sph"]),
        "r_cyl": _get_float(expanded, row, ["or_right_cyl"], ["or_right_cyl"]),
        "l_cyl": _get_float(expanded, row, ["or_left_cyl"], ["or_left_cyl"]),
        "r_ax": _get_int(expanded, row, ["or_right_ax"], ["or_right_ax"]),
        "l_ax": _get_int(expanded, row, ["or_left_ax"], ["or_left_ax"]),
        "r_pris": _get_float(expanded, row, ["or_right_pris"], ["or_right_pris"]),
        "l_pris": _get_float(expanded, row, ["or_left_pris"], ["or_left_pris"]),
        "r_base": _get_str(expanded, row, ["or_right_base"], ["or_right_base"]),
        "l_base": _get_str(expanded, row, ["or_left_base"], ["or_left_base"]),
        "r_va": _get_va(expanded, row, ["or_right_va"], ["or_right_va"]),
        "l_va": _get_va(expanded, row, ["or_left_va"], ["or_left_va"]),
        "r_ad": _get_float(expanded, row, ["or_right_add"], ["or_right_add"]),
        "l_ad": _get_float(expanded, row, ["or_left_add"], ["or_left_add"]),
        "comb_va": _get_va(expanded, row, ["or_mid_va"], ["or_mid_va"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_old_refraction_extension_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_float(expanded, row, ["old1_r_sph"]),
        "l_sph": _get_float(expanded, row, ["old1_l_sph"]),
        "r_cyl": _get_float(expanded, row, ["old1_r_cyl"]),
        "l_cyl": _get_float(expanded, row, ["old1_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["old1_r_ax"]),
        "l_ax": _get_int(expanded, row, ["old1_l_ax"]),
        "r_pr_h": _get_float(expanded, row, ["old1_r_prish"]),
        "l_pr_h": _get_float(expanded, row, ["old1_l_prish"]),
        "r_base_h": _get_str(expanded, row, ["old1_r_baseh"]),
        "l_base_h": _get_str(expanded, row, ["old1_l_baseh"]),
        "r_pr_v": _get_float(expanded, row, ["old1_r_prisv"]),
        "l_pr_v": _get_float(expanded, row, ["old1_l_prisv"]),
        "r_base_v": _get_str(expanded, row, ["old1_r_basev"]),
        "l_base_v": _get_str(expanded, row, ["old1_l_basev"]),
        "r_va": _get_va(expanded, row, ["old1_r_va"]),
        "l_va": _get_va(expanded, row, ["old1_l_va"]),
        "r_ad": _get_float(expanded, row, ["old1_r_add"]),
        "l_ad": _get_float(expanded, row, ["old1_l_add"]),
        "r_j": _get_str(expanded, row, ["old1_r_j"]),
        "l_j": _get_str(expanded, row, ["old1_l_j"]),
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
        "r_sph": _get_float(expanded, row, ["sub_f_r_sph"]),
        "l_sph": _get_float(expanded, row, ["sub_f_l_sph"]),
        "r_cyl": _get_float(expanded, row, ["sub_f_r_cyl"]),
        "l_cyl": _get_float(expanded, row, ["sub_f_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["sub_f_r_ax"]),
        "l_ax": _get_int(expanded, row, ["sub_f_l_ax"]),
        "r_pr_h": _get_float(expanded, row, ["sub_f_r_prish"]),
        "l_pr_h": _get_float(expanded, row, ["sub_f_l_prish"]),
        "r_base_h": _get_str(expanded, row, ["sub_f_r_baseh"]),
        "l_base_h": _get_str(expanded, row, ["sub_f_l_baseh"]),
        "r_pr_v": _get_float(expanded, row, ["sub_f_r_prisv"]),
        "l_pr_v": _get_float(expanded, row, ["sub_f_l_prisv"]),
        "r_base_v": _get_str(expanded, row, ["sub_f_r_basev"]),
        "l_base_v": _get_str(expanded, row, ["sub_f_l_basev"]),
        "r_va": _get_va(expanded, row, ["sub_f_r_va"]),
        "l_va": _get_va(expanded, row, ["sub_f_l_va"]),
        "r_j": _get_str(expanded, row, ["sub_f_r_j"]),
        "l_j": _get_str(expanded, row, ["sub_f_l_j"]),
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
        "r_sph": _get_float(expanded, row, ["sub_f_r_sph"]),
        "l_sph": _get_float(expanded, row, ["sub_f_l_sph"]),
        "r_cyl": _get_float(expanded, row, ["sub_f_r_cyl"]),
        "l_cyl": _get_float(expanded, row, ["sub_f_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["sub_f_r_ax"]),
        "l_ax": _get_int(expanded, row, ["sub_f_l_ax"]),
        "r_pris": _get_float(expanded, row, ["sub_f_r_prish"]),
        "l_pris": _get_float(expanded, row, ["sub_f_l_prish"]),
        "r_base": _get_str(expanded, row, ["sub_f_r_baseh"]),
        "l_base": _get_str(expanded, row, ["sub_f_l_baseh"]),
        "r_va": _get_va(expanded, row, ["sub_f_r_va"]),
        "l_va": _get_va(expanded, row, ["sub_f_l_va"]),
        "r_ad": _get_float(expanded, row, ["sub_r_add_at"]),
        "l_ad": _get_float(expanded, row, ["sub_l_add_at"]),
        "r_pd": _get_float(expanded, row, ["sub_f_r_far_pd"]),
        "l_pd": _get_float(expanded, row, ["sub_f_l_far_pd"]),
        "comb_va": _get_va(expanded, row, ["sub_f_b_va"]),
        "comb_pd": _get_float(expanded, row, ["sub_f_b_far_pd"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_compact_prescription_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sph": _get_float(expanded, row, ["sub_f_r_sph"]),
        "l_sph": _get_float(expanded, row, ["sub_f_l_sph"]),
        "r_cyl": _get_float(expanded, row, ["sub_f_r_cyl"]),
        "l_cyl": _get_float(expanded, row, ["sub_f_l_cyl"]),
        "r_ax": _get_int(expanded, row, ["sub_f_r_ax"]),
        "l_ax": _get_int(expanded, row, ["sub_f_l_ax"]),
        "r_pris": _get_float(expanded, row, ["sub_f_r_prish"]),
        "l_pris": _get_float(expanded, row, ["sub_f_l_prish"]),
        "r_base": _get_str(expanded, row, ["sub_f_r_baseh"]),
        "l_base": _get_str(expanded, row, ["sub_f_l_baseh"]),
        "r_va": _get_va(expanded, row, ["sub_f_r_va"]),
        "l_va": _get_va(expanded, row, ["sub_f_l_va"]),
        "r_ad": _get_float(expanded, row, ["sub_f_r_near_pd"]),
        "l_ad": _get_float(expanded, row, ["sub_f_l_near_pd"]),
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
        "r_sph": _get_float(expanded, row, ["obj_r_sph"]),
        "l_sph": _get_float(expanded, row, ["obj_l_sph"]),
        "r_cyl": _get_float(expanded, row, ["obj_r_cyl"]),
        "l_cyl": _get_float(expanded, row, ["obj_l_cyl"]),
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
        "r_sph": _get_float(expanded, row, ["obj_w_r_sph"]),
        "l_sph": _get_float(expanded, row, ["obj_w_l_sph"]),
        "r_cyl": _get_float(expanded, row, ["obj_w_r_cyl"]),
        "l_cyl": _get_float(expanded, row, ["obj_w_l_cyl"]),
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
    data = {
        "r_dpt_k1": _get_float(expanded, row, ["obj_k_r_dpt1"]),
        "r_dpt_k2": _get_float(expanded, row, ["obj_k_r_dpt2"]),
        "l_dpt_k1": _get_float(expanded, row, ["obj_k_l_dpt1"]),
        "l_dpt_k2": _get_float(expanded, row, ["obj_k_l_dpt2"]),
        "r_mm_k1": _get_float(expanded, row, ["obj_k_r_mm1"]),
        "r_mm_k2": _get_float(expanded, row, ["obj_k_r_mm2"]),
        "l_mm_k1": _get_float(expanded, row, ["obj_k_l_mm1"]),
        "l_mm_k2": _get_float(expanded, row, ["obj_k_l_mm2"]),
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
        "card_instance_id": "legacy",
        "card_id": "legacy",
        "tab_index": 0,
        "deviation_type": _get_str(expanded, row, ["bino_ct_hp_type", "bino_ct_ht_type"], None, True),
        "deviation_direction": _get_str(expanded, row, ["bino_ct_selection"], None, True),
        "fv_1": _get_float(expanded, row, ["bino_ct_fv_exo_p"]),
        "fv_2": _get_float(expanded, row, ["bino_ct_fv_eso_p"]),
        "nv_1": _get_float(expanded, row, ["bino_ct_nv_exo_p"]),
        "nv_2": _get_float(expanded, row, ["bino_ct_nv_eso_p"]),
    }
    meaningful = {k: v for k, v in data.items() if k not in ("card_instance_id", "card_id", "tab_index")}
    if any(v is not None for v in meaningful.values()):
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
        "c_r_h": _get_str(expanded, row, ["bino_mr_h_with"]),
        "c_r_v": _get_str(expanded, row, ["bino_mr_v_with"]),
        "c_l_h": _get_str(expanded, row, ["bino_mr_h_no"]),
        "c_l_v": _get_str(expanded, row, ["bino_mr_v_no"]),
        "wc_r_h": _get_str(expanded, row, ["bino_mr_h_addw"]),
        "wc_r_v": _get_str(expanded, row, ["bino_mr_v_addw"]),
        "wc_l_h": _get_str(expanded, row, ["bino_mr_h_addn"]),
        "wc_l_v": _get_str(expanded, row, ["bino_mr_v_addn"]),
    }
    if any(data.values()):
        return data
    return None


def _build_stereo_test_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    fly_result = _get_bool(expanded, row, ["bino_st_fly"])
    data = {
        "fly_result": fly_result,
        "circle_score": _get_float(expanded, row, ["bino_st_cir_9"]),
        "circle_max": _get_float(expanded, row, ["bino_st_cir_3"]),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def _build_rg_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "rg_status": _get_str(expanded, row, ["bino_rg_selection"], None, True),
        "suppressed_eye": _get_str(expanded, row, ["bino_rg_supp_eye"], None, True),
    }
    if any(data.values()):
        return data
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


def _build_notes_component(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    data = {
        "r_sensation": _get_str(expanded, row, ["bio_r_lach", "bio_r_lens"], None, True),
        "l_sensation": _get_str(expanded, row, ["bio_l_lach", "bio_l_lens"], None, True),
        "r_vision": _get_str(expanded, row, ["fun_r_macula", "fun_r_pupil"], None, True),
        "l_vision": _get_str(expanded, row, ["fun_l_macula", "fun_l_pupil"], None, True),
        "r_stability": _get_str(expanded, row, ["fun_r_diska"], None, True),
        "l_stability": _get_str(expanded, row, ["fun_l_diska"], None, True),
        "r_movement": _get_str(expanded, row, ["bino_mw_exo"], None, True),
        "l_movement": _get_str(expanded, row, ["bino_mw_eso"], None, True),
        "r_recommendations": _get_str(expanded, row, ["subjective_remarks"], None, True),
        "l_recommendations": _get_str(expanded, row, ["bino_remarks"], None, True),
    }
    if any(v is not None for v in data.values()):
        return data
    return None


def build_exam_data_from_eye_tests(row: Dict[str, Any], expanded: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    builders: List[Tuple[str, Any]] = [
        ("old-ref", _build_old_ref_component),
        ("old-refraction", _build_old_refraction_component),
        ("old-refraction-extension", _build_old_refraction_extension_component),
        ("objective", _build_objective_component),
        ("subjective", _build_subjective_component),
        ("addition", _build_addition_component),
        ("final-subjective", _build_final_subjective_component),
        ("final-prescription", _build_final_prescription_component),
        ("compact-prescription", _build_compact_prescription_component),
        ("retinoscop", _build_retinoscop_component),
        ("retinoscop-dilation", _build_retinoscop_dilation_component),
        ("uncorrected-va", _build_uncorrected_va_component),
        ("keratometer", _build_keratometer_component),
        ("keratometer-full", _build_keratometer_full_component),
        ("corneal-topography", _build_corneal_topography_component),
        ("anamnesis", _build_anamnesis_component),
        ("cover-test", _build_cover_test_component),
        ("fusion-range", _build_fusion_range_component),
        ("maddox-rod", _build_maddox_rod_component),
        ("stereo-test", _build_stereo_test_component),
        ("rg", _build_rg_component),
        ("schirmer-test", _build_schirmer_component),
        ("contact-lens-diameters", _build_contact_lens_diameters_component),
        ("notes", _build_notes_component),
    ]
    for key, builder in builders:
        block = builder(row, expanded)
        if block:
            data[key] = block
    return data


def load_expanded_eye_tests(csv_dir: str, valid_account_codes: Set[str]) -> Dict[str, Dict[str, Any]]:
    mapping: Dict[str, Dict[str, Any]] = {}
    rows_iter = read_csv_streaming(csv_dir, "optic_exp_eyetests.csv")
    if rows_iter is None:
        return mapping
    for row in rows_iter:
        account_code = row.get("account_code")
        if account_code is None:
            continue
        account_code_str = str(account_code).strip()
        if not account_code_str or account_code_str not in valid_account_codes:
            continue
        code_value = row.get("code")
        if code_value is None:
            continue
        code_str = str(code_value).strip()
        if not code_str or code_str in mapping:
            continue
        mapping[code_str] = row
    return mapping


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

def migrate_lookups(db: Session, csv_dir: str):
    t0 = time.time()
    print("[lookups] starting...", flush=True)
    simple_mappings: List[Tuple[str, Any]] = [
        ("optic_tv_lens_supplier.csv", LookupSupplier),
        ("optic_tv_lens_model.csv", LookupLensModel),
        ("optic_tv_lens_mater.csv", LookupMaterial),
        ("optic_tv_lens_color.csv", LookupColor),
        ("optic_tv_lens_coat.csv", LookupCoating),
        ("optic_tv_frame_model.csv", LookupFrameModel),
        ("optic_tv_frame_manuf.csv", LookupManufacturer),
        ("optic_tv_contact_type.csv", LookupContactLensType),
        ("optic_tv_contact_model.csv", LookupContactEyeLensType),
        ("optic_tv_contact_manuf.csv", LookupManufacturer),
        ("optic_tv_contact_color.csv", LookupColor),
        ("optic_tv_contact_mater.csv", LookupContactEyeMaterial),
        ("optic_tv_clean_sol.csv", LookupCleaningSolution),
        ("optic_tv_dis_sol.csv", LookupDisinfectionSolution),
        ("optic_tv_wash_sol.csv", LookupRinsingSolution),
        ("optic_tv_order_type.csv", LookupOrderType),
        ("account_tv_memo_type.csv", LookupReferralType),
    ]
    for filename, model in simple_mappings:
        rows = read_csv(csv_dir, filename)
        print(f"[lookups] {filename}: {len(rows)} rows", flush=True)
        for r in rows:
            name = (r.get("name") or "").strip()
            upsert_lookup_simple(db, model, name)
    print(f"[lookups] done in {time.time()-t0:.2f}s", flush=True)


def collect_branch_codes(csv_dir: str) -> List[str]:
    codes: List[str] = []
    seen = set()
    for r in read_csv_streaming(csv_dir, "account.csv"):
        bc = r.get("branch_code")
        if bc and bc not in seen:
            codes.append(bc)
            seen.add(bc)
    print(f"[accounts] distinct branch codes: {len(codes)}", flush=True)
    return codes


def migrate_clients_and_families(db: Session, csv_dir: str, company: Company, return_only: bool = False, target_clinic_id: Optional[int] = None) -> Tuple[Dict[str, int], Dict[str, int]]:
    # Returns: account_code -> client_id, head_of_family -> family_id
    t0 = time.time()
    account_to_client: Dict[str, int] = {}
    head_to_family: Dict[str, int] = {}
    row_count = 0

    if return_only:
        print("[accounts] return_only mode enabled — mapping existing clients", flush=True)
        all_clients = db.execute(select(Client)).scalars().all()
        by_national_id: Dict[str, List[Client]] = {}
        by_email: Dict[str, List[Client]] = {}
        by_mobile: Dict[str, List[Client]] = {}
        by_home: Dict[str, List[Client]] = {}
        by_work: Dict[str, List[Client]] = {}
        by_name_dob: Dict[Tuple[str, str, Optional[datetime.date]], List[Client]] = {}

        def norm_phone(s: Optional[str]) -> Optional[str]:
            if not s:
                return None
            digits = "".join(ch for ch in str(s) if ch.isdigit())
            return digits or None

        def norm_email(s: Optional[str]) -> Optional[str]:
            if not s:
                return None
            s2 = str(s).strip().lower()
            return s2 or None

        for c in all_clients:
            if c.national_id:
                by_national_id.setdefault(c.national_id, []).append(c)
            em = norm_email(c.email)
            if em:
                by_email.setdefault(em, []).append(c)
            m = norm_phone(c.phone_mobile)
            if m:
                by_mobile.setdefault(m, []).append(c)
            h = norm_phone(c.phone_home)
            if h:
                by_home.setdefault(h, []).append(c)
            w = norm_phone(c.phone_work)
            if w:
                by_work.setdefault(w, []).append(c)
            fn = (c.first_name or "").strip()
            ln = (c.last_name or "").strip()
            key = (fn, ln, c.date_of_birth)
            by_name_dob.setdefault(key, []).append(c)

        def find_client_for_row(r: Dict[str, Any]) -> Optional[Client]:
            nid = (r.get("id_number") or None)
            if nid and nid in by_national_id:
                return by_national_id[nid][0]
            em = norm_email(r.get("e_mail"))
            if em and em in by_email:
                return by_email[em][0]
            m = norm_phone(r.get("mobile_phone"))
            if m and m in by_mobile:
                return by_mobile[m][0]
            h = norm_phone(r.get("phone1"))
            if h and h in by_home:
                return by_home[h][0]
            w = norm_phone(r.get("phone2"))
            if w and w in by_work:
                return by_work[w][0]
            fn = (r.get("first_name") or "").strip()
            ln = (r.get("last_name") or "").strip()
            dob = parse_date(r.get("birth_date"))
            key = (fn, ln, dob)
            if fn or ln:
                cand = by_name_dob.get(key)
                if cand:
                    return cand[0]
            return None

        rows_iter = read_csv_streaming(csv_dir, "account.csv")
        for r in rows_iter:
            row_count += 1
            if not is_client_account(r):
                continue
            acc = r.get("account_code")
            if acc is None:
                continue
            client = find_client_for_row(r)
            if client is None:
                continue
            account_to_client[str(acc)] = client.id

        rows_iter = read_csv_streaming(csv_dir, "account.csv")
        for r in rows_iter:
            if not is_client_account(r):
                continue
            head = r.get("head_of_family")
            if not head or head in head_to_family:
                continue
            acc_head = str(head)
            cid = account_to_client.get(acc_head)
            if not cid:
                continue
            c = db.get(Client, cid)
            if c and c.family_id:
                head_to_family[acc_head] = c.family_id

        print(f"[accounts] mapped existing clients: {len(account_to_client)} from {row_count} rows in {time.time()-t0:.2f}s", flush=True)
        return account_to_client, head_to_family

    # Create clinics first based on branch codes present
    branch_to_clinic: Dict[str, int] = {}
    if target_clinic_id is not None:
        branch_codes = collect_branch_codes(csv_dir)
        for bc in branch_codes:
            branch_to_clinic[bc] = target_clinic_id
        print(f"[accounts] mapping all branch codes to target clinic {target_clinic_id}", flush=True)
    else:
        for bc in collect_branch_codes(csv_dir):
            clinic = get_or_create_clinic(db, company, bc)
            branch_to_clinic[bc] = clinic.id
        print(f"[accounts] clinics created/ensured: {len(branch_to_clinic)}", flush=True)

    # Pre-compute a preferred last name per head_of_family for naming the family
    # Preference: if a row's account_code equals head_of_family and has last_name -> priority 0
    # Otherwise any row in that head group with last_name -> priority 1
    head_name_pref: Dict[str, Tuple[int, str]] = {}
    rows_iter = read_csv_streaming(csv_dir, "account.csv")
    for r in rows_iter:
        row_count += 1
        if not is_client_account(r):
            continue
        head = r.get("head_of_family")
        if head:
            head = str(head).strip()
        if not head:
            continue
        last_name = (r.get("last_name") or "").strip()
        if not last_name:
            continue
        priority = 1
        try:
            if str(r.get("account_code")).strip() == head:
                priority = 0
        except Exception:
            priority = 1
        current = head_name_pref.get(head)
        if current is None or priority < current[0]:
            head_name_pref[head] = (priority, last_name)
    print(f"[accounts] total rows: {row_count}", flush=True)

    # First pass: create families by head_of_family
    family_count = 0
    pending = 0
    batch_families: List[Tuple[Family, str]] = []
    rows_iter = read_csv_streaming(csv_dir, "account.csv")
    for r in rows_iter:
        if not is_client_account(r):
            continue
        head = r.get("head_of_family")
        if head:
            head = str(head).strip()
        if head and head not in head_to_family:
            clinic_id = branch_to_clinic.get(r.get("branch_code"))
            # Use preferred last name for family name
            family_last = None
            pref = head_name_pref.get(head)
            if pref:
                family_last = pref[1]
            if not family_last:
                family_last = (r.get("last_name") or "").strip()
            family_name = family_last if family_last else "משפחה"
            fam = Family(
                clinic_id=clinic_id,
                name=family_name,
                notes="Migrated family",
            )
            batch_families.append((fam, head))
            pending += 1
            if pending % 5000 == 0:
                families_only = [f[0] for f in batch_families]
                db.bulk_save_objects(families_only, return_defaults=True)
                db.flush()
                for fam_obj, head_val in batch_families:
                    head_to_family[head_val] = fam_obj.id
                batch_families.clear()
                pending = 0
            family_count += 1
            if family_count % 1000 == 0:
                print(f"[accounts] families created: {family_count}", flush=True)
    if batch_families:
        families_only = [f[0] for f in batch_families]
        db.bulk_save_objects(families_only, return_defaults=True)
        db.flush()
        for fam_obj, head_val in batch_families:
            head_to_family[head_val] = fam_obj.id
    db.commit()

    # Second pass: create clients
    client_count = 0
    pending = 0
    batch_clients: List[Tuple[Dict[str, Any], str, int]] = []
    rows_iter = read_csv_streaming(csv_dir, "account.csv")
    batch_size = min(30000, int(os.environ.get("CSV_MAX_ROWS", "5000")))
    try:
        for r in rows_iter:
            if not is_client_account(r):
                continue
            bc = r.get("branch_code")
            clinic_id = branch_to_clinic.get(bc)

            gender = None
            sx = (r.get("sex") or "").strip()
            if sx == "1":
                gender = "male"
            elif sx == "2":
                gender = "female"

            address_number = None
            house_num = r.get("house_num")
            apt = r.get("apartment_num")
            if house_num:
                address_number = str(house_num)
                if apt:
                    address_number = f"{address_number}/{apt}"

            raw_account_code = r.get("account_code")
            if raw_account_code is None:
                continue
            account_code = str(raw_account_code).strip()
            if not account_code:
                continue
            
            try:
                composite_id = create_composite_client_id(clinic_id, account_code)
            except ValueError as e:
                print(f"[accounts] Skipping account_code '{account_code}': {e}", flush=True)
                continue
            
            client_dict = {
                "id": composite_id,
                "clinic_id": clinic_id,
                "first_name": r.get("first_name") or None,
                "last_name": r.get("last_name") or None,
                "gender": gender,
                "national_id": r.get("id_number") or None,
                "date_of_birth": parse_date(r.get("birth_date")),
                "address_city": r.get("city") or None,
                "address_street": r.get("street") or None,
                "address_number": address_number,
                "postal_code": r.get("zip_code") or None,
                "phone_home": r.get("phone1") or None,
                "phone_work": r.get("phone2") or None,
                "phone_mobile": r.get("mobile_phone") or None,
                "email": r.get("e_mail") or None,
                "price_list": None,
                "discount_percent": parse_int(r.get("discount_precent")) or 0,
                "blocked_checks": parse_bool_flag(r.get("check_blocked")),
                "blocked_credit": parse_bool_flag(r.get("credit_blocked")),
                "sorting_group": r.get("acc_sort_group") or None,
                "file_creation_date": parse_date(r.get("open_date")),
                "occupation": r.get("occupation") or None,
                "status": r.get("account_status") or None,
                "notes": r.get("remarks") or None,
                "file_location": r.get("file_location") or None,
                "family_id": head_to_family.get(str(r.get("head_of_family")).strip() if r.get("head_of_family") else None),
            }
            batch_clients.append((client_dict, account_code, composite_id))
            pending += 1
            if pending % batch_size == 0:
                print(f"[accounts] flushing batch of {len(batch_clients)} clients", flush=True)
                clients_dicts = [c[0] for c in batch_clients]
                db.bulk_insert_mappings(Client, clients_dicts)
                db.flush()
                
                for _, acc_code, comp_id in batch_clients:
                    account_to_client[acc_code] = comp_id
                
                batch_clients.clear()
                pending = 0
            client_count += 1
            if client_count % 1000 == 0:
                print(f"[accounts] clients created: {client_count}", flush=True)
    finally:
        if batch_clients:
            print(f"[accounts] flushing final batch of {len(batch_clients)} clients", flush=True)
            clients_dicts = [c[0] for c in batch_clients]
            db.bulk_insert_mappings(Client, clients_dicts)
            db.flush()
            print(f"[accounts] mapping {len(batch_clients)} client IDs", flush=True)
            
            for _, acc_code, comp_id in batch_clients:
                account_to_client[acc_code] = comp_id
            
            print(f"[accounts] committing final batch", flush=True)
        db.commit()
        print(f"[accounts] commit completed", flush=True)
        
        try:
            max_id_result = db.execute(text("SELECT MAX(id) FROM clients")).scalar()
            max_id = max_id_result if max_id_result else 0
            if max_id > 0:
                db.execute(text(f"SELECT setval('clients_id_seq', {max_id})"))
                db.commit()
                print(f"[accounts] Updated clients_id_seq to {max_id}", flush=True)
        except Exception as e:
            print(f"[accounts] Warning: Could not update sequence: {e}", flush=True)

    print(f"[accounts] families: {family_count}, clients: {client_count}, took {time.time()-t0:.2f}s", flush=True)
    return account_to_client, head_to_family


def migrate_optical_exams(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    valid_account_codes = set(account_to_client.keys())
    sample_mapping_keys = list(valid_account_codes)[:5] if valid_account_codes else []
    print(f"[exams] filtering exams to {len(valid_account_codes)} valid account codes, sample keys: {sample_mapping_keys}", flush=True)
    expanded_rows = load_expanded_eye_tests(csv_dir, valid_account_codes)
    print(f"[exams] loaded {len(expanded_rows)} expanded exam rows", flush=True)
    
    clinic_to_layout: Dict[int, int] = {}

    count = 0
    pending = 0
    batch_exams: List[Tuple[OpticalExam, Dict[str, Any], Optional[int]]] = []
    batch_instances: List[ExamLayoutInstance] = []
    rows_iter = read_csv_streaming(csv_dir, "optic_eye_tests.csv")
    skipped_count = 0
    sample_missing_codes = []
    for r in rows_iter:
        raw_account_code = r.get("account_code")
        if raw_account_code is None:
            skipped_count += 1
            if len(sample_missing_codes) < 5:
                sample_missing_codes.append(("None", "missing"))
            continue
        account_code = str(raw_account_code).strip()
        if not account_code:
            skipped_count += 1
            if len(sample_missing_codes) < 5:
                sample_missing_codes.append((str(raw_account_code), "empty_after_strip"))
            continue
        if account_code not in valid_account_codes:
            skipped_count += 1
            if len(sample_missing_codes) < 5:
                sample_missing_codes.append((account_code, "not_in_mapping"))
            continue
        client_id = account_to_client[account_code]
        if client_id is None:
            skipped_count += 1
            if len(sample_missing_codes) < 5:
                sample_missing_codes.append((account_code, "null_client_id"))
            continue

        branch_code = r.get("branch_code") or None
        clinic_id = None
        if branch_code and branch_code in branch_to_clinic:
            clinic_id = branch_to_clinic[branch_code]

        exam_date = parse_date(r.get("test_date"))
        exam_code_value = r.get("code")
        expanded_row = None
        if exam_code_value is not None:
            expanded_row = expanded_rows.get(str(exam_code_value).strip())
        
        dominant_eye_raw = r.get("dominant_eye")
        dominant_eye = None
        if dominant_eye_raw:
            dominant_eye_str = str(dominant_eye_raw).strip().upper()
            if dominant_eye_str in ("R", "L", "RIGHT", "LEFT"):
                dominant_eye = "R" if dominant_eye_str in ("R", "RIGHT") else "L"
        
        test_reason = r.get("test_reason")
        test_name = "Migrated Exam"
        if test_reason:
            test_reason_str = str(test_reason).strip()
            if test_reason_str:
                test_name = test_reason_str

        exam = OpticalExam(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            exam_date=exam_date,
            test_name=test_name,
            dominant_eye=dominant_eye,
            type="exam",
        )
        data = build_exam_data_from_eye_tests(r, expanded_row)
        batch_exams.append((exam, data, clinic_id))
        pending += 1
        if pending % 5000 == 0:
            exams_only = [e[0] for e in batch_exams if e[0].client_id is not None]
            if exams_only:
                db.bulk_save_objects(exams_only, return_defaults=True)
                db.flush()
                saved_exams = set(exams_only)
                for exam_obj, exam_data, exam_clinic_id in batch_exams:
                    if exam_obj not in saved_exams:
                        continue
                    if exam_clinic_id:
                        if exam_clinic_id not in clinic_to_layout:
                            clinic = db.get(Clinic, exam_clinic_id)
                            layout = get_or_create_default_exam_layout(db, clinic)
                            clinic_to_layout[exam_clinic_id] = layout.id
                        layout_id = clinic_to_layout[exam_clinic_id]
                    else:
                        if None not in clinic_to_layout:
                            layout = get_or_create_default_exam_layout(db, None)
                            clinic_to_layout[None] = layout.id
                        layout_id = clinic_to_layout[None]
                    layout_instance = ExamLayoutInstance(
                        exam_id=exam_obj.id,
                        layout_id=layout_id,
                        is_active=False,
                        order=0,
                        exam_data=exam_data,
                    )
                    batch_instances.append(layout_instance)
            db.bulk_save_objects(batch_instances, return_defaults=True)
            db.flush()
            batch_exams.clear()
            batch_instances.clear()
            pending = 0

        count += 1
        if count % 500 == 0:
            print(f"[exams] processed: {count}", flush=True)
    if batch_exams:
        exams_only = [e[0] for e in batch_exams if e[0].client_id is not None]
        if exams_only:
            db.bulk_save_objects(exams_only, return_defaults=True)
            db.flush()
            saved_exams = set(exams_only)
            for exam_obj, exam_data, exam_clinic_id in batch_exams:
                if exam_obj not in saved_exams:
                    continue
                if exam_clinic_id:
                    if exam_clinic_id not in clinic_to_layout:
                        clinic = db.get(Clinic, exam_clinic_id)
                        layout = get_or_create_default_exam_layout(db, clinic)
                        clinic_to_layout[exam_clinic_id] = layout.id
                    layout_id = clinic_to_layout[exam_clinic_id]
                else:
                    if None not in clinic_to_layout:
                        layout = get_or_create_default_exam_layout(db, None)
                        clinic_to_layout[None] = layout.id
                    layout_id = clinic_to_layout[None]
                layout_instance = ExamLayoutInstance(
                    exam_id=exam_obj.id,
                    layout_id=layout_id,
                    is_active=False,
                    order=0,
                    exam_data=exam_data,
                )
                batch_instances.append(layout_instance)
            if batch_instances:
                db.bulk_save_objects(batch_instances, return_defaults=True)
    db.commit()
    debug_msg = ""
    if sample_missing_codes:
        debug_msg = f", sample missing codes: {sample_missing_codes[:3]}"
    print(f"[exams] inserted total: {count}, skipped: {skipped_count}{debug_msg}, took {time.time()-t0:.2f}s", flush=True)


def migrate_contact_lens_orders(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int) -> Dict[str, int]:
    t0 = time.time()
    valid_account_codes = set(account_to_client.keys())
    print(f"[cl_orders] filtering orders to {len(valid_account_codes)} valid account codes", flush=True)
    rows_iter = read_csv_streaming(csv_dir, "optic_contact_presc.csv")
    presc_code_to_order_id: Dict[str, int] = {}
    count = 0
    skipped_count = 0
    pending = 0
    for r in rows_iter:
        raw_account_code = r.get("account_code")
        if raw_account_code is None:
            skipped_count += 1
            continue
        account_code = str(raw_account_code).strip()
        if not account_code or account_code not in valid_account_codes:
            skipped_count += 1
            continue
        client_id = account_to_client[account_code]
        if client_id is None:
            skipped_count += 1
            continue
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        order_date = parse_date(r.get("presc_date"))

        supply_branch = r.get("supply_branch")
        supply_in_clinic_id = branch_to_clinic.get(supply_branch) if supply_branch in (branch_to_clinic or {}) else None

        order_status_raw = r.get("order_status")
        order_status = str(order_status_raw) if order_status_raw is not None and str(order_status_raw).strip() != "" else None
        advisor_code = r.get("advisor_code")
        advisor = str(advisor_code) if advisor_code is not None and str(advisor_code).strip() != "" else None
        
        treatment_type = r.get("treatment_type")
        order_type = "contact_lens"
        if treatment_type:
            treatment_type_str = str(treatment_type).strip()
            if treatment_type_str:
                order_type = treatment_type_str

        order = ContactLensOrder(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            order_date=order_date,
            type=order_type,
            order_status=order_status,
            advisor=advisor,
            supply_in_clinic_id=supply_in_clinic_id,
        )
        data: Dict[str, Any] = {}

        order_block = {
            "cleaning_solution": (r.get("clean_sol") or None),
            "disinfection_solution": (r.get("dis_sol") or None),
            "rinsing_solution": (r.get("wash_sol") or None),
            "priority": str(r.get("order_iner_priority")) if r.get("order_iner_priority") not in (None, "") else None,
            "approval_date": (r.get("given_at") or None),
            "promise_to_date": (r.get("promise_to_date") or None),
        }
        if any(v is not None for v in order_block.values()):
            data["contact-lens-order"] = order_block

        details_block = {
            "l_lens_type": (r.get("left_type") or None),
            "l_model": (r.get("left_model") or None),
            "l_supplier": (r.get("left_manuf") or None),
            "l_material": (r.get("left_mater") or None),
            "l_color": (r.get("left_color") or None),
            "l_quantity": parse_int(r.get("left_qty")),
            "l_order_quantity": parse_int(r.get("left_order_qty")),
            "r_lens_type": (r.get("right_type") or None),
            "r_model": (r.get("right_model") or None),
            "r_supplier": (r.get("right_manuf") or None),
            "r_material": (r.get("right_mater") or None),
            "r_color": (r.get("right_color") or None),
            "r_quantity": parse_int(r.get("right_qty")),
            "r_order_quantity": parse_int(r.get("right_order_qty")),
        }
        if any(v is not None for v in details_block.values()):
            data["contact-lens-details"] = details_block

        exam_block = {
            "l_bc": (r.get("left_bc1") or None),
            "l_bc_2": (r.get("left_bc2") or None),
            "l_oz": (r.get("left_oz") or None),
            "l_diam": parse_float(r.get("left_diam")),
            "l_sph": parse_float(r.get("left_sph")),
            "l_cyl": parse_float(r.get("left_cyl")),
            "l_ax": parse_int(r.get("left_ax")),
            "l_va": (r.get("left_va") or None),
            "l_read_ad": (r.get("left_read") or None),
            "l_j": (r.get("left_j") or None),
            "r_bc": (r.get("right_bc1") or None),
            "r_bc_2": (r.get("right_bc2") or None),
            "r_oz": (r.get("right_oz") or None),
            "r_diam": parse_float(r.get("right_diam")),
            "r_sph": parse_float(r.get("right_sph")),
            "r_cyl": parse_float(r.get("right_cyl")),
            "r_ax": parse_int(r.get("right_ax")),
            "r_va": (r.get("right_va") or None),
            "r_read_ad": (r.get("right_read") or None),
            "r_j": (r.get("right_j") or None),
            "comb_va": parse_float(r.get("mid_va")),
        }
        if any(v is not None for v in exam_block.values()):
            data["contact-lens-exam"] = exam_block

        ker_block = {
            "l_rv": parse_float(r.get("cr_left_rv")),
            "l_rh": parse_float(r.get("cr_left_rh")),
            "l_avg": parse_float(r.get("cr_left_avg")),
            "l_cyl": parse_float(r.get("cr_left_cyl")),
            "l_ax": parse_int(r.get("cr_left_ax")),
            "l_ecc": parse_float(r.get("cr_left_ecc")),
            "r_rv": parse_float(r.get("cr_right_rv")),
            "r_rh": parse_float(r.get("cr_right_rh")),
            "r_avg": parse_float(r.get("cr_right_avg")),
            "r_cyl": parse_float(r.get("cr_right_cyl")),
            "r_ax": parse_int(r.get("cr_right_ax")),
            "r_ecc": parse_float(r.get("cr_right_ecc")),
        }
        if any(v is not None for v in ker_block.values()):
            data["keratometer-contact-lens"] = ker_block

        schirmer_block = {
            "r_mm": parse_float(r.get("sirmer_right")),
            "r_but": parse_float(r.get("sirmer_right_but")),
            "l_mm": parse_float(r.get("sirmer_left")),
            "l_but": parse_float(r.get("sirmer_left_but")),
        }
        if any(v is not None for v in schirmer_block.values()):
            data["schirmer-test"] = schirmer_block

        diam_block = {
            "corneal_diameter": parse_float(r.get("cornia_diam")),
            "pupil_diameter": parse_float(r.get("pupil_diameter")) if r.get("pupil_diameter") not in (None, "") else parse_float(r.get("pupil_distance")),
        }
        if any(v is not None for v in diam_block.values()):
            data["contact-lens-diameters"] = diam_block

        if data:
            order.order_data = data
        db.add(order)
        pending += 1
        if pending % 500 == 0:
            db.flush()
            pending = 0
        db.flush()
        code = str(r.get("code")) if r.get("code") else None
        if code:
            presc_code_to_order_id[code] = order.id

        try:
            total_sum = parse_float(r.get("total_sum"))
            discount_sum = parse_float(r.get("discount_sum"))
            advance_sum = parse_float(r.get("advance_sum"))
            num_payments = parse_int(r.get("num_payments"))
            if any(v is not None for v in (total_sum, discount_sum, advance_sum, num_payments)):
                billing = Billing(
                    order_id=None,
                    contact_lens_id=order.id,
                    total_before_discount=(total_sum + (discount_sum or 0.0)) if total_sum is not None else None,
                    discount_amount=discount_sum,
                    discount_percent=None,
                    total_after_discount=total_sum,
                    prepayment_amount=advance_sum,
                    installment_count=num_payments,
                    notes=r.get("order_remarks") or None,
                )
                db.add(billing)
                db.flush()

                right_price = parse_float(r.get("right_lens_price"))
                left_price = parse_float(r.get("left_lens_price"))
                rl_discount = parse_float(r.get("rlens_discount"))
                ll_discount = parse_float(r.get("llens_discount"))
                right_qty = parse_int(r.get("right_qty")) or 0
                left_qty = parse_int(r.get("left_qty")) or 0

                if right_price is not None and right_qty > 0:
                    oli = OrderLineItem(
                        billings_id=billing.id,
                        sku=None,
                        description=r.get("right_model") or r.get("right_type") or "Right lens",
                        supplied_by=r.get("right_manuf") or None,
                        supplied=None,
                        price=right_price,
                        quantity=float(right_qty),
                        discount=rl_discount,
                        line_total=(right_price * float(right_qty)) - (rl_discount or 0.0),
                    )
                    db.add(oli)

                if left_price is not None and left_qty > 0:
                    oli = OrderLineItem(
                        billings_id=billing.id,
                        sku=None,
                        description=r.get("left_model") or r.get("left_type") or "Left lens",
                        supplied_by=r.get("left_manuf") or None,
                        supplied=None,
                        price=left_price,
                        quantity=float(left_qty),
                        discount=ll_discount,
                        line_total=(left_price * float(left_qty)) - (ll_discount or 0.0),
                    )
                    db.add(oli)
        except Exception:
            pass
        count += 1
        if count % 1000 == 0:
            print(f"[cl_orders] inserted: {count}", flush=True)
    db.commit()
    print(f"[cl_orders] inserted total: {count}, skipped: {skipped_count}, took {time.time()-t0:.2f}s", flush=True)
    return presc_code_to_order_id


def enrich_from_contact_lens_chk(db: Session, csv_dir: str, account_to_client: Dict[str, int], presc_code_to_order_id: Dict[str, int]):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "optic_contact_lens_chk.csv")
    updated_exams = 0
    updated_orders = 0
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        presc_code = str(r.get("contact_presc_code")) if r.get("contact_presc_code") else None
        order = None
        order_date = None
        if presc_code and presc_code in presc_code_to_order_id:
            order = db.get(ContactLensOrder, presc_code_to_order_id[presc_code])
            if order:
                order_date = order.order_date

        date_guess = parse_date(r.get("last_action")) or order_date
        eye = (r.get("tested_eye") or "").strip().upper()

        exam = None
        if client_id:
            exams = db.execute(select(OpticalExam).where(OpticalExam.client_id == client_id)).scalars().all()
            if exams:
                if date_guess:
                    best = None
                    best_delta = None
                    for e in exams:
                        if e.exam_date is None:
                            continue
                        delta = abs((e.exam_date - date_guess).days)
                        if best is None or delta < best_delta:
                            best = e
                            best_delta = delta
                    exam = best
                else:
                    exam = exams[-1]

        if exam:
            li = db.execute(select(ExamLayoutInstance).where(ExamLayoutInstance.exam_id == exam.id)).scalars().first()
            if li:
                data = dict(li.exam_data or {})
                over = dict(data.get("over-refraction")) if data.get("over-refraction") else {}
                if eye == "R":
                    over.update({
                        "r_sph": parse_float(r.get("or_sph")),
                        "r_cyl": parse_float(r.get("or_cyl")),
                        "r_ax": parse_int(r.get("or_ax")),
                        "r_va": parse_float(r.get("chk_va")),
                        "r_add": parse_float(r.get("chk_add")),
                    })
                elif eye == "L":
                    over.update({
                        "l_sph": parse_float(r.get("or_sph")),
                        "l_cyl": parse_float(r.get("or_cyl")),
                        "l_ax": parse_int(r.get("or_ax")),
                        "l_va": parse_float(r.get("chk_va")),
                        "l_add": parse_float(r.get("chk_add")),
                    })
                if parse_float(r.get("chk_va")) is not None:
                    over["comb_va"] = parse_float(r.get("chk_va"))
                if any(v is not None for v in over.values()):
                    data["over-refraction"] = over
                    li.exam_data = data
                    db.add(li)
                    updated_exams += 1

        if order:
            data = dict(order.order_data or {})
            exam_block = dict(data.get("contact-lens-exam") or {})
            details_block = dict(data.get("contact-lens-details") or {})
            order_block = dict(data.get("contact-lens-order") or {})

            if eye == "R":
                exam_block.update({
                    "r_bc": r.get("lens_bc_1") or exam_block.get("r_bc"),
                    "r_bc_2": r.get("lens_bc_2") or exam_block.get("r_bc_2"),
                    "r_diam": parse_float(r.get("lens_diam")) if exam_block.get("r_diam") is None else exam_block.get("r_diam"),
                    "r_sph": parse_float(r.get("lens_sph")) if exam_block.get("r_sph") is None else exam_block.get("r_sph"),
                    "r_cyl": parse_float(r.get("lens_cyl")) if exam_block.get("r_cyl") is None else exam_block.get("r_cyl"),
                    "r_ax": parse_int(r.get("lens_ax")) if exam_block.get("r_ax") is None else exam_block.get("r_ax"),
                })
                if not details_block.get("r_lens_type"):
                    details_block["r_lens_type"] = r.get("lens_type") or None
                if not details_block.get("r_model"):
                    details_block["r_model"] = r.get("lens_model") or None
                if not details_block.get("r_supplier"):
                    details_block["r_supplier"] = r.get("lens_supplier") or None
            elif eye == "L":
                exam_block.update({
                    "l_bc": r.get("lens_bc_1") or exam_block.get("l_bc"),
                    "l_bc_2": r.get("lens_bc_2") or exam_block.get("l_bc_2"),
                    "l_diam": parse_float(r.get("lens_diam")) if exam_block.get("l_diam") is None else exam_block.get("l_diam"),
                    "l_sph": parse_float(r.get("lens_sph")) if exam_block.get("l_sph") is None else exam_block.get("l_sph"),
                    "l_cyl": parse_float(r.get("lens_cyl")) if exam_block.get("l_cyl") is None else exam_block.get("l_cyl"),
                    "l_ax": parse_int(r.get("lens_ax")) if exam_block.get("l_ax") is None else exam_block.get("l_ax"),
                })
                if not details_block.get("l_lens_type"):
                    details_block["l_lens_type"] = r.get("lens_type") or None
                if not details_block.get("l_model"):
                    details_block["l_model"] = r.get("lens_model") or None
                if not details_block.get("l_supplier"):
                    details_block["l_supplier"] = r.get("lens_supplier") or None

            notes_parts: List[str] = []
            if r.get("trial_sct"):
                notes_parts.append(str(r.get("trial_sct")))
            if r.get("chk_comment"):
                notes_parts.append(str(r.get("chk_comment")))
            if notes_parts:
                existing = order_block.get("notes") or ""
                joined = "; ".join([p for p in notes_parts if p])
                order_block["notes"] = (existing + ("; " if existing and joined else "") + joined) or None

            if exam_block:
                data["contact-lens-exam"] = exam_block
            if details_block:
                data["contact-lens-details"] = details_block
            if order_block:
                data["contact-lens-order"] = order_block
            order.order_data = data
            db.add(order)
            updated_orders += 1

    db.commit()
    print(f"[cl_chk] enriched exams: {updated_exams}, orders: {updated_orders}, took {time.time()-t0:.2f}s", flush=True)

def migrate_referrals(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "optic_reference.csv")
    presc_rows = list(read_csv_streaming(csv_dir, "optic_presc_prices.csv"))
    print(f"[referrals] presc_rows: {len(presc_rows)}", flush=True)
    # Group prescription notes by presc_code
    presc_map: Dict[str, List[str]] = {}
    for pr in presc_rows:
        code = str(pr.get("presc_code")) if pr.get("presc_code") else None
        if not code:
            continue
        item_name = (pr.get("item_name") or "").strip()
        if not item_name:
            continue
        presc_map.setdefault(code, []).append(item_name)

    count = 0
    pending = 0
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        date = parse_date(r.get("reference_date"))
        recipient = r.get("address_to") or None
        notes = r.get("reference_remark") or None

        referral = Referral(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            referral_notes=notes or "",
            prescription_notes=None,
            date=date,
            type="general",
            recipient=recipient,
            referral_data={},
        )
        db.add(referral)
        pending += 1
        if pending % 1000 == 0:
            db.flush()
            pending = 0
        db.flush()

        # Attach prescription notes into referral_data if available
        presc_code = str(r.get("presc_code")) if r.get("presc_code") else None
        if presc_code and presc_code in presc_map:
            referral.referral_data = {"prescription_notes": "; ".join(presc_map[presc_code])}
            db.add(referral)
        count += 1
        if count % 1000 == 0:
            print(f"[referrals] inserted: {count}", flush=True)
    db.commit()
    print(f"[referrals] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_files(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "account_files.csv")
    count = 0
    pending = 0
    batch: List[File] = []
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        upload_date = parse_date(r.get("file_date"))
        raw_filename = r.get("file_description")
        if raw_filename and raw_filename.strip():
            file_name = raw_filename.strip()
        else:
            # Use the original code as fallback if description is missing
            file_name = f"legacy-file-{r.get('code', 'unknown')}"
        notes = r.get("file_remark") or None

        f = File(
            client_id=client_id,
            clinic_id=clinic_id,
            file_name=file_name,
            file_path=f"/legacy/{r.get('code') or file_name}",
            file_size=None,
            file_type=None,
            upload_date=datetime.combine(upload_date, datetime.min.time()) if upload_date else None,
            uploaded_by=admin_user_id,
            notes=notes,
        )
        batch.append(f)
        pending += 1
        if pending % 2000 == 0:
            db.bulk_save_objects(batch, return_defaults=True)
            db.flush()
            batch.clear()
        count += 1
        if count % 1000 == 0:
            print(f"[files] staged: {count}", flush=True)
    if batch:
        db.bulk_save_objects(batch, return_defaults=True)
    db.commit()
    print(f"[files] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_medical_logs(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "account_memos.csv")
    count = 0
    pending = 0
    batch_m: List[MedicalLog] = []
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        log_date = parse_date(r.get("memo_date"))
        log = r.get("memo_remark") or ""

        m = MedicalLog(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            log_date=log_date,
            log=log,
        )
        batch_m.append(m)
        pending += 1
        if pending % 5000 == 0:
            db.bulk_save_objects(batch_m, return_defaults=True)
            db.flush()
            batch_m.clear()
        count += 1
        if count % 1000 == 0:
            print(f"[memos] staged: {count}", flush=True)
    if batch_m:
        db.bulk_save_objects(batch_m, return_defaults=True)
    db.commit()
    print(f"[memos] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_appointments(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "diary_timetab.csv")
    count = 0
    pending = 0
    batch_a: List[Appointment] = []
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        date = parse_date(r.get("line_date"))
        time_str = (r.get("line_time") or "").strip() or None
        note = r.get("line_remark") or None

        app = Appointment(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            date=date,
            time=time_str,
            duration=30,
            exam_name=None,
            note=note,
        )
        batch_a.append(app)
        pending += 1
        if pending % 5000 == 0:
            db.bulk_save_objects(batch_a, return_defaults=True)
            db.flush()
            batch_a.clear()
        count += 1
        if count % 1000 == 0:
            print(f"[appointments] staged: {count}", flush=True)
    if batch_a:
        db.bulk_save_objects(batch_a, return_defaults=True)
    db.commit()
    print(f"[appointments] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate(csv_dir: str, company_id: Optional[int] = None, clinic_id: Optional[int] = None):
    db = SessionLocal()
    try:
        # Optional performance mode for Postgres
        perf_mode = True
        return_only_clients = os.environ.get("RETURN_ONLY_CLIENTS", "0").lower() in ("1", "true", "yes", "y")
        if perf_mode:
            try:
                db.execute(text("SET synchronous_commit TO OFF"))
                # Bypass triggers/FKs for speed; ensure you trust input data
                db.execute(text("SET session_replication_role = replica"))
                db.commit()
                print("[perf] Enabled Postgres fast settings (synchronous_commit=off, replication_role=replica)")
            except Exception as e:
                print(f"[perf] Failed to enable fast settings: {e}")
        
        if clinic_id is not None:
            clinic = get_clinic_by_id(db, clinic_id)
            if not clinic:
                raise ValueError(f"Clinic with id {clinic_id} not found")
            if company_id is not None:
                if clinic.company_id != company_id:
                    raise ValueError(f"Clinic {clinic_id} does not belong to company {company_id}")
                company = get_company_by_id(db, company_id)
                if not company:
                    raise ValueError(f"Company with id {company_id} not found")
            else:
                company = get_company_by_id(db, clinic.company_id)
                if not company:
                    raise ValueError(f"Company with id {clinic.company_id} (from clinic) not found")
                company_id = company.id
            print(f"Using company: {company.name} (id: {company.id})")
            print(f"Using clinic: {clinic.name} (id: {clinic.id})")
        elif company_id is not None:
            company = get_company_by_id(db, company_id)
            if not company:
                raise ValueError(f"Company with id {company_id} not found")
            print(f"Using company: {company.name} (id: {company.id})")
            clinic = None
        else:
            company = get_or_create_company(db)
            print(f"Using/created company: {company.name} (id: {company.id})")
            clinic = None
        
        admin_user = get_or_create_admin_user(db, company)

        # Lookups first to satisfy FKs and choices
        #migrate_lookups(db, csv_dir)

        # Clinics map (from accounts)
        branch_codes = collect_branch_codes(csv_dir)
        branch_to_clinic: Dict[str, int] = {}
        if clinic_id is not None:
            for bc in branch_codes:
                branch_to_clinic[bc] = clinic_id
            print(f"Mapping all branch codes to clinic {clinic_id}")
        else:
            for bc in branch_codes:
                clinic_obj = get_or_create_clinic(db, company, bc)
                branch_to_clinic[bc] = clinic_obj.id

        # Clients and families
        account_to_client, _ = migrate_clients_and_families(db, csv_dir, company, return_only=True, target_clinic_id=clinic_id)
        print("Clients and families migrated")

        use_parallel = os.environ.get("MIGRATION_PARALLEL", "1").lower() in ("1", "true", "yes", "y")
        max_workers = int(os.environ.get("MIGRATION_WORKERS", "4"))
        
        if use_parallel and max_workers > 1:
            print(f"[parallel] Using {max_workers} workers for parallel migrations")
            
            def run_with_session(func, *args, **kwargs):
                session = SessionLocal()
                try:
                    if perf_mode:
                        try:
                            session.execute(text("SET synchronous_commit TO OFF"))
                            session.execute(text("SET session_replication_role = replica"))
                            session.commit()
                        except Exception:
                            pass
                    result = func(session, *args, **kwargs)
                    session.commit()
                    return result
                except Exception as e:
                    session.rollback()
                    raise e
                finally:
                    if perf_mode:
                        try:
                            session.execute(text("SET session_replication_role = origin"))
                            session.execute(text("SET synchronous_commit TO ON"))
                            session.commit()
                        except Exception:
                            pass
                    session.close()
            
            admin_user_id = admin_user.id
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_exams = executor.submit(
                    run_with_session,
                    migrate_optical_exams,
                    csv_dir, account_to_client, branch_to_clinic, admin_user_id
                )
                
                future_orders = executor.submit(
                    run_with_session,
                    migrate_contact_lens_orders,
                    csv_dir, account_to_client, branch_to_clinic, admin_user_id
                )
                
                try:
                    future_exams.result()
                    print("[parallel] exams completed")
                except Exception as e:
                    print(f"[parallel] exams failed: {e}", flush=True)
                    raise
                
                try:
                    presc_code_to_order_id = future_orders.result()
                    print("[parallel] orders completed")
                except Exception as e:
                    print(f"[parallel] orders failed: {e}", flush=True)
                    raise
                
                future_enrich = executor.submit(
                    run_with_session,
                    enrich_from_contact_lens_chk,
                    csv_dir, account_to_client, presc_code_to_order_id
                )
                try:
                    future_enrich.result()
                    print("[parallel] Contact lens checks enrichment completed")
                except Exception as e:
                    print(f"[parallel] enrichment failed: {e}", flush=True)
                    raise
                
                if True:
                    future_referrals = executor.submit(
                        run_with_session,
                        migrate_referrals,
                        csv_dir, account_to_client, branch_to_clinic, admin_user_id
                    )
                    future_files = executor.submit(
                        run_with_session,
                        migrate_files,
                        csv_dir, account_to_client, branch_to_clinic, admin_user_id
                    )
                    future_logs = executor.submit(
                        run_with_session,
                        migrate_medical_logs,
                        csv_dir, account_to_client, branch_to_clinic, admin_user_id
                    )
                    future_appointments = executor.submit(
                        run_with_session,
                        migrate_appointments,
                        csv_dir, account_to_client, branch_to_clinic, admin_user_id
                    )
                    
                    for name, future in [
                        ("referrals", future_referrals),
                        ("files", future_files),
                        ("logs", future_logs),
                        ("appointments", future_appointments),
                    ]:
                        try:
                            future.result()
                            print(f"[parallel] {name} completed")
                        except Exception as e:
                            print(f"[parallel] {name} failed: {e}", flush=True)
                            raise
        else:
            admin_user_id = admin_user.id
            migrate_optical_exams(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
            print("Exams migrated")

            presc_code_to_order_id = migrate_contact_lens_orders(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
            print("Contact lens orders migrated")

            enrich_from_contact_lens_chk(db, csv_dir, account_to_client, presc_code_to_order_id)
            print("Contact lens checks enrichment applied")
            
            if False:
                migrate_referrals(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
                print("Referrals and prescription notes migrated")
                migrate_files(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
                print("Files migrated")
                migrate_medical_logs(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
                print("Medical logs migrated")
                migrate_appointments(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
                print("Appointments migrated")

        print("Migration completed successfully.")
    finally:
        if 'perf_mode' in locals() and perf_mode:
            try:
                db.execute(text("SET session_replication_role = origin"))
                db.execute(text("SET synchronous_commit TO ON"))
                db.commit()
                print("[perf] Restored Postgres settings")
            except Exception as e:
                print(f"[perf] Failed to restore settings: {e}")
        db.close()


def cleanup_clinic_migration(clinic_id: int, company_id: Optional[int] = None, keep_clients: bool = True):
    db = SessionLocal()
    try:
        clinic = db.get(Clinic, clinic_id)
        if not clinic:
            raise ValueError(f"Clinic with id {clinic_id} not found")
        
        if company_id is not None and clinic.company_id != company_id:
            raise ValueError(f"Clinic {clinic_id} does not belong to company {company_id}")
        
        print(f"[cleanup] Starting cleanup for clinic: {clinic.name} (id: {clinic_id})")
        if keep_clients:
            print(f"[cleanup] Keep clients mode enabled - clients and families will not be deleted")
        t0 = time.time()
        
        perf_mode = os.environ.get("MIGRATION_PERF", "0") == "1"
        if perf_mode:
            try:
                db.execute(text("SET synchronous_commit TO OFF"))
                db.execute(text("SET session_replication_role = replica"))
                db.commit()
                print("[cleanup] Enabled Postgres fast settings")
            except Exception as e:
                print(f"[cleanup] Failed to enable fast settings: {e}")
        
        client_ids = db.execute(
            select(Client.id).where(Client.clinic_id == clinic_id)
        ).scalars().all()
        client_count = len(client_ids)
        print(f"[cleanup] Found {client_count} clients to delete")
        
        exams_count = 0
        contact_lens_orders_count = 0
        
        if client_count > 0:
            client_ids_list = list(client_ids)
            
            order_line_items_count = db.execute(
                select(func.count(OrderLineItem.id))
                .join(Billing)
                .join(ContactLensOrder)
                .where(ContactLensOrder.client_id.in_(client_ids_list))
            ).scalar() or 0
            order_line_items_count += db.execute(
                select(func.count(OrderLineItem.id))
                .join(Billing)
                .join(Order)
                .where(Order.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if order_line_items_count > 0:
                print(f"[cleanup] Deleting {order_line_items_count} order line items...")
                db.execute(
                    text("""
                        DELETE FROM order_line_item 
                        WHERE billings_id IN (
                            SELECT id FROM billings 
                            WHERE contact_lens_id IN (
                                SELECT id FROM contact_lens_orders 
                                WHERE client_id = ANY(:client_ids)
                            )
                            OR order_id IN (
                                SELECT id FROM orders 
                                WHERE client_id = ANY(:client_ids)
                            )
                        )
                    """),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            billings_count = db.execute(
                select(func.count(Billing.id))
                .where(
                    (Billing.contact_lens_id.in_(
                        select(ContactLensOrder.id).where(ContactLensOrder.client_id.in_(client_ids_list))
                    ))
                    | (Billing.order_id.in_(
                        select(Order.id).where(Order.client_id.in_(client_ids_list))
                    ))
                )
            ).scalar() or 0
            
            if billings_count > 0:
                print(f"[cleanup] Deleting {billings_count} billings...")
                db.execute(
                    text("""
                        DELETE FROM billings 
                        WHERE contact_lens_id IN (
                            SELECT id FROM contact_lens_orders 
                            WHERE client_id = ANY(:client_ids)
                        )
                        OR order_id IN (
                            SELECT id FROM orders 
                            WHERE client_id = ANY(:client_ids)
                        )
                    """),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            exam_instances_count = db.execute(
                select(func.count(ExamLayoutInstance.id))
                .join(OpticalExam)
                .where(OpticalExam.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if exam_instances_count > 0:
                print(f"[cleanup] Deleting {exam_instances_count} exam layout instances...")
                db.execute(
                    text("""
                        DELETE FROM exam_layout_instances 
                        WHERE exam_id IN (
                            SELECT id FROM optical_exams 
                            WHERE client_id = ANY(:client_ids)
                        )
                    """),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            exams_count = db.execute(
                select(func.count(OpticalExam.id))
                .where(OpticalExam.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if exams_count > 0:
                print(f"[cleanup] Deleting {exams_count} optical exams...")
                db.execute(
                    text("DELETE FROM optical_exams WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            contact_lens_orders_count = db.execute(
                select(func.count(ContactLensOrder.id))
                .where(ContactLensOrder.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if contact_lens_orders_count > 0:
                print(f"[cleanup] Deleting {contact_lens_orders_count} contact lens orders...")
                db.execute(
                    text("DELETE FROM contact_lens_orders WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            orders_count = db.execute(
                select(func.count(Order.id))
                .where(Order.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if orders_count > 0:
                print(f"[cleanup] Deleting {orders_count} orders...")
                db.execute(
                    text("DELETE FROM orders WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            referrals_count = db.execute(
                select(func.count(Referral.id))
                .where(Referral.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if referrals_count > 0:
                print(f"[cleanup] Deleting {referrals_count} referrals...")
                db.execute(
                    text("DELETE FROM referrals WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            files_count = db.execute(
                select(func.count(File.id))
                .where(File.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if files_count > 0:
                print(f"[cleanup] Deleting {files_count} files...")
                db.execute(
                    text("DELETE FROM files WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            medical_logs_count = db.execute(
                select(func.count(MedicalLog.id))
                .where(MedicalLog.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if medical_logs_count > 0:
                print(f"[cleanup] Deleting {medical_logs_count} medical logs...")
                db.execute(
                    text("DELETE FROM medical_logs WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            appointments_count = db.execute(
                select(func.count(Appointment.id))
                .where(Appointment.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if appointments_count > 0:
                print(f"[cleanup] Deleting {appointments_count} appointments...")
                db.execute(
                    text("DELETE FROM appointments WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            if not keep_clients:
                print(f"[cleanup] Deleting {client_count} clients...")
                db.execute(
                    text("DELETE FROM clients WHERE clinic_id = :clinic_id"),
                    {"clinic_id": clinic_id}
                )
                db.flush()
            else:
                print(f"[cleanup] Skipping deletion of {client_count} clients (keep_clients=True)")
        
        families_count = db.execute(
            select(func.count(Family.id))
            .where(Family.clinic_id == clinic_id)
        ).scalar() or 0
        
        if not keep_clients:
            if families_count > 0:
                print(f"[cleanup] Deleting {families_count} families...")
                db.execute(
                    text("DELETE FROM families WHERE clinic_id = :clinic_id"),
                    {"clinic_id": clinic_id}
                )
                db.flush()
        else:
            if families_count > 0:
                print(f"[cleanup] Skipping deletion of {families_count} families (keep_clients=True)")
        
        default_layouts = db.execute(
            select(ExamLayout.id)
            .where(
                (ExamLayout.clinic_id == clinic_id) &
                (ExamLayout.name == "Default Migrated Layout")
            )
        ).scalars().all()
        
        if default_layouts:
            layout_ids = list(default_layouts)
            print(f"[cleanup] Deleting {len(layout_ids)} default exam layouts...")
            db.execute(
                text("DELETE FROM exam_layouts WHERE id = ANY(:layout_ids)"),
                {"layout_ids": layout_ids}
            )
            db.flush()
        
        db.commit()
        print(f"[cleanup] Cleanup completed in {time.time()-t0:.2f}s")
        clients_status = f"{client_count} clients (kept)" if keep_clients else f"{client_count} clients"
        families_status = f"{families_count} families (kept)" if keep_clients else f"{families_count} families"
        print(f"[cleanup] Deleted: {clients_status}, {families_status}, {exams_count} exams, {contact_lens_orders_count} contact lens orders")
        
    except Exception as e:
        db.rollback()
        print(f"[cleanup] Error during cleanup: {e}", flush=True)
        raise
    finally:
        if perf_mode:
            try:
                db.execute(text("SET session_replication_role = origin"))
                db.execute(text("SET synchronous_commit TO ON"))
                db.commit()
                print("[cleanup] Restored Postgres settings")
            except Exception as e:
                print(f"[cleanup] Failed to restore settings: {e}")
        db.close()


if __name__ == "__main__":
    # Prefer ENV; fallback to new CSV folder under migration
    default_dir = os.environ.get(
        "LEGACY_CSV_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "csv_files_new")),
    )
    print(f"Using CSV directory: {default_dir}")
    
    company_id = 13
    clinic_id = 8
    
    if company_id is not None:
        print(f"Target company ID: {company_id}")
    if clinic_id is not None:
        print(f"Target clinic ID: {clinic_id}")
    if company_id is None and clinic_id is not None:
        print("Warning: CLINIC_ID specified without COMPANY_ID. Company will be auto-detected from clinic.")
    
    # Quick sanity: show row counts for key files
    for name in [
        "account.csv",
        "optic_device_data.csv",
        "optic_reference.csv",
        "optic_presc_prices.csv",
        "account_files.csv",
        "account_memos.csv",
        "diary_timetab.csv",
    ]:
        try:
            cnt = len(read_csv(default_dir, name))
        except Exception:
            cnt = -1
        print(f"{name}: {cnt} rows")
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
        if clinic_id is None:
            print("Error: CLINIC_ID is required for cleanup")
            sys.exit(1)
        keep_clients = os.environ.get("KEEP_CLIENTS", "0").lower() in ("1", "true", "yes", "y")
        if keep_clients:
            print(f"Running cleanup for clinic {clinic_id} (keeping clients)...")
        else:
            print(f"Running cleanup for clinic {clinic_id}...")
        cleanup_clinic_migration(clinic_id, company_id=company_id, keep_clients=True)
    else:
        migrate(default_dir, company_id=company_id, clinic_id=clinic_id)


