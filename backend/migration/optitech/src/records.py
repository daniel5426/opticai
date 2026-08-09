from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time
from pathlib import Path
import re
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence, Tuple


PrimaryKeyPart = Tuple[str, str]


TABLE_PRIMARY_KEYS: Dict[str, Tuple[str, ...]] = {
    "tblPerData": ("PerId",),
    "tblPerData_FamId": ("FamId",),
    "tblUsers": ("UserId",),
    "tblCrdGlassChecks": ("PerId", "CheckDate"),
    "tblCrdGlassChecksPrevs": ("PerId", "CheckDate", "PrevId"),
    "tblCrdClensChecks": ("PerId", "CheckDate"),
    "tblCrdBuysWorks": ("WorkId",),
    "tblPerPicture": ("PerPicId",),
    "tblCrdDiags": ("PerId", "CheckDate"),
    "tblClndrApt": ("AptNum",),
    "tblClndrWrk": ("WrkId",),
    "tblCrdGlassBrand": ("GlassBrandId",),
    "tblCrdGlassCoat": ("GlassCoatId",),
    "tblCrdGlassColor": ("GlassColorId",),
    "tblCrdGlassMater": ("GlassMaterId",),
    "tblCrdGlassModel": ("GlassModelId",),
    "tblCrdGlassRole": ("GlassRoleId",),
    "tblCrdClensBrands": ("ClensBrandId",),
    "tblCrdClensManuf": ("ClensManufId",),
    "tblCrdClensTypes": ("ClensTypeId",),
    "tblCrdClensSolClean": ("ClensSolCleanId",),
    "tblCrdClensSolDisinfect": ("ClensSolDisinfectId",),
    "tblCrdClensSolRinse": ("ClensSolRinseId",),
    "tblSapaks": ("SapakID",),
    "tblCrdBuysWorkTypes": ("WorkTypeId",),
    "tblCrdBuysWorkStats": ("WorkStatId",),
    "tblCrdBuysWorkSupply": ("WorkSupplyId",),
    "tblCrdBuysWorkLabs": ("LabID",),
    "tblCrdBuysWorkSapaks": ("SapakID",),
    "tblCrdBuysWorkLabels": ("LabelId",),
    "tblCrdClensChecksMater": ("MaterId",),
    "tblCrdClensChecksTint": ("TintId",),
    "tblCrdClensChecksPr": ("PrId",),
}


NULL_LIKE = {"", "null", "none", "nan"}
OPTICAL_ZERO_LIKE = {"plano", "pl", "plan", "+0", "-0", "0.00", "0"}
OPTICAL_FLAT_LIKE = {"flt", "flat"}
OPTICAL_STEEP_LIKE = {"stp", "steep"}

SPH_ALIASES = {
    "balance": "Balance",
    "balanc": "Balance",
    "amblyopia": "Amblyopia",
    "amblyopya": "Amblyopia",
    "ambliyopia": "Amblyopia",
    "ambliyopya": "Amblyopia",
    "ambli": "Amblyopia",
    "occluder": "Occluder",
    "occlud": "Occluder",
    "occlude": "Occluder",
    "oclude": "Occluder",
    "frosted": "Frosted / Matte",
    "frostedmatte": "Frosted / Matte",
    "matte": "Frosted / Matte",
    "matt": "Frosted / Matte",
}
CONTACT_ADD_ALIASES = {
    "low": "Low",
    "lo": "Low",
    "l": "Low",
    "medium": "Medium",
    "med": "Medium",
    "mid": "Medium",
    "m": "Medium",
    "high": "High",
    "hi": "High",
    "h": "High",
}


def clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.lower() in NULL_LIKE:
        return None
    return text


def parse_boolish(value: Any) -> Optional[bool]:
    text = clean_text(value)
    if text is None:
        return None
    lowered = text.lower()
    if lowered in {"1", "-1", "true", "t", "yes", "y"}:
        return True
    if lowered in {"0", "false", "f", "no", "n"}:
        return False
    return None


def parse_intish(value: Any) -> Optional[int]:
    text = clean_text(value)
    if text is None:
        return None
    text = text.replace(",", ".")
    try:
        return int(float(text))
    except ValueError:
        return None


def parse_floatish(value: Any) -> Optional[float]:
    text = clean_text(value)
    if text is None:
        return None
    text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def parse_optical_float(value: Any) -> Optional[float]:
    text = clean_text(value)
    if text is None:
        return None
    lowered = text.lower()
    if lowered in OPTICAL_ZERO_LIKE:
        return 0.0
    if lowered in OPTICAL_FLAT_LIKE:
        return 0.0
    text = text.replace(",", ".")
    if re.fullmatch(r"[+-]?\d+(?:\.\d+)?", text):
        try:
            return float(text)
        except ValueError:
            return None
    return None


