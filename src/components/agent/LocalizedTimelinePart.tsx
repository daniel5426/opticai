import React from 'react';
import type { AgentChatTimelineSlotProps } from '@agents24/chat-react/ui';
import type { ChatPart } from '@agents24/react';
import type { TFunction } from 'i18next';
import { useAppLocale } from '@/localization/use-app-locale';
import { useTimelineLabels } from './timeline-labels';
import { LocalizedHitl } from './LocalizedHitl';

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function localizeTimelinePart(part: ChatPart, t: TFunction): ChatPart {
  if (part.kind === 'reasoning') {
    const value = part.text || part.label;
    if (!value || /^(thinking|working|planning next moves|reasoning|processing)(?:\.{3}|…)?$/i.test(value.trim())) {
      return { ...part, text: t('agent.timeline.reasoning') };
    }
  }
  if (part.kind === 'citation' && !part.label) return { ...part, label: t('agent.timeline.citation') };
  if (part.kind === 'attachment' && !part.attachment.filename) return { ...part, attachment: { ...part.attachment, filename: t('agent.timeline.attachment') } };
  if (part.kind === 'ui-blocks' && part.bundle) {
    return { ...part, bundle: { ...part.bundle, title: typeof part.bundle.title === 'string' ? part.bundle.title : t('agent.timeline.ui.results'),
      rows: Array.isArray(part.bundle.rows) ? part.bundle.rows.map(raw => {
        const row = object(raw);
        return { ...row, blocks: Array.isArray(row.blocks) ? row.blocks.map(rawBlock => {
          const block = object(rawBlock);
          return { ...block, title: typeof block.title === 'string' ? block.title : t('agent.timeline.ui.result') };
        }) : [] };
      }) : [],
    } };
  }
  return part;
}
export function LocalizedTimelinePart({ part, ...props }: AgentChatTimelineSlotProps & { part: ChatPart }) {
  const { t } = useTimelineLabels();
  const { direction } = useAppLocale();
  if (part.kind === 'hitl') return <LocalizedHitl {...props} part={part} isLoading={false} />;
  if (part.kind === 'context-compression') return <p dir={direction} role="status" className={`py-2 text-xs ${part.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{t(`agent.timeline.context.${part.status}`)}</p>;
  if (part.kind === 'error') {
    const failure = part.failure;
    const label = failure?.code !== 'MODEL_INVOCATION_FAILED'
      ? 'agent.operationFailed'
      : failure.retryable ? 'agent.timeline.modelFailedRetry' : 'agent.timeline.modelFailed';
    return <p dir={direction} role="alert" className="text-sm text-destructive">{t(label)}</p>;
  }
  if (part.kind === 'node-activity') return <p dir={direction} role="status" className={`py-2 text-xs ${part.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{t(`agent.timeline.node.${part.status}`)}</p>;
  if (part.kind === 'ui-blocks') {
    if (part.state === 'output-error') return <p role="alert" className="text-sm text-destructive">{t('agent.timeline.ui.failed')}</p>;
    return <p role="status" className="text-sm text-muted-foreground">{t(`agent.timeline.ui.${part.state === 'input-streaming' || part.state === 'input-available' ? 'running' : 'done'}`)}</p>;
  }
  return null;
}
