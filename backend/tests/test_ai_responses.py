import asyncio
import json
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from pydantic import ValidationError
from database import Base, get_db
from auth import get_current_user
from models import Company, Clinic, User, Client, Appointment, Campaign
from services.ai_privacy import project_record, clean_tool_result
from services.ai_service import AIService, AIError, translated
from services.ai_schemas import GeneratedCampaign, CampaignFilter
from services import ai_tools
from EndPoints import ai, ai_sidebar


class Item(NS):
    def model_dump(self, **kwargs):
        return vars(self)


def response(text='ok', calls=(), status='completed'):
    return NS(model='test', status=status, output_text=text, output=list(calls), usage=NS(input_tokens=10, output_tokens=3))


def function(name='appointment_operations', args=None, call_id='call_1'):
    return Item(type='function_call', name=name, arguments=json.dumps(args or {'action': 'list'}), call_id=call_id)


class Stream:
    def __init__(self, events): self.events = events
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    async def __aiter__(self):
        for event in self.events: yield event


def mock_service(responses):
    client = NS(responses=NS(create=AsyncMock(side_effect=responses)))
    return AIService(client), client.responses.create


@pytest.fixture
def workspace(monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions() as db:
        company = Company(name='Clinic company', owner_full_name='Owner')
        other = Company(name='Other company', owner_full_name='Other')
        db.add_all([company, other]); db.flush()
        clinic = Clinic(company_id=company.id, name='Clinic', unique_id='clinic')
        foreign = Clinic(company_id=other.id, name='Other', unique_id='foreign')
        db.add_all([clinic, foreign]); db.flush()
        user = User(company_id=company.id, clinic_id=clinic.id, role_level=2, username='GOOGLE_USERNAME_MARKER', full_name='GOOGLE_NAME_MARKER', google_account_email='GOOGLE_EMAIL_MARKER', google_access_token='GOOGLE_TOKEN_MARKER')
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name='Clinic entered', last_name='Patient', phone_mobile='0501234567', ai_exam_state='GOOGLE_DERIVED_MARKER')
        foreign_client = Client(company_id=other.id, clinic_id=foreign.id, first_name='Foreign', last_name='Patient')
        db.add_all([user, client, foreign_client]); db.flush()
        appointment = Appointment(client_id=client.id, clinic_id=clinic.id, user_id=user.id, exam_name='Eye exam', google_calendar_event_id='GOOGLE_EVENT_MARKER')
        db.add(appointment); db.commit()
    monkeypatch.setattr(ai_tools, 'SessionLocal', sessions)
    monkeypatch.setattr('ai_tools.base.SessionLocal', sessions)
    ai.USER_MEMORY.clear(); ai.USER_LOCKS.clear()
    app = FastAPI(); app.include_router(ai.router); app.include_router(ai_sidebar.router)
    def get_session():
        with sessions() as session: yield session
    app.dependency_overrides[get_db] = get_session
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as http:
        yield http, sessions, user, client, foreign_client, clinic, foreign
    engine.dispose()


def test_projection_and_error_boundary():
    row = NS(id=1, date=None, note='clinic note', google_calendar_event_id='MARKER', google_access_token='MARKER')
    assert 'MARKER' not in json.dumps(project_record(row, 'appointments'))
    value = {'status': 'error', 'error': 'MARKER', 'google_calendar_event_id': 'MARKER', 'data': {'google_name': 'MARKER'}, 'unknown': 'MARKER'}
    assert 'MARKER' not in json.dumps(clean_tool_result(value))


@pytest.mark.parametrize('language', ['he', 'en', 'fr'])
def test_assistant_direct_request_and_locale(workspace, monkeypatch, language):
    http, _, user, *_ = workspace
    service, create = mock_service([response('answer')])
    monkeypatch.setattr(ai, 'get_ai_service', lambda: service)
    result = http.post('/ai/chat', json={'message': 'hello', 'locale': language, 'conversationHistory': [{'role': 'user', 'content': 'hello'}]})
    assert result.json() == {'success': True, 'message': 'answer'}
    payload = create.call_args.kwargs
    assert payload['store'] is False and payload['background'] is False
    assert payload['model'] == 'gpt-6.1-sol' and payload['reasoning'] == {'effort': 'low'}
    assert 'GOOGLE_' not in json.dumps(payload)
    assert len(payload['input']) == 1
    assert {'he': 'Hebrew', 'en': 'English', 'fr': 'French'}[language] in payload['instructions']


def test_scoped_insights_and_persisted_format(workspace, monkeypatch):
    http, sessions, _, patient, foreign, *_ = workspace
    sections = dict.fromkeys(ai_sidebar.InsightSections.model_fields, 'grounded insight')
    service, create = mock_service([response(json.dumps(sections))])
    monkeypatch.setattr(ai_sidebar, 'get_ai_service', lambda: service)
    assert http.post(f'/ai/generate-all-states/{foreign.id}').status_code == 403
    assert not create.called
    result = http.post(f'/ai/generate-all-states/{patient.id}?locale=fr')
    assert result.status_code == 200
    assert result.json()['states']['ai_exam_state'] == 'grounded insight'
    payload = create.call_args.kwargs
    assert 'GOOGLE_' not in json.dumps(payload)
    assert payload['reasoning'] == {'effort': 'medium'}
    assert payload['text']['format']['strict'] is True
    with sessions() as db: assert db.get(Client, patient.id).ai_medical_state == 'grounded insight'


