import React from 'react';
import { Download, FileDown, FileSearch, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { agentJson, downloadAgentReport, type AgentJobSummary, type AgentScope } from '@/services/agent-client';

export const activeJob = (job: Pick<AgentJobSummary, 'status'>) => ['uploading', 'queued', 'running'].includes(job.status);
export const expiredJob = (job: AgentJobSummary) => job.expired || Boolean(job.expires_at && Date.parse(job.expires_at) <= Date.now());

export function AgentJobActions({ job, scope, onError }: { job: AgentJobSummary; scope: AgentScope; onError: () => void }) {
  const { t } = useTranslation();
  const workspace = usePrysmAgent();
  const queryClient = useQueryClient();
  const expired = expiredJob(job);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['agent-jobs'] });
  const download = async (path: string) => {
    try { await downloadAgentReport(scope, path); }
    catch { onError(); void refresh(); }
  };
  if (expired) return <span className="text-xs text-muted-foreground">{t('agent.job.expired')}</span>;
  return <div className="agent-results__actions">
    {job.can_analyze && <Button variant="ghost" size="icon" className="size-7" disabled={!workspace?.runtime || Boolean(workspace.runtime.controller.activeRunId)}
      aria-label={t('agent.analyzeDocument')} title={t('agent.analyzeDocument')} onClick={() => void workspace?.runtime?.submit({ text: t('agent.analyzeDocumentPrompt', { id: job.id }), files: [] })}><FileSearch className="size-3.5" /></Button>}
    {activeJob(job) && <Button variant="ghost" size="icon" className="size-7" aria-label={t('agent.cancel')} title={t('agent.cancel')} onClick={async () => {
      try { await agentJson(scope, `/jobs/${job.id}/cancel`, { method: 'POST' }); await refresh(); } catch { onError(); }
    }}><Square className="size-3" /></Button>}
    {job.original_path && <Button variant="ghost" size="icon" className="size-7" aria-label={t('agent.original')} title={`${t('agent.original')} · ${t('agent.originalRetention')}`} onClick={() => void download(job.original_path!)}><FileDown className="size-3.5" /></Button>}
    {job.download_path && <Button variant="ghost" size="icon" className="size-7" aria-label={t('agent.download')} title={t('agent.download')} onClick={() => void download(job.download_path!)}><Download className="size-3" /></Button>}
  </div>;
}
