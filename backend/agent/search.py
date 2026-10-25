"""Tool-facing record search over the shared authorized catalog."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from fastapi import HTTPException
from sqlalchemy import String, cast, or_, and_, case, literal
from services.clinic_catalog import catalog, expressions, MODELS
from services.clinic_query import FilterGroup, compile_where
from .records import json_value


class SearchQuery(BaseModel):
    model_config = ConfigDict(extra='forbid')
    text: str = Field(default='', max_length=300)
    datasets: list[str] = Field(default_factory=list, max_length=16)
    term_match: Literal['all', 'any'] = 'all'
    where: FilterGroup | None = None
    offset: int = Field(default=0, ge=0, le=10000)
    limit: int = Field(default=25, ge=1, le=200)

    @model_validator(mode='after')
    def meaningful(self):
        if not self.text.strip() and not (self.where and self.where.conditions):
            raise ValueError('Supply search text or filters.')
        if self.where and len(self.datasets) != 1:
            raise ValueError('Structured filters require exactly one dataset.')
        return self


def result_source(kind, values):
    if kind == 'measurements':
        source_kind = {'exam': 'exams', 'order': 'orders', 'contact_lens_order': 'contact_lens_orders', 'referral': 'referrals'}.get(values.get('source_type'))
        if source_kind:
            return result_source(source_kind, {**values, 'id': values.get('exam_id') if source_kind == 'exams' else values.get('source_id')})
    patient = values.get('id') if kind == 'clients' else values.get('client_id')
    path = f'/clients/{patient}' if patient else '/inventory' if kind == 'inventory' else '/families' if kind == 'families' else '/ai-assistant'
    if kind in {'exams', 'orders', 'referrals'} and patient:
        path += f'/{kind}/{values["id"]}'
    elif patient and kind != 'clients':
        path += '?tab=' + {'medical_logs': 'medical', 'contact_lens_orders': 'orders', 'files': 'files', 'appointments': 'appointments'}.get(kind, 'details')
    return {'kind': kind, 'id': values.get('id'), 'client_id': patient, 'path': path}


def search(db, authority, raw):
    request = SearchQuery.model_validate(raw)
    available = catalog(db, authority)
    selected = list(dict.fromkeys(request.datasets or [name for name in available if available[name].get('ready', True)]))
    if any(name not in available for name in selected):
        raise HTTPException(422, 'agent.unsupportedReportField')
    if any(not available[name].get('ready', True) for name in selected):
        raise HTTPException(409, 'agent.prescriptionIndexPending')
    matches, total = [], 0
    for name in selected:
        query, fields = expressions(db, authority, name)
        safe = {key: column for key, column in fields.items() if not key.endswith(('.month', '.year'))}
        if name == 'clients':
            safe = {key: column for key, column in safe.items() if key not in {'total', 'paid', 'outstanding', 'currency'}}
        clauses = []
        terms = request.text.strip().split()
        patterns = []
        for term in terms:
            pattern = '%' + term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
            patterns.append(pattern)
            clauses.append(or_(*[cast(column, String).ilike(pattern, escape='\\') for column in safe.values()]))
        query = query.filter((and_ if request.term_match == 'all' else or_)(*clauses) if clauses else and_(True), compile_where(db, authority, name, fields, request.where))
        # Client currency rows represent one searchable patient.
        columns = list(safe)
        score = sum((case((or_(*[cast(column, String).ilike(pattern, escape='\\') for pattern in patterns]), 1), else_=0)
            for column in safe.values()), literal(0)) if patterns else literal(0)
        query = query.with_entities(*[safe[key].label(key) for key in columns], score.label('_search_score')).distinct()
        count = query.count()
        total += count
        for row in query.order_by(score.desc(), fields['id'].asc()).limit(request.offset + request.limit):
            values = {key: json_value(value) for key, value in zip(columns, row)}
            evidence = {key: value for key, value in values.items() if value is not None and
                any(term.casefold() in str(value).casefold() for term in terms)}
            matches.append({'dataset': name, 'values': values, 'matched_fields': evidence,
                'source': result_source(name, values), '_score': row[-1]})
    matches.sort(key=lambda item: (-item['_score'], selected.index(item['dataset']), item['values']['id']))
    for item in matches:
        del item['_score']
    return {'type': 'record_search', 'query': request.model_dump(mode='json'), 'total': total,
        'items': matches[request.offset:request.offset + request.limit],
        'next_offset': request.offset + request.limit if total > request.offset + request.limit else None,
        'coverage': 'Structured records and file metadata. Document content is searched separately.'}