def test_tool_validation_and_scope(workspace):
    _, sessions, user, patient, foreign, *_ = workspace
    for args in [ {'action': 'get', 'client_id': foreign.id}, {'action': 'create', 'payload': {'client_id': patient.id, 'date': '2026-10-06', 'time': '10:00', 'google_calendar_event_id': 'MARKER'}}, {'action': 'nonsense'}, {'action': 'update', 'payload': {'appointment_id': True}}, {'action': 'list', 'limit': -1} ]:
        name = 'client_operations' if args['action'] == 'get' else 'appointment_operations'
        assert ai_tools.execute_tool(user, name, json.dumps(args))['status'] == 'error'
    valid = {'action': 'create', 'payload': {'client_id': patient.id, 'date': '2026-10-06', 'time': '10:00', 'note': 'clinic note'}}
    result = ai_tools.execute_tool(user, 'appointment_operations', json.dumps(valid))
    assert result['status'] == 'success'
    with sessions() as db: assert db.query(Appointment).count() == 2


def test_write_not_retried_after_model_failure(workspace, monkeypatch):
    http, sessions, _, patient, *_ = workspace
    args = {'action': 'create', 'payload': {'client_id': patient.id, 'date': '2026-10-06', 'time': '10:00'}}
    service, create = mock_service([response('', [function(args=args)]), RuntimeError('GOOGLE_SECRET_MARKER')])
    monkeypatch.setattr(ai, 'get_ai_service', lambda: service)
    result = http.post('/ai/chat', json={'message': 'create appointment'})
    assert result.status_code == 502
    assert 'MARKER' not in result.text
    assert create.call_count == 2
    with sessions() as db: assert db.query(Appointment).count() == 2
    assert 'Completed tool results' in json.dumps(list(ai.USER_MEMORY.values()))
    assert 'GOOGLE_' not in json.dumps(create.call_args.kwargs)


def test_stream_contract_and_interruption(workspace, monkeypatch):
    http, *_ = workspace
    service, _ = mock_service([Stream([NS(type='response.output_text.delta', delta='hello'), NS(type='response.completed', response=response('hello'))])])
    monkeypatch.setattr(ai, 'get_ai_service', lambda: service)
    events = [json.loads(line[6:]) for line in http.post('/ai/chat/stream', json={'message': 'hi'}).text.splitlines() if line.startswith('data: ')]
    assert events[0]['chunk'] == 'hello'
    assert events[-1]['done'] and events[-1]['message'] == 'hello'
    service, _ = mock_service([Stream([NS(type='response.output_text.delta', delta='partial')])])
    monkeypatch.setattr(ai, 'get_ai_service', lambda: service)
    result = http.post('/ai/chat/stream', json={'message': 'hi again'})
    assert '"fatal": true' in result.text


def test_round_limit(workspace, monkeypatch):
    http, *_ = workspace
    calls = [response('', [function(call_id=f'call_{n}')]) for n in range(8)]
    service, create = mock_service(calls)
    monkeypatch.setattr(ai, 'get_ai_service', lambda: service)
    result = http.post('/ai/chat', json={'message': 'list'})
    assert result.status_code == 502 and result.json()['detail'] == 'ai.limit'
    assert create.call_count == 8


def campaign():
    return {'name': 'Reminder', 'filters': [{'field': 'age', 'operator': 'greater_than', 'value': 40, 'logic': 'AND'}], 'email_enabled': True, 'email_content': 'Reminder', 'sms_enabled': False, 'sms_content': None, 'active': False, 'cycle_type': 'daily', 'cycle_custom_days': None, 'execute_once_per_client': True}


def test_campaign_validation_and_scope(workspace, monkeypatch):
    http, sessions, _, _, _, clinic, foreign = workspace
    service, create = mock_service([response(json.dumps(campaign()))])
    monkeypatch.setattr(ai_sidebar, 'get_ai_service', lambda: service)
    assert http.post('/ai/create-campaign-from-prompt', json={'prompt': 'remind', 'clinic_id': foreign.id}).status_code == 403
    assert not create.called
    result = http.post('/ai/create-campaign-from-prompt', json={'prompt': 'remind', 'clinic_id': clinic.id, 'locale': 'en'})
    assert result.status_code == 200
    assert create.call_args.kwargs['model'] == 'gpt-6-luna'
    with sessions() as db:
        saved = db.query(Campaign).one()
        assert isinstance(json.loads(saved.filters), list) and not saved.mail_sent
    invalid = campaign(); invalid['filters'][0]['operator'] = 'invalid'
    with pytest.raises(ValidationError): GeneratedCampaign.model_validate(invalid)


