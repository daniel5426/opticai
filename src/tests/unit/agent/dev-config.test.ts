// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserConfigFn } from 'vite';
import electronConfig from '../../../../vite.config';
import browserConfig from '../../../../vite.renderer.config.mts';

afterEach(() => vi.unstubAllEnvs());

it('isolates Electron and browser dependency caches and refreshes the composer SDK entries', async () => {
  const context = { command: 'serve', mode: 'test' } as const;
  const electron = await (electronConfig as UserConfigFn)(context);
  const browser = await (browserConfig as UserConfigFn)(context);
  expect(electron.cacheDir).not.toBe(browser.cacheDir);
  for (const config of [electron, browser]) {
    expect(config.optimizeDeps?.include).toEqual(expect.arrayContaining(['@agents24/chat-react/ui', '@agents24/chat-react/runtime']));
  }
});

describe.each([['Electron', electronConfig], ['browser', browserConfig]] as const)('%s agent proxy', (_name, configure) => {
  it.each([
    ['http://127.0.0.1:18016/api/v1', 'http://127.0.0.1:18016'],
    ['http://0.0.0.0:18016/api/v1', 'http://localhost:18016'],
    [undefined, 'http://localhost:8000'],
  ])('uses the same API origin as the client for %s', async (url, expected) => {
    vi.stubEnv('VITE_API_URL', url);
    const config = await (configure as UserConfigFn)({ command: 'serve', mode: 'test' });
    expect(config.server?.proxy?.['/api/agents24']).toMatchObject({ target: expected });
    expect(config.server?.proxy?.['/api/v1/agent']).toMatchObject({ target: expected });
  });
});
