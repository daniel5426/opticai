import asyncio
import os
from unittest.mock import AsyncMock, Mock

import pytest

from agent import hosted_services


@pytest.mark.asyncio
async def test_shutdown_terminates_both_owned_workers(monkeypatch):
    monkeypatch.setenv('AGENTS24_ENABLED', 'true')
    monkeypatch.setenv('PRYSM_HOSTED_AGENT_WORKERS', '1')
    children = []

    async def start(*command, **kwargs):
        assert kwargs['env']['PRYSM_AGENT_SUPERVISOR_PID'] == str(os.getpid())
        finished = asyncio.Event()
        child = Mock(pid=123, returncode=None)

        async def wait():
            await finished.wait()
            child.returncode = 0
            return 0

        child.wait = wait
        child.terminate.side_effect = finished.set
        children.append(child)
        return child

    monkeypatch.setattr(asyncio, 'create_subprocess_exec', start)
    async with hosted_services.hosted_agent_services():
        await asyncio.sleep(0)
        assert len(children) == 2
    assert all(child.terminate.call_count == 1 for child in children)


@pytest.mark.asyncio
async def test_hosted_workers_are_opt_in(monkeypatch):
    monkeypatch.setenv('AGENTS24_ENABLED', 'true')
    monkeypatch.delenv('PRYSM_HOSTED_AGENT_WORKERS', raising=False)
    start = AsyncMock()
    monkeypatch.setattr(asyncio, 'create_subprocess_exec', start)
    async with hosted_services.hosted_agent_services():
        await asyncio.sleep(0)
    start.assert_not_called()


@pytest.mark.asyncio
async def test_exited_worker_is_restarted(monkeypatch):
    child = Mock(pid=123, returncode=1, wait=AsyncMock(return_value=1))
    start = AsyncMock(return_value=child)
    monkeypatch.setattr(asyncio, 'create_subprocess_exec', start)
    sleep = AsyncMock(side_effect=[None, asyncio.CancelledError])
    monkeypatch.setattr(asyncio, 'sleep', sleep)
    with pytest.raises(asyncio.CancelledError):
        await hosted_services.supervise('requested')
    assert start.call_count == 2
    child.terminate.assert_not_called()


@pytest.mark.asyncio
async def test_container_init_does_not_use_the_local_owner_guard(monkeypatch):
    monkeypatch.setattr(os, 'getpid', lambda: 1)
    monkeypatch.setenv('PRYSM_AGENT_SUPERVISOR_PID', '999')
    child = Mock(pid=123, returncode=1, wait=AsyncMock(return_value=1))
    start = AsyncMock(return_value=child)
    monkeypatch.setattr(asyncio, 'create_subprocess_exec', start)
    monkeypatch.setattr(asyncio, 'sleep', AsyncMock(side_effect=asyncio.CancelledError))
    with pytest.raises(asyncio.CancelledError):
        await hosted_services.supervise('requested')
    assert 'PRYSM_AGENT_SUPERVISOR_PID' not in start.call_args.kwargs['env']
