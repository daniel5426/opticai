"""Approval readiness follows the installed Artifact, never another test copy."""
import importlib.util
from pathlib import Path

import httpx
import pytest

spec = importlib.util.spec_from_file_location('agent_dev_policy', Path(__file__).resolve().parents[3] / 'scripts/agent_dev_policy.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
ENV = {'AGENTS24_BASE_URL': 'http://127.0.0.1:8026', 'AGENTS24_API_KEY': 'synthetic-private-key'}
STATUS = {'installation': {'bindings': [{'kind': 'artifact', 'resource_key': 'clinic-tools', 'resource_id': 'clinic'}]}}


def tool(artifact, decision):
    return {'id': artifact + '-commit', 'source': {'id': artifact, 'key': 'commit_change'},
            'governance': {'approval': {'policy': decision}}}


def verify(items, **kwargs):
    def request(req):
        assert req.method == 'GET'
        assert req.url.path == '/tools'
        assert req.headers['Authorization'] == 'Bearer synthetic-private-key'
        return httpx.Response(200, json={'items': items, 'has_more': False})
    return policy.verify_approval_policy(ENV, STATUS, transport=httpx.MockTransport(request), **kwargs)


def test_healthy_synthetic_copy_cannot_mask_unguarded_actual_clinic():
    with pytest.raises(RuntimeError, match='must use Ask'):
        verify([tool('synthetic', 'ask'), tool('clinic', 'always_allow')])


def test_exact_installed_clinic_with_ask_is_ready():
    assert verify([tool('synthetic', 'always_allow'), tool('clinic', 'ask')]) == {'tool_id': 'clinic-commit', 'policy': 'ask'}


@pytest.mark.parametrize('items', [[], [tool('other', 'ask')], [tool('clinic', 'ask'), tool('clinic', 'ask')]])
def test_missing_or_ambiguous_commit_fails_closed(items):
    with pytest.raises(RuntimeError, match='missing or ambiguous'):
        verify(items)


@pytest.mark.parametrize('decision', ['deny', None, 'always_allow'])
def test_other_policies_cannot_pass(decision):
    with pytest.raises(RuntimeError, match='must use Ask'):
        verify([tool('clinic', decision)])


def test_authorized_read_paginates_without_mutating_policy():
    pages = []
    def request(req):
        assert req.method == 'GET'
        pages.append(req.url.params['skip'])
        return httpx.Response(200, json={'items': [tool('synthetic', 'ask')] if len(pages) == 1 else [tool('clinic', 'ask')],
                                        'has_more': len(pages) == 1})
    assert policy.verify_approval_policy(ENV, STATUS, transport=httpx.MockTransport(request))['policy'] == 'ask'
    assert pages == ['0', '100']


def test_remote_platform_is_rejected_before_network():
    with pytest.raises(RuntimeError, match='local Agents24'):
        policy.verify_approval_policy({**ENV, 'AGENTS24_BASE_URL': 'https://api.agents24.dev'}, STATUS)


def test_read_failure_does_not_expose_credentials_or_response():
    transport = httpx.MockTransport(lambda req: httpx.Response(403, text='private diagnostics'))
    with pytest.raises(RuntimeError) as error:
        policy.verify_approval_policy(ENV, STATUS, transport=transport)
    assert 'synthetic-private-key' not in str(error.value)
    assert 'private diagnostics' not in str(error.value)
