"""Manual clinic reports for company managers, built on the agent's validated report definitions."""
import csv
import io
import json
from datetime import timedelta
from typing import Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from auth import get_current_user
from database import get_db
from models import User
from security.scope import CEO_LEVEL, assert_clinic_scope
from agent.authority import Authority
from agent.records import json_value
from agent.report_definitions import ReportDefinitionV2, compile_definition, resolve, saved
from agent.reports import safe_csv
from services.clinic_catalog import catalog as data_catalog

router = APIRouter(prefix='/clinic-reports', tags=['clinic-reports'])

DATASETS = ('clients', 'appointments', 'exams', 'orders', 'contact_lens_orders', 'referrals',
            'billing', 'payments', 'inventory', 'medical_logs', 'files')
ROW_LIMIT = 1000
EXPORT_LIMIT = 100_000


def manager(db: Session, user: User, clinic_id: int) -> Authority:
    if (user.role_level or 1) < CEO_LEVEL:
        raise HTTPException(403, 'Access denied')
    assert_clinic_scope(db, user, clinic_id, allow_maintenance=True)
    return Authority(user, clinic_id, f'manual-report:{user.id}', company_id=user.company_id)


def custom(raw: dict[str, Any]) -> ReportDefinitionV2:
    definition = resolve(raw)
    if definition.preset != 'custom' or definition.dataset not in DATASETS:
        raise HTTPException(422, 'agent.unsupportedReportField')
    return definition


def bounded(db: Session):
    # Clinic-scoped, but a manager can still ask for a very wide report.
    if db.get_bind().dialect.name == 'postgresql':
        from sqlalchemy import text
        db.execute(text("SET LOCAL statement_timeout = '30s'"))


def rows_of(query, columns, limit):
    return [{key: json_value(value) for key, value in zip(columns, row)} for row in query.limit(limit)]


@router.get('/catalog')
def catalog(clinic_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    authority = manager(db, current_user, clinic_id)
    datasets = data_catalog(db, authority)
    return {'datasets': {name: datasets[name] for name in DATASETS if name in datasets}}


@router.post('/run')
def run(raw: dict[str, Any], clinic_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    authority = manager(db, current_user, clinic_id)
    definition = custom(raw)
    bounded(db)
    query, columns = compile_definition(db, authority, definition)
    result = {'columns': columns, 'total': query.order_by(None).count(), 'rows': rows_of(query, columns, ROW_LIMIT),
              'limit': ROW_LIMIT, 'definition': definition.model_dump(mode='json')}
    if definition.date_field and definition.comparison and definition.aggregates:
        days = (definition.end_date - definition.start_date).days + 1
        previous = definition.model_copy(update={'start_date': definition.start_date - timedelta(days=days),
                                                 'end_date': definition.start_date - timedelta(days=1)})
        previous_query, _ = compile_definition(db, authority, previous)
        result['comparison'] = {'start': previous.start_date.isoformat(), 'end': previous.end_date.isoformat(),
                                'rows': rows_of(previous_query, columns, ROW_LIMIT)}
    return result


@router.post('/export')
def export(raw: dict[str, Any], clinic_id: int, format: Literal['xlsx', 'csv'] = Query('xlsx'),
           db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    authority = manager(db, current_user, clinic_id)
    definition = custom(raw)
    bounded(db)
    query, columns = compile_definition(db, authority, definition)
    labels = definition.presentation.labels if definition.presentation else {}
    header = [labels.get(key, key) for key in columns]
    values = ([json_value(value) for value in row] for row in query.limit(EXPORT_LIMIT).yield_per(500))
    if format == 'csv':
        buffer = io.StringIO()
        buffer.write('﻿')
        writer = csv.writer(buffer)
        writer.writerow(header)
        for row in values:
            writer.writerow([safe_csv(json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value) for value in row])
        body, media = buffer.getvalue().encode('utf-8'), 'text/csv'
    else:
        from openpyxl import Workbook
        from openpyxl.cell import WriteOnlyCell
        workbook = Workbook(write_only=True)
        sheet = workbook.create_sheet(definition.title[:31] or 'Report')
        sheet.sheet_view.rightToLeft = True
        sheet.append(header)
        for row in values:
            cells = []
            for value in row:
                cell = WriteOnlyCell(sheet, value=json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value)
                if isinstance(cell.value, str):
                    cell.data_type = 's'
                cells.append(cell)
            sheet.append(cells)
        output = io.BytesIO()
        workbook.save(output)
        body, media = output.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    return StreamingResponse(iter([body]), media_type=media,
                             headers={'Content-Disposition': f'attachment; filename="prysm-report.{format}"'})


class SavedAction(BaseModel):
    model_config = ConfigDict(extra='forbid')
    action: Literal['save', 'rename', 'delete']
    report_id: str | None = Field(default=None, max_length=36)
    title: str | None = Field(default=None, max_length=200)
    definition: ReportDefinitionV2 | None = None
    revision: int | None = Field(default=None, ge=1)


@router.get('/saved')
def saved_list(clinic_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    authority = manager(db, current_user, clinic_id)
    items = saved(db, authority, 'list')['items']
    return {'items': [item for item in items if item['definition'].get('preset', 'custom') == 'custom'
                      and item['definition'].get('dataset') in DATASETS]}


@router.post('/saved')
def saved_action(payload: SavedAction, clinic_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    authority = manager(db, current_user, clinic_id)
    if payload.definition:
        custom(payload.definition.model_dump(mode='json', exclude_unset=True))
    return saved(db, authority, **payload.model_dump(mode='json', exclude_unset=True, exclude={'definition'}),
                 definition=payload.definition.model_dump(mode='json', exclude_unset=True) if payload.definition else None)
