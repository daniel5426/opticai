import { createBffAgentClient } from '@agents24/client/bff';
import type { FetchLike } from '@agents24/client';
import { getActiveLocale } from '@/localization/locale';
import { apiClient } from '@/lib/api-client';

export type AgentScope = { clinicId: number; patientId?: number | null; userId?: number };
export type AgentJob = { id: string; kind: string; status: string; title: string; download_path?: string | null; result?: unknown; original_path?: string | null };
export type AgentJobSummary = Omit<AgentJob, 'result'> & { created_at: string; updated_at: string; expires_at: string | null; expired: boolean; can_analyze: boolean };
export type AgentJobHistory = { items: AgentJobSummary[]; next_cursor: string | null };
export type AgentJobActivity = { items: AgentJobSummary[]; since: string };
export type BriefItem = { category: string; title: string; detail: string; sources: { path: string; id: number; kind: string }[] };
export type DailyBrief = { date: string; status: string; brief: { greeting: string; items: BriefItem[] } | null };

const nativeFetch: typeof fetch = async (url: RequestInfo | URL, options: RequestInit = {}) => {
  const id = crypto.randomUUID();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let release: (() => void) | undefined;
  const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; },
    pull() { release?.(); release = undefined; },
    cancel() { release?.(); window.electronAPI.agentFetchAbort(id); } });
  const abort = () => window.electronAPI.agentFetchAbort(id);
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const serialized = options.body ? new Response(options.body) : null;
  const bytes = serialized ? new Uint8Array(await serialized.arrayBuffer()) : undefined;
  const headers: Record<string, string> = {};
  new Headers(options.headers).forEach((value, key) => { headers[key] = value; });
  if (options.body instanceof FormData) headers['content-type'] = serialized!.headers.get('content-type')!;
  try {
    const metadata = await window.electronAPI.agentFetch({ id, path: new URL(String(url)).pathname + new URL(String(url)).search,
      method: options.method || 'GET', headers, body: bytes ? Array.from(bytes) : undefined },
      chunk => { controller.enqueue(new Uint8Array(chunk));
        if ((controller.desiredSize || 0) <= 0) return new Promise<void>(resolve => { release = resolve; });
      }, error => {
        options.signal?.removeEventListener('abort', abort);
        if (error) controller.error(new Error(error)); else controller.close();
      });
    return new Response([204, 205, 304].includes(metadata.status) ? null : body, { status: metadata.status, headers: metadata.headers });
  } catch (error) { options.signal?.removeEventListener('abort', abort); throw error; }
};

export function scopedFetch(scope: AgentScope): typeof fetch {
  return async (input: RequestInfo | URL, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set('X-Prysm-Clinic-Id', String(scope.clinicId));
    if (scope.patientId) headers.set('X-Prysm-Client-Id', String(scope.patientId));
    let body = options.body;
    if (options.method?.toUpperCase() === 'POST' && typeof body === 'string' && String(input).startsWith('/api/agents24/')) {
      const payload = JSON.parse(body) as Record<string, unknown>;
      payload.metadata = { ...(payload.metadata as Record<string, unknown> || {}), 'app.locale': getActiveLocale() };
      body = JSON.stringify(payload);
    }
    return apiClient.agentFetch(String(input), { ...options, body, headers }, window.electronAPI?.agentFetch ? nativeFetch : undefined);
  };
}

export function createAgentClient(scope: AgentScope) {
  return createBffAgentClient({ basePath: '/api/agents24', fetch: scopedFetch(scope) as FetchLike });
}

export async function agentJson<T>(scope: AgentScope, path: string, options?: RequestInit): Promise<T> {
  const response = await scopedFetch(scope)(`/api/v1/agent${path}`, options);
  if (!response.ok) throw Object.assign(new Error('agent.operationFailed'), { status: response.status });
  return response.json() as Promise<T>;
}

export async function downloadAgentReport(scope: AgentScope, path: string) {
  const response = await scopedFetch(scope)(path);
  if (!response.ok) throw new Error('agent.downloadUnavailable');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=utf-8''([^;]+)/i)?.[1];
  anchor.download = encoded ? decodeURIComponent(encoded) : disposition.match(/filename="?([^";]+)/)?.[1] || 'prysm-report.xlsx';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
