"""Normal development startup owns local clinic dependencies, never hosted services."""
import asyncio
import json
import logging
import os
import signal
import sys
from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4
from .availability import platform_available


def automatic_services_enabled(env):
    if env.get('PRYSM_AGENT_SERVICES_MANAGED') == '1':
        return False
    if env.get('APP_ENV', 'development').lower() not in {'development', 'local'}:
        return False
    if env.get('APP_ENVIRONMENT', 'development').lower() not in {'development', 'local'}:
        return False
    if any(env.get(key) for key in ['RAILWAY_PROJECT_ID', 'RAILWAY_SERVICE_ID', 'RAILWAY_ENVIRONMENT_NAME']):
        return False
    return env.get('AGENTS24_ENABLED', '').lower() == 'true' and urlsplit(env.get('AGENTS24_BASE_URL', '')).hostname in {'localhost', '127.0.0.1'}


@asynccontextmanager
async def local_agent_services():
    if not automatic_services_enabled(os.environ):
        yield
        return
    if not await platform_available():
        logging.getLogger(__name__).info('Starting without optional local agent services.')
        yield
        return
    async with AsyncExitStack() as stack:
        try:
            await stack.enter_async_context(_managed_agent_services())
        except (OSError, RuntimeError):
            logging.getLogger(__name__).warning('Optional local agent services could not start; continuing without AI.')
        yield


@asynccontextmanager
async def _managed_agent_services():
    root = Path(__file__).resolve().parents[2]
    directory = root / '.agent-data' / 'clinic-services'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    log_path = directory / 'supervisor.log'
    token = str(uuid4())
    previous_client = os.environ.get('AGENTS24_RELAY_CLIENT_ID')
    with open(log_path, 'a') as log:
        log_path.chmod(0o600)
        process = await asyncio.create_subprocess_exec(
            sys.executable, str(root / 'scripts/clinic-dev.py'), 'services',
            '--owner-pid', str(os.getpid()), '--startup-token', token,
            cwd=root, env=dict(os.environ), stdout=log, stderr=asyncio.subprocess.STDOUT,
            start_new_session=True)
    try:
        deadline = asyncio.get_running_loop().time() + 120
        while asyncio.get_running_loop().time() < deadline:
            if process.returncode is not None:
                raise RuntimeError('Local agent services could not start; inspect .agent-data/clinic-services/supervisor.log.')
            try:
                ready = json.loads((directory / 'ready.json').read_text())
                if ready.get('token') == token and ready.get('owner_pid') == os.getpid():
                    from uuid import UUID
                    os.environ['AGENTS24_RELAY_CLIENT_ID'] = str(UUID(ready['relay_client_id']))
                    break
            except (OSError, ValueError):
                pass
            await asyncio.sleep(0.25)
        else:
            raise RuntimeError('Local agent startup timed out; inspect .agent-data/clinic-services logs.')
        yield
    finally:
        if previous_client is None:
            os.environ.pop('AGENTS24_RELAY_CLIENT_ID', None)
        else:
            os.environ['AGENTS24_RELAY_CLIENT_ID'] = previous_client
        if process.returncode is None:
            process.send_signal(signal.SIGTERM)
            try:
                await asyncio.wait_for(process.wait(), timeout=12)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
