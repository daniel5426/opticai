"""The convenience launcher must never inherit a shared data target."""
import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location('agent_dev_stack', Path(__file__).resolve().parents[3] / 'scripts/agent_dev_stack.py')
stack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stack)


@pytest.fixture
def local_env():
    env = {key: 'synthetic' for key in ['AGENTS24_API_KEY', 'AGENTS24_ARTIFACT_SIGNING_SECRET', 'SECRET_KEY',
           'AGENTS24_AGENT_ID', 'AGENTS24_INSIGHTS_AGENT_ID', 'AGENTS24_BRIEF_AGENT_ID',
           'AGENTS24_DOCUMENT_PIPELINE_ID', 'AGENTS24_NATIVE_DOCUMENT_PIPELINE_ID']}
    return {**env, 'DATABASE_URL': 'postgresql:///opticai_agent_dev', 'AGENTS24_BASE_URL': 'http://127.0.0.1:8026',
            'VITE_API_URL': 'http://localhost:8016/api/v1', 'PRYSM_RENDERER_URL': 'http://localhost:5136',
            'AGENTS24_ENABLED': 'true', 'AGENTS24_RUNTIME_TARGET': 'draft'}


def test_isolated_environment_is_accepted(local_env):
    stack.validate_environment(local_env)


@pytest.mark.parametrize('key,value', [
    ('DATABASE_URL', 'postgresql://staff:private@remote.invalid/opticai_agent_dev'),
    ('DATABASE_URL', 'postgresql:///shared'),
    ('DATABASE_URL', 'postgresql:///opticai_agent_dev?host=remote.invalid'),
    ('AGENTS24_BASE_URL', 'https://api.agents24.dev'),
    ('AGENTS24_ENABLED', 'false'),
    ('AGENTS24_RUNTIME_TARGET', 'published'),
    ('VITE_API_URL', 'http://localhost:8001/api/v1'),
    ('PRYSM_RENDERER_URL', 'http://localhost:5126'),
])
def test_wrong_targets_are_rejected_without_echoing_values(local_env, key, value):
    local_env[key] = value
    with pytest.raises(RuntimeError) as error:
        stack.validate_environment(local_env)
    assert value not in str(error.value)
    assert 'private' not in str(error.value)


def test_missing_credentials_report_names_only(local_env):
    local_env['AGENTS24_API_KEY'] = ''
    with pytest.raises(RuntimeError, match='Missing local settings: AGENTS24_API_KEY'):
        stack.validate_environment(local_env)


@pytest.fixture
def clinic_env(local_env):
    return {**local_env, 'DATABASE_URL': 'postgresql://postgres.eoyqvffwzllggemzfxaw:test@aws-0-eu-central-1.pooler.supabase.com/postgres',
            'VITE_API_URL': 'http://localhost:8000/api/v1', 'PRYSM_RENDERER_URL': 'http://localhost:5126',
            'PRYSM_AGENT_CLINIC_ID': '33'}


def test_clinic_launcher_accepts_scoped_nonproduction_target(clinic_env):
    stack.validate_environment(clinic_env, 'clinic')


@pytest.mark.parametrize('clinic_id', ['', '0', '-1', 'all', '33,34'])
def test_clinic_launcher_requires_one_explicit_clinic(clinic_env, clinic_id):
    clinic_env['PRYSM_AGENT_CLINIC_ID'] = clinic_id
    with pytest.raises(RuntimeError):
        stack.validate_environment(clinic_env, 'clinic')


def test_clinic_launcher_rejects_production(clinic_env):
    clinic_env['DATABASE_URL'] = 'postgresql://postgres:test@db.ncmcwspdjtyetwfijahj.supabase.co/postgres'
    with pytest.raises(RuntimeError):
        stack.validate_environment(clinic_env, 'clinic')
