"""Lossless, migration-only clinical cards. Raw snapshots remain immutable in trace.

Bindings expose existing hidden canonical values without creating a second editable
copy. Unrecognized exported clinical fields remain visible under their source name.
"""
import hashlib
import re
from typing import Any, Mapping

CARD_TYPES = (
    "optitech-examination", "optitech-prescription", "optitech-contact-measurements",
    "optitech-accommodation", "optitech-binocular",
)
CLINICAL_TABLES = {
    "tblCrdDisDiags": "vision",
    "tblCrdOverViews": "review",
    "tblCrdOrthoks": "ortho-k",
    "tblCrdClinicChecks": "clinical-health",
    "tblCrdFrps": "replacement-plan",
}
CHILD_CLINICAL_TABLES = {
    "tblCrdGlassChecksGlasses": ("tblCrdGlassChecks", "lens-specification", "optitech-prescription"),
    "tblCrdGlassChecksFrm": ("tblCrdGlassChecks", "frame-specification", "optitech-prescription"),
    "tblCrdGlassChecksGlassesP": ("tblCrdGlassChecks", "additional-lens-specification", "optitech-prescription"),
    "tblCrdLVChecks": ("tblCrdGlassChecks", "low-vision", "optitech-examination"),
    "tblCrdClensFits": ("tblCrdClensChecks", "contact-lens-fitting", "optitech-contact-measurements"),
    "tblCrdFrpsLines": ("tblCrdFrps", "replacement-plan-line", "optitech-contact-measurements"),
}
ALL_CLINICAL_TABLES = tuple((*CLINICAL_TABLES, *CHILD_CLINICAL_TABLES))
IDENTITY = {
    "PerId", "CheckDate", "UserId", "OrthoKId", "OrthokId", "FrpId", "FrpLineId",
    "GlassId", "GlassCId", "GlassPId", "PrevId", "FitId", "ClinicCheckId", "LVId",
}
ACCOMMODATION = {
    "PushUp", "MinusLens", "MonAccFac6", "MonAccFac7", "MonAccFac8", "MonAccFac13",
    "BinAccFac6", "BinAccFac7", "BinAccFac8", "BinAccFac13", "MemRet", "FusedXCyl", "NRA", "PRA",
}
GLASSES_VISIBLE = set("SphR SphL CylR CylL AxR AxL PrisR PrisL BaseR BaseL ReadR ReadL IntR IntL BifR BifL MulR MulL JR JL PDDistR PDDistL PDDistA PDReadR PDReadL PDReadA FVR FVL DominEye Comments ObjComm ObjSphR ObjSphL ObjCylR ObjCylL ObjAxR ObjAxL ObjSphEsR ObjSphEsL PSphR PSphL PCylR PCylL PAxR PAxL PPrisR PPrisL PBaseR PBaseL PVAR PVAL PVA PReadR PReadL PJR PJL".split())
CONTACT_VISIBLE = set("PupDiam CornDiam BUT BUTL ShirR ShirL DiamR DiamL BC1R BC1L OZR OZL SphR SphL CylR CylL AxR AxL AddR AddL VAR VAL VA MaterR MaterL TintR TintL ClensTypeIdR ClensTypeIdL ClensManufIdR ClensManufIdL ClensBrandIdR ClensBrandIdL ClensSolCleanId ClensSolDisinfectId ClensSolRinseId Comments".split())


def present(value: Any) -> bool:
    return value is not None and str(value).strip().lower() not in {"", "null", "none", "nan"}


def card(component: str, fields: Mapping[str, Any], instance_id: int, *, bindings=None, suffix="1"):
    values = {k: str(v) for k, v in fields.items() if present(v)}
    if not values and not bindings:
        return {}
    return {component if suffix == "1" else f"{component}-{component}-{suffix}": {
        "layout_instance_id": instance_id, "card_instance_id": f"{component}-{suffix}",
        **values, **({"bindings": bindings} if bindings else {}),
    }}


