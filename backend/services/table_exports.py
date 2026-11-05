"""Manual exports use list queries and staff authority, independently of chat/AI."""
import csv
import json
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.exc import IntegrityError
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Font

from agent.config import now, data_directory
from agent.models import AgentJob
from auth import validate_current_user
from models import User, Client, OpticalExam, Appointment, Referral, File, Clinic
from security.scope import get_record_clinic_ids, resolve_company_id, normalize_clinic_id_for_company
from services.inventory_service import can_view_cost, variant_dict

ZONE = ZoneInfo('Asia/Jerusalem')
COPY = json.loads(Path(__file__).with_name('table_export_copy.json').read_text())
COLUMNS = {
    'clients': ['id', 'first_name', 'last_name', 'gender', 'national_id', 'phone_mobile', 'email'],
    'orders': ['date', 'clients', 'kind', 'status', 'payer', 'balance'],
    'exams': ['exam_date', 'test_name', 'client', 'clinic', 'examiner'],
    'appointments': ['date', 'time', 'client', 'exam_name', 'examiner', 'note'],
    'referrals': ['date', 'type', 'client', 'urgency', 'recipient'],
    'files': ['file_name', 'type', 'file_size', 'upload_date', 'client'],
    'inventory': ['product', 'category', 'variant', 'sku', 'on_hand', 'reserved', 'available', 'retail', 'cost'],
}
EXTRA_COLUMNS = {'inventory': ['stock', 'pricing']}
FILTERS = {'clients': {'gender'}, 'orders': {'kind', 'status'}, 'exams': {'test_name'},
    'appointments': {'exam_name', 'date_scope'}, 'referrals': {'urgency_level', 'referral_type'},
    'files': {'file_category'}, 'inventory': {'category', 'supplier', 'visibility', 'product_id'}}
SORTS = {'clients': [*COLUMNS['clients'], 'family_role'], 'orders': ['date'], 'exams': COLUMNS['exams'],
    'appointments': COLUMNS['appointments'], 'referrals': ['date', 'type', 'client', 'urgency', 'recipient'],
    'files': COLUMNS['files'], 'inventory': ['product']}
DATES = {'clients': Client.file_creation_date, 'exams': OpticalExam.exam_date,
    'appointments': Appointment.date, 'referrals': Referral.date, 'files': File.upload_date}


class ExportRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    table: Literal['clients', 'orders', 'exams', 'appointments', 'referrals', 'files', 'inventory']
    clinic_id: int | None = Field(default=None, gt=0)
    search: str = Field(default='', max_length=500)
    filters: dict[str, str] = Field(default_factory=dict)
    column_filters: str = Field(default='', max_length=12000)
    columns: list[str] = Field(min_length=1, max_length=20)
    sort: str = Field(default='', max_length=80)
    locale: Literal['he', 'en', 'fr'] = 'he'
    format: Literal['xlsx', 'csv'] = 'xlsx'
    start_date: date | None = Field(default=None, strict=False)
    end_date: date | None = Field(default=None, strict=False)
    request_key: str = Field(min_length=1, max_length=80)

    @model_validator(mode='after')
    def supported(self):
        allowed = COLUMNS[self.table] + EXTRA_COLUMNS.get(self.table, [])
        if len(set(self.columns)) != len(self.columns) or not set(self.columns) <= set(allowed):
            raise ValueError('tableExport.invalidRequest')
        if not set(self.filters) <= FILTERS[self.table] or any(len(v) > 200 for v in self.filters.values()):
            raise ValueError('tableExport.invalidRequest')
        if self.sort:
            key, _, direction = self.sort.rpartition('_')
            if key not in SORTS[self.table] or direction not in ('asc', 'desc'):
                raise ValueError('tableExport.invalidRequest')
        enums = {'gender': ('all', 'זכר', 'נקבה'), 'kind': ('all', 'regular', 'contact'),
            'date_scope': ('all', 'today', 'upcoming', 'past'), 'urgency_level': ('all', 'routine', 'urgent', 'emergency'),
            'file_category': ('all', 'image', 'document', 'video', 'audio', 'archive', 'other'),
            'category': ('all', 'frame', 'contact_lens'), 'visibility': ('all', 'active', 'archived')}
        for key, choices in enums.items():
            if key in self.filters and self.filters[key] not in choices:
                raise ValueError('tableExport.invalidRequest')
        if self.filters.get('product_id') and (not self.filters['product_id'].isdigit() or int(self.filters['product_id']) <= 0):
            raise ValueError('tableExport.invalidRequest')
        if bool(self.start_date) != bool(self.end_date) or (self.start_date and self.start_date > self.end_date):
            raise ValueError('tableExport.invalidDate')
        if self.end_date == date.max:
            raise ValueError('tableExport.invalidDate')
        if self.table == 'inventory' and self.start_date:
            raise ValueError('tableExport.invalidRequest')
        return self


