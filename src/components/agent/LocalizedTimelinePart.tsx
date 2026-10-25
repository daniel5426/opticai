import React from 'react';
import { AgentResponseTimeline, type AgentChatTimelineSlotProps } from '@agents24/chat-react/ui';
import type { ChatPart } from '@agents24/react';
import { useAppLocale } from '@/localization/use-app-locale';
import { useTimelineLabels } from './timeline-labels';
import { LocalizedHitl } from './LocalizedHitl';
import { toolPresentationRegistry } from './tool-presentation';
import { TimelineCode } from './TimelineCode';

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function LocalizedTimelinePart({ part, ...props }: AgentChatTimelineSlotProps & { part: ChatPart }) {
  const { t } = useTimelineLabels();
  const { direction } = useAppLocale();
  if (part.kind === 'hitl') return <LocalizedHitl {...props} part={part} isLoading={false} />;
  if (part.kind === 'context-compression') return <p dir={direction} role="status" className={`py-2 text-xs ${part.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{t(`agent.timeline.context.${part.status}`)}</p>;
  if (part.kind === 'error') return <p dir={direction} role="alert" className="text-sm text-destructive">{t('agent.operationFailed')}</p>;
  if (part.kind === 'node-activity') {
    const mode = props.nodeActivityMode || 'default';
    if (mode === 'hidden' || (mode === 'default' && !part.defaultChatVisible)) return null;
    return <p dir={direction} role="status" className={`py-2 text-xs ${part.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{t(`agent.timeline.node.${part.status}`)}</p>;
  }
  if (part.kind === 'reasoning') {
    // Tool trace notes duplicate the app's localized tool activity, rather than agent-authored prose.
    const tool = part.label?.replace(/^artifact__prysm_clinic_tools_/, '');
    if (part.label && (/^(artifact|runtime)__/.test(part.label) || (tool && Object.hasOwn(toolPresentationRegistry, tool)))) return null;
    const value = part.text || part.label;
    const generic = !value || /^(thinking|working|planning next moves|reasoning|processing)(?:\.{3}|…)?$/i.test(value.trim());
    return <p dir={direction} className="py-2 text-sm text-muted-foreground">{generic ? t('agent.timeline.reasoning') : value}</p>;
  }
  let translated = part;
  if (part.kind === 'citation' && !part.label) translated = { ...part, label: t('agent.timeline.citation') };
  if (part.kind === 'attachment' && !part.attachment.filename) translated = { ...part, attachment: { ...part.attachment, filename: t('agent.timeline.attachment') } };
  if (part.kind === 'ui-blocks') {
    if (part.state === 'output-error') return <p role="alert" className="text-sm text-destructive">{t('agent.timeline.ui.failed')}</p>;
    if (!part.bundle) return <p role="status" className="text-sm text-muted-foreground">{t(`agent.timeline.ui.${part.state === 'input-streaming' || part.state === 'input-available' ? 'running' : 'done'}`)}</p>;
    translated = { ...part, bundle: { ...part.bundle, title: typeof part.bundle.title === 'string' ? part.bundle.title : t('agent.timeline.ui.results'),
      rows: Array.isArray(part.bundle.rows) ? part.bundle.rows.map(raw => {
        const row = object(raw);
        return { ...row, blocks: Array.isArray(row.blocks) ? row.blocks.map(rawBlock => {
          const block = object(rawBlock);
          return { ...block, title: typeof block.title === 'string' ? block.title : t('agent.timeline.ui.result') };
        }) : [] };
      }) : [],
    } };
  }
  // Subset rendering must never use the SDK's whole-message fallback.
  return <AgentResponseTimeline {...props} message={{ ...props.message, content: '' }} parts={[translated]}
    responseProps={{ ...props.responseProps, controls: false, components: { ...props.responseProps?.components, code: TimelineCode } }} />;
}