def add_supplemental_cards(data: dict, seed, instance_id: int, *, contact=False):
    row = seed.source_ref.raw_payload
    visible = CONTACT_VISIBLE if contact else GLASSES_VISIBLE
    remaining = {k: v for k, v in row.items() if k not in visible | IDENTITY and present(v)}
    remaining.update({k: v for k, v in seed.extra_context.get("source_bases", {}).items() if k in remaining})
    targets = {}
    if not contact:
        for source, field in {"Sph": "sph", "Cyl": "cyl", "Ax": "ax", "Pris": "pris", "Read": "ad", "PDDist": "pd_far", "PDRead": "pd_close"}.items():
            for eye in ("R", "L"):
                targets[source + eye] = ("final-prescription", eye.lower() + "_" + field)
        for source in ("Int", "Bif", "Mul", "J"):
            for eye in ("R", "L"):
                targets[source + eye] = ("addition", eye.lower() + "_" + source.lower())
    else:
        for source, field in {"Sph": "sph", "Cyl": "cyl", "Ax": "ax", "BC1": "bc", "OZ": "oz", "Diam": "diam", "Add": "read_ad"}.items():
            for eye in ("R", "L"):
                targets[source + eye] = ("contact-lens-exam", eye.lower() + "_" + field)
        for source, field in {"Mater": "material", "Tint": "color", "ClensTypeId": "lens_type", "ClensManufId": "supplier", "ClensBrandId": "model"}.items():
            for eye in ("R", "L"):
                targets[source + eye] = ("contact-lens-details", eye.lower() + "_" + field)
        for source, field in {"ClensSolCleanId": "cleaning_solution", "ClensSolDisinfectId": "disinfection_solution", "ClensSolRinseId": "rinsing_solution"}.items():
            targets[source] = ("contact-lens-order", field)
        targets.update({"PupDiam": ("contact-lens-diameters", "pupil_diameter"), "CornDiam": ("contact-lens-diameters", "corneal_diameter"),
                        "ShirR": ("schirmer-test", "r_mm"), "ShirL": ("schirmer-test", "l_mm"),
                        "BUT": ("schirmer-test", "r_but"), "BUTL": ("schirmer-test", "l_but"),
                        "VAR": ("contact-lens-exam", "r_va"), "VAL": ("contact-lens-exam", "l_va"), "VA": ("contact-lens-exam", "comb_va")})
    if not contact:
        targets.update({"FVR": ("uncorrected-va", "r_fv"), "FVL": ("uncorrected-va", "l_fv"),
                        "PDDistA": ("final-prescription", "comb_pd_far"), "PDReadA": ("final-prescription", "comb_pd_close")})
        for source, field in {"ObjSph": "sph", "ObjCyl": "cyl", "ObjAx": "ax", "ObjSphEs": "se"}.items():
            for eye in ("R", "L"):
                targets[source + eye] = ("objective", eye.lower() + "_" + field)
    for source, (component, field) in targets.items():
        if present(row.get(source)) and not present(data.get(component, {}).get(field)):
            remaining[source] = row[source]
    # These fields already have canonical storage but are hidden in normal cards.
    binding_fields = {} if contact else {
        "VAR": ("final-prescription", "r_va"), "VAL": ("final-prescription", "l_va"),
        "VA": ("final-prescription", "comb_va"), "HighR": ("final-prescription", "r_high"),
        "HighL": ("final-prescription", "l_high"), "IOPR": ("addition", "r_iop"),
        "IOPL": ("addition", "l_iop"),
    }
    bindings = {}
    for source, (component, field) in binding_fields.items():
        if present(data.get(component, {}).get(field)):
            bindings[source] = {"component": component, "field": field}
            remaining.pop(source, None)
    exam_fields = {k: remaining.pop(k) for k in list(remaining) if k in {
        "ReCheckDate", "IOPR", "IOPL", "IOPTime", "IOPInstId", "NPC", "NPCR", "NPAR", "NPAL",
        "AmslerR", "AmslerL", "CTD", "CTN", "CCD", "CCN",
    }}
    if "IOPInstId" in exam_fields:
        resolved = seed.extra_context.get("source_lookups", {}).get("IOPInstId")
        if resolved:
            exam_fields["IOPInstId"] = resolved
        elif str(exam_fields["IOPInstId"]).strip() in {"0", "0.0"}:
            exam_fields.pop("IOPInstId", None)
    if seed.recheck_date is not None:
        exam_fields["ReCheckDate"] = seed.recheck_date.isoformat()
    exam_bindings = {k: v for k, v in bindings.items() if k.startswith("IOP")}
    prescription_bindings = {k: v for k, v in bindings.items() if k not in exam_bindings}
    data.update(card("optitech-examination", exam_fields, instance_id, bindings=exam_bindings))
    if contact:
        for source, target in (("OZR", "r_oz"), ("OZL", "l_oz"), ("BC1R", "r_bc"), ("BC1L", "l_bc")):
            if present(row.get(source)) and target not in data.get("contact-lens-exam", {}):
                remaining[source] = row[source]
    data.update(card("optitech-contact-measurements" if contact else "optitech-prescription",
                     remaining, instance_id, bindings=prescription_bindings))
    unresolved = seed.extra_context.get("unresolved_bases", {})
    if unresolved:
        block = data.setdefault("optitech-prescription", {
            "layout_instance_id": instance_id, "card_instance_id": "optitech-prescription-1",
        })
        block.update({f"unresolved_{k}": str(v) for k, v in unresolved.items()})
    # Previous-row fields not represented by the standard refraction tabs stay
    # associated with their original row/slot, including comments and PD.
    for i, previous in enumerate(seed.extra_context.get("previous_refractions", []), 1):
        fields = {}
        previous_targets = {"Sph": "sph", "Cyl": "cyl", "Ax": "ax", "Pris": "pris", "Base": "base", "VA": "va", "Add": "ad"}
        for key, value in previous.get("source_fields", {}).items():
            match = re.fullmatch(r"(Sph|Cyl|Ax|Pris|Base|VA|Add)([RL]?)\d+", key)
            target = ((match[2].lower() + "_") if match[2] else "comb_") + previous_targets[match[1]] if match else None
            if target is None or not present(previous.get(target)):
                fields[key] = value
        data.update(card("optitech-prescription", fields, instance_id, suffix=f"previous-{i}"))
    for i, previous_row in enumerate(seed.extra_context.get("previous_raw_rows", []), 1):
        fields = {k: v for k, v in previous_row.items() if k not in IDENTITY and not re.search(r"\d+$", k) and not k.startswith("Ref")}
        data.update(card("optitech-prescription", fields, instance_id, suffix=f"previous-row-{i}"))
    for i, record in enumerate(seed.extra_context.get("retinoscopy_records", []), 1):
        added = card("optitech-prescription", record.get("source_fields", {}), instance_id, suffix=f"retinoscopy-{i}")
        if added:
            block = next(iter(added.values()))
            block["source_section"] = "retinoscopy-record"
            block["source_provenance"] = record.get("source_provenance", {})
            data.update(added)
    return data


