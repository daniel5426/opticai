"""Consumer configuration uses the public graph contract and preserves other draft work."""
import importlib.util
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location('configure_agent_outputs', Path(__file__).resolve().parents[3] / 'scripts/configure-agent-outputs.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
EXPORT = {'transcript': {'source': {'namespace': 'node_output', 'node_id': 'speech_to_text', 'key': 'references'}, 'representation': 'processed_text'}}


def test_export_configuration_preserves_graph_and_other_exports():
    graph = {'nodes': [{'id': 'speech_to_text', 'type': 'speech_to_text', 'config': {'model_id': 'existing'}}],
        'workflow_contract': {'inputs': [{'key': 'audio'}], 'exports': {'other': {'source': {}}}}, 'metadata': {'builder_ui': {'preserved': True}}}
    result = module.graph_with_outputs(graph, EXPORT)
    assert result['nodes'] == graph['nodes']
    assert result['metadata'] == graph['metadata']
    assert result['workflow_contract']['inputs'] == graph['workflow_contract']['inputs']
    assert result['workflow_contract']['exports']['other'] == {'source': {}}
    assert result['workflow_contract']['exports']['transcript'] == EXPORT['transcript']
    assert 'transcript' not in graph['workflow_contract']['exports']
    assert module.graph_with_outputs(result, EXPORT) == result
    result['workflow_contract']['exports']['transcript']['source'].update(label=None, expected_type=None)
    assert module.graph_with_outputs(result, EXPORT) == result


def test_rejects_missing_producer_and_conflicting_existing_export():
    with pytest.raises(ValueError):
        module.graph_with_outputs({'nodes': []}, EXPORT)
    with pytest.raises(ValueError):
        module.graph_with_outputs({'nodes': [{'id': 'speech_to_text', 'type': 'speech_to_text'}], 'workflow_contract': {'exports': {'transcript': {'source': {}}}}}, EXPORT)


@pytest.mark.asyncio
@pytest.mark.parametrize('suffix,operation', [('/outputs', 'list_outputs'), ('/outputs/result', 'get_output')])
async def test_installed_bff_forwards_result_reads_with_server_identity(monkeypatch, suffix, operation):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from agents24.bff import AgentBffPrincipal, AgentBffPrincipalResolution
    from agent import runtime
    embed = SimpleNamespace(resolve_customer_principal=AsyncMock(return_value={'customer_principal_ref': 'trusted-principal'}),
        resolve_conversation_run=AsyncMock(return_value={'agent_id': 'agent'}),
        list_outputs=AsyncMock(return_value={'items': [], 'next_cursor': None, 'unproduced': []}),
        get_output=AsyncMock(return_value={'output_id': 'result', 'status': 'available', 'value': []}))
    async def principal(request):
        return AgentBffPrincipalResolution(principal=AgentBffPrincipal(subject='company:user', issuer='prysm'), chat_scope='clinic:5:patient:0')
    monkeypatch.setattr(runtime, 'async_client', lambda: SimpleNamespace(embed=embed))
    monkeypatch.setattr(runtime, 'agent_id', lambda: 'agent')
    monkeypatch.setattr(runtime, 'resolve_bff_principal', principal)
    monkeypatch.setattr(runtime, 'on_principal_resolved', None)
    monkeypatch.setattr(runtime, 'integration', lambda: 'prysm')
    monkeypatch.setattr(runtime, 'target', lambda: 'published')
    app = FastAPI(); app.include_router(runtime.bff_router())
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/api/agents24/runs/run' + suffix, params={'external_user_id': 'attacker', 'chat_scope': 'clinic:other'})
    assert response.status_code == 200
    call = getattr(embed, operation).call_args
    assert call.args[:2] == ('agent', 'run')
    assert call.kwargs['external_user_id'] == 'trusted-principal'
    assert call.kwargs['chat_scope'] == 'clinic:5:patient:0'
    assert call.kwargs['runtime_target'] == 'published'


@pytest.mark.asyncio
async def test_installed_bff_denies_unauthenticated_output_reads(monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from agents24.bff import AgentBffResolverError
    from agent import runtime
    read = AsyncMock()
    async def denied(request):
        raise AgentBffResolverError('unauthenticated')
    monkeypatch.setattr(runtime, 'async_client', lambda: SimpleNamespace(embed=SimpleNamespace(get_output=read)))
    monkeypatch.setattr(runtime, 'agent_id', lambda: 'agent')
    monkeypatch.setattr(runtime, 'resolve_bff_principal', denied)
    app = FastAPI(); app.include_router(runtime.bff_router())
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/api/agents24/runs/run/outputs/result')
    assert response.status_code == 401
    read.assert_not_called()
