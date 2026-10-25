"""Database outages and cleanup cannot orphan the local clinic relay."""
import importlib.util
import os
import runpy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy.exc import OperationalError

from agent import process_owner
from workers import agent_worker as worker

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('lifecycle_stack', ROOT / 'scripts/agent_dev_stack.py')
stack_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stack_module)


def unavailable():
    return OperationalError('private SQL', {}, RuntimeError('private connection credentials'))


def test_worker_retries_database_poll_with_capped_backoff_and_reset(monkeypatch, caplog):
    attempts, waits = [], []
    outcomes = iter([*[unavailable() for _ in range(6)], False, KeyboardInterrupt()])
    def run(*args):
        attempts.append(args)
        outcome = next(outcomes)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome
    monkeypatch.setattr(worker, 'run_once', run)
    monkeypatch.setattr(worker.time, 'sleep', waits.append)
    with pytest.raises(KeyboardInterrupt):
        worker.run_worker_loop('same-owner', 'requested', [33])
    assert waits == [5, 10, 20, 30, 30, 30, 5]
    assert all(item == ('same-owner', 'requested', [33]) for item in attempts)
    assert 'private' not in caplog.text


def test_claim_connection_failure_closes_session_before_next_poll(monkeypatch):
    events = []
    class Session:
        def __enter__(self):
            events.append('open')
            return self
        def __exit__(self, *_):
            events.append('close')
    claims = iter([unavailable(), None])
    def claim(*_):
        outcome = next(claims)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome
    sleeps = 0
    def sleep(_):
        nonlocal sleeps
        sleeps += 1
        events.append('sleep')
        if sleeps == 2:
            raise KeyboardInterrupt()
    monkeypatch.setattr(worker, 'SessionLocal', Session)
    monkeypatch.setattr(worker, 'claim', claim)
    monkeypatch.setattr(worker.time, 'time', lambda: 1_800_000_010)
    monkeypatch.setattr(worker.time, 'sleep', sleep)
    with pytest.raises(KeyboardInterrupt):
        worker.run_worker_loop('owner', 'requested', [33])
    assert events == ['open', 'close', 'sleep', 'open', 'close', 'sleep']


def test_worker_does_not_hide_programming_failures(monkeypatch):
    monkeypatch.setattr(worker, 'run_once', Mock(side_effect=ValueError('broken implementation')))
    sleep = Mock()
    monkeypatch.setattr(worker.time, 'sleep', sleep)
    with pytest.raises(ValueError):
        worker.run_worker_loop('owner', 'requested', [33])
    sleep.assert_not_called()


def test_owner_exit_is_graceful_and_pid_reuse_cannot_keep_service_alive(monkeypatch):
    monkeypatch.setattr(process_owner.os, 'getppid', lambda: 123)
    process_owner.require_process_owner({})  # Standalone hosts have no supervisor.
    process_owner.require_process_owner({'PRYSM_AGENT_SUPERVISOR_PID': '123'})
    with pytest.raises(SystemExit) as exit:
        process_owner.require_process_owner({'PRYSM_AGENT_SUPERVISOR_PID': '456'})
    assert exit.value.code == 0


def test_cleanup_skips_exited_processes_and_continues_after_group_permission_error(tmp_path, monkeypatch):
    stack = stack_module.Stack(tmp_path, {})
    live = SimpleNamespace(pid=201, poll=lambda: None, send_signal=Mock(), wait=Mock())
    exited = SimpleNamespace(pid=202, poll=lambda: 1, send_signal=Mock(), wait=Mock())
    other = SimpleNamespace(pid=203, poll=lambda: None, send_signal=Mock(), wait=Mock())
    stack.children = [('live', live), ('exited', exited), ('other', other)]
    monkeypatch.setattr(stack_module.os, 'getpgid', lambda pid: pid)
    sent = []
    def kill(pid, signal):
        sent.append(pid)
        if pid == 203:
            raise PermissionError()
    monkeypatch.setattr(stack_module.os, 'killpg', kill)
    stack.stop()
    assert sent == [203, 201]
    other.send_signal.assert_called_once_with(stack_module.signal.SIGTERM)
    exited.send_signal.assert_not_called()
    live.wait.assert_called_once()


def test_cleanup_never_signals_a_different_process_group(tmp_path, monkeypatch):
    stack = stack_module.Stack(tmp_path, {})
    child = SimpleNamespace(pid=201, poll=lambda: None, send_signal=Mock(), wait=Mock())
    monkeypatch.setattr(stack_module.os, 'getpgid', lambda _: 999)
    kill = Mock()
    monkeypatch.setattr(stack_module.os, 'killpg', kill)
    stack.children = [('child', child)]
    stack.stop()
    kill.assert_not_called()
    child.send_signal.assert_called_once_with(stack_module.signal.SIGTERM)


@pytest.mark.parametrize('script', ['clinic-dev.py', 'agent-dev.py'])
def test_managed_service_replaces_launcher_process(script, tmp_path, monkeypatch):
    entry = tmp_path / 'scripts' / script
    entry.parent.mkdir()
    entry.write_text((ROOT / 'scripts' / script).read_text())
    (tmp_path / 'backend').mkdir()
    (tmp_path / 'backend/.env').write_text('')
    (tmp_path / '.env.agent-dev').write_text('DATABASE_URL=postgresql:///opticai_agent_dev\nAGENTS24_BASE_URL=http://127.0.0.1:8026\n')
    monkeypatch.setattr(stack_module, 'validate_environment', lambda *a, **k: None)
    monkeypatch.setitem(__import__('sys').modules, 'agent_dev_stack', stack_module)
    monkeypatch.setattr('sys.argv', [str(entry), 'relay'])
    calls = []
    class Replaced(BaseException):
        pass
    def replace(executable, args, env):
        calls.append((executable, args, env))
        raise Replaced()
    monkeypatch.setattr(os, 'chdir', lambda _: None)
    monkeypatch.setattr(os, 'execvpe', replace)
    with pytest.raises(Replaced):
        runpy.run_path(str(entry), run_name='__main__')
    assert calls[0][1][1:] == ['-m', 'agent.relay_host']
