"""Preserve incremental SDK event delivery through the host HTTP middleware."""
from starlette.middleware.gzip import GZipMiddleware


class ClinicGZipMiddleware:
    def __init__(self, app, minimum_size=1024):
        self.app = app
        self.compressed = GZipMiddleware(app, minimum_size=minimum_size)

    async def __call__(self, scope, receive, send):
        # The pinned Starlette gzip implementation buffers streaming gzip output.
        transport = self.app if scope['type'] == 'http' and scope.get('path', '').startswith('/api/agents24/') else self.compressed
        await transport(scope, receive, send)
