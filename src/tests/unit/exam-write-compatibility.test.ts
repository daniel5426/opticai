import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.unmock('@/lib/api-client');

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) })));
});
afterEach(() => vi.unstubAllGlobals());

it('marks current exam replacements and explicit clears without changing the stored payload shape', async () => {
  const { apiClient } = await import('@/lib/api-client');
  const data = { 'opticplus-ocular-health': { note: 'Retained clinical data' } };
  await apiClient.saveUnifiedExamData(7, data);
  await apiClient.updateExamLayoutInstance(7, { exam_data: data });
  await apiClient.deleteUnifiedExamData(7);
  const calls = vi.mocked(fetch).mock.calls;
  expect(calls).toHaveLength(3);
  for (const [, options] of calls) {
    expect(options?.headers).toMatchObject({ 'X-Prysm-Exam-Write': 'replace-v1' });
    expect((options?.headers as Record<string, string>)['X-Prysm-Exam-Components'].split(',')).toContain('opticplus-ocular-health');
  }
  expect(JSON.parse(calls[0][1]!.body as string)).toEqual(data);
  expect(JSON.parse(calls[1][1]!.body as string)).toEqual({ exam_data: data });
  expect(calls[2][1]!.method).toBe('DELETE');
});
