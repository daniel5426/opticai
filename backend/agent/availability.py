"""A bounded connectivity check for the optional experimental integration."""
import asyncio
import httpx
from contextlib import contextmanager
from agents24.errors import Agents24SDKError
from .config import enabled, setting

_local_services_ready = None


@contextmanager
def local_service_readiness(ready):
    global _local_services_ready
    previous = _local_services_ready
    _local_services_ready = ready
    try:
        yield
    finally:
        _local_services_ready = previous


async def platform_available():
    if _local_services_ready is False:
        return False
    if not enabled() or not all(setting(key) for key in (
        'AGENTS24_BASE_URL', 'AGENTS24_API_KEY', 'AGENTS24_AGENT_ID',
    )):
        return False
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            response = await client.get(setting('AGENTS24_BASE_URL').rstrip('/') + '/health')
        if response.status_code != 200:
            return False
        if setting('PRYSM_HOSTED_AGENT_WORKERS') != '1' or setting('AGENTS24_ARTIFACT_TRANSPORT', 'relay') != 'relay':
            return True
        from .relay import relay_client_id
        from .runtime import async_client
        identity = relay_client_id()
        if not identity:
            return False
        relay = await asyncio.wait_for(async_client().relay_clients.get(identity), timeout=1.5)
        target = setting('AGENTS24_RUNTIME_TARGET', 'published')
        return relay.get('id') == identity and relay.get('status') == 'connected' and any(
            item.get('ready') and item.get('target') == target for item in relay.get('registrations', []))
    except (httpx.HTTPError, Agents24SDKError, TimeoutError, ValueError, OSError, RuntimeError):
        return False