def parse_optical_value(value: Any) -> Optional[float | str]:
    """Parse numeric optics losslessly while canonicalizing supported SPH text."""
    text = clean_text(value)
    if text is None:
        return None
    lowered = text.lower()
    if lowered in OPTICAL_ZERO_LIKE:
        return 0.0
    canonical = SPH_ALIASES.get(re.sub(r"[^a-z]", "", lowered))
    if canonical:
        return canonical
    numeric = parse_floatish(text)
    return numeric if numeric is not None else text


def parse_modified_acuity(value: Any) -> Optional[str]:
    """Keep the complete VA/J token, including modifiers such as ±1..±3."""
    return clean_text(value)


def parse_contact_add(value: Any) -> Optional[float | str]:
    text = clean_text(value)
    if text is None:
        return None
    numeric = parse_floatish(text)
    if numeric is not None:
        return numeric
    return CONTACT_ADD_ALIASES.get(re.sub(r"[^a-z]", "", text.lower()), text)


def parse_contact_bc(value: Any) -> Optional[float | str]:
    text = clean_text(value)
    if text is None:
        return None
    lowered = text.lower()
    if lowered in OPTICAL_FLAT_LIKE:
        return "Flat"
    if lowered in OPTICAL_STEEP_LIKE:
        return "Steep"
    numeric = parse_floatish(text)
    return numeric if numeric is not None else text


def parse_numeric_only(value: Any) -> Optional[float]:
    return parse_floatish(value)


def normalize_base(value: Any) -> Optional[str]:
    text = clean_text(value)
    if text is None:
        return None
    normalized = re.sub(r"[^a-z0-9]", "", text.lower())
    aliases = {
        "2": "DOWN",
        "down": "DOWN",
        "d": "DOWN",
        "3": "IN",
        "in": "IN",
        "basein": "IN",
        "bi": "IN",
        "4": "UP",
        "up": "UP",
        "u": "UP",
        "5": "OUT",
        "out": "OUT",
        "baseout": "OUT",
        "bo": "OUT",
        "1": "180",
        "180": "180",
    }
    if normalized in {"", "0", "none"}:
        return None
    return aliases.get(normalized, text.upper())


def parse_access_date(value: Any) -> Optional[date]:
    parsed = parse_access_datetime(value)
    return parsed.date() if parsed is not None else None


def parse_access_datetime(value: Any) -> Optional[datetime]:
    text = clean_text(value)
    if text is None:
        return None
    formats = (
        "%m/%d/%y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%y",
        "%m/%d/%Y",
        "%Y-%m-%d",
        "%Y-%m-%d %H:%M:%S",
    )
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def parse_access_time(value: Any) -> Optional[str]:
    text = clean_text(value)
    if text is None:
        return None
    formats = (
        "%m/%d/%y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%H:%M:%S",
        "%H:%M",
    )
    for fmt in formats:
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.strftime("%H:%M:%S")
        except ValueError:
            continue
    return None


def normalize_eye(value: Any) -> Optional[str]:
    text = clean_text(value)
    if text is None:
        return None
    lowered = text.lower()
    if lowered in {"r", "right", "ימין"}:
        return "R"
    if lowered in {"l", "left", "שמאל"}:
        return "L"
    return text


def build_source_ref(
    table_name: str,
    row: Mapping[str, Any],
    raw_row_ref: Optional[str] = None,
) -> "SourceRef":
    keys = TABLE_PRIMARY_KEYS.get(table_name)
    if not keys:
        raise KeyError(f"No primary key mapping configured for {table_name}")
    primary_key_parts: Tuple[PrimaryKeyPart, ...] = tuple(
        (key, clean_text(row.get(key)) or "") for key in keys
    )
    if raw_row_ref is None:
        joined = "|".join(f"{key}={value}" for key, value in primary_key_parts)
        raw_row_ref = f"{table_name}:{joined}"
    return SourceRef(
        table_name=table_name,
        primary_key_parts=primary_key_parts,
        raw_row_ref=raw_row_ref,
        raw_payload={str(key): value for key, value in row.items()},
    )


@dataclass(frozen=True)
class SourceRef:
    table_name: str
    primary_key_parts: Tuple[PrimaryKeyPart, ...]
    raw_row_ref: Optional[str] = None
    raw_payload: Mapping[str, Any] = field(default_factory=dict, compare=False, repr=False)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "table_name": self.table_name,
            "primary_key_parts": [
                {"column": column, "value": value}
                for column, value in self.primary_key_parts
            ],
            "raw_row_ref": self.raw_row_ref,
        }


