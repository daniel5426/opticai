import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { agentJson, type AgentJobActivity, type AgentScope } from '@/services/agent-client';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { Button } from '@/components/ui/button';
import { AgentJobActions, activeJob, expiredJob } from './AgentJobActions';

export function AgentResults({ scope }: { scope: AgentScope }) {
  const workspace = usePrysmAgent();
  return <Activity key={`${scope.userId}:${scope.clinicId}:${scope.patientId || 0}:${workspace?.jobActivityKey || 0}`} scope={scope} />;
}

function Activity({ scope }: { scope: AgentScope }) {
  const { t } = useTranslation();
  const workspace = usePrysmAgent();
  const queryClient = useQueryClient();
  const running = Boolean(workspace?.runtime?.controller.activeRunId);
  const [viewId] = React.useState(() => crypto.randomUUID());
  const since = React.useRef<string | null>(null);
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set());
  const [error, setError] = React.useState(false);
  const activity = useQuery({ queryKey: ['agent-jobs', 'activity', scope.userId, scope.clinicId, scope.patientId || 0, viewId],
    queryFn: async () => {
      const result = await agentJson<AgentJobActivity>(scope, `/jobs/activity${since.current ? `?since=${encodeURIComponent(since.current)}` : ''}`);
      since.current = result.since;
      return result;
    },
    refetchInterval: query => running || query.state.data?.items.some(activeJob) ? 3000 : false });
  const data = activity.data?.items || [];
  const wasRunning = React.useRef(running);
  React.useEffect(() => {
    if (wasRunning.current && !running) void queryClient.invalidateQueries({ queryKey: ['agent-jobs'] });
    wasRunning.current = running;
  }, [running, queryClient]);
  const signature = data.map(job => `${job.id}:${job.status}`).join('|');
  React.useEffect(() => { void queryClient.invalidateQueries({ queryKey: ['agent-jobs', 'history'] }); }, [signature, queryClient]);
  const visible = data.filter(job => !dismissed.has(job.id) && !expiredJob(job));
  if (!visible.length) return null;
  return <div className="agent-results">
    <div className="agent-results__rail" role="region" aria-label={t('agent.results')} tabIndex={0}>
      <ul className="agent-results__list">
        {visible.map(job => <li key={job.id} className="agent-results__card">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {activeJob(job) ? <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="size-3 shrink-0" aria-hidden="true" />}
            <span className="min-w-0 flex-1 truncate" title={job.title || t('agent.report')}>{job.title || t('agent.report')}</span>
            <span className="shrink-0 text-muted-foreground">{t(`agent.job.${job.status}`)}</span>
          </div>
          <AgentJobActions job={job} scope={scope} onError={() => setError(true)} />
          <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={t('agent.dismissJob')} title={t('agent.dismissJob')}
            onClick={() => setDismissed(previous => new Set([...previous, job.id]))}><X className="size-3.5" /></Button>
        </li>)}
      </ul>
    </div>
    {error && <p role="alert" className="mt-1 text-xs text-destructive">{t('agent.operationFailed')}</p>}
  </div>;
}
