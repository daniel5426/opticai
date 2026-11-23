import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, ChevronDown, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { agentJson, downloadAgentReport, type AgentScope } from '@/services/agent-client';

type Output = Record<string, unknown>;
type Format = 'csv' | 'xlsx';
type Metadata = {
  title?: string;
  status?: string;
  expired?: boolean;
  download_path?: string | null;
  report_version?: number;
  report_format?: Format;
  report_definition?: Output;
};

function DownloadCard({ id, initial, scope }: { id: string; initial: Output; scope: AgentScope }) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['agent-report-attachment', scope.userId, scope.clinicId, scope.patientId, id],
    queryFn: () => agentJson<Metadata>(scope, `/jobs/${id}?metadata_only=true`),
    refetchInterval: query => ['queued', 'running'].includes(query.state.data?.status || '') ? 1500 : false,
    retry: false,
  });
  const title = query.data?.title || String(initial.title || t('agent.report'));
  const downloadPath = query.data && ('download_path' in query.data ? query.data.download_path
    : query.data.status === 'completed' ? `/api/v1/agent/jobs/${id}/download` : null);
  const available = Boolean(downloadPath && !query.data?.expired && !query.isError);
  const version = query.data?.report_version ?? initial.report_version ?? (initial.type === 'legacy_report' || initial.legacy ? 1 : 2);
  const originalFormat = query.data?.report_format ?? initial.format;
  const formats: Format[] = version === 2 ? ['csv', 'xlsx']
    : originalFormat === 'csv' || originalFormat === 'xlsx' ? [originalFormat] : [];
  const download = useMutation({ mutationFn: (path: string) => downloadAgentReport(scope, path) });
  const save = useMutation({
    mutationFn: async () => {
      // An older API supplies the definition through the report page.
      const definition = query.data?.report_definition
        ?? (await agentJson<{ definition?: Output }>(scope, `/reports/${id}/page?limit=1`)).definition;
      if (!definition) throw new Error('agent.operationFailed');
      return agentJson(scope, '/saved-reports', {
        method: 'POST',
        body: JSON.stringify({ action: 'save', title, definition }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-saved-reports', scope.userId, scope.clinicId, scope.patientId] });
    },
  });
  const downloadLabel = t('agent.data.downloadNamed', { name: title });
  const saveLabel = t(save.isSuccess ? 'agent.data.saved' : 'agent.data.save');
  const downloadButton = <Button type="button" variant="ghost" size="icon"
    className={formats.length ? 'h-9 w-11 shrink-0' : 'size-9 shrink-0'} disabled={!available || download.isPending}
    aria-label={downloadLabel} title={available ? downloadLabel : t('agent.downloadUnavailable')}
    onClick={formats.length ? undefined : () => { if (downloadPath) download.mutate(downloadPath); }}>
    <Download className="size-4" aria-hidden="true" />
    {formats.length > 0 && <ChevronDown className="size-3" aria-hidden="true" />}
  </Button>;

  const state = query.data?.status || initial.status;
  const status = query.data?.expired || initial.expired ? 'expired' : query.isError ? 'failed'
    : state === 'queued' || state === 'running' || state === 'failed' || state === 'cancelled' ? state : null;
  return <div className="min-w-0 rounded-lg bg-card px-1.5" data-report-attachment>
    <div className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 flex-1 truncate ps-1 text-sm font-medium" title={title}>{title}</span>
      {status && <span role="status" className="shrink-0 px-2 text-xs text-muted-foreground">{t(`agent.job.${status}`)}</span>}
      {version === 2 && <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0"
        disabled={!available || save.isPending || save.isSuccess} aria-label={saveLabel} title={saveLabel}
        onClick={() => save.mutate()}>
        {save.isSuccess ? <BookmarkCheck className="size-4" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}
      </Button>}
      {formats.length ? <DropdownMenu dir={direction} modal={false}>
        <DropdownMenuTrigger asChild>{downloadButton}</DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {formats.map(format => <DropdownMenuItem key={format} onSelect={() => {
            if (downloadPath) download.mutate(version === 2 ? `/api/v1/agent/reports/${id}/export?format=${format}` : downloadPath);
          }}><bdi>{t(`agent.data.exportFormat.${format}`)}</bdi></DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu> : downloadButton}
    </div>
    {save.isSuccess && <span role="status" className="sr-only">{saveLabel}</span>}
    {(download.isError || save.isError) && <p role="alert" className="px-1 text-xs text-destructive">
      {t(download.isError ? 'agent.downloadUnavailable' : 'agent.operationFailed')}
    </p>}
  </div>;
}

export function MessageReportResults({ reports }: { reports: Output[] }) {
  const workspace = usePrysmAgent();
  const { t } = useTranslation();
  if (!reports.length) return null;
  return <div className="@container min-w-0 pt-2" data-agent-response-reports>
    <div className="grid min-w-0 grid-cols-1 gap-1" aria-label={t('agent.data.reportAttachments')}>
      {reports.map(output => workspace?.scope ? <DownloadCard key={String(output.job_id)} id={String(output.job_id)} initial={output} scope={workspace.scope} />
        : <div key={String(output.job_id)} className="min-w-0 rounded-xl border border-border/50 p-3"><span className="truncate text-sm">{String(output.title || t('agent.report'))}</span></div>)}
    </div>
  </div>;
}