def text(locale, key):
    result = COPY[locale]['tableExport']
    for part in key.split('.'):
        result = result.get(part, {}) if isinstance(result, dict) else {}
    return result if isinstance(result, str) else key


def label(locale, value):
    return COPY[locale]['tableExport']['value'].get(str(value), value)


def authorize(db, user, request):
    validate_current_user(user)
    from services.subscription_service import enforce_workspace
    enforce_workspace(db, resolve_company_id(db, user), write=False)
    ids = get_record_clinic_ids(db, user, request.clinic_id)
    if not ids:
        raise HTTPException(403, 'tableExport.scopeChanged')
    if request.table == 'inventory':
        normalize_clinic_id_for_company(db, user, request.clinic_id)
        if not can_view_cost(user) and 'cost' in request.columns:
            raise HTTPException(403, 'tableExport.scopeChanged')
    return sorted(ids)


def date_range(query, column, request):
    if not request.start_date:
        return query
    if column.type.python_type is datetime:
        start = datetime.combine(request.start_date, time.min, ZONE).astimezone(timezone.utc)
        end = datetime.combine(request.end_date + timedelta(days=1), time.min, ZONE).astimezone(timezone.utc)
        if not getattr(column.type, 'timezone', False):
            start, end = start.replace(tzinfo=None), end.replace(tzinfo=None)
        return query.filter(column >= start, column < end)
    return query.filter(column >= request.start_date, column <= request.end_date)


def source_query(db, user, request):
    """Same scoped queries and stable ordering used by the operational lists."""
    f, clinic, search = request.filters, request.clinic_id, request.search.strip()
    if request.table == 'clients':
        from EndPoints.clients import client_list_query
        query = client_list_query(db, user, clinic, search, f.get('gender'), request.sort or 'id_desc', request.column_filters)
    elif request.table == 'exams':
        from EndPoints.exams import exam_list_query
        query = exam_list_query(db, user, clinic, search, f.get('test_name'), None, request.sort or 'exam_date_desc', request.column_filters)
    elif request.table == 'appointments':
        from EndPoints.appointments import appointment_list_query
        query = appointment_list_query(db, user, clinic, search, f.get('exam_name'), f.get('date_scope'), request.sort or 'date_desc', request.column_filters)
    elif request.table == 'referrals':
        from EndPoints.referrals import referral_list_query
        query = referral_list_query(db, user, clinic, search, f.get('urgency_level'), f.get('referral_type'), request.sort or 'date_desc', request.column_filters)
    elif request.table == 'files':
        from EndPoints.files import file_list_query
        query = file_list_query(db, user, clinic, search, f.get('file_category'), request.sort or 'upload_date_desc', request.column_filters)
    elif request.table == 'orders':
        from EndPoints.order_groups import order_list_candidates
        source = order_list_candidates(db, user, None, clinic, search, f.get('kind'), f.get('status'), request.column_filters)
        query = date_range(db.query(source), source.c.opened_date, request)
        direction = source.c.opened_date.asc() if request.sort == 'date_asc' else source.c.opened_date.desc()
        return query.order_by(direction.nulls_last(), source.c.kind, source.c.id.desc())
    else:
        from EndPoints.inventory import _variant_query
        return _variant_query(db, company_id=resolve_company_id(db, user), clinic_id=clinic,
            category=None if f.get('category') in (None, 'all') else f['category'],
            include_archived=f.get('visibility', 'active') != 'active')
    return date_range(query, DATES[request.table], request)