@pytest.mark.parametrize('status', ['incomplete', 'failed'])
def test_failed_responses_are_controlled(status):
    service, _ = mock_service([response(status=status)])
    with pytest.raises(AIError): asyncio.run(service.response('whatsapp', [], 'test'))


def test_whatsapp_uses_shared_boundary(workspace, monkeypatch):
    from services import bot_service
    _, sessions, *_ = workspace
    service, create = mock_service([response('hello')])
    monkeypatch.setattr(bot_service, 'get_ai_service', lambda: service)
    send = AsyncMock()
    monkeypatch.setattr(bot_service.whatsapp_service, 'send_message', send)
    with sessions() as db:
        asyncio.run(bot_service.BotService(db).handle_incoming_message('0501234567', 'hello', {'locale': 'en'}))
    assert send.await_count == 1
    assert create.call_args.kwargs['model'] == 'gpt-6-luna'
    assert 'GOOGLE_' not in json.dumps(create.call_args.kwargs)


def test_identical_write_with_new_call_id_runs_once(workspace, monkeypatch):
    http, sessions, _, patient, *_ = workspace
    args = {'action': 'create', 'payload': {'client_id': patient.id, 'date': '2026-10-06', 'time': '10:00'}}
    service, create = mock_service([response('', [function(args=args)]), response('', [function(args=args, call_id='second')]), response('done')])
    monkeypatch.setattr(ai, 'get_ai_service', lambda: service)
    assert http.post('/ai/chat', json={'message': 'create'}).status_code == 200
    with sessions() as db: assert db.query(Appointment).count() == 2
    assert create.call_count == 3


def test_closed_generator_retains_completed_write(workspace, monkeypatch):
    _, sessions, user, patient, *_ = workspace
    args = {'action': 'create', 'payload': {'client_id': patient.id, 'date': '2026-10-06', 'time': '10:00'}}
    service, _ = mock_service([response('', [function(args=args)])])
    monkeypatch.setattr(ai, 'get_ai_service', lambda: service)
    async def run():
        with sessions() as db: message, language, key = ai._context({'message': 'create'}, user, db)
        generator = ai._run({}, user, message, language, key, streaming=False)
        assert (await anext(generator))['tool']['phase'] == 'start'
        assert (await anext(generator))['tool']['phase'] == 'end'
        await generator.aclose()
        assert 'Completed tool results' in json.dumps(ai.USER_MEMORY[key])
        assert not ai.USER_LOCKS[key].locked()
    asyncio.run(run())
    with sessions() as db: assert db.query(Appointment).count() == 2


def test_timeout_and_error_logs_exclude_bodies(caplog):
    service, _ = mock_service([TimeoutError('GOOGLE_CREDENTIAL_MARKER')])
    with pytest.raises(AIError): asyncio.run(service.response('assistant', [], 'test'))
    assert 'MARKER' not in caplog.text
    assert 'code=ai.failed' in caplog.text


def test_refusal_is_controlled():
    refusal = Item(type='message', content=[NS(type='refusal', refusal='PRIVATE_MARKER')])
    service, _ = mock_service([response('', [refusal])])
    with pytest.raises(AIError): asyncio.run(service.response('assistant', [], 'test'))


def test_read_tool_output_and_next_request_are_isolated(workspace, monkeypatch, caplog):
    http, *_ = workspace
    service, create = mock_service([response('', [function()]), response('listed')])
    monkeypatch.setattr(ai, 'get_ai_service', lambda: service)
    assert http.post('/ai/chat', json={'message': 'list appointments'}).status_code == 200
    outgoing = json.dumps([c.kwargs for c in create.call_args_list])
    assert 'GOOGLE_' not in outgoing and 'GOOGLE_' not in caplog.text
    assert 'function_call_output' in outgoing and 'Eye exam' in outgoing


def test_disconnect_during_write_waits_for_result(workspace, monkeypatch):
    import anyio
    import threading
    import time
    _, sessions, user, *_ = workspace
    started = threading.Event()
    writes = []
    def write(*args):
        started.set()
        time.sleep(.05)
        writes.append('done')
        return {'status': 'success', 'data': {'appointment_id': 99}}
    monkeypatch.setattr(ai, 'execute_tool', write)
    service, _ = mock_service([response('', [function(args={'action': 'create', 'payload': {}})])])
    monkeypatch.setattr(ai, 'get_ai_service', lambda: service)
    async def run():
        with sessions() as db: message, language, key = ai._context({'message': 'create'}, user, db)
        async def consume():
            async for _ in ai._run({}, user, message, language, key, streaming=False):
                await anyio.sleep(0)
        async with anyio.create_task_group() as group:
            group.start_soon(consume)
            await anyio.to_thread.run_sync(started.wait)
            group.cancel_scope.cancel()
        assert writes == ['done']
        assert 'appointment_id' in json.dumps(ai.USER_MEMORY[key])
        assert not ai.USER_LOCKS[key].locked()
    anyio.run(run)
