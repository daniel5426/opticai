"""Validated clinic-side audience selection shared by the UI, worker and agent."""
import json
import re
from datetime import date, datetime
from sqlalchemy import and_, or_, exists, select, func
from fastapi import HTTPException
from models import Client, Appointment, OpticalExam, Order, ContactLensOrder, CampaignClientExecution
from security.scope import client_clinic_condition
from services.ai_campaign_catalog import FILTER_FIELDS, OPERATORS
from campaign_models import MessagingSuppression, MessagingConsent, CampaignContactClaim


def fail(code):
    raise HTTPException(422, detail={'code': code})


def validate_filters(raw):
    try:
        filters = json.loads(raw or '[]') if isinstance(raw, str) else raw
        if not isinstance(filters, list) or len(filters) > 30:
            raise ValueError()
        for f in filters:
            spec = FILTER_FIELDS[f['field']]
            if f['operator'] not in OPERATORS[spec['type']] or f.get('logic', 'AND') not in ('AND', 'OR'):
                raise ValueError()
            if not isinstance(f.get('value', ''), (str, bool, int, float)):
                raise ValueError()
            if f['operator'] not in ('is_empty', 'is_not_empty'):
                value = f.get('value', '')
                if spec['type'] == 'number' or f['operator'] in ('last_days', 'next_days'):
                    import math
                    if not math.isfinite(float(value)):
                        raise ValueError()
                elif spec['type'] == 'date':
                    date.fromisoformat(str(value)[:10])
                elif spec['type'] == 'boolean' and str(value).lower() not in ('true', 'false', '1', '0'):
                    raise ValueError()
        return filters
    except (ValueError, KeyError, TypeError):
        fail('invalid_filters')


