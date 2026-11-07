"""Keep integration metadata and browser model overrides out of managed AI runs."""
import json

from starlette.responses import JSONResponse
from services.ai_privacy import clean_nested


class AgentPrivacyMiddleware:
    # Matches the SDK's JSON envelope budget; binary uploads keep its own limits.
    MAX_BODY_BYTES = 1_048_576

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get('path', '')
        if (scope['type'] != 'http' or not path.startswith('/api/agents24/')
                or scope.get('method') not in {'POST', 'PUT', 'PATCH'}
                or path == '/api/agents24/attachments/upload'):
            return await self.app(scope, receive, send)

        body = bytearray()
        while True:
            event = await receive()
            if event['type'] == 'http.disconnect':
                return
            body.extend(event.get('body', b''))
            if len(body) > self.MAX_BODY_BYTES:
                return await JSONResponse({'detail': 'agent.operationFailed'}, status_code=413)(scope, receive, send)
            if not event.get('more_body', False):
                break
        try:
            payload = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            payload = None  # The SDK owns invalid-envelope errors.
        if isinstance(payload, dict):
            # Prysm selects published models. A client cannot widen the provider list.
            if payload.get('requestedModelId'):
                return await JSONResponse({'detail': 'agent.operationFailed'}, status_code=422)(scope, receive, send)
            for key in ('metadata', 'toolInputs', 'client'):
                if key in payload:
                    payload[key] = clean_nested(payload[key])
            body = json.dumps(payload, ensure_ascii=False).encode()
        scope = {**scope, 'headers': [(key, value) for key, value in scope.get('headers', [])
                                     if key.lower() != b'content-length'] + [(b'content-length', str(len(body)).encode())]}
        delivered = False

        async def filtered_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()

        await self.app(scope, filtered_receive, send)
