"""Backend profile ownership and official SDK selection, without clinical data."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest

from agent import relay, runtime
from agent.relay_host import profile_lock, stop_children


@pytest.fixture
def profile(tmp_path):
    return {'PRYSM_AGENT_DATA_DIR': str(tmp_path), 'AGENTS24_BASE_URL': 'http://127.0.0.1:8026',
            'AGENTS24_INTEGRATION_ID': 'synthetic', 'AGENTS24_ARTIFACT_TRANSPORT': 'relay'}


def test_profile_identity_survives_restart_and_concurrent_startup(profile):
    with ThreadPoolExecutor(max_workers=8) as pool:
        clients = list(pool.map(lambda _: relay.ensure_relay_client(profile), range(20)))
    assert len(set(clients)) == 1
    assert relay.relay_client_id(profile) == clients[0]
    assert relay.identity_path(profile).stat().st_mode & 0o777 == 0o600
    assert not list(relay.identity_path(profile).parent.glob('*.tmp'))


def test_profiles_and_platforms_do_not_replace_each_others_identity(profile):
    original = relay.ensure_relay_client(profile)
    other = {**profile, 'AGENTS24_INTEGRATION_ID': 'other'}
    remote = {**profile, 'AGENTS24_BASE_URL': 'https://api.agents24.dev'}
    assert relay.ensure_relay_client(other) != original
    assert relay.ensure_relay_client(remote) != original
    assert relay.ensure_relay_client(profile) == original


def test_http_mode_has_no_relay_selection(profile):
    assert relay.relay_client_id({**profile, 'AGENTS24_ARTIFACT_TRANSPORT': 'http'}) is None


def test_explicit_client_is_validated_and_never_rotated(profile):
    selected = str(uuid4())
    assert relay.ensure_relay_client({**profile, 'AGENTS24_RELAY_CLIENT_ID': selected}) == selected
    assert not relay.identity_path(profile).exists()
    with pytest.raises(ValueError):
        relay.ensure_relay_client({**profile, 'AGENTS24_RELAY_CLIENT_ID': 'invalid'})


def test_second_profile_host_is_rejected_without_disconnecting_owner(tmp_path):
    with profile_lock(tmp_path / 'host.lock'):
        with pytest.raises(RuntimeError, match='already has a relay host'):
            with profile_lock(tmp_path / 'host.lock'):
                pytest.fail('A second host acquired the same profile')
    with profile_lock(tmp_path / 'host.lock'):
        pass


def test_host_shutdown_stops_only_owned_children():
    exited = SimpleNamespace(poll=lambda: 0, terminate=Mock(), wait=Mock())
    alive = SimpleNamespace(poll=lambda: None, terminate=Mock(), wait=Mock())
    stop_children([alive, exited])
    alive.terminate.assert_called_once()
    exited.terminate.assert_not_called()


@pytest.mark.asyncio
async def test_bff_chooses_backend_profile_not_browser_inputs(monkeypatch):
    selected = str(uuid4())
    monkeypatch.setattr(runtime, 'load_principal_scope', lambda _: runtime.PrincipalScope('1:2', 'context', 'clinic:1:patient:0', 'bound'))
    monkeypatch.setattr(runtime, 'relay_client_id', lambda: selected)
    request = SimpleNamespace(headers={'relay_client_id': str(uuid4())})
    result = await runtime.resolve_bff_principal(request)
    assert result.relay_client_id == selected
    assert result.chat_scope == 'clinic:1:patient:0'


def test_background_admission_uses_same_profile_and_recovery_never_resubmits(monkeypatch):
    selected = str(uuid4())
    def attach(*args, on_event, **kwargs):
        assert 'relay_client_id' not in kwargs  # Read/attach contracts stay unchanged.
        on_event({'seq': 1, 'event': 'run.completed', 'payload': {'assistant_output_text': 'complete'}})
    embed = SimpleNamespace(resolve_customer_principal=Mock(return_value={'customer_principal_ref': 'principal'}),
        start_agent_run=Mock(return_value={'run_id': 'run', 'thread_id': 'thread'}), attach_agent_run=attach)
    monkeypatch.setattr(runtime, 'client', lambda: SimpleNamespace(embed=embed))
    monkeypatch.setattr(runtime, 'relay_client_id', lambda: selected)
    assert runtime.run_text('agent', 'hello', subject='1:2') == 'complete'
    assert embed.start_agent_run.call_args.args[1]['relay_client_id'] == selected
    assert runtime.run_text('agent', '', subject='1:2', existing_run_id='run') == 'complete'
    assert embed.start_agent_run.call_count == 1


@pytest.mark.asyncio
async def test_backend_shutdown_closes_shared_sdk_without_creating_another_client(monkeypatch):
    from unittest.mock import AsyncMock
    runtime.async_client.cache_clear()
    sdk = SimpleNamespace(aclose=AsyncMock())
    construct = Mock(return_value=sdk)
    monkeypatch.setattr(runtime, 'AsyncAgents24', construct)
    await runtime.close_runtime_clients()
    construct.assert_not_called()
    assert runtime.async_client() is sdk
    await runtime.close_runtime_clients()
    sdk.aclose.assert_awaited_once()
    assert runtime.async_client.cache_info().currsize == 0


def test_readiness_requires_this_client_and_registration(profile, tmp_path, monkeypatch):
    import importlib.util
    path = Path(__file__).resolve().parents[3] / 'scripts/agent_dev_stack.py'
    spec = importlib.util.spec_from_file_location('relay_stack_test', path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    stack = module.Stack(tmp_path, profile)
    stack.env['AGENTS24_RELAY_CLIENT_ID'] = 'ours'
    stack.status = lambda: {'installation': {'bindings': [{'kind': 'artifact', 'resource_key': 'clinic-tools', 'resource_id': 'clinic'}]}}
    status = {'id': 'ours', 'status': 'connected', 'registrations': [{'artifact_id': 'clinic', 'target': 'draft', 'ready': True}]}
    monkeypatch.setattr(module.subprocess, 'run', lambda *a, **k: SimpleNamespace(returncode=0, stdout=json.dumps(status)))
    assert stack.relay_ready()
    status['id'] = 'someone-else'
    assert not stack.relay_ready()
    status['id'] = 'ours'; status['registrations'][0]['ready'] = False
    assert not stack.relay_ready()


@pytest.mark.parametrize('target,command', [('draft', 'dev'), ('published', 'serve')])
def test_host_uses_official_serving_mode_and_cleans_up_on_exit(profile, tmp_path, monkeypatch, target, command):
    from agent import relay_host
    declaration = tmp_path / 'agents24/artifacts/clinic/artifact.yaml'
    declaration.parent.mkdir(parents=True)
    declaration.write_text('development:\n  base_url: http://127.0.0.1:4316\nproduction:\n  transport: relay\n')
    calls = []
    children = []
    def spawn(arguments, **kwargs):
        calls.append(arguments)
        child = SimpleNamespace(poll=lambda: None, terminate=Mock(), wait=Mock())
        children.append(child)
        return child
    monkeypatch.setattr(relay_host, 'cli_command', lambda *_: ['node', 'official-cli.js'])
    monkeypatch.setattr(relay_host, 'require_free_port', lambda _: None)
    monkeypatch.setattr(relay_host.subprocess, 'Popen', spawn)
    monkeypatch.setattr(relay_host.signal, 'signal', lambda *_: None)
    monkeypatch.setattr(relay_host.time, 'sleep', lambda _: (_ for _ in ()).throw(KeyboardInterrupt()))
    env = {**profile, 'AGENTS24_RUNTIME_TARGET': target, 'AGENTS24_API_KEY': 'private-test-key',
           'AGENTS24_ARTIFACT_SIGNING_SECRET': 'private-test-signer'}
    assert relay_host.serve(tmp_path, env) == 0
    assert calls[1][:3] == ['node', 'official-cli.js', command]
    assert '--client-id' in calls[1]
    assert 'private-test-key' not in str(calls) and 'private-test-signer' not in str(calls)
    assert len(children) == 2
    assert all(child.terminate.call_count == 1 for child in children)


def test_occupied_artifact_port_is_rejected_before_relay_admission():
    import socket
    from agent.relay_host import require_free_port
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0)); listener.listen()
        with pytest.raises(RuntimeError, match='already in use'):
            require_free_port(listener.getsockname()[1])


def test_synthetic_launcher_fixes_data_profile_before_backend_dotenv_defaults(monkeypatch, tmp_path):
    import runpy
    import subprocess
    source = Path(__file__).resolve().parents[3] / 'scripts/agent-dev.py'
    entry = tmp_path / 'scripts/agent-dev.py'
    entry.parent.mkdir()
    entry.write_text(source.read_text())
    (tmp_path / '.env.agent-dev').write_text('DATABASE_URL=postgresql:///opticai_agent_dev\nAGENTS24_BASE_URL=http://127.0.0.1:8026\n')
    monkeypatch.delenv('PRYSM_AGENT_DATA_DIR', raising=False)
    monkeypatch.setattr('sys.argv', [str(entry), 'cli', '--help'])
    observed = []
    def call(*args, **kwargs):
        observed.append(kwargs['env']['PRYSM_AGENT_DATA_DIR'])
        return 0
    monkeypatch.setattr(subprocess, 'call', call)
    with pytest.raises(SystemExit) as result:
        runpy.run_path(str(entry), run_name='__main__')
    assert result.value.code == 0
    assert observed == [str(tmp_path / '.agent-data')]
