import React from 'react';
import { partitionAgentChatToolTimeline, type AgentChatTimelineSlotProps } from '@agents24/chat-react/ui';
import type { ChatToolPart } from '@agents24/react';
import { Check, ChevronDown, CircleAlert, CircleMinus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '@/localization/use-app-locale';
import { LocalizedTimelinePart } from './LocalizedTimelinePart';
import { presentTool, type ActivityStatus } from './tool-presentation';
const AgentDataResults = React.lazy(() => import('./AgentDataResults').then(module => ({ default: module.AgentDataResults })));

function StatusIcon({ status }: { status: ActivityStatus }) {
  const Icon = status === 'running' ? Loader2 : status === 'failed' ? CircleAlert : status === 'cancelled' ? CircleMinus : Check;
  return <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${status === 'running' ? 'animate-spin motion-reduce:animate-none' : ''} ${status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`} />;
}
export function ToolActivityGroup({ parts }: { parts: readonly ChatToolPart[] }) {
  const { t } = useTranslation();
  const { locale, direction } = useAppLocale();
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const steps = parts.map(part => presentTool(part, t, locale));
  const current = steps.findLast(step => step.status === 'running') || steps.findLast(step => step.meaningful) || steps[steps.length - 1];
  const failed = steps.some(step => step.status === 'failed');
  const cancelled = steps.some(step => step.status === 'cancelled');
  const issue = failed && cancelled ? 'both' : failed ? 'failed' : cancelled ? 'cancelled' : null;
  return <div dir={direction} className="min-w-0 text-xs text-muted-foreground">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
      className="flex min-h-9 max-w-full items-center gap-2 rounded-md px-1 py-2 text-start hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <StatusIcon status={current.status === 'running' ? 'running' : failed ? 'failed' : cancelled ? 'cancelled' : 'completed'} />
      <span className="min-w-0 break-words" aria-live="polite">{current.label}{issue && ` · ${t(`agent.activity.group.${issue}`)}`}</span>
      <ChevronDown aria-hidden="true" className={`size-3.5 shrink-0 ${open ? 'rotate-180' : ''}`} />
      <span className="sr-only">{t(`agent.activity.${open ? 'collapse' : 'expand'}`)}</span>
    </button>
    <ol id={id} hidden={!open} className="ms-2 space-y-3 border-s border-border py-2 ps-4">
      {steps.map((step, index) => <li key={parts[index].id} className="flex items-start gap-2">
        <span className="mt-0.5"><StatusIcon status={step.status} /></span>
        <div className="min-w-0"><p className="break-words text-foreground/80">{step.label}<span className="sr-only">{` · ${t(`agent.activity.status.${step.status}`)}`}</span></p>
          {step.detail && <p className="mt-0.5 truncate">{step.detail}</p>}
        </div>
      </li>)}
    </ol>
  </div>;
}

export function ToolActivityTimeline(props: AgentChatTimelineSlotProps) {
  const { t } = useTranslation();
  // The SDK owns partitioning. Keep its internal ask-user invocation hidden; its approval/input card renders separately.
  const parts = props.parts.filter(part => part.kind !== 'tool' || ![part.toolName, part.toolKey, part.action].some(value => value?.trim().toLowerCase() === 'runtime__ask_user'));
  const segments = partitionAgentChatToolTimeline(parts, 'closed');
  const loading = props.isLoading && !props.message.responseCompletion;
  return <>{segments.map((segment, index) => {
    if (segment.kind !== 'part') {
      const tools = segment.kind === 'tool-session' ? segment.parts : [segment.part];
      return <React.Fragment key={tools[0].id}><ToolActivityGroup parts={tools} />
        {tools.filter(tool => tool.state === 'output-available' && tool.output && typeof tool.output === 'object' &&
          ['record_search', 'prescription_search', 'document_search'].includes(String((tool.output as Record<string, unknown>).type)))
          .map(tool => <React.Suspense key={tool.id} fallback={null}><AgentDataResults output={tool.output} /></React.Suspense>)}
      </React.Fragment>;
    }
    if (segment.part.kind === 'model-turn') return loading && index === segments.length - 1 && segment.part.status === 'running' && segment.part.turnKind === 'agent'
      ? <p key={segment.part.id} className="py-2 text-xs text-muted-foreground">{t('agent.activity.planning')}</p> : null;
    // A filtered individual part must not trigger the SDK's whole-message or thinking fallback.
    // Only the final text segment can still be streaming; earlier text stays settled.
    return <LocalizedTimelinePart key={segment.part.id} {...props} part={segment.part}
      message={{ ...props.message, content: '' }}
      isLoading={Boolean(loading && index === segments.length - 1 && segment.part.kind === 'text')}
      parts={[segment.part]} />;
  })}</>;
}
