import React from 'react';
import { AgentChatMessage, type AgentChatMessageProps } from '@agents24/chat-react/ui';
import { useTranslation } from 'react-i18next';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { useAgentTranscript } from '@/services/use-agent-transcript';

export function TranscriptMessage(props: AgentChatMessageProps) {
  const workspace = usePrysmAgent();
  const { t } = useTranslation();
  const { message } = props;
  const audio = (message.attachments || []).filter(attachment =>
    String(attachment.mediaType || attachment.contentType || '').startsWith('audio/'));
  const enabled = message.role === 'user' && audio.length > 0;
  const transcript = useAgentTranscript(workspace?.client, message.runId, enabled);
  if (!enabled) return <AgentChatMessage {...props} />;
  const resolved = transcript.status === 'available' ? transcript.entries.filter(entry => audio.some(file => file.id === entry.attachment_id)) : [];
  const ids = new Set(resolved.map(entry => entry.attachment_id));
  const content = [message.content, ...resolved.map(entry => entry.text || t('agent.transcript.empty'))].filter(Boolean).join('\n\n');
  const status = transcript.status === 'available' && resolved.length ? null :
    t(transcript.status === 'pending' ? 'agent.transcript.pending' : 'agent.transcript.unavailable');
  return <AgentChatMessage {...props} message={{ ...message, attachments: message.attachments?.filter(file => !ids.has(file.id || '')) }}
    userMessageContent={content}
    renderUserContent={status ? () => <div className="whitespace-pre-wrap text-start">{content && <p>{content}</p>}
      <p role="status" className="text-sm text-muted-foreground">{status}</p></div> : undefined} />;
}
