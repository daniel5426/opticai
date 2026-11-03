import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { agentWebProxy } from './agent-web-proxy.mjs';

async function listen(t, handler) {
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('agent bootstrap reaches the API with host authentication and no locale redirect', async t => {
  const origin = await listen(t, (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer synthetic');
    assert.equal(req.headers['x-prysm-clinic-id'], '6');
    assert.equal(req.url, '/api/agents24/bootstrap?agent_id=synthetic');
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end('{"detail":"unauthenticated"}');
  });
  const app = express();
  app.use(agentWebProxy(origin + '/api/v1'));
  app.use((_req, res) => res.redirect('/he/'));
  const web = await listen(t, app);
  const response = await fetch(web + '/api/agents24/bootstrap?agent_id=synthetic', {
    redirect: 'error', headers: { Authorization: 'Bearer synthetic', 'X-Prysm-Clinic-Id': '6' },
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { detail: 'unauthenticated' });
});

test('POST uploads and agent product endpoints preserve bytes and response headers', async t => {
  const bytes = Buffer.from([0, 1, 254, 255]);
  const origin = await listen(t, async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), bytes);
    res.writeHead(201, { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename=test.bin' });
    res.end(bytes);
  });
  const app = express();
  app.use(agentWebProxy(origin));
  const web = await listen(t, app);
  const response = await fetch(web + '/api/v1/agent/documents', { method: 'POST', body: bytes });
  assert.equal(response.status, 201);
  assert.match(response.headers.get('content-disposition'), /test.bin/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test('SSE arrives before upstream ends and cancellation closes the upstream', async t => {
  let finish;
  const closed = new Promise(resolve => { finish = resolve; });
  const origin = await listen(t, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: first\n\n');
    res.on('close', finish);
  });
  const app = express();
  app.use(agentWebProxy(origin));
  const web = await listen(t, app);
  const controller = new AbortController();
  const response = await fetch(web + '/api/agents24/threads/events', { signal: controller.signal });
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.equal(new TextDecoder().decode(first.value), 'data: first\n\n');
  controller.abort();
  await closed;
});

test('other routes fall through and absent configuration fails closed', async t => {
  const app = express();
  app.use(agentWebProxy());
  app.use((_req, res) => res.status(204).end());
  const web = await listen(t, app);
  assert.equal((await fetch(web + '/api/agents24/bootstrap')).status, 503);
  assert.equal((await fetch(web + '/api/v1/users')).status, 204);
});
