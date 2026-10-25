import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { HitlSubmissionStatus, isHitlSubmissionCompact, type AgentChatTimelineSlotProps } from '@agents24/chat-react/ui';
import type { ChatHitlPart, ChatToolPart } from '@agents24/react';
import { useTranslation } from 'react-i18next';
import { agentJson } from '@/services/agent-client';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { AgentLink } from './AgentLinks';
import { ToolActivityTimeline } from './ToolActivityTimeline';
import { useTimelineLabels } from './timeline-labels';
import { useAppLocale } from '@/localization/use-app-locale';
import { Button } from '@/components/ui/button';
import { reportMessageResults } from './report-message-results';
import { MessageReportResults } from './MessageReportResults';

type Proposal = { id: string; kind: string; action: string; before: Record<string, unknown>; after: Record<string, unknown>; status: string; patient?: { label: string; path: string } | null };
function Value({ value }: { value: unknown }) {
  const { t } = useTranslation();
  if (typeof value === 'boolean') return <span>{t(`agent.timeline.${value ? 'yes' : 'no'}`)}</span>;
  if (value == null) return <span>—</span>;
  if (typeof value === 'object') return <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs" dir="ltr">{JSON.stringify(value, null, 2)}</pre>;
  return <span className="break-words">{String(value)}</span>;
}
function Review({ part, changeId, ...props }: AgentChatTimelineSlotProps & { part: ChatHitlPart; changeId?: string }) {
  const { t, submissionLabels } = useTimelineLabels();
  const { direction } = useAppLocale();
  const workspace = usePrysmAgent();
  const { data, isError } = useQuery({ queryKey: ['agent-change', workspace?.scope?.userId, workspace?.scope?.clinicId, changeId],
    queryFn: () => agentJson<Proposal>(workspace!.scope!, `/changes/${changeId}`), enabled: Boolean(workspace?.scope && changeId) });
  const action = props.getHitlActionState?.(part);
  const pending = part.status === 'pending';
  const busy = isHitlSubmissionCompact(action) || action?.status === 'connecting';
  const ready = ['prepared', 'approved'].includes(data?.status || '') && pending && !busy;
  const retryFocus = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { if (action?.status === 'error' && ready) retryFocus.current?.focus(); }, [action?.status, ready]);
  const respond = (answer: 'approve' | 'reject') => {
    props.onHitlAction?.(part, { action: answer }, answer === 'approve' ? {
      prepare: async ({ signal }) => { await agentJson(workspace!.scope!, `/changes/${changeId}/approve`, { method: 'POST', signal: signal as AbortSignal }); },
    } : undefined);
  };
  if (isHitlSubmissionCompact(action)) return <HitlSubmissionStatus state={action!} labels={submissionLabels} onPaint={props.onHitlPaint} />;
  return <div dir={direction} className="rounded-lg bg-muted/50 p-4 text-sm">
    <p className="mb-3 font-medium">{t('agent.proposal')}</p>
    {data?.patient && <p className="mb-3"><AgentLink href={data.patient.path}>{data.patient.label}</AgentLink></p>}
    {data && <div className="space-y-3">
      {Object.entries(data.after).filter(([key]) => !['client_id', 'exam_id', 'layout_instance_id'].includes(key)).map(([key, value]) => <div key={key}>
        <div className="mb-1 text-xs font-medium text-muted-foreground">{t(`agent.timeline.field.${key}`, { defaultValue: t(key, { defaultValue: t('agent.timeline.field') }) })}</div>
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-xs text-muted-foreground">{t('agent.before')}</span><div><Value value={data.before[key]} /></div></div>
          <div><span className="text-xs text-muted-foreground">{t('agent.after')}</span><div><Value value={value} /></div></div>
        </div>
      </div>)}
    </div>}
    {((!changeId && pending) || isError || action?.error) && <p role="alert">{t('agent.operationFailed')}</p>}
    {pending ? <div className="mt-4 flex gap-2">
      {part.allowedActions.includes('approve') && <Button ref={action?.action === 'approve' ? retryFocus : undefined} size="sm" disabled={!ready} onClick={() => void respond('approve')}>{t('agent.approve')}</Button>}
      {part.allowedActions.includes('reject') && <Button ref={action?.action === 'reject' ? retryFocus : undefined} size="sm" variant="outline" disabled={busy} onClick={() => void respond('reject')}>{t('agent.reject')}</Button>}
    </div> : <p className="mt-3 text-xs text-muted-foreground">{t(`agent.approval.${part.status}`)}</p>}
  </div>;
}

export function ApprovalTimeline(props: AgentChatTimelineSlotProps) {
  const groups: React.ReactNode[] = [];
  let chunk: typeof props.parts[number][] = [];
  const changesByCall = new Map<string, string>();
  for (const part of props.parts) {
    if (part.kind !== 'tool') continue;
    const tool = part as ChatToolPart;
    if (tool.toolName !== 'commit_change' && tool.displayName !== 'commit_change') continue;
    const input = tool.input as { change_id?: unknown } | undefined;
    if (tool.toolCallId && typeof input?.change_id === 'string') changesByCall.set(tool.toolCallId, input.change_id);
  }
  const flush = () => { if (chunk.length) { groups.push(<ToolActivityTimeline key={chunk.find(part => part.kind !== 'model-turn')?.id || chunk[0].id} {...props} parts={chunk} responseProps={{ ...props.responseProps, components: { a: AgentLink, img: ({ alt }: { alt?: string }) => <span>{alt}</span> } }} />); chunk = []; } };
  for (const part of props.parts) {
    if (part.kind === 'hitl' && part.hitlKind === 'tool_review' && part.presentation.tool_name === 'commit_change') {
      const changeId = changesByCall.get(String(part.presentation.tool_call_id || ''));
      flush(); groups.push(<Review key={part.id} {...props} part={part} changeId={changeId} />);
    } else chunk.push(part);
  }
  flush();
  const reports = reportMessageResults(props.parts);
  return <div className="space-y-3">{groups}
    <MessageReportResults reports={reports} />
  </div>;
}