@dataclass(frozen=True)
class NormalizedSeedBase:
    source_ref: SourceRef
    source_per_id: Optional[int]
    source_user_id: Optional[int]
    target_clinic_binding: Optional[str] = None
    extra_context: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class NormalizedClientSeed(NormalizedSeedBase):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    national_id: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone_home: Optional[str] = None
    phone_work: Optional[str] = None
    phone_mobile: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city_id: Optional[int] = None
    postal_code: Optional[str] = None
    discount_id: Optional[int] = None
    group_id: Optional[int] = None
    referral_id: Optional[int] = None
    referral_sub1_id: Optional[int] = None
    referral_sub2_id: Optional[int] = None
    notes: Optional[str] = None
    hidden_note: Optional[str] = None
    wants_laser: Optional[bool] = None
    laser_date: Optional[date] = None
    family_id: Optional[int] = None
    mailing_list: Optional[bool] = None
    occupation: Optional[str] = None


@dataclass(frozen=True)
class NormalizedUserSeed(NormalizedSeedBase):
    legacy_user_id: Optional[int] = None
    full_name: Optional[str] = None
    phone_home: Optional[str] = None
    phone_mobile: Optional[str] = None
    fax: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city_id: Optional[int] = None
    birth_date: Optional[date] = None
    salary: Optional[float] = None
    role_level: Optional[int] = None
    comment: Optional[str] = None
    user_tz: Optional[str] = None
    legacy_password_present: bool = False
    is_diagnostic_user: Optional[bool] = None
    is_employee: Optional[bool] = None


@dataclass(frozen=True)
class NormalizedFamilySeed(NormalizedSeedBase):
    legacy_family_id: Optional[int] = None
    family_name: Optional[str] = None
    member_source_per_ids: Tuple[int, ...] = ()


@dataclass(frozen=True)
class NormalizedGlassesExamSeed(NormalizedSeedBase):
    check_date: Optional[date] = None
    recheck_date: Optional[date] = None
    dominant_eye: Optional[str] = None
    objective: Dict[str, Any] = field(default_factory=dict)
    subjective: Dict[str, Any] = field(default_factory=dict)
    final_prescription: Dict[str, Any] = field(default_factory=dict)
    additional: Dict[str, Any] = field(default_factory=dict)
    comments: Optional[str] = None
    objective_comment: Optional[str] = None


@dataclass(frozen=True)
class NormalizedWorkShiftSeed(NormalizedSeedBase):
    legacy_work_shift_id: Optional[int] = None
    work_date: Optional[date] = None
    work_minutes: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None


@dataclass(frozen=True)
class NormalizedContactLensExamSeed(NormalizedSeedBase):
    check_date: Optional[date] = None
    recheck_date: Optional[date] = None
    corneal_diameter: Optional[float] = None
    pupil_diameter: Optional[str] = None
    tear_metrics: Dict[str, Any] = field(default_factory=dict)
    keratometry: Dict[str, Any] = field(default_factory=dict)
    lens_values: Dict[str, Any] = field(default_factory=dict)
    lens_catalog: Dict[str, Any] = field(default_factory=dict)
    care_solutions: Dict[str, Any] = field(default_factory=dict)
    comments: Optional[str] = None


@dataclass(frozen=True)
class NormalizedOrderSeed(NormalizedSeedBase):
    legacy_order_id: Optional[int] = None
    work_date: Optional[date] = None
    related_exam_date: Optional[date] = None
    promise_date: Optional[date] = None
    delivery_date: Optional[date] = None
    work_type_id: Optional[int] = None
    work_status_id: Optional[int] = None
    work_supply_id: Optional[int] = None
    lab_id: Optional[int] = None
    supplier_id: Optional[int] = None
    bag_number: Optional[str] = None
    comment: Optional[str] = None
    frame: Dict[str, Any] = field(default_factory=dict)
    lens: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class NormalizedFileSeed(NormalizedSeedBase):
    legacy_file_id: Optional[int] = None
    file_name: Optional[str] = None
    description: Optional[str] = None
    scan_date: Optional[date] = None
    scan_datetime: Optional[datetime] = None
    notes: Optional[str] = None
    scan_path: Optional[str] = None
    scan_exists: bool = False


@dataclass(frozen=True)
class NormalizedMedicalNoteSeed(NormalizedSeedBase):
    check_date: Optional[date] = None
    complaints: Optional[str] = None
    illnesses: Optional[str] = None
    optical_diagnosis: Optional[str] = None
    doctor_referral: Optional[str] = None
    summary: Optional[str] = None


@dataclass(frozen=True)
class NormalizedAppointmentSeed(NormalizedSeedBase):
    legacy_appointment_id: Optional[int] = None
    appointment_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    description: Optional[str] = None
    took_place: Optional[bool] = None
    reminder: Optional[bool] = None


