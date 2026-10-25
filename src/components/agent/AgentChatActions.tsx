import React from 'react';
import { Building2, History, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LegacyChats } from './LegacyChats';
import { AgentReportHistory } from './AgentReportHistory';
import { SavedReports } from './SavedReports';
import './agent-workspace.css';

export function AgentChatActions({ compact = false }: { compact?: boolean }) {
  const workspace = usePrysmAgent();
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const [history, setHistory] = React.useState(false);
  const [archive, setArchive] = React.useState(false);
  React.useEffect(() => { setArchive(false); setHistory(false); }, [workspace?.scope?.userId, workspace?.scope?.clinicId]);
  const runtime = workspace?.runtime;
  if (!runtime || !workspace?.scope) return null;
  const controller = runtime.controller;

  return <div className={`agent-chat-actions ${compact ? 'agent-chat-actions--compact' : ''}`} dir={direction}>
    {workspace.scope.patientId && !compact && <Button size="icon" variant="ghost" className="agent-chat-actions__button" aria-label={t('agent.clinicChat')} onClick={workspace.openClinicChat}><Building2 className="size-4" /></Button>}
    <AgentReportHistory scope={workspace.scope} compact={compact} />
    <SavedReports compact={compact} />
    <Popover open={history} onOpenChange={setHistory}>
      <PopoverTrigger asChild><Button size={compact ? 'icon' : 'sm'} variant="ghost" className="agent-chat-actions__button" aria-label={t('agent.history')}>
        {!compact && <span className="hidden md:inline">{t('agent.history')}</span>}<History className="size-4" />
      </Button></PopoverTrigger>
      <PopoverContent dir={direction} align="end" className="w-80 max-w-[calc(100vw-2rem)] p-2">
        <p className="px-2 py-2 text-xs font-medium text-muted-foreground">{t('agent.history')}</p>
        <div className="max-h-64 overflow-y-auto">
          {!controller.threads.length && <p className="px-2 py-3 text-sm text-muted-foreground">{t('agent.noConversations')}</p>}
          {controller.threads.map(thread => <button key={thread.id} className="block w-full truncate rounded-md px-2 py-2 text-start text-sm hover:bg-muted focus-visible:outline focus-visible:outline-ring" onClick={async () => { await runtime.openThread(thread.id); workspace.resetJobActivity(); setHistory(false); }}>{thread.title || t('agent.newChat')}</button>)}
          {controller.hasMoreThreads && <Button variant="ghost" size="sm" onClick={() => void controller.loadMoreThreads()}>{t('agent.more')}</Button>}
        </div>
        <Button className="mt-1 w-full justify-start" variant="ghost" size="sm" onClick={() => { setHistory(false); setArchive(true); }}>{t('agent.archive')}</Button>
      </PopoverContent>
    </Popover>
    <Button size={compact ? 'icon' : 'sm'} variant="ghost" className="agent-chat-actions__button" aria-label={t('agent.newChat')} disabled={Boolean(controller.activeRunId)} onClick={async () => { await runtime.newThread(); workspace.resetJobActivity(); }}>
      {!compact && <span className="hidden md:inline">{t('agent.newChat')}</span>}<Plus className="size-4" />
    </Button>
    {archive && <LegacyChats onClose={() => setArchive(false)} />}
  </div>;
}
