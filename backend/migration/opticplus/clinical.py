"""OpticPlus clinical coverage. Values remain literal unless a mapping is verified."""
from __future__ import annotations

import hashlib

CLINICAL_REVISION = 3

CARD_TYPES = (
    "opticplus-prescription-details", "opticplus-contact-fitting",
    "opticplus-measurements", "opticplus-ocular-health", "opticplus-binocular",
    "opticplus-questionnaire", "opticplus-legacy-history",
)
CLINICAL_TABLES = {"tb_comp", "tb_gnrl_tests", "tb_quest"}
REFERENCE_TABLES = {"sapakim", "tb_catalog", "tb_ad_catalog", "bank_list", "credit_list",
                    "presence_type", "add_num", "add_order", "companyn", "doc_title"}
TECHNICAL_FIELDS = {"numw", "wnum", "bdikanum", "rnum", "datew", "qtyp", "__date_serials"}
CLIENT_MAPPED = {"pname", "fname", "zehut", "bdate", "min", "kupa", "address", "city", "mikud",
                 "sel", "tel", "telw", "fax", "email", "cdate", "qmikzoa", "remark"}
# Source flags/numbering are provenance, rather than inferred clinical findings.
CLIENT_TECHNICAL = {"numw", "wsort", "ocupation", "msgdone", "sendb", "cust_open", "swd", "swb", "aswb"}

ORDER_SLOT_FIELDS = set("color qpart ob_comp ob_type ob_size ocolor ocomp og_type oheight aheight adds cover bprice gpricet amount ar al pbprice pgpricet pdisc pdisct sapakm sapaka".split())
ORDER_CONTEXT_FIELDS = set("odate ordernum mwdate yeda qmsgr heshbonit gprice gf_price tpay gpay greduce gdisc gremk".split())

def order_business_field(field):
    return field in ORDER_CONTEXT_FIELDS or field in ORDER_SLOT_FIELDS or (field.endswith("2") and field[:-1] in ORDER_SLOT_FIELDS) or field.startswith("oth")


def populated(value):
    return value is not None and value != ""


def card_data(kind, fields, *, table, key, bindings=None):
    instance = f"{kind}-{hashlib.sha256(f'{table}:{key}'.encode()).hexdigest()[:16]}"
    result = {k: v for k, v in fields.items() if populated(v) and not k.startswith("__")}
    return {**result, "card_instance_id": instance, "source_table": table,
            "source_key": str(key), **({"bindings": bindings} if bindings else {})}


def supplemental_card(table, row, key):
    kind = {"tb_comp": "opticplus-measurements", "tb_quest": "opticplus-questionnaire"}.get(table)
    if table == "tb_gnrl_tests":
        flag = row.get("qtyp")
        kind = "opticplus-binocular" if flag is True or str(flag).lower() in {"true", "1", "-1"} else "opticplus-ocular-health"
    return kind, card_data(kind, {k: v for k, v in row.items() if k not in TECHNICAL_FIELDS}, table=table, key=key)


def native_card(component, fields, sources, *, table, key, **presentation):
    """An independently identified standard card, owned by one source record."""
    instance = f"{component}-opticplus-{hashlib.sha256(f'{table}:{key}'.encode()).hexdigest()[:12]}"
    return {f"{component}-{instance}": {**fields, "card_instance_id": instance,
        "source_card_type": component, "opticplus_source": {
            "table": table, "key": str(key), "fields": sources, **presentation}}}


def supplemental_cards(table, row, key):
    from .mapping import number
    kind, extra = supplemental_card(table, row, key)
    cards = {}
    fields, sources = {}, {}
    if table == "tb_comp":
        for side in ("r", "l"):
            source, target = f"tb{side}", f"{side}_but"
            value = number(row.get(source), minimum=0, maximum=float("inf"))
            if value is not None:
                fields[target], sources[source] = value, target
                extra.pop(source, None)
        if fields:
            cards.update(native_card("schirmer-test", fields, sources, table=table, key=key, but_only=True))
    elif table == "tb_gnrl_tests" and kind == "opticplus-binocular" and populated(row.get("tst54")):
        cards.update(native_card("ocular-motor-assessment", {"ocular_motility": row["tst54"]},
            {"tst54": "ocular_motility"}, table=table, key=key))
        extra.pop("tst54", None)
    elif table == "tb_quest":
        for source, target in [("remk9", "medications"), ("remk10", "family_history"), ("remk11", "additional_notes")]:
            if populated(row.get(source)):
                fields[target], sources[source] = str(row[source]), target
                extra.pop(source, None)
        if fields:
            cards.update(native_card("anamnesis", fields, sources, table=table, key=key))
    if any(field not in {"card_instance_id", "source_table", "source_key"} for field in extra):
        extra["source_card_type"] = kind
        cards[f"{kind}-{extra['card_instance_id']}"] = extra
    return kind, extra, cards


def client_history(row):
    return {k: v for k, v in row.items() if k not in CLIENT_MAPPED | CLIENT_TECHNICAL and not k.startswith("__") and populated(v)}


def field_disposition(table, field):
    """Every source column gets an explicit, reviewable coverage classification."""
    if field.startswith("__") or field in TECHNICAL_FIELDS:
        return "technical_provenance"
    if table in REFERENCE_TABLES:
        return "reference_data"
    if table in {"checks", "adchecks"} | CLINICAL_TABLES:
        return "clinical_card"
    if table == "cust_list":
        return "mapped" if field in CLIENT_MAPPED else "technical_provenance" if field in CLIENT_TECHNICAL else "clinical_card"
    if table == "orders":
        return "order_details" if order_business_field(field) else "technical_provenance"
    if table == "person_remarks":
        return "medical_history" if field == "teur" else "technical_provenance"
    return "archive_only"


def clinical_source_key(row):
    # Supplemental sequence numbers may restart for each patient.
    from .bundle import source_id
    return f"{source_id(row.get('wnum'))}:{source_id(row.get('rnum'))}"
