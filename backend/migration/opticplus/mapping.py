"""Explicit OpticPlus mappings. Uncertain source semantics are never inferred."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import json
import re
from typing import Any

from .clinical import card_data, populated, native_card

KINDS = {"מרשם סופי": "final-prescription", "מרשם ישן": "old-refraction",
         "מרשםישן": "old-refraction", "בדיקה סובייקטיבית": "subjective",
         "בדיקה אובייקטיבית": "objective", "מרשם נסיוני": "contact-lens-exam"}


def clean(value: Any) -> str | None:
    return str(value).strip() if value is not None and str(value).strip() else None


def date_value(value: Any, *, past_only: bool = False) -> date | None:
    try:
        result = date.fromisoformat(str(value)[:10])
        return None if result.year < 1900 or (past_only and result > date.today()) else result
    except (ValueError, TypeError):
        return None


def number(value: Any, *, minimum: float = -40, maximum: float = 40, plano: bool = False) -> float | None:
    text = clean(value)
    if plano and text and text.upper() in {"PLANO", "PL", "PLAN"}:
        return 0.0
    if not text or not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", text):
        return None
    n = float(text)
    return n if minimum <= n <= maximum else None


def money(value: Any) -> Decimal:
    try:
        n = Decimal(str(value))
        if not n.is_finite():
            raise ValueError("Nonfinite OpticPlus amount")
        return n.quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError):
        raise ValueError("Invalid OpticPlus amount") from None


def visible_source(row: dict) -> str:
    # Source column names are provenance, not inferred/translatable diagnoses.
    return "\n".join(f"{k}: {json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v}"
                     for k, v in row.items() if not k.startswith("__") and v not in (None, ""))


def client_payload(row: dict) -> dict:
    return {"first_name": clean(row.get("pname")), "last_name": clean(row.get("fname")),
            "national_id": clean(row.get("zehut")), "date_of_birth": date_value(row.get("bdate"), past_only=True),
            "gender": {"ז": "זכר", "נ": "נקבה"}.get(clean(row.get("min"))),
            "health_fund": clean(row.get("kupa")), "address_street": clean(row.get("address")),
            "address_city": clean(row.get("city")), "postal_code": clean(row.get("mikud")),
            "phone_mobile": clean(row.get("sel")), "phone_home": clean(row.get("tel")),
            "phone_work": clean(row.get("telw")), "fax": clean(row.get("fax")), "email": clean(row.get("email")),
            "file_creation_date": date_value(row.get("cdate")), "occupation": clean(row.get("qmikzoa")),
            "notes": clean(row.get("remark"))}


def exam_payload(table: str, row: dict) -> tuple[dict, dict]:
    contact = table == "adchecks"
    category = KINDS.get(clean(row.get("qtyp")))
    exam = {"exam_date": date_value(row.get("caddate" if contact else "chdate"), past_only=True),
            "test_name": "opticplus.exam.contact" if contact else "opticplus.exam.glasses",
            "type": "exam",
            "dominant_eye": {"ימין": "R", "שמאל": "L"}.get(clean(row.get("qdomin")))}
    data = {}
    consumed = {"numw", "bdikanum", "__date_serials", "chdate", "caddate", "qdomin"}
    if clean(row.get("remark")):
        data["notes-notes-1"] = {"card_instance_id": "notes-1", "title": "OpticPlus", "note": clean(row["remark"])}
    consumed.add("remark")
    component = ("old-contact-lenses" if category == "old-refraction" else "contact-lens-exam") if contact and category else category
    if not contact and component == "contact-lens-exam": component = None
    if component:
        fields = {}
        for side in ("r", "l"):
            prefix = f"cn{side}" if contact else f"c{side}"
            for suffix, target in [("sph", "sph"), ("cyl", "cyl"), ("axis", "ax")]:
                value = number(row.get(prefix + suffix), minimum=0 if suffix == "axis" else -40,
                               maximum=180 if suffix == "axis" else 40, plano=suffix == "sph")
                fields[f"{side}_{target}"] = value
                if value is not None:
                    consumed.add(prefix + suffix)
            va = clean(row.get(prefix + "visus"))
            # Imported controls display source notation literally: no SoftOptic
            # denominator normalization or inferred conversion of dotted values.
            fields[f"{side}_va"] = va
            if fields[f"{side}_va"] is not None: consumed.add(prefix + "visus")
            if contact:
                for suffix, target in [("bc", "bc"), ("ktr", "diam")] + ([] if component == "old-contact-lenses" else [("add", "read_ad")]):
                    fields[f"{side}_{target}"] = number(row.get(prefix + suffix), minimum=0, maximum=30)
            else:
                for suffix, target in [("add", "ad"), ("pd", "pd_far"), ("high", "high")]:
                    fields[f"{side}_{target}"] = number(row.get(prefix + suffix), minimum=0, maximum=80)
                fields[f"{side}_pd_close"] = number(row.get(f"nc{side}pd"), minimum=0, maximum=80)
                fields[f"{side}_base"] = None
                fields[f"{side}_pris"] = None
                base = (clean(row.get(prefix + "prist")) or "").upper()
                if base in {"IN", "OUT", "UP", "DOWN", "BI", "BO", "BU", "BD"}:
                    fields[f"{side}_base"] = {"IN": "BI", "OUT": "BO", "UP": "BU", "DOWN": "BD"}.get(base, base)
                    fields[f"{side}_pris"] = number(row.get(prefix + "pris"), minimum=0)
        if not contact:
            fields["comb_pd_far"] = number(row.get("pd"), minimum=0, maximum=100)
            fields["comb_pd_close"] = number(row.get("npd"), minimum=0, maximum=100)
            
        if fields:
            fields["card_instance_id"] = f"{component}-1"
            fields["opticplus_source"] = {"table": table, "key": str(row.get("bdikanum")), "literal_va": True,
                "fields": {f"{'cn' if contact else 'c'}{side}visus": f"{side}_va" for side in ("r", "l") if fields.get(f"{side}_va") is not None}}
            data[component] = fields
    # Remaining source fields have named, migration-only cards, never order UI.
    # Successfully mapped numeric fields are consumed; unsupported literals stay visible.
    if component:
        for side in ("r", "l"):
            prefix = f"cn{side}" if contact else f"c{side}"
            for suffix, target in ([("bc", "bc"), ("ktr", "diam"), ("add", "read_ad")] if contact else
                                   [("add", "ad"), ("pd", "pd_far"), ("high", "high"), ("pris", "pris"), ("prist", "base")]):
                if fields.get(f"{side}_{target}") is not None:
                    consumed.add(prefix + suffix)
            if not contact and fields.get(f"{side}_pd_close") is not None:
                consumed.add(f"nc{side}pd")
        if not contact:
            for source, target in [("pd", "comb_pd_far"), ("npd", "comb_pd_close")]:
                if fields.get(target) is not None: consumed.add(source)
    # Standard cards own compatible supplemental values. Exceptional source text
    # remains visible in the source-specific card, never clamped or duplicated.
    standard, source_fields = {}, {}
    def move(source, target, value):
        if value is not None:
            standard[target], source_fields[source] = value, target
            consumed.add(source)
    if not contact:
        for side in ("r", "l"):
            for suffix, target in [("iadd", "int"), ("badd", "bif"), ("madd", "mul")]:
                move(f"nc{side}{suffix}", f"{side}_{target}", number(row.get(f"nc{side}{suffix}"), minimum=0, maximum=5))
            move(f"c{side}nvisus", f"{side}_j", clean(row.get(f"c{side}nvisus")))
        if standard:
            data.update(native_card("addition", standard, source_fields, table=table, key=row.get("bdikanum")))
        standard, source_fields = {}, {}
        for side in ("r", "l"):
            move(f"c{side}pvisus", f"{side}_fv", clean(row.get(f"c{side}pvisus")))
        if standard:
            data.update(native_card("uncorrected-va", standard, source_fields, table=table, key=row.get("bdikanum"), literal_va=True))
    else:
        for side in ("r", "l"):
            move(f"cn{side}or", f"{side}_sph", number(row.get(f"cn{side}or")))
            move(f"cn{side}orv", f"{side}_va", clean(row.get(f"cn{side}orv")))
        if standard:
            data.update(native_card("over-refraction", standard, source_fields, table=table, key=row.get("bdikanum"), literal_va=True))
    for source in (["cnvisus"] if contact else ["cvisus", "ncvisus"]):
        if clean(row.get(source)):
            data.update(native_card("notes", {"title": f"opticplusCards.fields.{source}", "note": clean(row[source])},
                {source: "note"}, table=table, key=f"{row.get('bdikanum')}:{source}"))
            # The source record identity is shared; only the card id uses a suffix.
            next(reversed(data.values()))["opticplus_source"]["key"] = str(row.get("bdikanum"))
            consumed.add(source)
    extra = {k: v for k, v in row.items() if k not in consumed and not k.startswith("__") and populated(v)}
    bindings = {}
    if component and not contact:
        visible = {
            "final-prescription": {"sph", "cyl", "ax", "pris", "base", "ad", "pd_far", "pd_close"},
            "subjective": {"sph", "cyl", "ax", "pris", "base", "va", "pd_far", "pd_close"},
            "objective": {"sph", "cyl", "ax"},
            "old-refraction": {"sph", "cyl", "ax", "pris", "base", "va", "ad"},
        }.get(component, set())
        candidates = {"pd": "comb_pd_far", "npd": "comb_pd_close"}
        for side in ("r", "l"):
            for suffix, target in [("sph", "sph"), ("cyl", "cyl"), ("axis", "ax"), ("visus", "va"),
                                   ("add", "ad"), ("pd", "pd_far"), ("high", "high"), ("pris", "pris"), ("prist", "base")]:
                if target not in visible: candidates[f"c{side}{suffix}"] = f"{side}_{target}"
            if "pd_close" not in visible: candidates[f"nc{side}pd"] = f"{side}_pd_close"
        if "pd_far" in visible: candidates.pop("pd", None)
        if "pd_close" in visible: candidates.pop("npd", None)
        for source, target in candidates.items():
            if source in consumed and fields.get(target) is not None and populated(row.get(source)):
                extra[source] = row[source]
                bindings[source] = {"component": component, "field": target, "cardInstanceId": fields["card_instance_id"]}
    kind = "opticplus-contact-fitting" if contact else "opticplus-prescription-details"
    if extra:
        data[kind] = card_data(kind, extra, table=table, key=row.get("bdikanum", "unknown"), bindings=bindings)
    return exam, data


def layout_data(data: dict) -> str:
    items = []
    priority = {"opticplus-measurements": 10, "schirmer-test": 11, "ocular-motor-assessment": 12,
                "opticplus-ocular-health": 20, "opticplus-binocular": 21,
                "opticplus-questionnaire": 30, "anamnesis": 31,
                "addition": 20, "uncorrected-va": 21, "opticplus-prescription-details": 22,
                "opticplus-contact-fitting": 22, "notes": 40}
    def kind_for(key, values):
        instance = str(values.get("card_instance_id") or "")
        component = key[:-len(instance)-1] if instance and key.endswith("-" + instance) else key
        return values.get("source_card_type") or ("notes" if component.startswith("notes-") else component)
    ordered = sorted(data.items(), key=lambda item: (priority.get(kind_for(*item), 0), str(item[1].get("card_instance_id", item[0]))))
    x, y, seen = 0, 0, set()
    for key, values in ordered:
        kind = kind_for(key, values)
        if kind == "contact-lens-details":
            continue  # Order-only controls are never valid imported exam cards.
        instance = values.get("card_instance_id", f"{kind}-1")
        if instance in seen:
            continue
        seen.add(instance)
        width = 8 if kind in {"opticplus-measurements", "schirmer-test", "ocular-motor-assessment"} else 12 if kind in priority else 24
        if x + width > 24:
            x, y = 0, y + 1
        items.append({"id": instance, "type": kind,
                      "x": x, "y": y, "w": width, "showEyeLabels": True})
        x += width
        if x == 24:
            x, y = 0, y + 1
    return json.dumps({"version": 2, "grid": {"columns": 24}, "items": items}, ensure_ascii=False)


def product_slots(row: dict) -> list[dict]:
    slots = []
    first_values = None
    for suffix in ("", "2"):
        values = {k: row.get(k + suffix) for k in [
            "color", "qpart", "ob_comp", "ob_type", "ob_size", "ocolor", "ocomp", "og_type",
            "oheight", "aheight", "adds", "cover", "bprice", "gpricet", "amount", "ar", "al",
            "sapakm", "sapaka", "bar_size", "cnl_size", "pbprice", "pgpricet", "pdisc", "pdisct",
            "alut", "aluta", "alutat", "sun"]}
        if not suffix: first_values = values
        # A default label alone does not establish a second purchased item.
        substantive = any(clean(values.get(k)) not in (None, "0", "0.0", "false", "False") for k in
                          ["ob_comp", "ob_type", "ocomp", "og_type", "bprice", "gpricet"])
        if substantive:
            label = clean(values.get("color")) or ""
            kind = "contact" if label.startswith("מגע") else "regular"
            slots.append({"slot": suffix or "1", "kind": kind, "values": values})
    if not slots:
        # The header still represents an order, including a free/empty legacy
        # order. Its primary label determines the type; second-slot defaults
        # alone never manufacture another purchase.
        kind = "contact" if (clean(row.get("color")) or "").startswith("מגע") else "regular"
        slots.append({"slot": "1", "kind": kind, "values": first_values})
    return slots


def billing_payload(row: dict) -> dict:
    total, paid, debt = (money(row.get(k)) for k in ["gf_price", "tpay", "gpay"])
    if abs(total - paid - debt) > Decimal("0.01"):
        raise ValueError("OpticPlus total/paid/outstanding do not reconcile")
    return {"total_after_discount": float(total), "prepayment_amount": float(paid), "currency": "ILS",
            "total_before_discount": float(money(row["gprice"])) if row.get("gprice") is not None else float(total),
            "discount_amount": float(money(row["greduce"])) if row.get("greduce") is not None else 0,
            "notes": f"OpticPlus · tpay={paid}; gpay={debt}; gf_price={total}"}


def json_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: json_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_value(v) for v in value]
    return value


def order_product_data(kind: str, slots: list[dict], suppliers: dict[str, str]) -> dict:
    """Only unambiguous product descriptions enter standard order fields."""
    def supplier(code):
        return suppliers.get(str(code).removesuffix('.0')) if code is not None else None
    for slot in slots:
        values = slot["values"]
        values["frame_supplier_name"] = supplier(values.get("sapakm"))
        values["lens_supplier_name"] = supplier(values.get("sapaka"))
    if kind == "contact":
        details = {}
        for side, flag in [("r", "ar"), ("l", "al")]:
            selected = [s["values"] for s in slots if s["values"].get(flag) is True or str(s["values"].get(flag)).lower() in {"true", "1", "-1"}]
            if not selected: continue
            for source, target in [("og_type", "lens_type"), ("lens_supplier_name", "supplier")]:
                values = {clean(s.get(source)) for s in selected} - {None}
                if len(values) == 1: details[f"{side}_{target}"] = values.pop()
            # An order-level quantity with both eyes selected is not a per-eye quantity.
            if len(selected) == 1:
                other = "al" if flag == "ar" else "ar"
                if selected[0].get(other) is False or str(selected[0].get(other)).lower() in {"false", "0"}:
                    qty = number(selected[0].get("amount"), minimum=0, maximum=100000)
                    if qty is not None and qty.is_integer(): details[f"{side}_quantity"] = int(qty)
        return {"contact-lens-details": details} if details else {}
    lens, frame = {}, {}
    # Common frame values may be displayed even when two source slots differ elsewhere.
    for source, target in [("ob_comp", "manufacturer"), ("ob_type", "model"), ("ocolor", "color"), ("frame_supplier_name", "supplier")]:
        values = {clean(s["values"].get(source)) for s in slots} - {None}
        if len(values) == 1: frame[target] = values.pop()
    for side, flag in [("right", "ar"), ("left", "al")]:
        selected = [s["values"] for s in slots if s["values"].get(flag) is True or str(s["values"].get(flag)).lower() in {"true", "1", "-1"}]
        for source, target in [("og_type", "model"), ("cover", "coating"), ("lens_supplier_name", "supplier")]:
            values = {clean(s.get(source)) for s in selected} - {None}
            if len(values) == 1: lens[f"{side}_{target}"] = values.pop()
    companies = {clean(s["values"].get("ocomp")) for s in slots} - {None}
    if len(companies) == 1: lens["manufacturer"] = companies.pop()
    return {"lens": lens, "frame": frame}
