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
from sqlalchemy import select

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
    Referral,
    File,
    Appointment,
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


def build_exam_data(row: Dict[str, Any]) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    obj = build_objective(row)
    if obj:
        data["objective"] = obj
    ker = build_keratometer(row)
    if ker:
        data["keratometer"] = ker
    subj = build_subjective(row)
    if subj:
        data["subjective"] = subj
    addi = build_addition(row)
    if addi:
        data["addition"] = addi
    oldr = build_old_refraction(row)
    if oldr:
        data["old-refraction"] = oldr
    return data


# ------------------------------
# Migration steps
# ------------------------------

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


def migrate_clients_and_families(db: Session, csv_dir: str, company: Company) -> Tuple[Dict[str, int], Dict[str, int]]:
    # Returns: account_code -> client_id, head_of_family -> family_id
    t0 = time.time()
    rows = read_csv(csv_dir, "account.csv")
    print(f"[accounts] total rows: {len(rows)}", flush=True)
    account_to_client: Dict[str, int] = {}
    head_to_family: Dict[str, int] = {}

    # Create clinics first based on branch codes present
    branch_to_clinic: Dict[str, int] = {}
    for bc in collect_branch_codes(csv_dir):
        clinic = get_or_create_clinic(db, company, bc)
        branch_to_clinic[bc] = clinic.id
    print(f"[accounts] clinics created/ensured: {len(branch_to_clinic)}", flush=True)

    # First pass: create families by head_of_family
    family_count = 0
    for r in rows:
        if (r.get("account_type") or "").strip().upper() != "A":
            continue
        head = r.get("head_of_family")
        if head and head not in head_to_family:
            clinic_id = branch_to_clinic.get(r.get("branch_code"))
            fam = Family(
                clinic_id=clinic_id,
                name=f"Family {head}",
                notes="Migrated family",
            )
            db.add(fam)
            db.commit()
            db.refresh(fam)
            head_to_family[head] = fam.id
            family_count += 1
            if family_count % 1000 == 0:
                print(f"[accounts] families created: {family_count}", flush=True)

    # Second pass: create clients
    client_count = 0
    for r in rows:
        if (r.get("account_type") or "").strip().upper() != "A":
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
        db.commit()
        db.refresh(client)
        account_code = str(r.get("account_code"))
        account_to_client[account_code] = client.id
        client_count += 1
        if client_count % 1000 == 0:
            print(f"[accounts] clients created: {client_count}", flush=True)

    print(f"[accounts] families: {family_count}, clients: {client_count}, took {time.time()-t0:.2f}s", flush=True)
    return account_to_client, head_to_family


def migrate_optical_exams(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User):
    t0 = time.time()
    rows = read_csv(csv_dir, "optic_device_data.csv")
    print(f"[exams] rows: {len(rows)}", flush=True)
    # Pre-create a default layout per clinic encountered
    clinic_to_layout: Dict[int, int] = {}

    count = 0
    for r in rows:
        account_code = str(r.get("account_code")) if r.get("account_code") is not None else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]

        branch_code = r.get("branch_code") or None  # may not exist in this CSV; fallback later
        clinic_id = None
        if branch_code and branch_code in branch_to_clinic:
            clinic_id = branch_to_clinic[branch_code]

        exam_date = parse_date(r.get("data_date"))

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
        db.commit()
        db.refresh(exam)

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

        data = build_exam_data(r)

        layout_instance = ExamLayoutInstance(
            exam_id=exam.id,
            layout_id=layout_id,
            is_active=False,
            order=0,
            exam_data=data,
        )
        db.add(layout_instance)
        db.commit()
        count += 1
        if count % 1000 == 0:
            print(f"[exams] inserted: {count}", flush=True)
    print(f"[exams] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


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
        db.commit()
        db.refresh(referral)

        # Attach prescription notes into referral_data if available
        presc_code = str(r.get("presc_code")) if r.get("presc_code") else None
        if presc_code and presc_code in presc_map:
            referral.referral_data = {"prescription_notes": "; ".join(presc_map[presc_code])}
            db.add(referral)
            db.commit()
        count += 1
        if count % 1000 == 0:
            print(f"[referrals] inserted: {count}", flush=True)
    print(f"[referrals] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_files(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User):
    t0 = time.time()
    rows = read_csv(csv_dir, "account_files.csv")
    print(f"[files] rows: {len(rows)}", flush=True)
    count = 0
    for r in rows:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        upload_date = parse_date(r.get("file_date"))
        file_name = r.get("file_description") or "legacy-file"
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
        db.add(f)
        count += 1
        if count % 1000 == 0:
            print(f"[files] staged: {count}", flush=True)
    db.commit()
    print(f"[files] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_medical_logs(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User):
    t0 = time.time()
    rows = read_csv(csv_dir, "account_memos.csv")
    print(f"[memos] rows: {len(rows)}", flush=True)
    count = 0
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
        db.add(m)
        count += 1
        if count % 1000 == 0:
            print(f"[memos] staged: {count}", flush=True)
    db.commit()
    print(f"[memos] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_appointments(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user: User):
    t0 = time.time()
    rows = read_csv(csv_dir, "diary_timetab.csv")
    print(f"[appointments] rows: {len(rows)}", flush=True)
    count = 0
    for r in rows:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        date = parse_date(r.get("line_date"))
        time = (r.get("line_time") or "").strip() or None
        note = r.get("line_remark") or None

        app = Appointment(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user.id,
            date=date,
            time=time,
            duration=30,
            exam_name=None,
            note=note,
        )
        db.add(app)
        count += 1
        if count % 1000 == 0:
            print(f"[appointments] staged: {count}", flush=True)
    db.commit()
    print(f"[appointments] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate(csv_dir: str):
    db = SessionLocal()
    try:
        company = get_or_create_company(db)
        admin_user = get_or_create_admin_user(db, company)

        # Lookups first to satisfy FKs and choices
        migrate_lookups(db, csv_dir)

        # Clinics map (from accounts)
        branch_codes = collect_branch_codes(csv_dir)
        branch_to_clinic: Dict[str, int] = {}
        for bc in branch_codes:
            clinic = get_or_create_clinic(db, company, bc)
            branch_to_clinic[bc] = clinic.id

        # Clients and families
        account_to_client, _ = migrate_clients_and_families(db, csv_dir, company)
        print("Clients and families migrated")

        # Exams
        migrate_optical_exams(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        print("Exams migrated")
        # Referrals and prescription notes
        migrate_referrals(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        print("Referrals and prescription notes migrated")
        # Files
        migrate_files(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        print("Files migrated")
        # Medical logs
        migrate_medical_logs(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        print("Medical logs migrated")
        # Appointments
        migrate_appointments(db, csv_dir, account_to_client, branch_to_clinic, admin_user)
        print("Appointments migrated")

        print("Migration completed successfully.")
    finally:
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