def normalize_family_seed(
    family_id: Any,
    family_name: Optional[str],
    member_source_per_ids: Sequence[int],
    raw_row_ref: Optional[str] = None,
) -> NormalizedFamilySeed:
    legacy_family_id = parse_intish(family_id)
    row = {"FamId": legacy_family_id}
    return NormalizedFamilySeed(
        source_ref=build_source_ref("tblPerData_FamId", row, raw_row_ref),
        source_per_id=legacy_family_id,
        source_user_id=None,
        legacy_family_id=legacy_family_id,
        family_name=clean_text(family_name),
        member_source_per_ids=tuple(sorted({value for value in member_source_per_ids if value is not None})),
    )


def normalize_client_row(
    row: Mapping[str, Any],
    raw_row_ref: Optional[str] = None,
) -> NormalizedClientSeed:
    per_id = parse_intish(row.get("PerId"))
    sex = parse_intish(row.get("Sex"))
    gender = None
    if sex == 1:
        gender = "male"
    elif sex == 0:
        gender = "female"
    return NormalizedClientSeed(
        source_ref=build_source_ref("tblPerData", row, raw_row_ref),
        source_per_id=per_id,
        source_user_id=parse_intish(row.get("UserId")),
        first_name=clean_text(row.get("FirstName")),
        last_name=clean_text(row.get("LastName")),
        national_id=clean_text(row.get("TzId")),
        date_of_birth=parse_access_date(row.get("BirthDate")),
        gender=gender,
        phone_home=clean_text(row.get("HomePhone")),
        phone_work=clean_text(row.get("WorkPhone")),
        phone_mobile=clean_text(row.get("CellPhone")),
        fax=clean_text(row.get("Fax")),
        email=clean_text(row.get("Email")),
        address=clean_text(row.get("Address")),
        city_id=parse_intish(row.get("CityId")),
        postal_code=clean_text(row.get("ZipCode")),
        discount_id=parse_intish(row.get("DiscountId")),
        group_id=parse_intish(row.get("GroupId")),
        referral_id=parse_intish(row.get("RefId")),
        referral_sub1_id=parse_intish(row.get("RefsSub1Id")),
        referral_sub2_id=parse_intish(row.get("RefsSub2Id")),
        notes=clean_text(row.get("Comment")),
        hidden_note=clean_text(row.get("HidCom")),
        wants_laser=parse_boolish(row.get("WantsLaser")),
        laser_date=parse_access_date(row.get("LaserDate")),
        family_id=parse_intish(row.get("FamId")),
        mailing_list=parse_boolish(row.get("MailList")),
        occupation=clean_text(row.get("Ocup")),
    )


def normalize_user_row(
    row: Mapping[str, Any],
    raw_row_ref: Optional[str] = None,
) -> NormalizedUserSeed:
    first_name = clean_text(row.get("FirstName"))
    last_name = clean_text(row.get("LastName"))
    full_name = " ".join(part for part in (first_name, last_name) if part) or None
    return NormalizedUserSeed(
        source_ref=build_source_ref("tblUsers", row, raw_row_ref),
        source_per_id=None,
        source_user_id=parse_intish(row.get("UserId")),
        legacy_user_id=parse_intish(row.get("UserId")),
        full_name=full_name,
        phone_home=clean_text(row.get("HomePhone")),
        phone_mobile=clean_text(row.get("CellPhone")),
        fax=clean_text(row.get("Fax")),
        address=clean_text(row.get("Address")),
        postal_code=clean_text(row.get("ZipCode")),
        city_id=parse_intish(row.get("CityId")),
        birth_date=parse_access_date(row.get("BirthDate")),
        salary=parse_floatish(row.get("Salary")),
        role_level=parse_intish(row.get("LevelId")),
        comment=clean_text(row.get("Comment")),
        user_tz=clean_text(row.get("UserTz")),
        legacy_password_present=clean_text(row.get("Pass")) is not None,
        is_diagnostic_user=parse_boolish(row.get("Diag")),
        is_employee=parse_boolish(row.get("Emp")),
    )


