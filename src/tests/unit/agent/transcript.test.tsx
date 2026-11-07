import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import type { AgentClient } from '@agents24/client';
import { withTranscriptOutputs } from '@/services/agent-outputs';
import copy from '@/localization/agent.json';

const workspace = vi.hoisted(() => ({ client: null as ReturnType<typeof withTranscriptOutputs> | null }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => workspace }));
import { TranscriptMessage } from '@/components/agent/TranscriptMessage';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', resources: Object.fromEntries(Object.entries(copy).map(([lang, translation]) => [lang, { translation }])) });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const descriptor = { output_id: 'output', name: 'transcript', node_activity_id: 'speech', occurrence: 1,
  status: 'available', value_type: 'array', byte_size: 80, expires_at: null } as const;
function setup(page = { items: [], next_cursor: null, unproduced: [{ name: 'transcript', status: 'pending' }] } as any) {
  let receive: any;
  const list = vi.fn().mockResolvedValue(page);
  const get = vi.fn().mockResolvedValue({ ...descriptor, value: [{ attachment_id: 'audio', text: 'Synthetic transcript' }] });
  const stream = vi.fn((_input, callback) => { receive = callback; return new Promise(() => {}); });
  const attach = vi.fn((_input, callback) => { receive = callback; return new Promise(() => {}); });
  const submit = vi.fn().mockResolvedValue({});
  const client = withTranscriptOutputs({ chat: { stream }, runs: { attach, outputs: { list, get } }, threads: { messages: { submit } } } as unknown as AgentClient);
  workspace.client = client;
  return { client, list, get, stream, attach, submit, emit: (event: any) => receive(event) };
}
const message = { id: 'user', role: 'user', runId: 'run', content: '', createdAt: new Date(), parts: [],
  attachments: [{ id: 'audio', filename: 'voice.webm', mediaType: 'audio/webm' }] } as const;
