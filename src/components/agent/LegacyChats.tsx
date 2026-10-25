import React from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { CustomModal } from '@/components/ui/custom-modal';
import type { Chat, ChatMessage } from '@/lib/db/schema-interface';

export function LegacyChats({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const workspace = usePrysmAgent();
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  React.useEffect(() => {
    setChats([]); setMessages([]);
    if (!workspace?.scope) return;
    apiClient.getChats(workspace.scope.userId, 100, 0).then(result => setChats((result.data || []).filter(chat => chat.clinic_id == null || chat.clinic_id === workspace.scope!.clinicId)));
  }, [workspace?.scope?.userId, workspace?.scope?.clinicId]);
  return <CustomModal isOpen onClose={onClose} title={t('agent.archive')}>
    <p className="mb-3 text-xs text-muted-foreground">{t('agent.archiveReadOnly')}</p>
    <div className="flex max-h-[60vh] gap-4 overflow-auto">
      <div className="w-40 shrink-0">{chats.map(chat => <button key={chat.id} className="block w-full truncate px-2 py-2 text-start text-sm hover:bg-muted"
        onClick={() => chat.id && apiClient.getChatMessages(chat.id).then(result => setMessages(result.data || []))}>{chat.title}</button>)}</div>
      <div className="min-w-0 flex-1 space-y-4">{messages.map(message => <p key={message.id} className="whitespace-pre-wrap break-words text-sm">{message.content}</p>)}</div>
    </div>
  </CustomModal>;
}
