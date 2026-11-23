"""Optional discovery does not require agent tables or a running platform."""
import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from agent import availability
from EndPoints.agent import router, get_current_user


@pytest.fixture
def configured(monkeypatch):
    for key, value in {'AGENTS24_ENABLED': 'true', 'AGENTS24_BASE_URL': 'http://agent.invalid',
                       'AGENTS24_API_KEY': 'test-only', 'AGENTS24_AGENT_ID': 'test-agent'}.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv('PRYSM_HOSTED_AGENT_WORKERS', '0')


@pytest.mark.asyncio
@pytest.mark.parametrize('key', ['AGENTS24_ENABLED', 'AGENTS24_BASE_URL', 'AGENTS24_API_KEY', 'AGENTS24_AGENT_ID'])
async def test_disabled_or_incomplete_configuration_never_calls_platform(configured, monkeypatch, key):
    monkeypatch.setenv(key, 'false' if key == 'AGENTS24_ENABLED' else '')
    monkeypatch.setattr(availability.httpx, 'AsyncClient', lambda **_: pytest.fail('Unexpected network request'))
    assert await availability.platform_available() is False


@pytest.mark.asyncio
@pytest.mark.parametrize('outcome,expected', [(200, True), (503, False), ('offline', False), ('timeout', False)])
async def test_bounded_health_check(configured, monkeypatch, outcome, expected):
    class Client:
        def __init__(self, **kwargs):
            assert kwargs['timeout'] == 1.0
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def get(self, url):
            assert url == 'http://agent.invalid/health'
            if outcome == 'offline':
                raise httpx.ConnectError('offline')
            if outcome == 'timeout':
                raise httpx.ReadTimeout('timeout')
            return httpx.Response(outcome)
    monkeypatch.setattr(availability.httpx, 'AsyncClient', Client)
    assert await availability.platform_available() is expected


@pytest.mark.asyncio
@pytest.mark.parametrize('status,target,ready,expected', [
    ('disconnected', 'published', True, False), ('connected', 'draft', True, False),
    ('connected', 'published', False, False), ('connected', 'published', True, True),
])
async def test_hosted_readiness_checks_the_published_relay(configured, monkeypatch, status, target, ready, expected):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from uuid import uuid4
    from agent import runtime

    identity = str(uuid4())
    monkeypatch.setenv('PRYSM_HOSTED_AGENT_WORKERS', '1')
    monkeypatch.setenv('AGENTS24_ARTIFACT_TRANSPORT', 'relay')
    monkeypatch.setenv('AGENTS24_RUNTIME_TARGET', 'published')
    monkeypatch.setenv('AGENTS24_RELAY_CLIENT_ID', identity)
    class HealthyClient:
        def __init__(self, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def get(self, url):
            return httpx.Response(200)

    get = AsyncMock(return_value={'id': identity, 'status': status, 'registrations': [{'target': target, 'ready': ready}]})
    monkeypatch.setattr(availability.httpx, 'AsyncClient', HealthyClient)
    monkeypatch.setattr(runtime, 'async_client', lambda: SimpleNamespace(relay_clients=SimpleNamespace(get=get)))
    assert await availability.platform_available() is expected
    get.assert_awaited_once_with(identity)


def test_discovery_uses_app_auth_and_does_not_create_agent_contexts(monkeypatch):
    monkeypatch.setenv('AGENTS24_AGENT_ID', 'current-installation-agent')
    app = FastAPI()
    app.include_router(router, prefix='/api/v1')
    async def offline():
        return False
    monkeypatch.setattr(availability, 'platform_available', offline)
    app.dependency_overrides[get_current_user] = lambda: object()
    with TestClient(app) as client:
        response = client.get('/api/v1/agent/availability')
        assert response.status_code == 200
        assert response.json() == {'available': False, 'namespace': 'current-installation-agent'}
        def denied():
            raise HTTPException(401)
        app.dependency_overrides[get_current_user] = denied
        assert client.get('/api/v1/agent/availability').status_code == 401
