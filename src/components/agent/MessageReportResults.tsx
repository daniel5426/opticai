import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { agentJson, downloadAgentReport, type AgentScope } from '@/services/agent-client';
const AgentDataResults = React.lazy(() => import('./AgentDataResults').then(module => ({ default: module.AgentDataResults })));
type Output = Record<string, unknown>;
type Metadata = { title?: string; status?: string; expired?: boolean; download_path?: string | null };

function DownloadCard({ id, initial, scope }: { id: string; initial: Output; scope: AgentScope }) {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);
  const query = useQuery({ queryKey: ['agent-report-attachment', scope.userId, scope.clinicId, scope.patientId, id],
    queryFn: () => agentJson<Metadata>(scope, `/jobs/${id}?metadata_only=true`),
    refetchInterval: query => ['queued', 'running'].includes(query.state.data?.status || '') ? 1500 : false, retry: false });
  const title = query.data?.title || String(initial.title || t('agent.report'));
  const downloadPath = query.data && ('download_path' in query.data ? query.data.download_path
    : query.data.status === 'completed' ? `/api/v1/agent/jobs/${id}/download` : null);
  const available = Boolean(downloadPath && !query.data?.expired && !query.isError);
  return <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-card p-3 shadow-sm" data-report-attachment>
    <span className="min-w-0 flex-1 truncate text-sm font-medium" title={title}>{title}</span>
    <Button variant="ghost" size="icon" className="size-9 shrink-0" disabled={!available}
      aria-label={t('agent.data.downloadNamed', { name: title })} title={t(failed || query.isError || query.data?.expired ? 'agent.downloadUnavailable' : 'agent.download')}
      onClick={async () => { try { await downloadAgentReport(scope, downloadPath!); setFailed(false); } catch { setFailed(true); } }}>
      <Download className="size-4" aria-hidden="true" />
    </Button>
    {failed && <span role="alert" className="sr-only">{t('agent.downloadUnavailable')}</span>}
  </div>;
}

export function MessageReportResults({ reports }: { reports: Output[] }) {
  const workspace = usePrysmAgent();
  const { t } = useTranslation();
  if (!reports.length) return null;
  return <div className="min-w-0 space-y-4 pt-2" data-agent-response-reports>
    {workspace?.scope && reports.filter(output => output.type !== 'legacy_report').map(output => <React.Suspense key={String(output.job_id)} fallback={null}>
      <AgentDataResults output={output} embedded />
    </React.Suspense>)}
    <div className="grid min-w-0 grid-cols-2 gap-2" aria-label={t('agent.data.reportAttachments')}>
      {reports.map(output => workspace?.scope ? <DownloadCard key={String(output.job_id)} id={String(output.job_id)} initial={output} scope={workspace.scope} />
        : <div key={String(output.job_id)} className="min-w-0 rounded-xl border border-border/50 p-3"><span className="truncate text-sm">{String(output.title || t('agent.report'))}</span></div>)}
    </div>
  </div>;
}