LOOKUP_FIELDS = {
    "tblCrdClensFits": {"ClensTypeIdR": "tblCrdClensTypes", "ClensTypeIdL": "tblCrdClensTypes", "ClensManufIdR": "tblCrdClensManuf", "ClensManufIdL": "tblCrdClensManuf", "ClensBrandIdR": "tblCrdClensBrands", "ClensBrandIdL": "tblCrdClensBrands"},
    "tblCrdLVChecks": {"EyeId": "tblEyes", "ManufId": "tblCrdLVManuf", "FrameId": "tblCrdLVFrame", "AreaId": "tblCrdLVArea", "CapId": "tblCrdLVCap"},
    "tblCrdGlassChecksGlasses": {"RoleId": "tblCrdGlassRole", "MaterId": "tblCrdGlassMater", "BrandId": "tblCrdGlassBrand", "CoatId": "tblCrdGlassCoat", "ModelId": "tblCrdGlassModel", "ColorId": "tblCrdGlassColor"},
    "tblCrdGlassChecksGlassesP": {"UseId": "tblCrdGlassUses", "SapakId": "tblSapaks", "LensTypeId": "tblLnsTypes", "LensMaterId": "tblLnsMaterials", "LensCharId": "tblLnsChars", "TreatCharId": "tblLnsTreatChars", "TreatCharId1": "tblLnsTreatChars", "TreatCharId2": "tblLnsTreatChars", "TreatCharId3": "tblLnsTreatChars", "EyeId": "tblEyes"},
}
CARD_EXCLUDED = {"SaleAdd", "OrderId", "CustId", "Pic", "PICR", "PICL", "Pic3", "Pic4"}


def deterministic_card_suffix(table: str, row: Mapping[str, Any]) -> str:
    identity = "|".join(f"{key}={row.get(key, '')}" for key in sorted(IDENTITY) if key in row)
    return hashlib.sha256(f"{table}|{identity}".encode("utf-8")).hexdigest()[:12]


