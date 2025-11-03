import sys
import os
import csv
import json
from datetime import datetime
import time
from typing import Dict, Optional, Any, List, Tuple

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
from sqlalchemy import select, text

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


def parse_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    s = str(value).strip().replace(",", ".")
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    s = str(value).strip()
    if s == "":
        return None
    try:
        return int(float(s)) if "." in s else int(s)
    except ValueError:
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


def read_csv(csv_dir: str, filename: str) -> List[Dict[str, Any]]:
    path = os.path.join(csv_dir, filename)
    if not os.path.exists(path):
        return []
    # Try multiple encodings common for Hebrew/legacy exports
    candidate_encodings = [
        "utf-8",
        "utf-8-sig",
        "cp1255",
        "windows-1255",
        "iso-8859-8",
        "latin-1",
    ]
    for enc in candidate_encodings:
        try:
            with open(path, "r", newline="", encoding=enc, errors="strict") as f:
                # Peek to sniff delimiter safely
                sample = f.read(32768)
                f.seek(0)
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
                except Exception:
                    dialect = csv.excel
                reader = csv.DictReader(f, dialect=dialect)
                return list(reader)
        except UnicodeDecodeError:
            continue
    # Last resort: ignore undecodable bytes
    with open(path, "r", newline="", encoding="latin-1", errors="ignore") as f:
        try:
            sample = f.read(32768)
            f.seek(0)
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        except Exception:
            dialect = csv.excel
        reader = csv.DictReader(f, dialect=dialect)
        return list(reader)


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