def normalize_glasses_exam_row(
    row: Mapping[str, Any],
    raw_row_ref: Optional[str] = None,
) -> NormalizedGlassesExamSeed:
    objective = {
        "r_sph": parse_optical_value(row.get("ObjSphR")),
        "l_sph": parse_optical_value(row.get("ObjSphL")),
        "r_cyl": parse_floatish(row.get("ObjCylR")),
        "l_cyl": parse_floatish(row.get("ObjCylL")),
        "r_ax": parse_intish(row.get("ObjAxR")),
        "l_ax": parse_intish(row.get("ObjAxL")),
        "r_se": parse_optical_value(row.get("ObjSphEsR")),
        "l_se": parse_optical_value(row.get("ObjSphEsL")),
        "comb_pd": parse_floatish(row.get("ObjPD")),
        "r_va": parse_modified_acuity(row.get("ObjVAR")),
        "l_va": parse_modified_acuity(row.get("ObjVAL")),
        "comb_va": parse_modified_acuity(row.get("ObjVA")),
        "r_add": parse_floatish(row.get("ObjAddR")),
        "l_add": parse_floatish(row.get("ObjAddL")),
        "r_j": clean_text(row.get("ObjJR")),
        "l_j": clean_text(row.get("ObjJL")),
    }
    subjective = {
        "r_sph": parse_optical_value(row.get("SphR")),
        "l_sph": parse_optical_value(row.get("SphL")),
        "r_cyl": parse_floatish(row.get("CylR")),
        "l_cyl": parse_floatish(row.get("CylL")),
        "r_ax": parse_intish(row.get("AxR")),
        "l_ax": parse_intish(row.get("AxL")),
        "r_pris": parse_floatish(row.get("PrisR")),
        "l_pris": parse_floatish(row.get("PrisL")),
        "r_base": normalize_base(row.get("BaseR")),
        "l_base": normalize_base(row.get("BaseL")),
        "r_va": parse_modified_acuity(row.get("VAR")),
        "l_va": parse_modified_acuity(row.get("VAL")),
        "comb_va": parse_modified_acuity(row.get("VA")),
        "r_ph": clean_text(row.get("PHR")),
        "l_ph": clean_text(row.get("PHL")),
        "r_pd_far": parse_floatish(row.get("PDDistR")),
        "l_pd_far": parse_floatish(row.get("PDDistL")),
        "comb_pd_far": parse_floatish(row.get("PDDistA")),
        "r_pd_close": parse_floatish(row.get("PDReadR")),
        "l_pd_close": parse_floatish(row.get("PDReadL")),
        "comb_pd_close": parse_floatish(row.get("PDReadA")),
    }
    final_prescription = {
        "r_sph": parse_optical_value(row.get("PSphR")),
        "l_sph": parse_optical_value(row.get("PSphL")),
        "r_cyl": parse_floatish(row.get("PCylR")),
        "l_cyl": parse_floatish(row.get("PCylL")),
        "r_ax": parse_intish(row.get("PAxR")),
        "l_ax": parse_intish(row.get("PAxL")),
        "r_pris": parse_floatish(row.get("PPrisR")),
        "l_pris": parse_floatish(row.get("PPrisL")),
        "r_base": normalize_base(row.get("PBaseR")),
        "l_base": normalize_base(row.get("PBaseL")),
        "r_va": parse_modified_acuity(row.get("PVAR")),
        "l_va": parse_modified_acuity(row.get("PVAL")),
        "comb_va": parse_modified_acuity(row.get("PVA")),
        "r_ph": clean_text(row.get("PPHR")),
        "l_ph": clean_text(row.get("PPHL")),
        "r_pd_far": parse_floatish(row.get("PPDDistR")),
        "l_pd_far": parse_floatish(row.get("PPDDistL")),
        "comb_pd_far": parse_floatish(row.get("PPDDistA")),
        "r_pd_close": parse_floatish(row.get("PPDReadR")),
        "l_pd_close": parse_floatish(row.get("PPDReadL")),
        "comb_pd_close": parse_floatish(row.get("PPDReadA")),
        "r_ad": parse_floatish(row.get("PReadR")),
        "l_ad": parse_floatish(row.get("PReadL")),
        "r_j": parse_modified_acuity(row.get("PJR")),
        "l_j": parse_modified_acuity(row.get("PJL")),
        "type": (
            "מולטיפוקל"
            if any(parse_floatish(row.get(name)) not in (None, 0, 0.0) for name in ("PMulR", "PMulL"))
            else "ביפוקל"
            if any(parse_floatish(row.get(name)) not in (None, 0, 0.0) for name in ("PBifR", "PBifL"))
            else "רחוק"
        ),
    }
    additional = {
        "r_read": parse_floatish(row.get("ReadR")),
        "l_read": parse_floatish(row.get("ReadL")),
        "r_read_final": parse_floatish(row.get("PReadR")),
        "l_read_final": parse_floatish(row.get("PReadL")),
        "r_add_pris": parse_floatish(row.get("AddPrisR")),
        "l_add_pris": parse_floatish(row.get("AddPrisL")),
        "r_add_base": parse_floatish(row.get("AddBaseR")),
        "l_add_base": parse_floatish(row.get("AddBaseL")),
        "r_int": parse_floatish(row.get("IntR")),
        "l_int": parse_floatish(row.get("IntL")),
        "r_bif": parse_floatish(row.get("BifR")),
        "l_bif": parse_floatish(row.get("BifL")),
        "r_mul": parse_floatish(row.get("MulR")),
        "l_mul": parse_floatish(row.get("MulL")),
        "r_high": parse_floatish(row.get("HighR")),
        "l_high": parse_floatish(row.get("HighL")),
        "r_j": clean_text(row.get("JR")),
        "l_j": clean_text(row.get("JL")),
        "r_j_final": clean_text(row.get("PJR")),
        "l_j_final": clean_text(row.get("PJL")),
        "iop_left": parse_floatish(row.get("IOPL")),
        "iop_right": parse_floatish(row.get("IOPR")),
        "ext_r_pris": parse_floatish(row.get("ExtPrisR")),
        "ext_l_pris": parse_floatish(row.get("ExtPrisL")),
        "ext_r_base": normalize_base(row.get("ExtBaseR")),
        "ext_l_base": normalize_base(row.get("ExtBaseL")),
        "fvr": parse_modified_acuity(row.get("FVR")),
        "fvl": parse_modified_acuity(row.get("FVL")),
    }
    return NormalizedGlassesExamSeed(
        source_ref=build_source_ref("tblCrdGlassChecks", row, raw_row_ref),
        source_per_id=parse_intish(row.get("PerId")),
        source_user_id=parse_intish(row.get("UserId")),
        check_date=parse_access_date(row.get("CheckDate")),
        recheck_date=parse_access_date(row.get("ReCheckDate")),
        dominant_eye=normalize_eye(row.get("DominEye")),
        objective={k: v for k, v in objective.items() if v is not None},
        subjective={k: v for k, v in subjective.items() if v is not None},
        final_prescription={k: v for k, v in final_prescription.items() if v is not None},
        additional={k: v for k, v in additional.items() if v is not None},
        comments=clean_text(row.get("Comments")),
        objective_comment=clean_text(row.get("ObjComm")),
    )


