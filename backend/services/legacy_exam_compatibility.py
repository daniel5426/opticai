"""Protect clinical components that the published v1.0.79 writer cannot serialize."""
import json


# Frozen from v1.0.79's ExamComponentRegistry, not the current UI registry.
LEGACY_COMPONENTS = frozenset("""
old-refraction objective subjective addition final-subjective final-prescription
retinoscop retinoscop-dilation uncorrected-va keratometer keratometer-full
corneal-topography schirmer-test old-refraction-extension anamnesis notes
contact-lens-diameters contact-lens-details keratometer-contact-lens contact-lens-exam
contact-lens-order old-contact-lenses over-refraction sensation-vision-stability
fusion-range maddox-rod stereo-test rg ocular-motor-assessment cover-test cover-test-v2
diopter-adjustment-panel npc
""".split())
WRITE_HEADER = "X-Prysm-Exam-Write"
REPLACE_VERSION = "replace-v1"


def explicit_replacement(request):
    return request is not None and request.headers.get(WRITE_HEADER) == REPLACE_VERSION


def represented_types(request):
    if explicit_replacement(request):
        value = request.headers.get("X-Prysm-Exam-Components", "")
        if value and len(value) <= 8192:
            kinds = frozenset(value.split(","))
            if len(kinds) <= 128 and all(kind and all(c in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in kind) for kind in kinds):
                return kinds
    return LEGACY_COMPONENTS


def preserve_unrepresented_components(stored, incoming, request=None):
    supported = represented_types(request)
    def represented(key):
        return key == "__ui" or any(key == kind or key.startswith(kind + "-") for kind in supported)
    return {**{key: value for key, value in (stored or {}).items() if not represented(key)}, **incoming}


def preserve_unrepresented_layout(stored, incoming, request=None):
    if not stored:
        return incoming
    try:
        previous = json.loads(stored)
        unsupported = [item for item in previous.get("items", [])
                       if item.get("type") and item["type"] not in represented_types(request)]
        if not unsupported:
            return incoming
    except (ValueError, TypeError, AttributeError):
        return incoming
    try:
        updated = json.loads(incoming)
        if not isinstance(updated.get("items"), list):
            return stored
        sent = {item.get("id") for item in updated["items"]}
        updated["items"].extend(item for item in unsupported if item.get("id") not in sent)
        return json.dumps(updated, ensure_ascii=False)
    except (ValueError, TypeError, AttributeError):
        return stored