def predicate(field, operator, value, clinic_id, today, dialect):
    relations = {'exam': (OpticalExam, OpticalExam.exam_date), 'order': (Order, Order.order_date),
                 'appointment': (Appointment, Appointment.date)}
    if field == 'age':
        # Exact birthday arithmetic is expressed as date bounds, including leap-day births.
        n = float(value) if operator not in ('is_empty', 'is_not_empty') else 0
        if n < 0 or n > 200: fail('invalid_filters')
        def birthday(years):
            import calendar
            y = today.year - years
            return date(y, today.month, min(today.day, calendar.monthrange(y, today.month)[1]))
        import math
        if operator == 'is_empty': return Client.date_of_birth.is_(None)
        if operator == 'is_not_empty': return Client.date_of_birth.is_not(None)
        lower = birthday(math.floor(n) + 1)
        upper = birthday(math.floor(n))
        if operator == 'equals': return and_(Client.date_of_birth > lower, Client.date_of_birth <= upper) if n.is_integer() else Client.id < 0
        if operator == 'not_equals': return and_(Client.date_of_birth <= today, ~predicate(field, 'equals', value, clinic_id, today, dialect))
        if operator == 'greater_than': return Client.date_of_birth <= lower
        if operator == 'greater_equal': return Client.date_of_birth <= birthday(math.ceil(n))
        if operator == 'less_than': return and_(Client.date_of_birth <= today, Client.date_of_birth > birthday(math.ceil(n)))
        if operator == 'less_equal': return and_(Client.date_of_birth <= today, Client.date_of_birth > lower)
    if field.startswith('has_') and field != 'has_family' or field.startswith('total_') or field.startswith('last_') and field.endswith('_days'):
        key = 'exam' if 'exam' in field else 'order' if 'order' in field else 'appointment'
        model, when = relations[key]
        conditions = [model.client_id == Client.id, model.company_id == Client.company_id, model.clinic_id == clinic_id, model.deleted_at.is_(None)]
        if field.startswith('has_'):
            column = exists(select(model.id).where(*conditions))
        elif field.startswith('total_'):
            column = select(func.count(model.id)).where(*conditions).correlate(Client).scalar_subquery()
        else:
            recent = select(func.max(when)).where(*conditions).correlate(Client).scalar_subquery()
            column = (func.julianday(today) - func.julianday(recent)) if dialect == 'sqlite' else (today - func.date(recent))
    elif field == 'has_family':
        column = Client.family_id.is_not(None)
    else:
        column = getattr(Client, field)
    spec = FILTER_FIELDS[field]
    if operator == 'is_empty':
        return or_(column.is_(None), column == '') if spec['type'] in ('text', 'select') else column.is_(None)
    if operator == 'is_not_empty':
        return and_(column.is_not(None), column != '') if spec['type'] in ('text', 'select') else column.is_not(None)
    # Existing imports and current editors use different spellings of these values.
    aliases = {
        'gender': [('זכר', 'male', 'm'), ('נקבה', 'female', 'f'), ('אחר', 'other')],
        'health_fund': [('כללית', 'clalit'), ('מכבי', 'maccabi'), ('מאוחדת', 'meuhedet'), ('לאומית', 'leumit')],
    }
    if field in aliases and operator in ('equals', 'not_equals'):
        normalized = str(value).strip().lower()
        choices = next((group for group in aliases[field] if normalized in group), (normalized,))
        match = func.lower(func.trim(column)).in_(choices)
        return ~match if operator == 'not_equals' else match
    if spec['type'] == 'number': value = float(value)
    if spec['type'] == 'boolean': value = str(value).lower() in ('true', '1')
    if operator in ('last_days', 'next_days'):
        from datetime import timedelta
        delta = timedelta(days=int(value))
        column = func.date(column)
        return and_(column >= (today - delta if operator == 'last_days' else today), column <= (today if operator == 'last_days' else today + delta))
    if spec['type'] == 'date':
        column = func.date(column)
        value = date.fromisoformat(str(value)[:10])
    if operator in ('contains', 'not_contains', 'starts_with', 'ends_with'):
        escaped = str(value).replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
        pattern = ('%' if operator not in ('starts_with',) else '') + escaped + ('%' if operator not in ('ends_with',) else '')
        expr = column.ilike(pattern, escape='\\')
        return ~expr if operator == 'not_contains' else expr
    return {'equals': lambda: column == value, 'not_equals': lambda: column != value,
            'greater_than': lambda: column > value, 'less_than': lambda: column < value,
            'greater_equal': lambda: column >= value, 'less_equal': lambda: column <= value,
            'after': lambda: column > value, 'before': lambda: column < value}[operator]()


def clients_query(db, campaign, details, company_id, today):
    filters = validate_filters(campaign.filters)
    query = db.query(Client).filter(Client.company_id == company_id, Client.deleted_at.is_(None),
        Client.merged_into_client_id.is_(None), client_clinic_condition([campaign.clinic_id]))
    if not filters:
        return query if details.all_clients else query.filter(Client.id < 0)
    expr = None
    for f in filters:
        condition = predicate(f['field'], f['operator'], f.get('value', ''), campaign.clinic_id, today, db.get_bind().dialect.name)
        expr = condition if expr is None else or_(expr, condition) if f.get('logic') == 'OR' else and_(expr, condition)
    return query.filter(expr)


def normalize(channel, value):
    if channel == 'email':
        value = (value or '').strip().lower()
        return value if re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value) else None
    value = re.sub(r'[\s()\-]', '', value or '')
    if value.startswith('00972'): value = '+' + value[2:]
    if value.startswith('0'): value = '+972' + value[1:]
    return value if re.fullmatch(r'\+9725\d{8}', value) else None


def suppressed(db, company_id, channel, destination):
    return db.query(MessagingSuppression.id).filter(MessagingSuppression.scope.in_([0, company_id]),
        MessagingSuppression.channel == channel, MessagingSuppression.destination == destination).first() is not None


def consented(db, company_id, channel, destination):
    row = db.get(MessagingConsent, (company_id, channel, destination))
    return bool(row and row.granted)
