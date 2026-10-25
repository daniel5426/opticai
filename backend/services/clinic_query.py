"""Bounded typed predicates and registered relationships; no generated SQL."""
from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from math import isfinite
from pydantic import BaseModel, ConfigDict, Field
from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from models import Client
from services.clinic_catalog import MODELS, expressions


class Predicate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    field: str = Field(min_length=1, max_length=160)
    operator: Literal['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'contains', 'in', 'empty', 'not_empty']
    value: Any = None


class FilterGroup(BaseModel):
    model_config = ConfigDict(extra='forbid')
    match: Literal['all', 'any'] = 'all'
    conditions: list[Predicate | FilterGroup] = Field(default_factory=list, max_length=50)
    relation: str | None = Field(default=None, max_length=80)


def predicate(expression, condition):
    op, value = condition.operator, condition.value
    if op in {'empty', 'not_empty'}:
        return expression.is_(None) if op == 'empty' else expression.is_not(None)
    if op == 'in':
        if not isinstance(value, list) or not value or len(value) > 200:
            raise HTTPException(422, 'agent.invalidFilter')
        return or_(*[predicate(expression, Predicate(field=condition.field, operator='eq', value=item)) for item in value])
    if isinstance(value, (list, dict)) or value is None:
        raise HTTPException(422, 'agent.invalidFilter')
    try:
        kind = expression.type.python_type
    except (NotImplementedError, AttributeError):
        kind = None
    try:
        if kind in {int, float, Decimal}:
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
                raise ValueError()
        elif kind is bool:
            if not isinstance(value, bool) or op not in {'eq', 'ne'}:
                raise ValueError()
        elif isinstance(value, bool):
            raise ValueError()
        elif kind is date:
            value = date.fromisoformat(value) if isinstance(value, str) else value
            if not isinstance(value, date):
                raise ValueError()
        elif kind is datetime:
            value = datetime.fromisoformat(value) if isinstance(value, str) else value
            if not isinstance(value, datetime):
                raise ValueError()
    except (TypeError, ValueError):
        raise HTTPException(422, 'agent.invalidFilter') from None
    if op == 'contains':
        if not isinstance(value, str) or kind not in {str, None}:
            raise HTTPException(422, 'agent.invalidFilter')
        return expression.ilike('%' + value.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%', escape='\\')
    return {'eq': lambda: expression == value, 'ne': lambda: expression != value,
        'lt': lambda: expression < value, 'lte': lambda: expression <= value,
        'gt': lambda: expression > value, 'gte': lambda: expression >= value}[op]()


def compile_where(db, authority, dataset, fields, group, as_of=None, depth=0, budget=None):
    if group is None:
        return and_(True)
    budget = budget if budget is not None else [100]
    budget[0] -= 1
    if depth > 5 or budget[0] < 0:
        raise HTTPException(422, 'agent.invalidFilter')
    if isinstance(group, FilterGroup):
        if group.relation:
            if dataset != 'clients' or group.relation not in MODELS or group.relation in {'clients', 'families', 'campaigns'}:
                raise HTTPException(422, 'agent.unsupportedReportField')
            require_ready_relation(db, authority, group.relation)
            related, related_fields = expressions(db, authority, group.relation, as_of)
            local = group.model_copy(update={'relation': None})
            filtered = related.filter(compile_where(db, authority, group.relation, related_fields, local, as_of, depth + 1, budget))
            return Client.id.in_(filtered.with_entities(MODELS[group.relation].client_id))
        clauses = [compile_where(db, authority, dataset, fields, item, as_of, depth + 1, budget) for item in group.conditions]
        return (and_ if group.match == 'all' else or_)(*clauses) if clauses else and_(True)
    if group.field in fields:
        return predicate(fields[group.field], group)
    relation, _, field = group.field.partition('.')
    if dataset != 'clients' or relation not in MODELS or relation in {'clients', 'families', 'campaigns'} or not field:
        raise HTTPException(422, 'agent.unsupportedReportField')
    related, related_fields = expressions(db, authority, relation, as_of)
    require_ready_relation(db, authority, relation)
    if field not in related_fields or field.startswith('client.'):
        raise HTTPException(422, 'agent.unsupportedReportField')
    # A semijoin preserves the root grain even when several child records match.
    ids = related.filter(predicate(related_fields[field], group)).with_entities(MODELS[relation].client_id)
    return Client.id.in_(ids)


def require_ready_relation(db, authority, relation):
    if relation == 'measurements':
        from agent.models import PrescriptionIndexState
        state = db.get(PrescriptionIndexState, authority.clinic_id)
        if not state or not state.ready:
            raise HTTPException(409, 'agent.prescriptionIndexPending')
