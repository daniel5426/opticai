import { beforeEach, describe, expect, it, vi } from 'vitest';
const bridge = vi.hoisted(() => ({ handlers: new Map<string, Function>(), listeners: new Map<string, Function>() }));
vi.mock('electron', () => ({ ipcMain: {
  removeHandler: vi.fn(), removeAllListeners: vi.fn(),
  handle: (name: string, fn: Function) => bridge.handlers.set(name, fn),
  on: (name: string, fn: Function) => bridge.listeners.set(name, fn),
} }));
import { installAgentTransport } from '@/lib/agent-native-transport';

describe('authenticated native agent transport', () => {
  let window: any, event: any;
  beforeEach(() => {
    vi.stubGlobal('__PRYSM_AGENT_API_URL__', 'http://localhost:8016/api/v1');
    const contents = { mainFrame: {}, send: vi.fn() };
    window = { webContents: contents, isDestroyed: () => false, once: vi.fn() };
    event = { sender: contents, senderFrame: contents.mainFrame };
    installAgentTransport(window);
  });
  it('rejects other windows and frames before fetching', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(bridge.handlers.get('prysm-agent-fetch')!({ ...event, senderFrame: {} }, {})).rejects.toThrow('Denied');
    expect(fetch).not.toHaveBeenCalled();
    expect(() => bridge.listeners.get('prysm-agent-ack')!({ ...event, senderFrame: {} }, 'invalid')).not.toThrow();
  });
  it.each(['/api/v1/users', '/api/agents24/../users', '/api/agents24/%2e%2e/users',
    '/api/agents24/%252e%252e/users', '/api/agents24/%2fusers', '/api/agents24/%5cusers',
    '/api/agents24/%00', '/api/agents24/%zz', '/api/agents24/bootstrap#fragment',
    'https://foreign.invalid/api/agents24/'])('rejects unauthorized path %s', async path => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(bridge.handlers.get('prysm-agent-fetch')!(event, { id: crypto.randomUUID(), path, method: 'GET', headers: {} })).rejects.toThrow('Invalid agent request');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['approve', 'reject'])('forwards the SDK-encoded HITL URL for %s', async action => {
    const fetch = vi.fn().mockResolvedValue({ body: null, status: 200, headers: new Headers() });
    vi.stubGlobal('fetch', fetch);
    const path = `/api/agents24/runs/run-id/hitl/${encodeURIComponent('hitl:review-id')}/resume`;
    await bridge.handlers.get('prysm-agent-fetch')!(event, { id: crypto.randomUUID(), path,
      method: 'POST', headers: {}, body: Array.from(new TextEncoder().encode(JSON.stringify({ action }))) });
    expect(fetch.mock.calls[0][0].pathname).toBe(path);
  });
  it('binds the backend origin and forwards only supported headers', async () => {
    const fetch = vi.fn().mockResolvedValue({ body: null, status: 200, headers: new Headers() });vi.stubGlobal('fetch', fetch);
    await bridge.handlers.get('prysm-agent-fetch')!(event, { id: crypto.randomUUID(), path: '/api/agents24/bootstrap', method: 'GET',
      headers: { authorization: 'Bearer synthetic', 'x-prysm-clinic-id': '1', 'x-organization-key': 'forbidden' } });
    expect(fetch.mock.calls[0][0].origin).toBe('http://localhost:8016');
    expect(fetch.mock.calls[0][1].headers.get('x-organization-key')).toBeNull();
    expect(fetch.mock.calls[0][1].headers.get('authorization')).toBe('Bearer synthetic');
    expect(fetch.mock.calls[0][1].redirect).toBe('error');
  });
});
