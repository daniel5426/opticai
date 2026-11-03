import { useEffect, useId, useRef } from 'react';

export type AgentPageContext = { path: string; recordIds?: Record<string, unknown>; filters?: Record<string, unknown>; drafts?: Record<string, unknown> };
let page: AgentPageContext = { path: '/' };
const drafts = new Map<string, { path: string; read: () => unknown }>();
const sensitive = /password|secret|token|credential|smtp|api.?key|entry.?pin/i;
function safe(value: unknown, depth = 0): unknown {
  if (depth > 12) return null;
  if (Array.isArray(value)) return value.slice(0, 200).map(item => safe(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, safe(item, depth + 1)]));
  return typeof value === 'string' ? value.slice(0, 10000) : value;
}
export function setAgentPageContext(value: AgentPageContext) { page = value; }
export function capturePageContext(): AgentPageContext {
  const values: Record<string, unknown> = {};
  for (const [key, item] of drafts) if (item.path === page.path) {
    try { const value = item.read(); if (value != null) values[key] = safe(value); } catch { /* An unready form must not prevent a message. */ }
  }
  const result = { ...page, drafts: values };
  return JSON.stringify(result).length <= 64000 ? result : { ...page, drafts: { truncated: true } };
}
export function useAgentDraft(name: string, read: () => unknown) {
  const id = useId(); const ref = useRef(read); ref.current = read;
  useEffect(() => {
    const key = `${name}:${id}`;
    drafts.set(key, { path: page.path, read: () => ref.current() });
    return () => { drafts.delete(key); };
  }, [id, name, page.path]);
}

let submittedContext: AgentPageContext | null = null;
export function submissionPageContext() { return submittedContext || capturePageContext(); }
export async function withSubmissionContext<T>(context: AgentPageContext, operation: () => Promise<T>) {
  submittedContext = context;
  try { return await operation(); } finally { submittedContext = null; }
}
