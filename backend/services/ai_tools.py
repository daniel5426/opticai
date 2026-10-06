"""Responses function definitions and validated adapters for existing clinic tools."""
import json
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, StrictInt, ValidationError
from fastapi import HTTPException
from database import SessionLocal
from ai_tools import ClientOperationsTool, AppointmentOperationsTool, ExamOperationsTool, MedicalLogOperationsTool
from security.scope import (get_scoped_client, get_scoped_appointment, get_scoped_medical_log, assert_clinic_scope, normalize_user_id, get_allowed_clinic_ids)
from models import OpticalExam
from .ai_privacy import CLIENT_FIELDS, clean_tool_result, clean_nested, is_private_key


class ToolArguments(BaseModel):
    model_config = ConfigDict(extra='forbid')
    action: str
    search: str | None = Field(default=None, max_length=500)
    client_id: StrictInt | None = None
    appointment_id: StrictInt | None = None
    exam_id: StrictInt | None = None
    log_id: StrictInt | None = None
    user_id: StrictInt | None = None
    clinic_id: StrictInt | None = None
    limit: int | None = Field(default=None, ge=1, le=100)
    date: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    time: str | None = None
    type: str | None = None
    payload: dict | list[dict] | None = None


REGISTRY = {
    'client_operations': (ClientOperationsTool, {'search', 'get', 'get_summary', 'list_recent', 'create', 'update'}, 'clients', 'client_id', CLIENT_FIELDS - {'id'}),
    'appointment_operations': (AppointmentOperationsTool, {'list', 'search', 'get', 'create', 'update', 'check_conflicts'}, 'appointments', 'appointment_id', frozenset('appointment_id client_id date time duration exam_name note'.split())),
    'exam_operations': (ExamOperationsTool, {'list', 'search', 'get', 'get_latest', 'create', 'update'}, 'exams', 'exam_id', frozenset('exam_id client_id exam_date test_name dominant_eye type'.split())),
    'medical_log_operations': (MedicalLogOperationsTool, {'list', 'get', 'get_by_client', 'create', 'update'}, 'logs', 'log_id', frozenset('log_id client_id log_date log'.split())),
}


def definitions():
    result = []
    for name, (_, actions, _, _, fields) in REGISTRY.items():
        schema = ToolArguments.model_json_schema()
        schema['properties']['action'] = {'type': 'string', 'enum': sorted(actions)}
        result.append({'type': 'function', 'name': name, 'description': f'Clinic operations. Actions: {", ".join(sorted(actions))}. Write fields: {", ".join(sorted(fields))}. Use payload for writes; use record IDs for reads/updates.', 'parameters': schema, 'strict': False})
    return result


def _positive(value):
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError('invalid identifier')
    return value


def _scope_record(db, user, name, value):
    value = _positive(value)
    if name == 'client_operations':
        get_scoped_client(db, user, value)
    elif name == 'appointment_operations':
        get_scoped_appointment(db, user, value)
    elif name == 'medical_log_operations':
        get_scoped_medical_log(db, user, value)
    else:
        exam = db.query(OpticalExam).filter(OpticalExam.id == value).first()
        if not exam:
            raise ValueError('unknown record')
        assert_clinic_scope(db, user, exam.clinic_id)


def execute_tool(user, name, raw_arguments):
    """Fail closed before invoking a write. Errors never echo payloads or DB exceptions."""
    failure = {'status': 'error', 'error': 'ai.toolFailed'}
    try:
        cls, actions, list_key, id_key, fields = REGISTRY[name]
        args = ToolArguments.model_validate(json.loads(raw_arguments))
        if args.action not in actions:
            raise ValueError('invalid action')
        params = args.model_dump(exclude_none=True)
        action = params.pop('action')
        with SessionLocal() as db:
            get_allowed_clinic_ids(db, user)
            if args.clinic_id is not None:
                assert_clinic_scope(db, user, _positive(args.clinic_id))
            if args.client_id is not None:
                get_scoped_client(db, user, _positive(args.client_id))
            if args.user_id is not None:
                normalize_user_id(db, user, _positive(args.user_id))
            if action in {'get', 'get_summary', 'get_latest', 'get_by_client'}:
                target_key = 'client_id' if action in {'get_summary', 'get_latest', 'get_by_client'} else id_key
                target = params.get(target_key)
                if target_key == 'client_id':
                    get_scoped_client(db, user, _positive(target))
                else:
                    _scope_record(db, user, name, target)
            if action == 'search' and not args.search:
                raise ValueError('missing search')
            if action == 'check_conflicts' and (not args.date or not args.time):
                raise ValueError('missing date/time')
            if action in {'create', 'update'}:
                payload = params.pop('payload', None)
                items = payload if isinstance(payload, list) else [payload]
                if not items or len(items) > 50:
                    raise ValueError('invalid batch')
                for item in items:
                    if not isinstance(item, dict) or not item or any(is_private_key(k) or k not in fields | {'client_id', id_key} for k in item):
                        raise ValueError('invalid fields')
                    for key in (id_key, 'client_id'):
                        if key not in item and params.get(key) is not None:
                            item[key] = params[key]
                    if action == 'update':
                        _scope_record(db, user, name, item.get(id_key))
                    if 'client_id' in item:
                        get_scoped_client(db, user, _positive(item['client_id']))
                    if 'clinic_id' in item:
                        assert_clinic_scope(db, user, _positive(item['clinic_id']))
                    if action == 'create':
                        required = {'client_operations': ('first_name', 'last_name'), 'appointment_operations': ('client_id', 'date', 'time'), 'exam_operations': ('client_id',), 'medical_log_operations': ('client_id', 'log')}[name]
                        if any(not item.get(k) for k in required):
                            raise ValueError('missing required fields')
                        if name == 'client_operations' and user.clinic_id is None and not item.get('clinic_id'):
                            raise ValueError('clinic required')
                    for key in ('date', 'exam_date', 'log_date', 'date_of_birth'):
                        if item.get(key):
                            cls(user)._parse_date(item[key])
                    if item.get('time'):
                        datetime.strptime(item['time'], '%H:%M')
                params[list_key] = items
        result = json.loads(cls(user).execute(action, **params))
        if not isinstance(result, dict) or result.get('status') == 'error':
            return failure
        result = clean_tool_result(result)
        # Existing tools return localized operational strings; expose stable keys instead.
        result['message'] = 'ai.toolDone'
        return result
    except (KeyError, ValueError, TypeError, ValidationError, HTTPException):
        return failure
    except Exception:
        return failure