def inventory_description(item):
    a, p = item.get('attributes') or {}, item['product']
    if p['category'] == 'frame':
        return ' · '.join(str(v) for v in (a.get('color'), a.get('eye_size'), 'גשר ' + str(a['bridge']) if a.get('bridge') else None) if v)
    parameters = [f'{name} {a[key]}' for key, name in [('sph', 'SPH'), ('bc', 'BC'), ('dia', 'DIA'), ('pack_size', 'BOX'), ('cyl', 'CYL'), ('axis', 'AX'), ('add', 'ADD')] if a.get(key) is not None]
    return ' · '.join(str(v) for v in [p.get('product_type'), p.get('material'), a.get('color'), *parameters, a.get('design')] if v)


def inventory_rows(query, request, user):
    f, search = request.filters, request.search.strip().lower()
    for variant, product, balance in query.yield_per(500):
        item = variant_dict(variant, product, balance=balance, include_cost=can_view_cost(user))
        supplier = (product.preferred_supplier or '').strip().lower() or '__unassigned__'
        if f.get('supplier') not in (None, '', 'all', supplier):
            continue
        if f.get('product_id') and variant.product_id != int(f['product_id']):
            continue
        if f.get('visibility') == 'archived' and not variant.archived_at:
            continue
        description = inventory_description(item)
        if search and not any(search in str(v or '').lower() for v in [item['display_name'], product.brand, product.model, product.material, variant.sku, variant.barcode, description]):
            continue
        balance = item.get('balance') or {}
        yield {'product': ' '.join(v for v in [product.brand, product.model] if v), 'category': label(request.locale, product.category),
            'variant': description, 'sku': ' / '.join(v for v in [variant.sku, variant.barcode] if v),
            'on_hand': balance.get('on_hand', 0), 'reserved': balance.get('reserved', 0), 'available': balance.get('available', 0),
            'retail': variant.default_retail, 'cost': variant.default_cost if can_view_cost(user) else None,
            'stock': balance.get('on_hand', 0),
            'pricing': ' · '.join(text(request.locale, 'column.' + k) + f': {v} {variant.currency}' for k, v in [('retail', variant.default_retail), ('cost', variant.default_cost if can_view_cost(user) else None)] if v is not None),
            '__currency': variant.currency}


def legacy_orders(db, request):
    if request.table != 'orders':
        return False
    from services.order_group_service import order_groups_available
    return not order_groups_available(db)


def legacy_order_page(db, user, request, offset=0, count_only=False):
    from EndPoints.orders import get_orders_paginated
    return get_orders_paginated(clinic_id=request.clinic_id, limit=250, offset=offset,
        order=request.sort or 'date_desc', search=request.search.strip(), kind=request.filters.get('kind'),
        status=request.filters.get('status'), include_total=False, count_only=count_only, db=db, current_user=user)


def legacy_order_rows(db, user, request):
    # Older installations retain the same bounded server list adapter as the UI.
    offset = 0
    while True:
        page = legacy_order_page(db, user, request, offset)
        for record in page['items']:
            day = record.get('order_date')
            if isinstance(day, str):
                day = date.fromisoformat(day[:10])
            if request.start_date and (not day or not request.start_date <= day <= request.end_date):
                continue
            kind = 'contact' if record.get('__contact') else 'regular'
            name = record.get('clientName') or ''
            yield {'date': day, 'clients': name, 'payer': name,
                'kind': label(request.locale, {'glasses': 'regular', 'contact-lens': 'contact'}.get(record.get('type'), record.get('type') or kind)),
                'status': label(request.locale, record.get('order_status')),
                'balance': max(Decimal(0), Decimal(str(record.get('billing_total_after_discount') or 0)) - Decimal(str(record.get('billing_prepayment_amount') or 0))),
                '__currency': record.get('billing_currency') or 'ILS'}
        if not page.get('has_more') or not page['items']:
            return
        offset += len(page['items'])