def get_or_create_admin_user(db: Session, company: Company) -> User:
    user = db.execute(select(User).where(User.username == "admin")).scalars().first()
    if user:
        return user
    user = User(
        company_id=company.id,
        clinic_id=None,
        full_name="System Administrator",
        username="admin",
        email="admin@opticai.local",
        phone=None,
        password="admin",  # Consider updating post-migration
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


def build_exam_data_from_eye_tests(row: Dict[str, Any]) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    # objective from optic_eye_tests ob_* fields
    obj = {
        "r_sph": parse_float(row.get("ob_right_sph")),
        "l_sph": parse_float(row.get("ob_left_sph")),
        "r_cyl": parse_float(row.get("ob_right_cyl")),
        "l_cyl": parse_float(row.get("ob_left_cyl")),
        "r_ax": parse_int(row.get("ob_right_ax")),
        "l_ax": parse_int(row.get("ob_left_ax")),
    }
    if any(v is not None for v in obj.values()):
        data["objective"] = obj

    subj = {
        "r_fa": row.get("sb_right_fa") or None,
        "l_fa": row.get("sb_left_fa") or None,
        "r_sph": parse_float(row.get("sb_right_sph")),
        "l_sph": parse_float(row.get("sb_left_sph")),
        "r_cyl": parse_float(row.get("sb_right_cyl")),
        "l_cyl": parse_float(row.get("sb_left_cyl")),
        "r_ax": parse_int(row.get("sb_right_ax")),
        "l_ax": parse_int(row.get("sb_left_ax")),
        "r_pris": parse_float(row.get("sb_right_pris")),
        "l_pris": parse_float(row.get("sb_left_pris")),
        "r_base": row.get("sb_right_base") or None,
        "l_base": row.get("sb_left_base") or None,
        "r_va": parse_float(row.get("sb_right_va")),
        "l_va": parse_float(row.get("sb_left_va")),
        "r_pd_close": parse_float(row.get("sb_left_near_pd")),
        "l_pd_close": parse_float(row.get("sb_right_near_pd")),
        "r_pd_far": parse_float(row.get("sb_left_far_pd")),
        "l_pd_far": parse_float(row.get("sb_right_far_pd")),
    }
    if any(v is not None for v in subj.values()):
        data["subjective"] = subj

    addition = {
        "r_fcc": row.get("add_right_fcc") or None,
        "l_fcc": row.get("add_left_fcc") or None,
        "r_read": row.get("add_right_read") or None,
        "l_read": row.get("add_left_read") or None,
        "r_int": row.get("add_right_int") or None,
        "l_int": row.get("add_left_int") or None,
        "r_bif": row.get("add_right_bif") or None,
        "l_bif": row.get("add_left_bif") or None,
        "r_mul": row.get("add_right_mul") or None,
        "l_mul": row.get("add_left_mul") or None,
        "r_j": row.get("add_right_j") or None,
        "l_j": row.get("add_left_j") or None,
    }
    if any(v is not None for v in addition.values()):
        data["addition"] = addition

    oldr = {
        "r_sph": parse_float(row.get("or_right_sph")),
        "l_sph": parse_float(row.get("or_left_sph")),
        "r_cyl": parse_float(row.get("or_right_cyl")),
        "l_cyl": parse_float(row.get("or_left_cyl")),
        "r_ax": parse_int(row.get("or_right_ax")),
        "l_ax": parse_int(row.get("or_left_ax")),
        "r_pris": parse_float(row.get("or_right_pris")),
        "l_pris": parse_float(row.get("or_left_pris")),
        "r_base": row.get("or_right_base") or None,
        "l_base": row.get("or_left_base") or None,
        "r_va": parse_float(row.get("or_right_va")),
        "l_va": parse_float(row.get("or_left_va")),
        "comb_va": parse_float(row.get("or_mid_va")),
    }
    if any(v is not None for v in oldr.values()):
        data["old-refraction"] = oldr

    if obj:
        pass
    return data


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
    rows = read_csv(csv_dir, "account.csv")
    codes: List[str] = []
    for r in rows:
        bc = r.get("branch_code")
        if bc and bc not in codes:
            codes.append(bc)
    print(f"[accounts] distinct branch codes: {len(codes)}", flush=True)
    return codes


def migrate_clients_and_families(db: Session, csv_dir: str, company: Company, return_only: bool = False) -> Tuple[Dict[str, int], Dict[str, int]]:
    # Returns: account_code -> client_id, head_of_family -> family_id
    t0 = time.time()
    rows = read_csv(csv_dir, "account.csv")
    print(f"[accounts] total rows: {len(rows)}", flush=True)
    account_to_client: Dict[str, int] = {}
    head_to_family: Dict[str, int] = {}

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

        for r in rows:
            if not is_client_account(r):
                continue
            acc = r.get("account_code")
            if acc is None:
                continue
            client = find_client_for_row(r)
            if client is None:
                continue
            account_to_client[str(acc)] = client.id

        for r in rows:
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

        print(f"[accounts] mapped existing clients: {len(account_to_client)} in {time.time()-t0:.2f}s", flush=True)
        return account_to_client, head_to_family

    # Create clinics first based on branch codes present
    branch_to_clinic: Dict[str, int] = {}
    for bc in collect_branch_codes(csv_dir):
        clinic = get_or_create_clinic(db, company, bc)
        branch_to_clinic[bc] = clinic.id
    print(f"[accounts] clinics created/ensured: {len(branch_to_clinic)}", flush=True)

    # Pre-compute a preferred last name per head_of_family for naming the family
    # Preference: if a row's account_code equals head_of_family and has last_name -> priority 0
    # Otherwise any row in that head group with last_name -> priority 1
    head_name_pref: Dict[str, Tuple[int, str]] = {}
    for r in rows:
        if not is_client_account(r):
            continue
        head = r.get("head_of_family")
        if not head:
            continue
        last_name = (r.get("last_name") or "").strip()
        if not last_name:
            continue
        priority = 1
        try:
            if str(r.get("account_code")).strip() == str(head).strip():
                priority = 0
        except Exception:
            priority = 1
        current = head_name_pref.get(head)
        if current is None or priority < current[0]:
            head_name_pref[head] = (priority, last_name)

    # First pass: create families by head_of_family
    family_count = 0
    pending = 0
    for r in rows:
        if not is_client_account(r):
            continue
        head = r.get("head_of_family")
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
            db.add(fam)
            pending += 1
            if pending % 1000 == 0:
                db.flush()
                pending = 0
            db.flush()
            head_to_family[head] = fam.id
            family_count += 1
            if family_count % 1000 == 0:
                print(f"[accounts] families created: {family_count}", flush=True)
    db.commit()

    # Second pass: create clients
    client_count = 0
    pending = 0
    for r in rows:
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

        client = Client(
            clinic_id=clinic_id,
            first_name=r.get("first_name") or None,
            last_name=r.get("last_name") or None,
            gender=gender,
            national_id=r.get("id_number") or None,
            date_of_birth=parse_date(r.get("birth_date")),
            address_city=r.get("city") or None,
            address_street=r.get("street") or None,
            address_number=address_number,
            postal_code=r.get("zip_code") or None,
            phone_home=r.get("phone1") or None,
            phone_work=r.get("phone2") or None,
            phone_mobile=r.get("mobile_phone") or None,
            email=r.get("e_mail") or None,
            price_list=None,
            discount_percent=parse_int(r.get("discount_precent")) or 0,
            blocked_checks=parse_bool_flag(r.get("check_blocked")),
            blocked_credit=parse_bool_flag(r.get("credit_blocked")),
            sorting_group=r.get("acc_sort_group") or None,
            file_creation_date=parse_date(r.get("open_date")),
            occupation=r.get("occupation") or None,
            status=r.get("account_status") or None,
            notes=r.get("remarks") or None,
            file_location=r.get("file_location") or None,
            family_id=head_to_family.get(r.get("head_of_family")),
        )
        db.add(client)
        pending += 1
        if pending % 1000 == 0:
            db.flush()
            pending = 0
        db.flush()
        account_code = str(r.get("account_code"))
        account_to_client[account_code] = client.id
        client_count += 1
        if client_count % 1000 == 0:
            print(f"[accounts] clients created: {client_count}", flush=True)
    db.commit()

    print(f"[accounts] families: {family_count}, clients: {client_count}, took {time.time()-t0:.2f}s", flush=True)
    return account_to_client, head_to_family


def migrate_optical_exams(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User):
    t0 = time.time()
    # Prefer new sources: optic_eye_tests (and optional optic_exp_eyetests)
    rows = read_csv(csv_dir, "optic_eye_tests.csv")
    print(f"[exams] rows: {len(rows)}", flush=True)
    # Pre-create a default layout per clinic encountered
    clinic_to_layout: Dict[int, int] = {}

    count = 0
    pending = 0
    for r in rows:
        account_code = str(r.get("account_code")) if r.get("account_code") is not None else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]

        branch_code = r.get("branch_code") or None  # may not exist in this CSV; fallback later
        clinic_id = None
        if branch_code and branch_code in branch_to_clinic:
            clinic_id = branch_to_clinic[branch_code]

        exam_date = parse_date(r.get("test_date"))

        exam = OpticalExam(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user.id,
            exam_date=exam_date,
            test_name="Migrated Exam",
            dominant_eye=None,
            type="exam",
        )
        db.add(exam)
        pending += 1
        if pending % 1000 == 0:
            db.flush()
            pending = 0
        db.flush()

        # Ensure layout
        if clinic_id:
            if clinic_id not in clinic_to_layout:
                clinic = db.get(Clinic, clinic_id)
                layout = get_or_create_default_exam_layout(db, clinic)
                clinic_to_layout[clinic_id] = layout.id
            layout_id = clinic_to_layout[clinic_id]
        else:
            # global default if clinic unknown
            layout = get_or_create_default_exam_layout(db, None)
            layout_id = layout.id

        data = build_exam_data_from_eye_tests(r)

        layout_instance = ExamLayoutInstance(
            exam_id=exam.id,
            layout_id=layout_id,
            is_active=False,
            order=0,
            exam_data=data,
        )
        db.add(layout_instance)
        if count % 1000 == 0:
            db.flush()
        count += 1
        if count % 1000 == 0:
            print(f"[exams] inserted: {count}", flush=True)
    db.commit()
    print(f"[exams] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_contact_lens_orders(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User) -> Dict[str, int]:
    t0 = time.time()
    rows = read_csv(csv_dir, "optic_contact_presc.csv")
    print(f"[cl_orders] rows: {len(rows)}", flush=True)
    presc_code_to_order_id: Dict[str, int] = {}
    count = 0
    pending = 0
    for r in rows:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        order_date = parse_date(r.get("presc_date"))

        supply_branch = r.get("supply_branch")
        supply_in_clinic_id = branch_to_clinic.get(supply_branch) if supply_branch in (branch_to_clinic or {}) else None

        order_status_raw = r.get("order_status")
        order_status = str(order_status_raw) if order_status_raw is not None and str(order_status_raw).strip() != "" else None
        advisor_code = r.get("advisor_code")
        advisor = str(advisor_code) if advisor_code is not None and str(advisor_code).strip() != "" else None

        order = ContactLensOrder(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user.id,
            order_date=order_date,
            type="contact_lens",
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
        if pending % 1000 == 0:
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
    print(f"[cl_orders] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)
    return presc_code_to_order_id


def enrich_from_contact_lens_chk(db: Session, csv_dir: str, account_to_client: Dict[str, int], presc_code_to_order_id: Dict[str, int]):
    t0 = time.time()
    rows = read_csv(csv_dir, "optic_contact_lens_chk.csv")
    print(f"[cl_chk] rows: {len(rows)}", flush=True)
    updated_exams = 0
    updated_orders = 0
    for r in rows:
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

def migrate_referrals(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User):
    t0 = time.time()
    rows = read_csv(csv_dir, "optic_reference.csv")
    presc_rows = read_csv(csv_dir, "optic_presc_prices.csv")
    print(f"[referrals] rows: {len(rows)}, presc_rows: {len(presc_rows)}", flush=True)
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
    for r in rows:
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
            user_id=admin_user.id,
            referral_notes=notes or "",
            prescription_notes=None,
            date=date,
            type="general",
            branch=None,
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


def migrate_files(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User):
    t0 = time.time()
    rows = read_csv(csv_dir, "account_files.csv")
    print(f"[files] rows: {len(rows)}", flush=True)
    count = 0
    pending = 0
    batch: List[File] = []
    for r in rows:
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
            uploaded_by=admin_user.id,
            notes=notes,
        )
        batch.append(f)
        pending += 1
        if pending % 2000 == 0:
            db.bulk_save_objects(batch)
            db.flush()
            batch.clear()
        count += 1
        if count % 1000 == 0:
            print(f"[files] staged: {count}", flush=True)
    if batch:
        db.bulk_save_objects(batch)
    db.commit()
    print(f"[files] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_medical_logs(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User):
    t0 = time.time()
    rows = read_csv(csv_dir, "account_memos.csv")
    print(f"[memos] rows: {len(rows)}", flush=True)
    count = 0
    pending = 0
    batch_m: List[MedicalLog] = []
    for r in rows:
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
            user_id=admin_user.id,
            log_date=log_date,
            log=log,
        )
        batch_m.append(m)
        pending += 1
        if pending % 5000 == 0:
            db.bulk_save_objects(batch_m)
            db.flush()
            batch_m.clear()
        count += 1
        if count % 1000 == 0:
            print(f"[memos] staged: {count}", flush=True)
    if batch_m:
        db.bulk_save_objects(batch_m)
    db.commit()
    print(f"[memos] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_appointments(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User):
    t0 = time.time()
    rows = read_csv(csv_dir, "diary_timetab.csv")
    print(f"[appointments] rows: {len(rows)}", flush=True)
    count = 0
    pending = 0
    batch_a: List[Appointment] = []
    for r in rows:
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
            user_id=admin_user.id,
            date=date,
            time=time_str,
            duration=30,
            exam_name=None,
            note=note,
        )
        batch_a.append(app)
        pending += 1
        if pending % 5000 == 0:
            db.bulk_save_objects(batch_a)
            db.flush()
            batch_a.clear()
        count += 1
        if count % 1000 == 0:
            print(f"[appointments] staged: {count}", flush=True)
    if batch_a:
        db.bulk_save_objects(batch_a)
    db.commit()
    print(f"[appointments] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate(csv_dir: str):
    db = SessionLocal()
    try:
        # Optional performance mode for Postgres
        perf_mode = os.environ.get("MIGRATION_PERF", "0") == "1"
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
        company = get_or_create_company(db)
        admin_user = get_or_create_admin_user(db, company)

        # Lookups first to satisfy FKs and choices
        #migrate_lookups(db, csv_dir)

        # Clinics map (from accounts)
        branch_codes = collect_branch_codes(csv_dir)
        branch_to_clinic: Dict[str, int] = {}
        for bc in branch_codes:
            clinic = get_or_create_clinic(db, company, bc)
            branch_to_clinic[bc] = clinic.id

        # Clients and families
        account_to_client, _ = migrate_clients_and_families(db, csv_dir, company, return_only=True)
        print("Clients and families migrated")

        migrate_optical_exams(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        print("Exams migrated")

        presc_code_to_order_id = migrate_contact_lens_orders(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        print("Contact lens orders migrated")

        enrich_from_contact_lens_chk(db, csv_dir, account_to_client, presc_code_to_order_id)
        print("Contact lens checks enrichment applied")
        # Referrals and prescription notes
        #migrate_referrals(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        #print("Referrals and prescription notes migrated")
        # Files
        #migrate_files(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        #print("Files migrated")
        # Medical logs
        #migrate_medical_logs(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        #print("Medical logs migrated")
        # Appointments
        #migrate_appointments(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        #print("Appointments migrated")

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


if __name__ == "__main__":
    # Prefer ENV; fallback to new CSV folder under migration
    default_dir = os.environ.get(
        "LEGACY_CSV_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "csv_files_new")),
    )
    print(f"Using CSV directory: {default_dir}")
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
    migrate(default_dir)


