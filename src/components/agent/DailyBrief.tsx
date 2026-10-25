import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Users, Package, Wallet, ListChecks, Boxes, ChevronDown, ArrowUpRight, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { agentJson, type AgentScope, type DailyBrief as Brief } from '@/services/agent-client';
import { getActiveLocale } from '@/localization/locale';
import { Link } from '@tanstack/react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppLocale } from '@/localization/use-app-locale';

const icons = { appointments: CalendarDays, patients: Users, orders: Package, balances: Wallet, followups: ListChecks, inventory: Boxes };
export function DailyBrief({ scope, floating = false }: { scope: AgentScope; floating?: boolean }) {
  const { t, i18n } = useTranslation();
  const { direction } = useAppLocale();
  const { data, isError, refetch } = useQuery({ queryKey: ['agent-brief', scope.userId, scope.clinicId, i18n.language],
    queryFn: () => agentJson<Brief>(scope, `/brief?locale=${getActiveLocale()}`), refetchInterval: 30_000 });
  const content = <div className="mx-auto w-full max-w-xl px-2 py-4">
    <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('agent.dailyBrief')}</p>
    <h2 className="mb-8 text-center text-2xl font-medium tracking-tight">{data?.brief?.greeting || t('agent.clinicDay')}</h2>
    {data?.brief ? <ul className="space-y-5">{data.brief.items.map((item, index) => {
      const Icon = icons[item.category as keyof typeof icons] || ListChecks;
      return <li key={index} className="flex items-start gap-3">
        <Icon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <details className="min-w-0 flex-1">
          <summary className="flex cursor-pointer list-none items-start gap-2 text-sm font-medium">{item.title}<ChevronDown className="mt-0.5 size-3 shrink-0 text-muted-foreground" /></summary>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{item.sources.filter(source => /^\/clients\/\d+/.test(source.path)).map((source, i) =>
            <Link key={i} to={source.path as never} className="text-xs text-primary underline underline-offset-4">{t('agent.openRecord')} {source.id}</Link>)}</div>
        </details>
      </li>;
    })}</ul> : <p role="status" className="text-center text-sm text-muted-foreground">{t(isError || data?.status === 'failed' ? 'agent.briefUnavailable' : 'agent.briefPending')}
      {data?.status === 'failed' && <Button variant="ghost" size="sm" onClick={() => void agentJson(scope, `/brief/retry?locale=${getActiveLocale()}`, { method: 'POST' }).then(() => refetch()).catch(() => {})}>{t('agent.retry')}</Button>}</p>}
    {data?.date && <p className="mt-8 text-center text-xs text-muted-foreground"><bdi>{data.date}</bdi> · {t('agent.dailyTime')}</p>}
  </div>;
  if (!floating) return content;
  return <Popover>
    <PopoverTrigger asChild><Button variant="ghost" className="agent-workspace__brief-trigger">
      <Sun className="size-4" aria-hidden="true" /><span>{t('agent.clinicDay')}</span>
      <span className="agent-workspace__brief-separator" aria-hidden="true" />
      <span className="text-xs font-normal">{t('agent.dailyBrief')}</span><ArrowUpRight className="size-3.5" aria-hidden="true" />
    </Button></PopoverTrigger>
    <PopoverContent dir={direction} side="top" align="center" sideOffset={12} className="max-h-[min(60vh,32rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl p-4">
      {content}
    </PopoverContent>
  </Popover>;
}
