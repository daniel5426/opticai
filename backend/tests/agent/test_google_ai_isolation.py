"""Synthetic markers exercise the actual SDK admission and clinic-tool boundaries."""
import json
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from agents24.bff import AgentBffPrincipal, AgentBffPrincipalResolution

from agent import runtime
from services.ai_privacy import clean_nested, clean_json_text
from services.agent_privacy import AgentPrivacyMiddleware


PRIVATE = {
    'google_account_email': 'GOOGLE_ACCOUNT_MARKER',
    'googleCalendarEventId': 'GOOGLE_EVENT_MARKER',
    'google_derived_summary': 'GOOGLE_DERIVED_MARKER',
    'oauth': {'email': 'GOOGLE_PROFILE_MARKER'},
    'profilePicture': 'GOOGLE_IMAGE_MARKER',
    'userInfo': {'name': 'GOOGLE_NAME_MARKER'},
    'api-key': 'CREDENTIAL_MARKER',
    'ai_exam_state': 'GOOGLE_OLD_INSIGHT_MARKER',
}


def test_nested_integration_data_is_removed_without_losing_clinic_values():
    data = {'clinic': [{'note': 'Clinic-entered note', 'sph': -2, **PRIVATE}]}
    assert clean_nested(data) == {'clinic': [{'note': 'Clinic-entered note', 'sph': -2}]}
    assert data['clinic'][0]['google_account_email'] == PRIVATE['google_account_email']
    assert json.loads(clean_json_text(json.dumps(data))) == clean_nested(data)
    assert clean_json_text('Google Calendar connection help') == 'Google Calendar connection help'


@pytest.mark.asyncio
@pytest.mark.parametrize('language', ['he', 'en', 'fr'])
async def test_insights_are_filtered_before_they_are_serialized(monkeypatch, language):
    run = Mock(return_value='{"exam":"grounded"}')
    monkeypatch.setattr(runtime, 'run_text', run)
    assert await runtime.structured('insights', {'note': 'independent', **PRIVATE}, {}, language, '1:2') == {'exam': 'grounded'}
    payload = json.loads(run.call_args.args[1])
    assert payload['records'] == {'note': 'independent'}
    assert payload['locale'] == language


def test_saved_background_prompts_and_metadata_are_filtered_on_admission(monkeypatch):
    def attach(*args, on_event, **kwargs):
        on_event({'seq': 1, 'event': 'run.completed', 'payload': {'assistant_output_text': 'ready'}})
    embed = NS(resolve_customer_principal=Mock(return_value={'customer_principal_ref': 'principal'}),
        start_agent_run=Mock(return_value={'run_id': 'run'}), attach_agent_run=attach)
    monkeypatch.setattr(runtime, 'client', lambda: NS(embed=embed))
    monkeypatch.setattr(runtime, 'relay_client_id', lambda: None)
    prompt = json.dumps({'clinic_day': {'appointments': [{'note': 'Eye exam', **PRIVATE}]}})
    assert runtime.run_text('brief', prompt, subject='1:2', metadata={'app.page': {'path': '/clients/1', **PRIVATE}}) == 'ready'
    admitted = embed.start_agent_run.call_args.args[1]
    assert 'MARKER' not in json.dumps(admitted)
    assert 'Eye exam' in admitted['input']


@pytest.fixture
def bff(monkeypatch):
    calls = []
    async def stream(agent, payload, **kwargs):
        calls.append(payload)
        if False:
            yield None
    async def principal(request):
        return AgentBffPrincipalResolution(principal=AgentBffPrincipal(subject='1:2', issuer='prysm'), chat_scope='clinic:1:patient:0')
    embed = NS(resolve_customer_principal=AsyncMock(return_value={'customer_principal_ref': 'trusted-principal'}), stream_agent_events=stream)
    monkeypatch.setattr(runtime, 'async_client', lambda: NS(embed=embed))
    monkeypatch.setattr(runtime, 'agent_id', lambda: 'published-agent')
    monkeypatch.setattr(runtime, 'resolve_bff_principal', principal)
    monkeypatch.setattr(runtime, 'on_principal_resolved', None)
    app = FastAPI()
    app.add_middleware(AgentPrivacyMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=['http://clinic.test'])
    app.include_router(runtime.bff_router())
    return app, calls


@pytest.mark.asyncio
async def test_bff_filters_metadata_and_tool_context_before_sdk_network(bff):
    app, calls = bff
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        response = await client.post('/api/agents24/chat/stream', json={'input': 'Find appointments',
            'metadata': {'app.page': {'path': '/appointments', 'drafts': {'note': 'Eye exam', **PRIVATE}}, **PRIVATE},
            'toolInputs': {'clinic': {'sph': -2, **PRIVATE}}, 'client': PRIVATE})
    assert response.status_code == 200
    assert len(calls) == 1
    payload = calls[0]
    assert 'MARKER' not in json.dumps(payload)
    assert payload['tool_inputs'] == {'clinic': {'sph': -2}}
    assert payload['metadata']['app.page']['drafts'] == {'note': 'Eye exam'}
    assert payload['external_user_id'] == 'trusted-principal'


@pytest.mark.asyncio
@pytest.mark.parametrize('path', ['/chat/stream', '/conversations/id/messages'])
async def test_browser_model_overrides_never_reach_the_sdk(bff, path):
    app, calls = bff
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        response = await client.post('/api/agents24' + path, headers={'Origin': 'http://clinic.test'}, json={'input': 'test', 'requestedModelId': 'undisclosed-model'})
    assert response.status_code == 422
    assert response.headers['access-control-allow-origin'] == 'http://clinic.test'
    assert calls == []


@pytest.mark.asyncio
async def test_uploads_keep_their_bytes_and_responses_keep_streaming():
    app = FastAPI()
    app.add_middleware(AgentPrivacyMiddleware)
    @app.post('/api/agents24/attachments/upload')
    async def upload(request: Request):
        assert await request.body() == b'RAW-UPLOAD'
        return {'ok': True}
    @app.post('/api/agents24/chat/stream')
    async def chat(request: Request):
        assert (await request.json())['metadata'] == {'app.locale': 'he'}
        async def events():
            yield 'data: first\n\n'
            yield 'data: second\n\n'
        return StreamingResponse(events(), media_type='text/event-stream')
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.post('/api/agents24/attachments/upload', content=b'RAW-UPLOAD')).status_code == 200
        result = await client.post('/api/agents24/chat/stream', json={'metadata': {'app.locale': 'he', **PRIVATE}})
        assert result.headers['content-type'].startswith('text/event-stream')
        assert result.text == 'data: first\n\ndata: second\n\n'
        oversized = await client.post('/api/agents24/chat/stream', content=b'x' * (AgentPrivacyMiddleware.MAX_BODY_BYTES + 1))
        assert oversized.status_code == 413
