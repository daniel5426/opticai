"""Local-test ingress: expose authenticated email/SMS callbacks and tokenized unsubscribe links."""
import re
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
SHORT_UNSUBSCRIBE = re.compile(r'/s/[A-Za-z0-9_-]{38}')
MICROPAY = re.compile(r'/api/v1/messaging/webhooks/micropay/[A-Za-z0-9_-]{32,128}')
UNSUBSCRIBE = re.compile(r'/api/v1/messaging/unsubscribe/[a-f0-9]{32}\.[a-f0-9]{32}')


def allowed(method, path):
    return (method == 'POST' and path in ('/api/v1/messaging/webhooks/resend', '/api/v1/subscriptions/webhooks/allpay')
            or method == 'POST' and MICROPAY.fullmatch(path) is not None
            or method in ('GET', 'POST') and (UNSUBSCRIBE.fullmatch(path) is not None or SHORT_UNSUBSCRIBE.fullmatch(path) is not None))


@app.api_route('/{path:path}', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
async def forward(request: Request, path: str):
    path = '/' + path
    if not allowed(request.method, path) or request.url.query:
        return Response(status_code=404)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 65536:
            return Response(status_code=413)
    headers = {name: value for name, value in request.headers.items()
               if name in ('svix-id', 'svix-timestamp', 'svix-signature', 'content-type')}
    try:
        async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
            result = await client.request(request.method, 'http://127.0.0.1:8000' + path,
                                          content=bytes(body), headers=headers)
        return Response(content=result.content, status_code=result.status_code,
                        headers={'Content-Type': result.headers.get('content-type', 'application/json'),
                                 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
    except httpx.HTTPError:
        return Response(status_code=503)
