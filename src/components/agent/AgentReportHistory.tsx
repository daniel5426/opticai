import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppLocale } from '@/localization/use-app-locale';
import { agentJson, type AgentJobHistory, type AgentScope } from '@/services/agent-client';
import { AgentJobActions, activeJob, expiredJob } from './AgentJobActions';

export function AgentReportHistory({ scope, compact }: { scope: AgentScope; compact: boolean }) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [scope.userId, scope.clinicId, scope.patientId]);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button size={compact ? 'icon' : 'sm'} variant="ghost" className="agent-chat-actions__button" aria-label={t('agent.reportHistory')}>
      {!compact && <span className="hidden xl:inline">{t('agent.reportHistory')}</span>}<FileSpreadsheet className="size-4" />
    </Button></PopoverTrigger>
    <PopoverContent dir={direction} align="end" className="w-[min(30rem,calc(100vw-2rem))] p-3">
      {open && <HistoryList key={`${scope.userId}:${scope.clinicId}:${scope.patientId || 0}`} scope={scope} />}
    </PopoverContent>
  </Popover>;
}

function HistoryList({ scope }: { scope: AgentScope }) {
  const { t } = useTranslation();
  const { locale, direction } = useAppLocale();
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [actionError, setActionError] = React.useState(false);
  const searchId = React.useId();
  React.useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const jobs = useInfiniteQuery({
    queryKey: ['agent-jobs', 'history', scope.userId, scope.clinicId, scope.patientId || 0, query],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20', q: query });
      if (pageParam) params.set('cursor', pageParam);
      return agentJson<AgentJobHistory>(scope, `/jobs/history?${params}`);
    },
    getNextPageParam: page => page.next_cursor || undefined,
    refetchInterval: false,
  });
  const seen = new Set<string>();
  const items = jobs.data?.pages.flatMap(page => page.items).filter(job => {
    if (seen.has(job.id)) return false;
    seen.add(job.id); return true;
  }) || [];
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  return <div className="flex min-h-0 flex-col gap-3">
    <p className="text-sm font-medium">{t('agent.reportHistory')}</p>
    <label htmlFor={searchId} className="sr-only">{t('agent.searchReports')}</label>
    <Input id={searchId} dir={direction} type="search" value={search} maxLength={200} placeholder={t('agent.searchReports')} onChange={event => setSearch(event.target.value)} />
    <p className="text-xs text-muted-foreground">{t('agent.reportRetention')}</p>
    <div className="max-h-[min(55vh,26rem)] overflow-y-auto">
      {jobs.isPending && <p role="status" className="py-4 text-center text-sm text-muted-foreground">{t('loading')}</p>}
      {!jobs.isPending && !jobs.isError && !items.length && <p role="status" className="py-4 text-center text-sm text-muted-foreground">{t('agent.noReports')}</p>}
      <ul className="space-y-1">
        {items.map(job => <li key={job.id} className="flex items-center gap-3 rounded-md px-2 py-3 hover:bg-muted/40">
          {activeJob(job) && !expiredJob(job) ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm" title={job.title || t('agent.report')}>{job.title || t('agent.report')}</p>
            <p className="mt-1 text-xs text-muted-foreground"><time dateTime={job.created_at}>{date(job.created_at)}</time>{!expiredJob(job) && <> · {t(`agent.job.${job.status}`)}</>}</p>
          </div>
          <AgentJobActions job={job} scope={scope} onError={() => setActionError(true)} />
        </li>)}
      </ul>
      {jobs.hasNextPage && <Button variant="ghost" className="mt-2 w-full" disabled={jobs.isFetchingNextPage} onClick={() => void jobs.fetchNextPage()}>{t('agent.more')}</Button>}
      {jobs.isError && <div role="alert" className="py-3 text-sm text-destructive">{t('agent.operationFailed')}<Button variant="ghost" size="sm" onClick={() => void jobs.refetch()}>{t('agent.retry')}</Button></div>}
    </div>
    {actionError && <p role="alert" className="text-xs text-destructive">{t('agent.operationFailed')}</p>}
  </div>;
}
