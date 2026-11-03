"""API-owned hosted queues share the API's durable report/upload directory."""
import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from .config import enabled

logger = logging.getLogger(__name__)


async def supervise(queue):
    while True:
        process = None
        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable, '-m', 'workers.agent_worker', '--queue', queue,
                cwd=Path(__file__).resolve().parents[1],
                env={**os.environ, 'PRYSM_AGENT_SUPERVISOR_PID': str(os.getpid())})
            logger.info('agent_worker_started queue=%s pid=%s', queue, process.pid)
            await process.wait()
            logger.warning('agent_worker_exited queue=%s code=%s', queue, process.returncode)
        except OSError:
            logger.warning('agent_worker_start_failed queue=%s', queue)
        finally:
            if process is not None and process.returncode is None:
                try:
                    process.terminate()
                except ProcessLookupError:
                    pass
                try:
                    await asyncio.wait_for(process.wait(), 20)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
        await asyncio.sleep(5)


@asynccontextmanager
async def hosted_agent_services():
    if not enabled() or os.getenv('PRYSM_HOSTED_AGENT_WORKERS') != '1':
        yield
        return
    tasks = [asyncio.create_task(supervise(queue)) for queue in ('requested', 'summaries')]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