def count(db, user, request):
    authorize(db, user, request)
    if legacy_orders(db, request):
        return sum(1 for _ in legacy_order_rows(db, user, request)) if request.start_date else legacy_order_page(db, user, request, count_only=True)['total']
    query = source_query(db, user, request)
    if request.table == 'inventory':
        return sum(1 for _ in inventory_rows(query, request, user))
    return query.order_by(None).count()


def order_status(entry):
    record = entry['order']
    if entry['kind'] == 'contact':
        return record.get('order_status')
    data = record.get('order_data')
    details = data.get('details') if isinstance(data, dict) else None
    return details.get('order_status') if isinstance(details, dict) else None


def export_rows(db, user, request):
    if legacy_orders(db, request):
        yield from legacy_order_rows(db, user, request)
        return
    query = source_query(db, user, request)
    if request.table == 'inventory':
        yield from inventory_rows(query, request, user)
        return
    if request.table == 'orders':
        from EndPoints.order_groups import order_list_items
        # Bounded pages avoid a live server-side cursor during group detail reads.
        offset = 0
        while True:
            page = query.offset(offset).limit(250).all()
            if not page:
                break
            for group in order_list_items(db, page):
                clients = {c['id']: ' '.join(c.get(k) or '' for k in ['first_name', 'last_name']).strip() for c in group['clients']}
                entries = group['entries']
                kinds = [label(request.locale, {'glasses': 'regular', 'contact-lens': 'contact'}.get(entry['order'].get('type'), entry['order'].get('type') or entry['kind'])) for entry in entries]
                statuses = [order_status(entry) for entry in entries]
                bill = group.get('billing') or {}
                yield {'date': group['opened_date'], 'clients': ', '.join(dict.fromkeys(clients.get(e['order']['client_id'], '') for e in entries)),
                    'kind': ', '.join(kinds), 'status': ', '.join(dict.fromkeys(str(label(request.locale, s)) for s in statuses if s)),
                    'payer': clients.get(group['payer_client_id'], ''), 'balance': max(Decimal(0), Decimal(str(bill.get('total_after_discount') or 0)) - Decimal(str(bill.get('prepayment_amount') or 0))),
                    '__currency': bill.get('currency') or 'ILS'}
            offset += len(page)
        return
    for row in query.yield_per(500):
        if request.table == 'clients':
            item = dict(row._mapping)
            item['gender'] = label(request.locale, item.get('gender'))
        else:
            record = row[0]
            item = {c.name: getattr(record, c.name) for c in record.__table__.columns}
            if request.table == 'exams':
                item['test_name'] = label(request.locale, item.get('test_name'))
                item.update(examiner=row[2] or row[1], client=' '.join(v or '' for v in [row[3], row[4]]).strip(), clinic=row[5] or record.clinic)
            else:
                item['client'] = row[1]
                if request.table == 'appointments':
                    item['examiner'] = row[2]
                if request.table == 'referrals':
                    item['urgency'] = label(request.locale, record.urgency_level)
                if request.table == 'files':
                    item['type'] = record.file_type
        yield item


def paths(job):
    root = data_directory()
    return [root / f'{job.id}.table.{ext}' for ext in ('xlsx', 'csv')]


def enqueue(db, user, request):
    ids = authorize(db, user, request)
    payload = request.model_dump(mode='json')
    key = f'table_export:{user.id}:{request.request_key}'
    existing = db.query(AgentJob).filter_by(unique_key=key).first()
    if existing:
        validate_job(db, user, existing)
        if existing.definition['request'] != payload:
            raise HTTPException(409, 'tableExport.invalidRequest')
        return existing
    row = AgentJob(unique_key=key, company_id=resolve_company_id(db, user), clinic_id=request.clinic_id or user.clinic_id or ids[0],
        user_id=user.id, kind='table_export', locale=request.locale, definition={'request': payload, 'clinic_ids': ids}, expires_at=now() + timedelta(days=7))
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return enqueue(db, user, request)
    return row


