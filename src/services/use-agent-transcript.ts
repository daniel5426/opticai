import { useEffect, useState } from 'react';
import type { WorkflowOutputDescriptor } from '@agents24/client';
import type { OutputClient } from './agent-outputs';

export type TranscriptEntry = { attachment_id: string; text: string };
type Transcript = { entries: TranscriptEntry[]; status: 'pending' | 'available' | 'unavailable' };
const pending: Transcript = { entries: [], status: 'pending' };

export function useAgentTranscript(client: OutputClient | null | undefined, runId: string | null | undefined, enabled: boolean) {
  const [state, setState] = useState<Transcript & { runId?: string }>({ ...pending });
  useEffect(() => {
    if (!client || !runId || !enabled) { setState(pending); return; }
    let active = true;
    let latest = -1;
    let revision = 0;
    let selectedId: string | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let expiresAt: number | undefined;
    const unavailable = () => { if (active) setState({ runId, entries: [], status: 'unavailable' }); };
    setState({ ...pending, runId });
    const checkExpiry = () => { if (expiresAt !== undefined && Date.now() >= expiresAt) unavailable(); };
    const load = async (descriptor: WorkflowOutputDescriptor) => {
      if (!active || descriptor.name !== 'transcript' || descriptor.occurrence < latest || (descriptor.output_id === selectedId && descriptor.status === 'available')) return;
      const capture = ++revision;
      latest = descriptor.occurrence;
      selectedId = descriptor.output_id;
      clearTimeout(expiry);
      if (descriptor.status !== 'available') { unavailable(); return; }
      try {
        const result = await client.runs.outputs.get({ runId, outputId: descriptor.output_id });
        if (!active || capture !== revision) return;
        if (result.status !== 'available' || !Array.isArray(result.value) || !result.value.every(entry =>
          entry && typeof entry === 'object' && typeof entry.attachment_id === 'string' && typeof entry.text === 'string')) {
          unavailable(); return;
        }
        expiresAt = result.expires_at ? Date.parse(result.expires_at) : undefined;
        if (expiresAt !== undefined && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) { unavailable(); return; }
        setState({ runId, entries: result.value as TranscriptEntry[], status: 'available' });
        if (expiresAt !== undefined) expiry = setTimeout(unavailable, Math.min(expiresAt - Date.now(), 2_147_483_647));
      } catch { if (active && capture === revision) { selectedId = undefined; unavailable(); } }
    };
    const restore = async () => {
      try {
        let after: number | undefined;
        let waiting = false;
        do {
          const page = await client.runs.outputs.list({ runId, after, limit: 100 });
          if (!active) return;
          waiting ||= page.unproduced.some(item => item.name === 'transcript' && item.status === 'pending');
          for (const descriptor of page.items) void load(descriptor);
          if (!selectedId && page.unproduced.some(item => item.name === 'transcript' && item.status === 'not_produced')) unavailable();
          after = page.next_cursor ?? undefined;
        } while (after !== undefined);
        // Older runs never requested this export and have no descriptor.
        if (!selectedId && !waiting) unavailable();
      } catch { if (!selectedId) unavailable(); }
    };
    const unsubscribe = client.subscribeOutputs(event => {
      if (event.run_id !== runId) return;
      if (event.event === 'workflow.output.available' || event.event === 'workflow.output.failed') {
        void load(event.payload as unknown as WorkflowOutputDescriptor);
      } else void restore();
    });
    const revalidate = () => { checkExpiry(); void restore(); };
    window.addEventListener('focus', revalidate);
    void restore();
    return () => { active = false; clearTimeout(expiry); unsubscribe(); window.removeEventListener('focus', revalidate); };
  }, [client, runId, enabled]);
  return state.runId === runId ? state : pending;
}
