"""Versioned prescription retrieval distance; never a clinical recommendation."""
from collections import defaultdict
from math import isfinite
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import and_, or_, select, exists
from models import Client, PrescriptionSearchIndex, ExamLayoutInstance, OpticalExam, Order, ContactLensOrder, Referral

SCALES = {'sph': .25, 'cyl': .25, 'ax': 10, 'add': .25, 'pd': 1}
FIELDS = ('sph', 'cyl', 'ax', 'add', 'pd', 'va')
SOURCES = {'exam': (ExamLayoutInstance, OpticalExam), 'order': Order, 'contact_lens_order': ContactLensOrder, 'referral': Referral}


class EyeCriteria(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    sph: float | None = None
    cyl: float | None = None
    ax: int | None = Field(default=None, ge=0, le=180)
    add: float | None = None
    pd: float | None = Field(default=None, ge=0)
    va: str | None = Field(default=None, max_length=40)

    @model_validator(mode='after')
    def finite(self):
        if any(value is not None and (isinstance(value, bool) or not isfinite(value)) for key in SCALES for value in [getattr(self, key)]):
            raise ValueError('Measurements must be finite numbers.')
        return self


class PrescriptionQuery(BaseModel):
    model_config = ConfigDict(extra='forbid')
    right: EyeCriteria | None = None
    left: EyeCriteria | None = None
    mode: Literal['similar', 'exact'] = 'similar'
    source_types: list[Literal['exam', 'order', 'contact_lens_order', 'referral']] = Field(default_factory=list)
    offset: int = Field(default=0, ge=0, le=1000)
    limit: int = Field(default=25, ge=1, le=100)

    @model_validator(mode='after')
    def supplied(self):
        if not any(eye and eye.model_dump(exclude_none=True) for eye in (self.right, self.left)):
            raise ValueError('Supply at least one measurement and identify its eye.')
        return self


def normalize(values):
    result = dict(values)
    if all(result.get(key) is not None for key in ('sph', 'cyl', 'ax')) and result['cyl'] > 0:
        result['sph'], result['cyl'], result['ax'] = result['sph'] + result['cyl'], -result['cyl'], (result['ax'] + 90) % 180
    if result.get('ax') is not None:
        result['ax'] %= 180
    if result.get('va') is not None:
        result['va'] = ''.join(str(result['va']).casefold().split())
    return result


def distance(requested, stored):
    if any(stored.get(key) is None for key in requested if key != 'ax' or requested.get('cyl') != 0):
        return None
    a, b = normalize(requested), normalize(stored)
    # Partial queries compare the supplied notation; transposition needs a full prescription.
    if not all(key in requested for key in ('sph', 'cyl', 'ax')):
        b = dict(stored)
        if b.get('ax') is not None:
            b['ax'] %= 180
        if b.get('va') is not None:
            b['va'] = ''.join(str(b['va']).casefold().split())
    deltas, score = {}, []
    for key in requested:
        if key == 'ax' and a.get('cyl') == 0:
            continue
        if key == 'va':
            delta = 0 if a[key] == b[key] else 1
        elif key == 'ax':
            delta = min(abs(a[key] - b[key]), 180 - abs(a[key] - b[key]))
        else:
            delta = abs(a[key] - b[key])
        score.append(delta / SCALES.get(key, 1))
        deltas[key] = {'requested': requested[key], 'recorded': stored[key], 'difference': round(delta, 6)}
    return (sum(score) / max(len(score), 1), deltas)


def eligible_index(db, clinic_ids, patient_id=None):
    index = PrescriptionSearchIndex
    query = db.query(index).join(Client, Client.id == index.client_id).filter(
        Client.clinic_id.in_(clinic_ids), index.clinic_id == Client.clinic_id, Client.deleted_at.is_(None),
        Client.merged_into_client_id.is_(None))
    if patient_id:
        query = query.filter(index.client_id == patient_id)
    valid = []
    for source, model in SOURCES.items():
        if source == 'exam':
            instance, exam = model
            statement = select(instance.id).join(exam, exam.id == instance.exam_id).where(instance.id == index.source_id,
                exam.id == index.exam_id, exam.client_id == index.client_id, exam.clinic_id == index.clinic_id, exam.deleted_at.is_(None))
        else:
            statement = select(model.id).where(model.id == index.source_id, model.client_id == index.client_id,
                model.clinic_id == index.clinic_id, model.deleted_at.is_(None))
        valid.append(and_(index.source_type == source, exists(statement)))
    return query.filter(or_(*valid))


def search(db, clinic_ids, raw, patient_id=None):
    request = PrescriptionQuery.model_validate(raw)
    index = PrescriptionSearchIndex
    query = eligible_index(db, clinic_ids, patient_id)
    if request.source_types:
        query = query.filter(index.source_type.in_(request.source_types))
    unready = query.filter(index.component_key.is_(None)).count()
    from agent.models import PrescriptionIndexState
    ready = db.query(PrescriptionIndexState).filter(PrescriptionIndexState.clinic_id.in_(clinic_ids), PrescriptionIndexState.ready.is_(True)).count() == len(clinic_ids)
    if not ready:
        return {'type': 'prescription_search', 'rule_version': 1, 'query': request.model_dump(mode='json'),
            'items': [], 'total': 0, 'next_offset': None, 'unindexed_rows': unready, 'index_ready': False}
    query = query.filter(index.component_key.is_not(None)).order_by(index.source_type, index.source_id, index.component_key, index.eye)
    eyes = {key: value.model_dump(exclude_none=True) for key, value in [('R', request.right), ('L', request.left)] if value and value.model_dump(exclude_none=True)}
    patients = defaultdict(list)
    current, group = None, []

    def evaluate(rows):
        if not rows:
            return
        by_eye = {r.eye: {key: getattr(r, key) for key in FIELDS} for r in rows}
        if any(eye not in by_eye for eye in eyes):
            return
        scored = {eye: distance(values, by_eye[eye]) for eye, values in eyes.items()}
        if any(value is None for value in scored.values()):
            return
        supplied_count = sum(len(value[1]) for value in scored.values())
        score = sum(value[0] * len(value[1]) for value in scored.values()) / max(1, supplied_count)
        if request.mode == 'exact' and score > 1e-8:
            return
        row = rows[0]
        kind = {'exam': 'exams', 'order': 'orders', 'contact_lens_order': 'contact_lens_orders', 'referral': 'referrals'}[row.source_type]
        path = f'/clients/{row.client_id}' + (f'/{kind}/{row.exam_id if kind == "exams" else row.source_id}' if kind != 'contact_lens_orders' else '?tab=orders')
        item = {'source_type': row.source_type, 'source_id': row.source_id, 'source_date': row.source_date.isoformat() if row.source_date else None,
            'card_type': row.card_type, 'component_key': row.component_key, 'distance': round(score, 6),
            'match': 'exact_or_equivalent' if score < 1e-8 else 'closest_recorded',
            'eyes': {eye: {'values': by_eye[eye], 'differences': result[1]} for eye, result in scored.items()},
            'source': {'kind': kind, 'id': row.exam_id if kind == 'exams' else row.source_id, 'client_id': row.client_id, 'path': path}}
        matches = patients[row.client_id]
        matches.append(item)
        matches.sort(key=lambda hit: (hit['distance'], -(int(hit['source_date'].replace('-', '')) if hit['source_date'] else 0), hit['source_type'], hit['source_id'], hit['component_key']))
        del matches[5:]

    for row in query.yield_per(500):
        key = (row.source_type, row.source_id, row.component_key)
        if key != current:
            evaluate(group)
            group, current = [], key
        group.append(row)
    evaluate(group)
    ordered = sorted(patients, key=lambda client: (patients[client][0]['distance'], client))
    page = ordered[request.offset:request.offset + request.limit]
    names = {row.id: row for row in db.query(Client).filter(Client.id.in_(page))}
    return {'type': 'prescription_search', 'rule_version': 1, 'query': request.model_dump(mode='json'), 'total': len(ordered),
        'items': [{'client_id': client, 'client_full_name': ' '.join(part for part in (names[client].first_name, names[client].last_name) if part),
            'matches': patients[client], 'source': {'kind': 'clients', 'id': client, 'client_id': client, 'path': f'/clients/{client}'}} for client in page],
        'next_offset': request.offset + request.limit if len(ordered) > request.offset + request.limit else None,
        'unindexed_rows': unready, 'index_ready': unready == 0}


def legacy_search(db, clinic_ids, request):
    """Preserve the existing exact-search HTTP contract, including pre-backfill records."""
    from sqlalchemy.orm import aliased
    from services.prescription_search_index import _iter_components
    from models import ReferralEye
    eyes = {eye: {key: value for key, value in criteria.model_dump(exclude_none=True).items() if value != ''}
        for eye, criteria in [('R', request.right), ('L', request.left)] if criteria}
    eyes = {eye: values for eye, values in eyes.items() if values}
    if not eyes or not clinic_ids:
        return {'items': [], 'total': 0}
    index = PrescriptionSearchIndex
    query = eligible_index(db, clinic_ids)
    primary_eye = 'R' if 'R' in eyes else 'L'
    query = query.filter(index.eye == primary_eye)
    for key, value in eyes[primary_eye].items():
        query = query.filter(getattr(index, key) == value)
    if len(eyes) == 2:
        left = aliased(index)
        query = query.join(left, and_(left.client_id == index.client_id, left.clinic_id == index.clinic_id,
            left.source_type == index.source_type, left.source_id == index.source_id, left.eye == 'L',
            left.card_type == index.card_type, or_(left.component_key == index.component_key,
                and_(left.component_key.is_(None), index.component_key.is_(None)))))
        for key, value in eyes['L'].items():
            query = query.filter(getattr(left, key) == value)
    candidates = query.distinct().order_by(index.source_date.desc().nulls_last(), index.source_id.desc()).all()
    verified, seen = [], set()
    for row in candidates:
        key = (row.client_id, row.source_type, row.source_id, row.card_type)
        if key in seen:
            continue
        if row.component_key is None:
            source_model = SOURCES[row.source_type][0] if row.source_type == 'exam' else SOURCES[row.source_type]
            source = db.get(source_model, row.source_id)
            payload = getattr(source, 'exam_data' if row.source_type == 'exam' else 'referral_data' if row.source_type == 'referral' else 'order_data', {}) or {}
            components = [values for _, kind, values in _iter_components(payload) if kind == row.card_type]
            if row.source_type == 'referral' and row.card_type == 'referral-eye':
                values = {}
                for item in db.query(ReferralEye).filter_by(referral_id=row.source_id):
                    prefix = 'r' if str(item.eye).upper().startswith('R') else 'l'
                    values.update({f'{prefix}_{field}': getattr(item, 'add_power' if field == 'add' else field) for field in FIELDS})
                components.append(values)
            def matches(values):
                return all(values.get(f'{eye.lower()}_{field}', values.get(f'{eye.lower()}_ad') if field == 'add' else None) == value
                    for eye, criteria in eyes.items() for field, value in criteria.items())
            if not any(matches(component) for component in components):
                continue
        seen.add(key); verified.append(row)
    page = verified[max(0, request.offset):max(0, request.offset) + min(max(1, request.limit), 100)]
    patients = {patient.id: patient for patient in db.query(Client).filter(Client.id.in_([row.client_id for row in page]))}
    return {'items': [{'client_id': row.client_id,
        'client_full_name': ' '.join(value for value in [patients[row.client_id].first_name, patients[row.client_id].last_name] if value),
        'national_id': patients[row.client_id].national_id, 'phone_mobile': patients[row.client_id].phone_mobile,
        'source_type': row.source_type, 'source_id': row.source_id, 'source_date': row.source_date,
        'card_type': row.card_type, 'matched_eyes': list(eyes)} for row in page], 'total': len(verified)}
