from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from agents24.errors import Agents24SDKError
from agent.runtime import run_text


def test_retired_stream_recovers_exact_completed_run_from_canonical_history(monkeypatch):
    retired = Agents24SDKError('Unavailable', kind='conflict', status=410,
        failure={'code': 'RUN_EVENTS_RETIRED'})
    embed = SimpleNamespace(
        resolve_customer_principal=Mock(return_value={'customer_principal_ref': 'principal'}),
        attach_agent_run=Mock(side_effect=retired),
        get_agent_thread=Mock(return_value={'turns': [
            {'run_id': 'unrelated', 'status': 'completed', 'assistant_output_text': 'Wrong'},
            {'run_id': 'saved', 'status': 'completed', 'assistant_output_text': '{"greeting":"Hello"}'}]}),
        start_agent_run=Mock())
    monkeypatch.setattr('agent.runtime.client', lambda: SimpleNamespace(embed=embed))
    result = run_text('brief', 'not replayed', subject='synthetic', existing_run_id='saved', existing_thread_id='thread')
    assert result == '{"greeting":"Hello"}'
    embed.start_agent_run.assert_not_called()
    embed.get_agent_thread.assert_called_once()


@pytest.mark.parametrize('turn', [{}, {'run_id': 'wrong', 'status': 'completed', 'assistant_output_text': 'Wrong'},
    {'run_id': 'saved', 'status': 'failed', 'assistant_output_text': 'Incomplete'}])
def test_retired_stream_does_not_return_unrelated_or_failed_output(monkeypatch, turn):
    embed = SimpleNamespace(resolve_customer_principal=Mock(return_value={'customer_principal_ref': 'principal'}),
        attach_agent_run=Mock(side_effect=Agents24SDKError('retired', kind='conflict', status=410,
            failure={'code': 'RUN_EVENTS_RETIRED'})), get_agent_thread=Mock(return_value={'turns': [turn]}))
    monkeypatch.setattr('agent.runtime.client', lambda: SimpleNamespace(embed=embed))
    with pytest.raises(RuntimeError, match='output is unavailable'):
        run_text('brief', '', subject='synthetic', existing_run_id='saved', existing_thread_id='thread')


def test_completed_projection_returns_output_without_looping_for_deltas(monkeypatch):
    def attach(*args, on_event, **kwargs):
        on_event({'seq': 1, 'event': 'run.completed', 'payload': {'assistant_output_text': '{"ok":true}'}})
    embed = SimpleNamespace(resolve_customer_principal=Mock(return_value={'customer_principal_ref': 'principal'}),
        attach_agent_run=attach)
    monkeypatch.setattr('agent.runtime.client', lambda: SimpleNamespace(embed=embed))
    assert run_text('brief', '', subject='synthetic', existing_run_id='saved') == '{"ok":true}'
