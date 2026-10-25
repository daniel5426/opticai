import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { agentFetch: mock.fetch } }));
vi.mock('@/localization/locale', () => ({ getActiveLocale: () => 'he' }));
import { scopedFetch } from '@/services/agent-client';
describe('clinic BFF consumer', () => {
  beforeEach(() => { mock.fetch.mockReset();mock.fetch.mockResolvedValue(new Response('{}')); });
  it('uses the public app metadata namespace and fixed host scope', async () => {
    await scopedFetch({ clinicId: 5, patientId: 7 })('/api/agents24/chat/stream', {
      method: 'POST', body: JSON.stringify({ input: 'Synthetic request', metadata: { 'app.request': 'fixture' } }),
    });
    const [path, options] = mock.fetch.mock.calls[0];
    expect(path).toBe('/api/agents24/chat/stream');
    expect(JSON.parse(options.body).metadata).toEqual({ 'app.request': 'fixture', 'app.locale': 'he' });
    expect(options.headers.get('X-Prysm-Clinic-Id')).toBe('5');
    expect(options.headers.get('X-Prysm-Client-Id')).toBe('7');
    expect(options.headers.get('x-organization-key')).toBeNull();
  });
});