def normalize_contact_lens_exam_row(
    row: Mapping[str, Any],
    raw_row_ref: Optional[str] = None,
) -> NormalizedContactLensExamSeed:
    tear_metrics = {
        "but": parse_floatish(row.get("BUT")),
        "but_left": parse_floatish(row.get("BUTL")),
        "schirmer_right": parse_optical_float(row.get("ShirR")),
        "schirmer_left": parse_optical_float(row.get("ShirL")),
        "eye_lid_key": parse_intish(row.get("EyeLidKey")),
        "eye_color": clean_text(row.get("Ecolor")),
    }
    keratometry = {
        "r_h": parse_floatish(row.get("rHR")),
        "l_h": parse_floatish(row.get("rHL")),
        "r_v": parse_floatish(row.get("rVR")),
        "l_v": parse_floatish(row.get("rVL")),
        "r_h_axis": parse_intish(row.get("AxHR")),
        "l_h_axis": parse_intish(row.get("AxHL")),
        "r_t": parse_floatish(row.get("rTR")),
        "l_t": parse_floatish(row.get("rTL")),
        "r_n": parse_floatish(row.get("rNR")),
        "l_n": parse_floatish(row.get("rNL")),
        "r_i": parse_floatish(row.get("rIR")),
        "l_i": parse_floatish(row.get("rIL")),
        "r_s": parse_floatish(row.get("rSR")),
        "l_s": parse_floatish(row.get("rSL")),
    }
    lens_values = {
        "r_diam": parse_floatish(row.get("DiamR")),
        "l_diam": parse_floatish(row.get("DiamL")),
        "r_bc_1": parse_contact_bc(row.get("BC1R")),
        "l_bc_1": parse_contact_bc(row.get("BC1L")),
        "r_bc_2": parse_floatish(row.get("BC2R")),
        "l_bc_2": parse_floatish(row.get("BC2L")),
        "r_oz": parse_numeric_only(row.get("OZR")),
        "l_oz": parse_numeric_only(row.get("OZL")),
        "r_pr": parse_floatish(row.get("PrR")),
        "l_pr": parse_floatish(row.get("PrL")),
        "r_sph": parse_optical_value(row.get("SphR")),
        "l_sph": parse_optical_value(row.get("SphL")),
        "r_cyl": parse_floatish(row.get("CylR")),
        "l_cyl": parse_floatish(row.get("CylL")),
        "r_ax": parse_intish(row.get("AxR")),
        "l_ax": parse_intish(row.get("AxL")),
        "r_add": parse_contact_add(row.get("AddR")),
        "l_add": parse_contact_add(row.get("AddL")),
        "r_va": parse_modified_acuity(row.get("VAR")),
        "l_va": parse_modified_acuity(row.get("VAL")),
        "comb_va": parse_modified_acuity(row.get("VA")),
        "r_ph": clean_text(row.get("PHR")),
        "l_ph": clean_text(row.get("PHL")),
    }
    lens_catalog = {
        "r_material_id": parse_intish(row.get("MaterR")),
        "l_material_id": parse_intish(row.get("MaterL")),
        "r_tint_id": parse_intish(row.get("TintR")),
        "l_tint_id": parse_intish(row.get("TintL")),
        "r_type_id": parse_intish(row.get("ClensTypeIdR")),
        "l_type_id": parse_intish(row.get("ClensTypeIdL")),
        "r_manufacturer_id": parse_intish(row.get("ClensManufIdR")),
        "l_manufacturer_id": parse_intish(row.get("ClensManufIdL")),
        "r_brand_id": parse_intish(row.get("ClensBrandIdR")),
        "l_brand_id": parse_intish(row.get("ClensBrandIdL")),
    }
    care_solutions = {
        "clean_id": parse_intish(row.get("ClensSolCleanId")),
        "disinfect_id": parse_intish(row.get("ClensSolDisinfectId")),
        "rinse_id": parse_intish(row.get("ClensSolRinseId")),
    }
    return NormalizedContactLensExamSeed(
        source_ref=build_source_ref("tblCrdClensChecks", row, raw_row_ref),
        source_per_id=parse_intish(row.get("PerId")),
        source_user_id=parse_intish(row.get("UserId")),
        check_date=parse_access_date(row.get("CheckDate")),
        recheck_date=parse_access_date(row.get("ReCheckDate")),
        corneal_diameter=parse_floatish(row.get("CornDiam")),
        pupil_diameter=clean_text(row.get("PupDiam")),
        tear_metrics={k: v for k, v in tear_metrics.items() if v is not None},
        keratometry={k: v for k, v in keratometry.items() if v is not None},
        lens_values={k: v for k, v in lens_values.items() if v is not None},
        lens_catalog={k: v for k, v in lens_catalog.items() if v is not None},
        care_solutions={k: v for k, v in care_solutions.items() if v is not None},
        comments=clean_text(row.get("Comments")),
    )


