"""Normal startup has a strictly local owner and deterministic cleanup."""
import json
from pathlib import Path

import pytest
from agent import local_startup


BASE = {'AGENTS24_ENABLED': 'true', 'AGENTS24_BASE_URL': 'http://127.0.0.1:8026'}


@pytest.fixture(autouse=True)
def available_platform(monkeypatch):
    async def available():
        return True
    monkeypatch.setattr(local_startup, 'platform_available', available)


@pytest.mark.parametrize('override', [
    {'APP_ENV': 'production'}, {'APP_ENV': 'staging'}, {'APP_ENVIRONMENT': 'production'},
    {'APP_ENVIRONMENT': 'staging'}, {'RAILWAY_PROJECT_ID': 'project'},
    {'RAILWAY_SERVICE_ID': 'service'}, {'RAILWAY_ENVIRONMENT_NAME': 'development'},
    {'AGENTS24_BASE_URL': 'https://api.agents24.dev'}, {'AGENTS24_ENABLED': 'false'},
    {'PRYSM_AGENT_SERVICES_MANAGED': '1'},
])
def test_automatic_dependencies_are_never_started_for_hosted_or_managed_targets(override):
    assert not local_startup.automatic_services_enabled({**BASE, **override})


def test_normal_local_backend_enables_dependency_supervision():
    assert local_startup.automatic_services_enabled(BASE)


@pytest.mark.asyncio
@pytest.mark.parametrize('environment', ['production', 'staging'])
async def test_hosted_lifespan_never_invokes_a_local_subprocess(monkeypatch, environment):
    for key, value in {**BASE, 'APP_ENV': environment}.items():
        monkeypatch.setenv(key, value)
    async def forbidden(*args, **kwargs):
        pytest.fail('Hosted startup attempted local dependency supervision.')
    monkeypatch.setattr(local_startup.asyncio, 'create_subprocess_exec', forbidden)
    async with local_startup.local_agent_services():
        pass


@pytest.mark.asyncio
async def test_matching_ready_receipt_gates_api_and_shutdown_stops_only_owned_process(monkeypatch, tmp_path):
    monkeypatch.setattr(local_startup, '__file__', str(tmp_path / 'backend/agent/local_startup.py'))
    monkeypatch.setattr(local_startup, 'automatic_services_enabled', lambda _: True)
    calls = []

    class Process:
        returncode = None
        def send_signal(self, signal):
            calls.append('stop')
            self.returncode = 0
        async def wait(self):
            return self.returncode

    async def spawn(*args, **kwargs):
        calls.append('spawn')
        assert args[2] == 'services'
        assert '--owner-pid' in args
        token = args[args.index('--startup-token') + 1]
        owner = int(args[args.index('--owner-pid') + 1])
        (tmp_path / '.agent-data/clinic-services/ready.json').write_text(json.dumps({'token': token, 'owner_pid': owner,
            'relay_client_id': '00000000-0000-0000-0000-000000000099'}))
        return Process()

    monkeypatch.setattr(local_startup.asyncio, 'create_subprocess_exec', spawn)
    async with local_startup.local_agent_services():
        assert calls == ['spawn']
        assert local_startup.os.environ['AGENTS24_RELAY_CLIENT_ID'] == '00000000-0000-0000-0000-000000000099'
    assert calls == ['spawn', 'stop']


@pytest.mark.asyncio
async def test_dependency_failure_does_not_block_core_api(monkeypatch, tmp_path):
    monkeypatch.setattr(local_startup, '__file__', str(tmp_path / 'backend/agent/local_startup.py'))
    monkeypatch.setattr(local_startup, 'automatic_services_enabled', lambda _: True)

    async def spawn(*args, **kwargs):
        return type('Stopped', (), {'returncode': 1})()

    monkeypatch.setattr(local_startup.asyncio, 'create_subprocess_exec', spawn)
    async with local_startup.local_agent_services():
        pass


@pytest.mark.asyncio
async def test_offline_platform_skips_optional_processes(monkeypatch):
    monkeypatch.setattr(local_startup, 'automatic_services_enabled', lambda _: True)
    async def offline():
        return False
    async def forbidden(*args, **kwargs):
        pytest.fail('Offline startup attempted local dependency supervision.')
    monkeypatch.setattr(local_startup, 'platform_available', offline)
    monkeypatch.setattr(local_startup.asyncio, 'create_subprocess_exec', forbidden)
    async with local_startup.local_agent_services():
        pass


@pytest.mark.asyncio
async def test_core_application_errors_are_not_suppressed(monkeypatch):
    monkeypatch.setattr(local_startup, 'automatic_services_enabled', lambda _: False)
    with pytest.raises(RuntimeError, match='core failure'):
        async with local_startup.local_agent_services():
            raise RuntimeError('core failure')


def test_owner_exit_is_detected_before_more_local_work(monkeypatch, tmp_path):
    import importlib.util
    spec = importlib.util.spec_from_file_location('startup_stack', Path(__file__).resolve().parents[3] / 'scripts/agent_dev_stack.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    stack = module.Stack(tmp_path, {}, 'clinic', services=True, owner_pid=99999)
    monkeypatch.setattr(module.os, 'kill', lambda *_: (_ for _ in ()).throw(ProcessLookupError()))
    with pytest.raises(RuntimeError, match='owning backend stopped'):
        stack.check_children()
