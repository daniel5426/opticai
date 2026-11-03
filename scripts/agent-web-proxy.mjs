import http from 'node:http';
import https from 'node:https';

const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const forwardedHeaders = headers => Object.fromEntries(
  Object.entries(headers).filter(([key]) => !hopHeaders.has(key.toLowerCase())),
);

export function agentWebProxy(target) {
  const origin = target ? new URL(target) : null;
  if (origin && !['http:', 'https:'].includes(origin.protocol)) {
    throw new Error('Agent API origin must use HTTP or HTTPS');
  }
  return (req, res, next) => {
    if (!/^\/api\/(agents24(?:\/|$)|v1\/agent(?:\/|$))/.test(req.path)) {
      next();
      return;
    }
    if (!origin) {
      res.status(503).json({ detail: 'agent.notConfigured' });
      return;
    }
    const transport = origin.protocol === 'https:' ? https : http;
    const upstream = transport.request({
      protocol: origin.protocol, hostname: origin.hostname, port: origin.port,
      method: req.method, path: req.originalUrl,
      headers: { ...forwardedHeaders(req.headers), host: origin.host },
    }, response => {
      res.writeHead(response.statusCode, forwardedHeaders(response.headers));
      res.flushHeaders();
      response.on('error', () => res.destroy());
      response.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) res.status(502).json({ detail: 'agent.unavailable' });
      else res.destroy();
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  };
}