def normalize_previous_refraction_row(row: Mapping[str, Any]) -> list[Dict[str, Any]]:
    """Expand one tblCrdGlassChecksPrevs row into its substantive refractions."""
    tabs: list[Dict[str, Any]] = []
    for index in range(1, 5):
        tab = {
            "r_sph": parse_optical_value(row.get(f"SphR{index}")),
            "l_sph": parse_optical_value(row.get(f"SphL{index}")),
            "r_cyl": parse_floatish(row.get(f"CylR{index}")),
            "l_cyl": parse_floatish(row.get(f"CylL{index}")),
            "r_ax": parse_intish(row.get(f"AxR{index}")),
            "l_ax": parse_intish(row.get(f"AxL{index}")),
            "r_pris": parse_floatish(row.get(f"PrisR{index}")),
            "l_pris": parse_floatish(row.get(f"PrisL{index}")),
            "r_base": normalize_base(row.get(f"BaseR{index}")),
            "l_base": normalize_base(row.get(f"BaseL{index}")),
            "r_va": parse_modified_acuity(row.get(f"VAR{index}")),
            "l_va": parse_modified_acuity(row.get(f"VAL{index}")),
            "comb_va": parse_modified_acuity(row.get(f"VA{index}")),
            "r_ad": parse_floatish(row.get(f"AddR{index}")),
            "l_ad": parse_floatish(row.get(f"AddL{index}")),
            "type": "רחוק",
            "legacy_prev_id": parse_intish(row.get("PrevId")),
            "legacy_slot": index,
            "legacy_comment": clean_text(row.get(f"Comments{index}")),
            # Semantics are incomplete; retain these in trace instead of the card.
            "trace_pd_far": {
                "r": parse_floatish(row.get(f"PDDistR{index}")),
                "l": parse_floatish(row.get(f"PDDistL{index}")),
                "combined": parse_floatish(row.get(f"PDDistA{index}")),
            },
            "trace_secondary_prism": {
                "r": parse_floatish(row.get(f"ExtPrisR{index}")),
                "l": parse_floatish(row.get(f"ExtPrisL{index}")),
                "r_base": normalize_base(row.get(f"ExtBaseR{index}")),
                "l_base": normalize_base(row.get(f"ExtBaseL{index}")),
            },
        }
        content_fields = (
            "r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax",
            "r_pris", "l_pris", "r_va", "l_va", "comb_va", "r_ad", "l_ad",
        )
        if any(tab.get(field) not in (None, "", 0, 0.0) for field in content_fields):
            tabs.append(tab)
    return tabs


