import asyncio
from services.agent_transport import ClinicGZipMiddleware


def test_bff_events_are_not_gzip_buffered():
    sent = []
    async def stream(scope, receive, send):
        await send({'type': 'http.response.start', 'status': 200, 'headers': [(b'content-type', b'text/event-stream')]})
        for value in (b'data: first\n\n', b'data: second\n\n'):
            await send({'type': 'http.response.body', 'body': value, 'more_body': True})
        await send({'type': 'http.response.body', 'body': b'', 'more_body': False})
    async def send(message): sent.append(message)
    asyncio.run(ClinicGZipMiddleware(stream)({'type': 'http', 'path': '/api/agents24/runs/run/stream',
        'headers': [(b'accept-encoding', b'gzip')]}, None, send))
    assert (b'content-encoding', b'gzip') not in sent[0]['headers']
    assert sent[1]['body'] == b'data: first\n\n'
    assert sent[2]['body'] == b'data: second\n\n'
