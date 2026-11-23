import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgentResponseTimeline, HitlSubmissionStatus, isHitlSubmissionCompact, type AgentChatStatusLabels, type AgentChatTimelineSlotProps } from '@agents24/chat-react/ui';
import type { ChatHitlPart, ChatPart } from '@agents24/react';
import { useTranslation } from 'react-i18next';
import { agentJson } from '@/services/agent-client';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { AgentLink } from './AgentLinks';
import { localizeTimelinePart, LocalizedTimelinePart } from './LocalizedTimelinePart';
import { ChatReportResults, ChatSearchReceipts, TimelineCode } from './TimelineCode';
import { useTimelineLabels } from './timeline-labels';
import { useAppLocale } from '@/localization/use-app-locale';
import { Button } from '@/components/ui/button';
import { isAttachedReportLink, reportMessageResults, searchMessageResults } from './report-message-results';
import { MessageReportResults } from './MessageReportResults';
import { AgentReportAttachments } from '@/services/use-agent-report-attachments';
import { supplyMessageResults } from './supply-message-results';
const AgentDataResults = React.lazy(() => import('./AgentDataResults').then(module => ({ default: module.AgentDataResults })));
const SupplyReview = React.lazy(() => import('../inventory/SupplyIntake').then(module => ({ default: module.SupplyReview })));

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
      {Object.entries(data.after).filter(([key]) => !['client_id', 'exam_id', 'layout_instance_id', 'clinic_id', 'revision'].includes(key)).map(([key, value]) => <div key={key}>
        <div className="mb-1 text-xs font-medium text-muted-foreground">{data.kind === 'campaigns' ? t(`campaign.proposalField.${key}`, { defaultValue: t('agent.timeline.field') }) : t(`agent.timeline.field.${key}`, { defaultValue: t(key, { defaultValue: t('agent.timeline.field') }) })}</div>
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
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const reports = React.useMemo(() => reportMessageResults(props.parts), [props.parts]);
  const searchReceipts = React.useMemo(() => searchMessageResults(props.parts), [props.parts]);
  const discovered = React.useContext(AgentReportAttachments).get(props.message.id) || [];
  const receipts = !props.isLoading && (props.message.isFinal || props.message.responseCompletion) ? reports : [];
  const attachments = new Map(receipts.map(report => [String(report.job_id), report]));
  for (const report of discovered) {
    attachments.set(report.id, { ...attachments.get(report.id), job_id: report.id,
      title: report.title, status: report.status, expired: report.expired,
      report_version: report.report_version, format: report.report_format });
  }
  const reportIds = new Set([...reports.map(report => String(report.job_id)), ...attachments.keys()]);
  const statusLabels: AgentChatStatusLabels = {
    thinking: t('agent.timeline.reasoning'),
    planning: t('agent.timeline.activity.planning'),
    capacity: t('agent.timeline.activity.capacity'),
    waiting: t('agent.timeline.activity.waiting'),
    interrupted: t('agent.timeline.activity.interrupted'),
    cancelling: t('agent.timeline.activity.cancelling'),
    toolWaitingDetail: t('agent.timeline.activity.toolWaitingDetail'),
    ...props.statusLabels,
  };
  const campaigns = props.parts.flatMap(part => {
    if (part.kind !== 'tool' || part.toolName !== 'commit_change' || part.state !== 'output-available') return [];
    const result = part.output as { kind?: string; id?: number; status?: string; approval?: { user_id?: number; at?: string } } | undefined;
    return result?.kind === 'campaigns' && result.status === 'draft' && Number.isSafeInteger(result.id) && Number(result.id) > 0 && Number(result.approval?.user_id) > 0 && Number.isFinite(Date.parse(result.approval?.at || '')) ? [Number(result.id)] : [];
  });
  const rows: React.ReactNode[] = [];
  let chunk: ChatPart[] = [];
  const changesByCall = new Map<string, string>();
  const toolNames = new Set<string>();
  for (const part of props.parts) {
    if (part.kind !== 'tool') continue;
    toolNames.add(part.toolName);
    if (part.toolName !== 'commit_change' && part.displayName !== 'commit_change') continue;
    const input = part.input as { change_id?: unknown } | undefined;
    if (part.toolCallId && typeof input?.change_id === 'string') changesByCall.set(part.toolCallId, input.change_id);
  }
  const flush = (active = false) => {
    if (!chunk.length && (!active || rows.length)) return;
    const message = { ...props.message, content: '', ...(active ? {} : { isFinal: true, activity: undefined }) };
    const visible = chunk.filter(part => part.kind !== 'data' && (part.kind !== 'text' || part.text.trim()));
    const lastPart = visible.at(-1);
    const modelTurn = !message.isFinal && !message.responseCompletion &&
      (!message.activity || message.activity.status === 'running') && lastPart?.kind === 'model-turn' &&
      lastPart.turnKind === 'agent' && lastPart.status === 'running' ? lastPart : undefined;
    const parts = visible.filter(part => part.kind !== 'model-turn' || part === modelTurn);
    const isLoading = active && props.isLoading && (parts.length > 0 || props.parts.length === 0);
    rows.push(<AgentResponseTimeline key={parts.find(part => part.kind !== 'model-turn')?.id || parts[0]?.id || 'activity'}
      {...props} message={message} isLoading={isLoading} parts={parts} toolLabelMode="agent" statusLabels={statusLabels}
      responseProps={{ ...props.responseProps, controls: false,
        allowElement: (node, index, parent) => !isAttachedReportLink(node, reportIds)
          && (props.responseProps?.allowElement?.(node, index, parent) ?? true),
        components: {
          ...props.responseProps?.components, a: AgentLink, img: ({ alt }: { alt?: string }) => <span>{alt}</span>, code: TimelineCode,
        },
      }} />);
    chunk = [];
  };
  for (const part of props.parts) {
    if (part.kind === 'node-activity' && (props.nodeActivityMode === 'hidden' || (props.nodeActivityMode !== 'all' && !part.defaultChatVisible))) continue;
    if (part.kind === 'reasoning' && part.label && (/^(artifact|runtime)__/.test(part.label) || toolNames.has(part.label))) continue;
    if (part.kind === 'hitl' || part.kind === 'error' || part.kind === 'node-activity' || part.kind === 'context-compression' ||
        (part.kind === 'ui-blocks' && (part.state === 'output-error' || !part.bundle))) {
      flush();
      rows.push(part.kind === 'hitl' && part.hitlKind === 'tool_review' && part.presentation.tool_name === 'commit_change'
        ? <Review key={part.id} {...props} part={part} changeId={changesByCall.get(String(part.presentation.tool_call_id || ''))} />
        : <LocalizedTimelinePart key={part.id} {...props} part={part} />);
    } else {
      chunk.push(localizeTimelinePart(part, t));
    }
  }
  flush(true);
  return <ChatReportResults.Provider value={reports}><ChatSearchReceipts.Provider value={searchReceipts}>
    <div className="space-y-3" dir={direction}>{rows}
    {searchReceipts.map((receipt, index) => typeof receipt.result_ref === 'string' ? null :
      <React.Suspense key={index} fallback={null}><AgentDataResults output={receipt} /></React.Suspense>)}
    {[...new Set(campaigns)].map(id => <p key={id}><AgentLink href={`/campaigns?campaign=${id}`}>{t('campaign.openDraft')}</AgentLink></p>)}
    <MessageReportResults reports={[...attachments.values()]} />
    {supplyMessageResults(props.parts).map(jobId => <React.Suspense key={jobId} fallback={null}>
      <section className="min-w-0 rounded-xl border bg-card p-3" data-supply-proposal={jobId}><SupplyReview jobId={jobId} /></section>
    </React.Suspense>)}
  </div></ChatSearchReceipts.Provider></ChatReportResults.Provider>;
}