def resolve_card_fields(table: str, row: Mapping[str, Any], catalog: Mapping[str, Mapping[int, Any]] | None = None):
    from .records import parse_intish
    catalog = catalog or {}
    fields, provenance = {}, {}
    questionnaire = catalog.get("tblCrdClinicChars", {})
    source_labels = {}
    for key, value in row.items():
        if key in IDENTITY or key in CARD_EXCLUDED or not present(value):
            continue
        if key.startswith("YN") and key[2:].isdigit():
            source_labels[key] = questionnaire.get(int(key[2:])) or key
            fields[key] = value
            continue
        lookup = LOOKUP_FIELDS.get(table, {}).get(key)
        if lookup:
            code = parse_intish(value)
            if code in (None, 0):
                continue
            provenance[key] = {"source_id": code, "lookup_table": lookup}
            fields[key] = catalog.get(lookup, {}).get(code) or f"[unknown:{code}]"
            continue
        fields[key] = value
    return fields, provenance, source_labels


def build_clinical_data(table: str, row: Mapping[str, Any], instance_id: int, catalog=None, *, repeated=False):
    fields, provenance, source_labels = resolve_card_fields(table, row, catalog)
    if table in {"tblCrdGlassChecksGlasses", "tblCrdGlassChecksFrm", "tblCrdGlassChecksGlassesP", "tblCrdLVChecks"}:
        meaningful = False
        for value in fields.values():
            text = str(value).strip()
            try:
                meaningful = meaningful or float(text.replace(",", ".")) != 0
            except ValueError:
                meaningful = meaningful or text.lower() not in {"", "false", "none", "null", "[ללא]"}
        if not meaningful:
            return {}
    if table == "tblCrdDisDiags":
        return {
            **card("optitech-accommodation", {k: v for k, v in fields.items() if k.lower() in {x.lower() for x in ACCOMMODATION}}, instance_id),
            **card("optitech-binocular", {k: v for k, v in fields.items() if k.lower() not in {x.lower() for x in ACCOMMODATION}}, instance_id),
        }
    component = CHILD_CLINICAL_TABLES.get(table, (None, None, None))[2]
    if component is None:
        component = "optitech-contact-measurements" if table in {"tblCrdOrthoks", "tblCrdFrps"} else "optitech-examination"
    suffix = deterministic_card_suffix(table, row) if repeated else "1"
    result = card(component, fields, instance_id, suffix=suffix)
    if result:
        block = next(iter(result.values()))
        block["source_section"] = CHILD_CLINICAL_TABLES.get(table, (None, CLINICAL_TABLES.get(table), None))[1]
        block["source_table"] = table
        if provenance:
            block["source_provenance"] = provenance
        if source_labels:
            block["source_labels"] = source_labels
    return result


def resolve_seed_bases(seed, catalog):
    """Use the source lookup. Missing/unknown codes stay visible, never guessed."""
    from dataclasses import replace
    from .records import normalize_base, parse_intish
    source = seed.source_ref.raw_payload
    subjective, previous = dict(seed.subjective), dict(seed.final_prescription)
    unresolved = {}
    for prefix, target in (("", subjective), ("P", previous)):
        for eye in ("R", "L"):
            key = f"{prefix}Base{eye}"
            value = source.get(key)
            code = parse_intish(value)
            if code is None:
                resolved = normalize_base(value)
            elif code == 0:
                resolved = None
            else:
                label = catalog.get("tblBases", {}).get(code)
                resolved = normalize_base(label) if label else None
                if resolved is None:
                    unresolved[key] = value
            target[f"{eye.lower()}_base"] = resolved
    # Additional prism bases stay in migration cards; expose decoded labels too.
    source_bases = {}
    for key, value in source.items():
        if "base" in key.lower() and present(value):
            code = parse_intish(value)
            if code is not None and code != 0:
                label = catalog.get("tblBases", {}).get(code)
                if label:
                    source_bases[key] = label.upper()
                else:
                    unresolved[key] = value
    source_lookups = {}
    iop_code = parse_intish(source.get("IOPInstId"))
    if iop_code not in (None, 0):
        source_lookups["IOPInstId"] = catalog.get("tblCrdGlassIOPInsts", {}).get(iop_code) or f"[unknown:{iop_code}]"
    return replace(seed, subjective=subjective, final_prescription=previous,
                   extra_context={**seed.extra_context, "unresolved_bases": unresolved, "source_bases": source_bases, "source_lookups": source_lookups})
