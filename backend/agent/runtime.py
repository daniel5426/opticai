"""Public SDK boundary. No provider calls or local agent loop."""
import asyncio
import json
import time
import logging
from dataclasses import dataclass
from anyio import CapacityLimiter, to_thread
from functools import lru_cache
from agents24 import Agents24, AsyncAgents24
from agents24.errors import Agents24SDKError
from agents24.bff import AgentBffAgent, AgentBffPrincipal, AgentBffPrincipalResolution, create_agents24_bff_router
from fastapi import Request, HTTPException
from database import SessionLocal
from .config import setting
from .authority import resolve_request, register_principal
from .failures import PlatformOperationFailed
from .relay import relay_client_id


@lru_cache(maxsize=1)
def client():
    return Agents24(base_url=setting('AGENTS24_BASE_URL'), api_key=setting('AGENTS24_API_KEY'), timeout=90)


@lru_cache(maxsize=1)
def async_client():
    return AsyncAgents24(base_url=setting('AGENTS24_BASE_URL'), api_key=setting('AGENTS24_API_KEY'))


async def close_runtime_clients():
    if async_client.cache_info().currsize:
        try:
            await async_client().aclose()
        finally:
            async_client.cache_clear()


def integration():
    return setting('AGENTS24_INTEGRATION_ID', 'prysm')


def target():
    return setting('AGENTS24_RUNTIME_TARGET', 'published')


def agent_id(name='AGENTS24_AGENT_ID'):
    value = setting(name)
    if not value:
        raise RuntimeError('Agents24 resource configuration is incomplete')
    return value


_authorization_limiter = CapacityLimiter(16)
_logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PrincipalScope:
    subject: str
    context_id: str
    chat_scope: str
    principal_ref: str | None


def load_principal_scope(request: Request, expected: PrincipalScope | None = None, principal_ref: str | None = None):
    started = time.monotonic()
    # Sessions and checked-out connections never cross the async boundary.
    with SessionLocal() as db:
        auth = resolve_request(db, request)
        result = PrincipalScope(f'{auth.company_id}:{auth.user.id}', auth.context_id,
            f'clinic:{auth.clinic_id}:patient:{auth.patient_id or 0}', auth.platform_principal_ref)
        if expected:
            if result.subject != expected.subject or result.context_id != expected.context_id or result.chat_scope != expected.chat_scope:
                raise HTTPException(403, 'agent.scopeDenied')
            register_principal(db, auth, principal_ref)
    _logger.debug('agent_authorization duration_ms=%.1f', (time.monotonic() - started) * 1000)
    return result


async def resolve_bff_principal(request: Request):
    scope = await to_thread.run_sync(load_principal_scope, request, limiter=_authorization_limiter)
    if not scope.principal_ref:
        identity = await async_client().embed.resolve_customer_principal({
            'integration_id': integration(), 'issuer': 'prysm', 'subject': scope.subject})
        # Reauthorize after the network await before binding the identity.
        await to_thread.run_sync(load_principal_scope, request, scope, identity['customer_principal_ref'], limiter=_authorization_limiter)
    return AgentBffPrincipalResolution(
        principal=AgentBffPrincipal(subject=scope.subject, issuer='prysm'), chat_scope=scope.chat_scope,
        relay_client_id=relay_client_id())


def bff_router():
    return create_agents24_bff_router(client=async_client(), agents=[AgentBffAgent(agent_id=agent_id())],
        integration_id=integration(), resolve_principal=resolve_bff_principal, runtime_target=target(), prefix='/api/agents24')


def run_text(resource_id, text, *, subject, session_id=None, scope=None, request_key=None, metadata=None, on_admitted=None, existing_run_id=None, existing_thread_id=None, cancel_check=None):
    sdk = client()
    identity = sdk.embed.resolve_customer_principal({'integration_id': integration(), 'issuer': 'prysm', 'subject': subject})
    principal = identity['customer_principal_ref']
    access = {'external_user_id': principal, 'integration_id': integration(), 'external_session_id': session_id,
              'runtime_target': target(), 'chat_scope': scope}
    run_id = existing_run_id
    thread_id = existing_thread_id
    if not run_id:
        selected = relay_client_id()
        result = sdk.embed.start_agent_run(resource_id, {**access, 'input': text, 'metadata': metadata or {},
            **({'relay_client_id': selected} if selected else {})},
            options={'idempotency_key': request_key} if request_key else None)
        run_id = result['run_id']
        thread_id = result.get('thread_id')
        if on_admitted:
            on_admitted(result)
    events = {}
    deadline = time.monotonic() + 600
    def receive(event):
        events[event['seq']] = event
    while time.monotonic() < deadline:
        if cancel_check and cancel_check():
            sdk.embed.cancel_agent_run(resource_id, run_id, **access)
            raise RuntimeError('Agents24 workflow was cancelled')
        try:
            # Replay from zero also restores deltas after worker/process recovery.
            sdk.embed.attach_agent_run(resource_id, run_id, {**access, 'cursor': 0}, on_event=receive)
        except Exception as error:
            if isinstance(error, Agents24SDKError) and error.code == 'RUN_EVENTS_RETIRED' and thread_id:
                history = sdk.embed.get_agent_thread(resource_id, thread_id, **access)
                turn = next((turn for turn in history.get('turns', []) if turn.get('run_id') == run_id), None)
                if turn and turn.get('status') == 'completed' and turn.get('assistant_output_text'):
                    return turn['assistant_output_text']
                raise RuntimeError('Completed workflow output is unavailable') from None
            if isinstance(error, Agents24SDKError) and getattr(error, 'status', getattr(error, 'status_code', None)) in {400, 401, 403, 404, 422}:
                raise
            if not events or not any(e['event'] in {'run.completed', 'run.failed', 'run.cancelled'} for e in events.values()):
                time.sleep(1)
                continue
        ordered = [events[key] for key in sorted(events)]
        if any(e['event'] in {'run.failed', 'run.cancelled'} for e in ordered):
            failed = next(e for e in ordered if e['event'] in {'run.failed', 'run.cancelled'})
            raise PlatformOperationFailed(failed.get('payload', {}).get('failure'))
        completed = any(e['event'] == 'assistant.completed' for e in ordered)
        if completed:
            content = ''.join(e['payload']['content'] for e in ordered if e['event'] == 'assistant.delta')
            if content:
                return content
        terminal = next((e for e in ordered if e['event'] == 'run.completed'), None)
        if terminal:
            content = terminal.get('payload', {}).get('assistant_output_text')
            if isinstance(content, str) and content:
                return content
            raise RuntimeError('Completed workflow output is unavailable')
        if any(e['event'] == 'run.paused' for e in ordered):
            raise RuntimeError('Background workflow unexpectedly requires staff input')
        time.sleep(1)
    raise RuntimeError('Agents24 workflow did not complete before its deadline')


async def structured(resource_id, data, schema, language, subject):
    text = json.dumps({'locale': language, 'records': data, 'required_output_schema': schema}, ensure_ascii=False)
    result = await asyncio.to_thread(run_text, resource_id, text, subject=subject)
    return json.loads(result)
