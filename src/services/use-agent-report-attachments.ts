import { createContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChatMessage } from '@agents24/react';
import { agentJson, type AgentScope } from './agent-client';

type Attachment = {
  id: string;
  run_id: string;
  title: string;
  status: string;
  expired: boolean;
  report_version: number | null;
  report_format: 'csv' | 'xlsx' | null;
};

export const AgentReportAttachments = createContext<ReadonlyMap<string, readonly Attachment[]>>(new Map());

export function useAgentReportAttachments(scope: AgentScope | null, threadId: string | null,
  activeRunId: string | null, messages: readonly ChatMessage[]) {
  const messageByRun = new Map<string, string>();
  for (const message of messages) {
    if (message.runId && message.role === 'assistant') messageByRun.set(message.runId, message.id);
  }
  const ids = [...messageByRun.keys()];
  const query = useQuery({
    queryKey: ['agent-turn-reports', scope?.userId, scope?.clinicId, scope?.patientId, threadId, activeRunId, ids],
    enabled: Boolean(scope && threadId && ids.length),
    retry: false,
    queryFn: async ({ signal }) => {
      const items: Attachment[] = [];
      for (let index = 0; index < ids.length; index += 50) {
        const query = new URLSearchParams({ thread_id: threadId! });
        for (const id of ids.slice(index, index + 50)) query.append('run_id', id);
        const page = await agentJson<{ items: Attachment[] }>(scope!, `/report-attachments?${query}`, { signal });
        items.push(...page.items);
      }
      return items;
    },
    refetchInterval: query => activeRunId || query.state.data?.some(item => ['queued', 'running'].includes(item.status))
      ? 2000 : false,
  });
  const byMessage = new Map<string, Attachment[]>();
  for (const report of query.data || []) {
    const messageId = messageByRun.get(report.run_id);
    if (!messageId) continue;
    const reports = byMessage.get(messageId);
    if (reports) reports.push(report);
    else byMessage.set(messageId, [report]);
  }
  return byMessage;
}