function row(locale = 'en', data: any = message) {
  return <I18nextProvider i18n={i18n}><TranscriptMessage message={data} dir={locale === 'he' ? 'rtl' : 'ltr'} /></I18nextProvider>;
}
describe('public client transcript wiring', () => {
  it('selects transcripts for initial and queued attachment submissions, leaving text default-off', () => {
    const s = setup();
    void s.client.chat.stream({ input: '', attachmentIds: ['audio'], idempotencyKey: 'one' }, vi.fn());
    expect(s.stream.mock.calls[0][0].requestedOutputs).toEqual(['transcript']);
    void s.client.threads.messages.submit({ threadId: 'thread', input: '', attachmentIds: ['audio'], mode: 'queue', idempotencyKey: 'two' });
    expect(s.submit.mock.calls[0][0].requestedOutputs).toEqual(['transcript']);
    void s.client.chat.stream({ input: 'Text', idempotencyKey: 'three' }, vi.fn());
    expect(s.stream.mock.calls[1][0]).not.toHaveProperty('requestedOutputs');
  });
  it.each(['en', 'he', 'fr'])('replaces the audio filename immediately while the stream remains open in %s', async locale => {
    await i18n.changeLanguage(locale);
    const s = setup();
    render(row(locale));
    await screen.findByText(copy[locale as keyof typeof copy]['agent.transcript.pending']);
    const receive = vi.fn();
    void s.client.chat.stream({ input: '', attachmentIds: ['audio'], idempotencyKey: 'one' }, receive);
    act(() => s.emit({ event: 'workflow.output.available', run_id: 'run', payload: descriptor }));
    expect(await screen.findByText('Synthetic transcript')).toBeVisible();
    expect(screen.queryByText('voice.webm')).toBeNull();
    expect(receive).toHaveBeenCalledOnce();
    expect(s.get).toHaveBeenCalledExactlyOnceWith({ runId: 'run', outputId: 'output' });
    act(() => s.emit({ event: 'workflow.output.available', run_id: 'run', payload: descriptor }));
    expect(s.get).toHaveBeenCalledOnce();
  });
  it('restores lazily from descriptor pages, preserving text and other files', async () => {
    const s = setup();
    s.list.mockResolvedValueOnce({ items: [], next_cursor: 1, unproduced: [] }).mockResolvedValueOnce({ items: [descriptor], next_cursor: null, unproduced: [] });
    render(row('en', { ...message, content: 'Please check', attachments: [...message.attachments, { id: 'pdf', filename: 'document.pdf', mediaType: 'application/pdf' }] }));
    expect(await screen.findByText(/Synthetic transcript/)).toBeVisible();
    expect(screen.getByText(/Please check/)).toBeVisible();
    expect(screen.getByText('document.pdf')).toBeVisible();
    expect(s.list.mock.calls[1][0].after).toBe(1);
  });
  it('recovers after attach/replay and ignores other runs', async () => {
    const s = setup(); render(row());
    void s.client.runs.attach({ runId: 'run' }, vi.fn());
    act(() => s.emit({ event: 'workflow.output.available', run_id: 'other', payload: descriptor }));
    expect(s.get).not.toHaveBeenCalled();
    s.list.mockResolvedValue({ items: [descriptor], next_cursor: null, unproduced: [] });
    act(() => s.emit({ event: 'run.snapshot', run_id: 'run', payload: {} }));
    expect(await screen.findByText('Synthetic transcript')).toBeVisible();
  });
  it.each(['failed', 'expired'])('keeps the attachment for %s capture without fetching a body', async status => {
    const s = setup({ items: [{ ...descriptor, status }], next_cursor: null, unproduced: [] });
    render(row());
    await screen.findByText(i18n.t('agent.transcript.unavailable'));
    expect(screen.getByText('voice.webm')).toBeVisible();
    expect(s.get).not.toHaveBeenCalled();
  });
  it('does not load bodies for non-audio messages', () => {
    const s = setup(); render(row('en', { ...message, attachments: [] }));
    expect(s.list).not.toHaveBeenCalled(); expect(s.get).not.toHaveBeenCalled();
  });
  it('clears visible text at source expiry', async () => {
    const s = setup({ items: [descriptor], next_cursor: null, unproduced: [] });
    s.get.mockResolvedValue({ ...descriptor, expires_at: new Date(Date.now() + 200).toISOString(), value: [{ attachment_id: 'audio', text: 'Short lived' }] });
    render(row()); await screen.findByText('Short lived');
    await waitFor(() => expect(screen.queryByText('Short lived')).toBeNull());
    expect(screen.getByText('voice.webm')).toBeVisible();
  });
  it('does not let a late value restore text after an expiry descriptor', async () => {
    const s = setup(); let complete: (value: unknown) => void = () => {};
    s.get.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    render(row()); void s.client.runs.attach({ runId: 'run' }, vi.fn());
    act(() => s.emit({ event: 'workflow.output.available', run_id: 'run', payload: descriptor }));
    act(() => s.emit({ event: 'workflow.output.failed', run_id: 'run', payload: { ...descriptor, status: 'expired' } }));
    await act(async () => complete({ ...descriptor, value: [{ attachment_id: 'audio', text: 'Expired late value' }] }));
    expect(screen.queryByText('Expired late value')).toBeNull();
    expect(screen.getByText(i18n.t('agent.transcript.unavailable'))).toBeVisible();
  });
  it('recovers a transient read error on terminal replay', async () => {
    const s = setup({ items: [descriptor], next_cursor: null, unproduced: [] });
    s.get.mockRejectedValueOnce(new Error('offline'));
    render(row()); await screen.findByText(i18n.t('agent.transcript.unavailable'));
    void s.client.runs.attach({ runId: 'run' }, vi.fn());
    act(() => s.emit({ event: 'run.completed', run_id: 'run', payload: {} }));
    expect(await screen.findByText('Synthetic transcript')).toBeVisible();
    expect(s.get).toHaveBeenCalledTimes(2);
  });

});