def normalize_order_row(
    row: Mapping[str, Any],
    raw_row_ref: Optional[str] = None,
) -> NormalizedOrderSeed:
    frame = {
        "frame_supplier_id": parse_intish(row.get("FSapakId")),
        "frame_label_id": parse_intish(row.get("FLabelId")),
        "frame_model": clean_text(row.get("FModel")),
        "frame_color": clean_text(row.get("FColor")),
        "frame_size": clean_text(row.get("FSize")),
        "frame_sold": parse_boolish(row.get("FrameSold")),
    }
    lens = {
        "lens_role_id": parse_intish(row.get("RoleId")),
        "lens_material_id": parse_intish(row.get("MaterId")),
        "lens_brand_id": parse_intish(row.get("BrandId")),
        "lens_coat_id": parse_intish(row.get("CoatId")),
        "lens_model_id": parse_intish(row.get("ModelId")),
        "lens_color_id": parse_intish(row.get("ColorId")),
        "diameter": clean_text(row.get("Diam")),
        "segment": parse_floatish(row.get("Segment")),
    }
    return NormalizedOrderSeed(
        source_ref=build_source_ref("tblCrdBuysWorks", row, raw_row_ref),
        source_per_id=parse_intish(row.get("PerId")),
        source_user_id=parse_intish(row.get("UserId")),
        legacy_order_id=parse_intish(row.get("WorkId")),
        work_date=parse_access_date(row.get("WorkDate")),
        related_exam_date=parse_access_date(row.get("CheckDate")),
        promise_date=parse_access_date(row.get("PromiseDate")),
        delivery_date=parse_access_date(row.get("DeliverDate")),
        work_type_id=parse_intish(row.get("WorkTypeId")),
        work_status_id=parse_intish(row.get("WorkStatId")),
        work_supply_id=parse_intish(row.get("WorkSupplyId")),
        lab_id=parse_intish(row.get("LabId")),
        supplier_id=parse_intish(row.get("SapakId")),
        bag_number=clean_text(row.get("BagNum")),
        comment=clean_text(row.get("Comment")),
        frame={k: v for k, v in frame.items() if v is not None},
        lens={k: v for k, v in lens.items() if v is not None},
    )


def normalize_file_row(
    row: Mapping[str, Any],
    scans_dir: Path,
    raw_row_ref: Optional[str] = None,
) -> NormalizedFileSeed:
    file_name = clean_text(row.get("PicFileName"))
    scan_path = scans_dir / file_name if file_name else None
    scan_datetime = parse_access_datetime(row.get("ScanDate"))
    return NormalizedFileSeed(
        source_ref=build_source_ref("tblPerPicture", row, raw_row_ref),
        source_per_id=parse_intish(row.get("PerId")),
        source_user_id=None,
        legacy_file_id=parse_intish(row.get("PerPicId")),
        file_name=file_name,
        description=clean_text(row.get("Description")),
        scan_date=scan_datetime.date() if scan_datetime is not None else None,
        scan_datetime=scan_datetime,
        notes=clean_text(row.get("Notes")),
        scan_path=str(scan_path) if scan_path else None,
        scan_exists=bool(scan_path and scan_path.exists()),
    )


def normalize_medical_note_row(
    row: Mapping[str, Any],
    raw_row_ref: Optional[str] = None,
) -> NormalizedMedicalNoteSeed:
    return NormalizedMedicalNoteSeed(
        source_ref=build_source_ref("tblCrdDiags", row, raw_row_ref),
        source_per_id=parse_intish(row.get("PerId")),
        source_user_id=parse_intish(row.get("UserId")),
        check_date=parse_access_date(row.get("CheckDate")),
        complaints=clean_text(row.get("Complaints")),
        illnesses=clean_text(row.get("illnesses")),
        optical_diagnosis=clean_text(row.get("OptDiag")),
        doctor_referral=clean_text(row.get("DocRef")),
        summary=clean_text(row.get("Summary")),
    )


def normalize_appointment_row(
    row: Mapping[str, Any],
    raw_row_ref: Optional[str] = None,
) -> NormalizedAppointmentSeed:
    return NormalizedAppointmentSeed(
        source_ref=build_source_ref("tblClndrApt", row, raw_row_ref),
        source_per_id=parse_intish(row.get("PerID")),
        source_user_id=parse_intish(row.get("UserID")),
        legacy_appointment_id=parse_intish(row.get("AptNum")),
        appointment_date=parse_access_date(row.get("AptDate")),
        start_time=parse_access_time(row.get("StarTime")),
        end_time=parse_access_time(row.get("EndTime")),
        description=clean_text(row.get("AptDesc")),
        took_place=parse_boolish(row.get("TookPlace")),
        reminder=parse_boolish(row.get("Reminder")),
    )


def normalize_work_shift_row(
    row: Mapping[str, Any],
    raw_row_ref: Optional[str] = None,
) -> NormalizedWorkShiftSeed:
    work_hours = parse_floatish(row.get("WrkTime"))
    return NormalizedWorkShiftSeed(
        source_ref=build_source_ref("tblClndrWrk", row, raw_row_ref),
        source_per_id=None,
        source_user_id=parse_intish(row.get("UserID")),
        legacy_work_shift_id=parse_intish(row.get("WrkId")),
        work_date=parse_access_date(row.get("WrkDate")),
        work_minutes=max(0, int(round(work_hours * 60))) if work_hours is not None else None,
        start_time=parse_access_time(row.get("StartTime")),
        end_time=parse_access_time(row.get("EndTime")),
    )