def validate_job(db, user, job):
    if not job or job.kind != 'table_export' or job.user_id != user.id or job.company_id != resolve_company_id(db, user):
        raise HTTPException(404, 'tableExport.unavailable')
    request = ExportRequest.model_validate_json(json.dumps(job.definition['request']))
    if authorize(db, user, request) != job.definition['clinic_ids']:
        raise HTTPException(403, 'tableExport.scopeChanged')
    return request


def is_expired(job):
    expiry = job.expires_at
    return expiry is not None and expiry.replace(tzinfo=timezone.utc) <= now()


def status(job):
    return {'id': job.id, 'status': job.status, 'expired': is_expired(job), 'format': job.definition['request']['format'],
        'rows': (job.result or {}).get('rows'), 'error': (job.result or {}).get('error')}


class Interrupted(Exception):
    pass


def materialize(db, job, cancelled):
    user = validate_current_user(db.get(User, job.user_id))
    request = validate_job(db, user, job)
    excel, csv_path = paths(job)
    attempt = uuid.uuid4().hex
    temporary = [p.with_suffix(p.suffix + '.part.' + attempt) for p in (excel, csv_path)]
    for temp in temporary:
        temp.touch(mode=0o600, exist_ok=True)
        temp.chmod(0o600)
    workbook = Workbook(write_only=True)
    def sheet():
        result = workbook.create_sheet(text(request.locale, 'records') + (f' {len(workbook.worksheets) + 1}' if workbook.worksheets else ''))
        result.sheet_view.rightToLeft = request.locale == 'he'
        result.freeze_panes = 'A2'
        headers = []
        for key in request.columns:
            cell = WriteOnlyCell(result, value=text(request.locale, 'column.' + key)); cell.font = Font(bold=True); headers.append(cell)
        result.append(headers)
        return result
    rows, current = 0, sheet()
    from agent.reports import safe_csv
    try:
        with temporary[1].open('w', encoding='utf-8-sig', newline='') as output:
            temporary[1].chmod(0o600)
            writer = csv.writer(output)
            writer.writerow([text(request.locale, 'column.' + key) for key in request.columns])
            for item in export_rows(db, user, request):
                if rows % 250 == 0 and cancelled():
                    raise Interrupted()
                if rows and rows % 1_048_575 == 0:
                    current = sheet()
                values, cells = [], []
                for key in request.columns:
                    value = item.get(key)
                    if key in ('id', 'national_id', 'phone_mobile', 'sku', 'time') and value is not None:
                        value = str(value)
                    if isinstance(value, datetime):
                        value = (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value).astimezone(ZONE).replace(tzinfo=None)
                    if key == 'date' and isinstance(value, str):
                        value = date.fromisoformat(value)
                    cell = WriteOnlyCell(current, value=value)
                    if isinstance(value, str):
                        cell.data_type = 's'
                    if key in ('retail', 'cost', 'balance') and item.get('__currency'):
                        cell.number_format = '#,##0.00 "' + item['__currency'] + '"'
                    cells.append(cell)
                    csv_value = value.isoformat() if isinstance(value, (date, datetime)) else value
                    if key in ('retail', 'cost', 'balance') and value is not None and item.get('__currency'):
                        csv_value = f'{value} {item["__currency"]}'
                    values.append(safe_csv(csv_value))
                writer.writerow(values); current.append(cells); rows += 1
            if cancelled():
                raise Interrupted()
        workbook.save(temporary[0])
        if cancelled():
            raise Interrupted()
        for temp, target in zip(temporary, (excel, csv_path)):
            temp.chmod(0o600); temp.replace(target)
        return {'rows': rows}
    finally:
        # openpyxl does not remove write-only scratch XML when a run is cancelled.
        for worksheet in workbook.worksheets:
            writer = getattr(worksheet, '_writer', None)
            if writer and Path(writer.out).exists():
                if not worksheet.closed:
                    worksheet.close()
                writer.cleanup()
        workbook.close()
        for temp in temporary:
            temp.unlink(missing_ok=True)
