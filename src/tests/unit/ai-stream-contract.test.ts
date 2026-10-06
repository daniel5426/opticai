import { afterEach, describe, expect, it, vi } from 'vitest';
vi.unmock('@/lib/api-client');
import { apiClient } from '@/lib/api-client';
import i18n from '@/localization/i18n';

function stream(frames: unknown[]) {
  const bytes = new TextEncoder().encode(frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`).join(''));
  return new Response(new ReadableStream({ start(controller) {
    // Split a frame to exercise transport buffering.
    controller.enqueue(bytes.slice(0, 9));
    controller.enqueue(bytes.slice(9));
    controller.close();
  } }), { status: 200 });
}

afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage('he'); });

describe('assistant SSE compatibility', () => {
  it('keeps text, progress and the final message across fragmented frames', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream([
      { chunk: 'Hello', fullMessage: 'Hello', currentTextPart: 'Hello' },
      { tool: { phase: 'end', name: 'client_operations', output: { status: 'success' } }, parts: [] },
      { done: true, message: 'Hello', parts: [{ type: 'text', content: 'Hello' }] },
    ])));
    const chunk = vi.fn(), done = vi.fn(), tool = vi.fn();
    await apiClient.aiChatStream('hello', [], null, chunk, done, tool);
    expect(chunk).toHaveBeenCalledWith('Hello', 'Hello', 'Hello');
    expect(tool.mock.calls[0][0].phase).toBe('end');
    expect(done.mock.calls[0][0]).toBe('Hello');
  });

  it.each(['he', 'en', 'fr'])('does not swallow fatal errors in %s', async language => {
    await i18n.changeLanguage(language);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream([{ error: 'server failure', errorCode: 'ai.limit', done: true }])));
    const done = vi.fn();
    await expect(apiClient.aiChatStream('hello', [], null, vi.fn(), done)).rejects.toThrow(i18n.t('ai.limit'));
    expect(done).not.toHaveBeenCalled();
  });

  it('does not persist an interrupted response as completed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream([{ chunk: 'partial', fullMessage: 'partial' }])));
    const done = vi.fn();
    await expect(apiClient.aiChatStream('hello', [], null, vi.fn(), done)).rejects.toThrow(i18n.t('ai.failed'));
    expect(done).not.toHaveBeenCalled();
  });

  it('passes cancellation through to fetch', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiClient.aiChatStream('hello', [], null, vi.fn(), vi.fn(), undefined, controller.signal)).rejects.toHaveProperty('name', 'AbortError');
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
