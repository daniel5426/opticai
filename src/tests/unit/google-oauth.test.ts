import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { authenticateGoogleWeb, publishGoogleOAuthCallback, refreshGoogleWebToken } from '@/lib/google/google-web-oauth';
import { GOOGLE_CONFIG } from '@/lib/google/google-config';

vi.mock('@/localization/i18n', () => ({ default: { exists: () => true, t: (key: string) => key } }));

class Channel {
  static instances: Channel[] = [];
  onmessage: ((event: any) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
  constructor(public name: string) { Channel.instances.push(this); }
}

beforeEach(() => {
  Channel.instances = [];
  vi.stubGlobal('BroadcastChannel', Channel);
  vi.stubGlobal('crypto', webcrypto);
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('uses the API web client, actual origin, PKCE and state; rejects unrelated callbacks', async () => {
  const popup = { location: { href: '' }, close: vi.fn(), closed: false };
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as any);
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ client_id: 'web-client', scopes: ['openid', 'email'] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access', refresh_token: 'refresh' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'owner@example.com' }) });
  vi.stubGlobal('fetch', fetchMock);
  const pending = authenticateGoogleWeb();
  expect(open).toHaveBeenCalledWith('about:blank', 'google-oauth', expect.any(String));
  await vi.waitFor(() => expect(popup.location.href).toContain('accounts.google.com'));
  const params = new URL(popup.location.href).searchParams;
  expect(params.get('client_id')).toBe('web-client');
  expect(params.get('redirect_uri')).toBe(`${window.location.origin}/oauth/callback`);
  expect(params.get('code_challenge_method')).toBe('S256');
  expect(params.get('code_challenge')).toHaveLength(43);
  const channel = Channel.instances[0];
  await channel.onmessage!({ data: { type: 'GOOGLE_AUTH_CODE', state: 'another-flow', code: 'bad' } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await channel.onmessage!({ data: { type: 'GOOGLE_AUTH_CODE', state: params.get('state'), code: 'valid' } });
  const result = await pending;
  expect(result.success).toBe(true);
  const exchange = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(exchange.code).toBe('valid');
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(exchange.code_verifier));
  expect(Buffer.from(digest).toString('base64url')).toBe(params.get('code_challenge'));
  expect(exchange.client_secret).toBeUndefined();
  expect(channel.close).toHaveBeenCalled();
  expect(popup.close).toHaveBeenCalled();
});

it('fails locally when the popup is blocked', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  expect((await authenticateGoogleWeb()).success).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('closes the popup and returns a translated error for missing server config', async () => {
  const popup = { close: vi.fn(), closed: false };
  vi.spyOn(window, 'open').mockReturnValue(popup as any);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: { code: 'google_not_configured' } }) }));
  expect(await authenticateGoogleWeb()).toEqual({ success: false, error: 'authLogin.google.google_not_configured' });
  expect(popup.close).toHaveBeenCalled();
});

it('passes state and provider cancellation back to the originating flow', () => {
  expect(publishGoogleOAuthCallback('?state=flow&error=access_denied')).toBe(false);
  expect(Channel.instances[0].postMessage).toHaveBeenCalledWith({ type: 'GOOGLE_AUTH_CODE', state: 'flow', code: null, error: 'access_denied' });
  expect(Channel.instances[0].close).toHaveBeenCalled();
  expect(publishGoogleOAuthCallback('?code=missing-state')).toBe(false);
  expect(Channel.instances).toHaveLength(1);
});

it('refreshes through the API without sending a client secret from the browser', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'new-access' }) });
  vi.stubGlobal('fetch', fetchMock);
  expect(await refreshGoogleWebToken('existing-refresh')).toEqual({ success: true, access_token: 'new-access', refresh_token: 'existing-refresh' });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh_token: 'existing-refresh' });
});

it('never substitutes fake desktop credentials and still reads runtime credentials', () => {
  vi.stubEnv('GOOGLE_DESKTOP_CLIENT_ID', ''); vi.stubEnv('GOOGLE_DESKTOP_CLIENT_SECRET', '');
  expect(GOOGLE_CONFIG.clientId).toBe(''); expect(GOOGLE_CONFIG.clientSecret).toBe('');
  vi.stubEnv('GOOGLE_DESKTOP_CLIENT_ID', 'real-client'); vi.stubEnv('GOOGLE_DESKTOP_CLIENT_SECRET', 'native-secret');
  expect(GOOGLE_CONFIG.clientId).toBe('real-client'); expect(GOOGLE_CONFIG.clientSecret).toBe('native-secret');
});

it('uses the main-process build fallback when runtime desktop env is absent', () => {
  vi.stubEnv('GOOGLE_DESKTOP_CLIENT_ID', ''); vi.stubEnv('GOOGLE_DESKTOP_CLIENT_SECRET', '');
  vi.stubGlobal('__PRYSM_GOOGLE_DESKTOP_CLIENT_ID__', 'packaged-client');
  vi.stubGlobal('__PRYSM_GOOGLE_DESKTOP_CLIENT_SECRET__', 'packaged-native-secret');
  expect(GOOGLE_CONFIG.clientId).toBe('packaged-client');
  expect(GOOGLE_CONFIG.clientSecret).toBe('packaged-native-secret');
  vi.stubEnv('GOOGLE_DESKTOP_CLIENT_ID', 'runtime-client');
  expect(GOOGLE_CONFIG.clientId).toBe('runtime-client');
});
