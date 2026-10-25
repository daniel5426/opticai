import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { HitlSubmissionStatus, isHitlSubmissionCompact, type AgentChatTimelineSlotProps } from '@agents24/chat-react/ui';
import type { ChatHitlAnswer, ChatHitlPart } from '@agents24/react';
import { useAppLocale } from '@/localization/use-app-locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTimelineLabels } from './timeline-labels';

type Props = AgentChatTimelineSlotProps & { part: ChatHitlPart };
export function LocalizedHitl(props: Props) {
  return props.part.hitlKind === 'user_input' ? <QuestionCard {...props} /> : <ApprovalCard {...props} />;
}
function QuestionCard({ part, ...props }: Props) {
  const { t, submissionLabels } = useTimelineLabels();
  const { direction } = useAppLocale();
  const state = props.getHitlActionState?.(part);
  const [step, setStep] = React.useState(0);
  const [drafts, setDrafts] = React.useState<Record<string, ChatHitlAnswer>>({});
  const [open, setOpen] = React.useState(false);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const disclosure = React.useRef<HTMLButtonElement>(null);
  const detailsId = React.useId();
  const questions = part.questions || [];
  const question = questions[Math.min(step, Math.max(0, questions.length - 1))];
  const draft = question ? drafts[question.id] || { questionId: question.id, selectedOptionIds: [], customText: '' } : null;
  const terminal = part.status !== 'pending';
  const wasPending = React.useRef(!terminal);
  React.useEffect(() => { if (terminal && wasPending.current) disclosure.current?.focus(); wasPending.current = !terminal; }, [terminal]);
  React.useEffect(() => { if (step) heading.current?.focus(); }, [step]);
  React.useEffect(() => { if (state?.status === 'error') input.current?.focus(); }, [state?.status]);
  if (isHitlSubmissionCompact(state)) return <div dir={direction}><HitlSubmissionStatus state={state!} labels={submissionLabels} onPaint={props.onHitlPaint} /></div>;
  if (terminal) {
    const answers = new Map((part.resolution?.answers || []).map(answer => [answer.questionId, answer]));
    return <div dir={direction} className="text-sm">
      <button ref={disclosure} type="button" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen(value => !value)}
        className="flex min-h-9 items-center gap-1.5 rounded-md text-start text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span>{t('agent.timeline.questions.asked', { count: questions.length })}</span>
        <ChevronDown aria-hidden="true" className={`size-3.5 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={detailsId} hidden={!open} role="region" aria-label={t('agent.timeline.questions.details')} className="space-y-3 py-2 ps-4">
        {questions.map(item => {
          const answer = answers.get(item.id);
          const labels = item.options.filter(option => answer?.selectedOptionIds.includes(option.id)).map(option => option.label);
          if (answer?.customText) labels.push(answer.customText);
          return <div key={item.id}><p className="font-medium">{item.question}</p><div className="mt-1 space-y-1 text-muted-foreground">
            {(labels.length ? labels : [t('agent.timeline.questions.noResponse')]).map((label, index) => <p className="whitespace-pre-wrap break-words" key={index}>{label}</p>)}
          </div></div>;
        })}
        {part.status !== 'resolved' && <p className="text-muted-foreground">{t(`agent.timeline.status.${part.status}`)}</p>}
      </div>
    </div>;
  }
  if (!question || !draft) return <p role="alert">{t('agent.timeline.questions.unavailable')}</p>;
  const busy = Boolean(props.isLoading || state?.status === 'resuming' || state?.status === 'connecting');
  const last = step >= questions.length - 1;
  const canContinue = Boolean(draft.selectedOptionIds.length || draft.customText?.trim());
  const update = (next: ChatHitlAnswer) => setDrafts(current => ({ ...current, [question.id]: next }));
  const advance = (answer: ChatHitlAnswer) => {
    if (busy || !props.onHitlAction || (!answer.selectedOptionIds.length && !answer.customText?.trim())) return;
    const next = { ...drafts, [question.id]: answer };
    setDrafts(next);
    if (!last) { setStep(value => value + 1); return; }
    props.onHitlAction(part, { action: 'respond', answers: questions.map(item => ({
      question_id: item.id, selected_option_ids: next[item.id]?.selectedOptionIds || [],
      ...(next[item.id]?.customText?.trim() ? { custom_text: next[item.id].customText!.trim() } : {}),
    })) });
  };
  return <div dir={direction} className="space-y-3 rounded-xl border border-border/50 bg-background p-4 text-sm shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <h3 ref={heading} tabIndex={-1} className="min-w-0 flex-1 break-words text-base font-medium outline-none">{question.question}</h3>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon" aria-label={t('agent.timeline.questions.previous')} disabled={busy || step === 0} onClick={() => setStep(value => value - 1)}><ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" /></Button>
        <span dir="ltr" className="text-xs tabular-nums" aria-label={t('agent.timeline.questions.progress', { current: step + 1, total: questions.length })}>{step + 1} / {questions.length}</span>
        <Button type="button" variant="ghost" size="icon" aria-label={t(`agent.timeline.questions.${last ? 'submitAnswers' : 'next'}`)} disabled={busy || !props.onHitlAction || !canContinue} onClick={() => advance(draft)}><ChevronRight aria-hidden="true" className="size-4 rtl:rotate-180" /></Button>
      </div>
    </div>
    {question.multiSelect && <p className="text-xs text-muted-foreground">{t('agent.timeline.questions.selectMany')}</p>}
    <div className="space-y-1">
      {question.options.map(option => <button key={option.id} type="button" aria-pressed={draft.selectedOptionIds.includes(option.id)} disabled={busy || !props.onHitlAction}
        className={`min-h-11 w-full rounded-lg px-3 py-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${draft.selectedOptionIds.includes(option.id) ? 'bg-muted' : 'hover:bg-muted/70'}`}
        onClick={() => {
          const selected = question.multiSelect ? (draft.selectedOptionIds.includes(option.id) ? draft.selectedOptionIds.filter(id => id !== option.id) : [...draft.selectedOptionIds, option.id]) : [option.id];
          const next = { ...draft, selectedOptionIds: selected, customText: question.multiSelect ? draft.customText : '' };
          update(next); if (!question.multiSelect) advance(next);
        }}>{option.label}</button>)}
    </div>
    <div className="flex gap-2">
      <Input ref={input} dir={direction} aria-label={t('agent.timeline.questions.otherLabel')} placeholder={t('agent.timeline.questions.other')} maxLength={2000} disabled={busy || !props.onHitlAction}
        value={draft.customText || ''} onChange={event => update({ ...draft, customText: event.target.value, selectedOptionIds: question.multiSelect ? draft.selectedOptionIds : [] })}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && draft.customText?.trim()) { event.preventDefault(); advance(draft); } }} />
      {(question.multiSelect || draft.customText?.trim()) && <Button type="button" size="sm" disabled={busy || !props.onHitlAction || !canContinue} onClick={() => advance(draft)}>{t(`agent.timeline.questions.${last ? 'submit' : 'nextStep'}`)}</Button>}
    </div>
    {state?.error && <p role="alert" className="text-destructive">{t('agent.operationFailed')}</p>}
  </div>;
}
function ApprovalCard({ part, ...props }: Props) {
  const { t, submissionLabels } = useTimelineLabels();
  const { direction } = useAppLocale();
  const state = props.getHitlActionState?.(part);
  const [comment, setComment] = React.useState('');
  const input = React.useRef<HTMLTextAreaElement>(null);
  const retry = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { if (state?.status === 'error') (input.current || retry.current)?.focus(); }, [state?.status]);
  if (isHitlSubmissionCompact(state)) return <div dir={direction}><HitlSubmissionStatus state={state!} labels={submissionLabels} onPaint={props.onHitlPaint} /></div>;
  if (part.status !== 'pending') return null;
  const requireComment = part.presentation?.require_comment === true;
  const allow = part.hitlKind === 'tool_review' || part.hitlKind === 'app_data_permission';
  const title = part.hitlKind === 'tool_review' ? 'review' : part.hitlKind === 'app_data_permission' ? 'data' : part.hitlKind === 'mcp_auth' ? 'connectTitle' : 'request';
  const actionKey = (action: string) => action === 'approve' ? (allow ? 'allow' : 'approve') : action === 'reject' ? (allow ? 'deny' : 'reject') : action === 'connect' ? 'connect' : action === 'respond' ? null : 'skip';
  return <div dir={direction} className="space-y-3 py-2 text-sm">
    <p className="font-medium">{t(`agent.timeline.approval.${title}`)}</p>
    {part.hitlKind === 'user_approval' && part.message && <p>{part.message}</p>}
    {requireComment && <Textarea ref={input} dir={direction} aria-label={t('agent.timeline.approval.comment')} placeholder={t('agent.timeline.approval.commentRequired')} value={comment} onChange={event => setComment(event.target.value)} />}
    {state?.error && <p role="alert" className="text-destructive">{t('agent.operationFailed')}</p>}
    <div className="flex flex-wrap gap-2">{part.allowedActions.map(action => <Button key={action} ref={state?.action === action || (!state?.action && action === part.allowedActions[0]) ? retry : undefined}
      type="button" size="sm" variant={action === 'approve' || action === 'connect' ? 'default' : 'ghost'}
      disabled={!props.onHitlAction || props.isLoading || state?.status === 'connecting' || state?.status === 'resuming' || (requireComment && !comment.trim())}
      onClick={() => props.onHitlAction?.(part, { action, ...(comment.trim() ? { comment: comment.trim() } : {}) })}>
      {actionKey(action) ? t(`agent.timeline.action.${actionKey(action)}`) : t('agent.timeline.questions.submit')}
    </Button>)}</div>
  </div>;
}
