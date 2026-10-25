import React from 'react';
import { AgentChatComposer, AgentChatMessage, type AgentChatComposerHandle } from '@agents24/chat-react/ui';
import { ArrowLeft, ArrowUpRight, FileSpreadsheet, Search, ChartNoAxesCombined, HeartPulse, History, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StickToBottom } from 'use-stick-to-bottom';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { Button } from '@/components/ui/button';
import { ApprovalTimeline } from './ApprovalTimeline';
import { DailyBrief } from './DailyBrief';
import { AgentChatActions } from './AgentChatActions';
import { useAppLocale } from '@/localization/use-app-locale';
import { AgentSky } from './AgentSky';
import '@agents24/chat-react/styles.css';
import './agent-workspace.css';

export function AgentChatPanel({ compact = false }: { compact?: boolean }) {
  const workspace = usePrysmAgent();
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const composerRef = React.useRef<AgentChatComposerHandle>(null);
  const runtime = workspace?.runtime;
  if (!runtime || !workspace?.scope) return <section className={`prysm-agent agent-workspace ${compact ? 'agent-workspace--compact' : ''}`} dir={direction}>
    {!compact && <AgentSky />}
    <p role="status" className="relative m-auto p-6 text-center text-sm">{t(workspace?.scope ? 'loading' : 'agent.sessionRequired')}</p>
  </section>;
  const controller = runtime.controller;
  const running = Boolean(controller.activeRunId);
  const empty = !controller.messages.length;
  const disabled = !runtime.bootstrap || runtime.isBootstrapping || runtime.isUploading;
  const patient = Boolean(workspace.scope.patientId);
  const suggestions = patient ? [
    { key: 'patientSummary', icon: HeartPulse },
    { key: 'patientExams', icon: History },
    { key: 'patientOrders', icon: Wallet },
  ] : [
    { key: 'customReport', icon: FileSpreadsheet, blank: true },
    { key: 'businessHealth', icon: ChartNoAxesCombined },
    { key: 'findRecord', icon: Search, blank: true },
  ];
  const composerScope = `${workspace.scope.userId}:${workspace.scope.clinicId}:${workspace.scope.patientId || 0}:${workspace.jobActivityKey}`;
  const fillSuggestion = (key: string, hasBlank?: boolean) => {
    const blank = hasBlank ? t(`agent.prompt.${key}.blank`) : '';
    const prompt = t(`agent.prompt.${key}.prompt`, { details: blank });
    const start = blank ? prompt.indexOf(blank) : prompt.length;
    composerRef.current?.setText(prompt, { focus: true, selection: { start, end: start + blank.length } });
  };
  const suggestionRows = <div className="agent-workspace__suggestions" aria-label={t('agent.suggestions')}>
      {suggestions.map(({ key, icon: Icon, ...suggestion }) => <button key={key} type="button" disabled={disabled || running}
        className="agent-workspace__suggestion" onClick={() => fillSuggestion(key, 'blank' in suggestion && suggestion.blank)}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{t(`agent.prompt.${key}.label`)}{'blank' in suggestion && suggestion.blank && <>{' '}<span className="agent-workspace__prompt-blank">{t(`agent.prompt.${key}.blank`)}</span></>}</span>
        <ArrowUpRight className="agent-workspace__suggestion-arrow size-3.5 shrink-0" aria-hidden="true" />
      </button>)}
    </div>;
  return <section className={`prysm-agent agent-workspace ${compact ? 'agent-workspace--compact' : ''} ${empty ? 'agent-workspace--empty' : 'agent-workspace--conversation'}`} dir={direction}>
    {!compact && <AgentSky />}
    {compact && <div className="agent-workspace__toolbar ps-12 pe-3">
      <Button size="icon" variant="ghost" aria-label={t('agent.returnInfo')} onClick={workspace.closePatientChat}><ArrowLeft className={`size-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} /></Button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t(workspace.scope.patientId ? 'agent.patientChat' : 'agent.clinicChat')}</span>
      <AgentChatActions compact />
    </div>}
    <div className="agent-workspace__stage">
      {empty && !compact && <div className="agent-workspace__welcome">
        <h1>{t(workspace.scope.patientId ? 'agent.patientWelcome' : 'agent.welcomeTitle')}</h1>
      </div>}
      <StickToBottom className={`agent-workspace__messages min-h-0 flex-1 overflow-hidden ${empty && !compact ? 'hidden' : ''}`} resize="smooth" initial="instant">
      <StickToBottom.Content className="agent-workspace__message-content mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-6 pt-5">
        {controller.hasOlderTurns && <Button variant="ghost" size="sm" onClick={() => void controller.loadOlder()}>{t('agent.more')}</Button>}
        {controller.messages.map(message => <AgentChatMessage key={message.id} message={message} dir={direction} Timeline={ApprovalTimeline}
          contentClassName={compact && message.role === 'user' ? 'bg-canvas' : undefined}
          userMessageShowMoreLabel={t('agent.timeline.message.more')} userMessageShowLessLabel={t('agent.timeline.message.less')}
          streamingMessageId={controller.streamingMessageId} getHitlActionState={runtime.getHitlActionState}
          hitlLabels={{ submitting: t('agent.submission.submitting'), checking: t('agent.submission.checking'),
            uncertain: t('agent.submission.uncertain'), retry: t('agent.submission.retry'), accepted: t('agent.submission.accepted'),
            approved: t('agent.submission.approved'), rejected: t('agent.submission.rejected') }}
          onHitlPaint={durationMs => { if (import.meta.env.DEV) performance.measure('agent.hitl.cardPaint', { start: performance.now() - durationMs, duration: durationMs }); }}
          onHitlAction={(part, answer, options) => { void runtime.onHitlAction(part, answer, options).catch(() => undefined); }}
          attachmentContentResolver={runtime.resolveAttachmentContent} />)}
      </StickToBottom.Content>
      </StickToBottom>
    {empty && compact && suggestionRows}
    <div className="agent-workspace__composer-wrap">
      {!runtime.bootstrap ? <div role="status" aria-live="polite" className="flex items-center gap-2 px-4 pb-2 text-sm text-muted-foreground">
        <span>{t(runtime.isBootstrapping ? 'agent.starting' : 'agent.startupUnavailable')}</span>
        {!runtime.isBootstrapping && <Button variant="ghost" size="sm" onClick={() => void runtime.retryBootstrap().catch(() => undefined)}>{t('agent.retryStartup')}</Button>}
      </div> : runtime.errorMessage && <p role="alert" className="px-4 pb-2 text-xs text-destructive">{t('agent.operationFailed')}</p>}
      <AgentChatComposer key={composerScope} ref={composerRef} scopeKey={composerScope}
        inputContract={runtime.inputContract} disabled={disabled}
        isRunning={running} isCancelling={runtime.state === 'cancelling'}
        placeholder={t('agent.placeholder')} contextWindow={runtime.contextWindow}
        onStop={() => void controller.cancelRun()} onSubmit={message => runtime.submit({ text: message.text,
          files: message.files.map(file => ({ name: file.filename, mediaType: file.mediaType, data: file.source || new Uint8Array() })) })} />
    </div>
    {empty && !compact && suggestionRows}
    </div>
    {empty && !compact && <footer className="agent-workspace__footer">
      <DailyBrief scope={workspace.scope} floating />
    </footer>}
  </section>;
}
