// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { shell } from 'electron';
vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }));
import { GoogleOAuthService } from '@/lib/google/google-oauth';

it('rejects callbacks without the matching state and accepts the valid loopback callback', async () => {
  const service = Object.create(GoogleOAuthService.prototype) as any;
  const callback = await service.createLoopbackCallbackServer('unguessable-state');
  try {
    expect((await fetch(`${callback.redirectUri}?code=bad&state=wrong`)).status).toBe(400);
    expect((await fetch(callback.redirectUri, { method: 'POST' })).status).toBe(400);
    expect((await fetch(`${callback.redirectUri}?code=valid&state=unguessable-state`)).status).toBe(200);
    expect(await callback.waitForCode).toBe('valid');
  } finally { callback.close(); }
});

it('cannot bypass loopback validation by forwarding a code through the renderer', async () => {
  expect(await GoogleOAuthService.resolvePendingAuth('unvalidated-code')).toBe(false);
});

it('opens the complete authorization URL in the system browser and exchanges the matching callback', async () => {
  const { createHash } = await import('node:crypto');
  const generated: any[] = [];
  const exchanged: any[] = [];
  class OAuth2 {
    redirect: string;
    constructor(_id: string, _secret: string, redirect: string) { this.redirect = redirect; }
    generateAuthUrl(options: any) {
      generated.push(options);
      return `https://accounts.google.com/auth?${new URLSearchParams({ ...options, redirect_uri: this.redirect })}`;
    }
    async getToken(options: any) { exchanged.push(options); return { tokens: { access_token: 'test' } }; }
    setCredentials() {}
  }
  const service = Object.create(GoogleOAuthService.prototype) as any;
  service.createOAuthClient = (redirect: string) => new OAuth2('', '', redirect);
  service.getUserInfo = async () => ({ email: 'synthetic@example.com' });
  const openExternal = vi.mocked(shell.openExternal).mockImplementation(async (url: string) => {
    const params = new URL(url).searchParams;
    expect(params.get('access_type')).toBe('offline');
    expect(params.get('scope')).toContain('https://www.googleapis.com/auth/calendar');
    expect(params.get('prompt')).toBe('consent');
    expect(params.get('code_challenge_method')).toBe('S256');
    const callback = params.get('redirect_uri')!;
    expect((await fetch(`${callback}?code=bad&state=wrong`)).status).toBe(400);
    await fetch(`${callback}?code=valid&state=${params.get('state')}`);
  });
  try {
    expect((await service.authenticate('fr')).userInfo.email).toBe('synthetic@example.com');
    expect(openExternal).toHaveBeenCalledTimes(1);
    expect(generated[0].state).toHaveLength(43);
    expect(generated[0].code_challenge_method).toBe('S256');
    expect(createHash('sha256').update(exchanged[0].codeVerifier).digest('base64url')).toBe(generated[0].code_challenge);
    expect(exchanged[0].code).toBe('valid');
    expect(exchanged[0].redirect_uri).toContain('http://127.0.0.1:');
  } finally { GoogleOAuthService.cancelPendingAuth(); openExternal.mockReset(); }
});
