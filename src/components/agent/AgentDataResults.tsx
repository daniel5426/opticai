import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bookmark, Download, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { agentJson, downloadAgentReport } from '@/services/agent-client';
import { AgentLink } from './AgentLinks';
import { ReportChart, type ReportChartData } from './ReportChart';

type Row = Record<string, unknown>;
type Source = { path?: string };
type Match = { source_date?: string; component_key?: string; distance?: number; source?: Source;
  eyes?: Record<string, { values?: Row; differences?: Record<string, { requested: unknown; recorded: unknown; difference: number }> }> };
type Result = { type?: string; title?: string; show_table?: boolean; show_stats?: boolean; items?: Row[]; total?: number; next_offset?: number | null; index_ready?: boolean;
  columns?: string[]; column_labels?: Record<string, string>; rows?: Row[]; job_id?: string; definition?: Row; status?: string; exports?: Record<string, string>;
  charts?: ReportChartData[];
  metrics?: { key: string; currency?: string | null; current: number | null; previous?: number | null; change_percent?: number | null }[];
  period?: { start: string; end: string }; comparison?: { start: string; end: string; total: number; rows: Row[] }; definitions?: Row; limitations?: string[]; coverage?: Row };
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};

function useColumnLabel() {
  const { t } = useTranslation();
  return (column: string) => {
    const [, aggregate, field] = column.match(/^(sum|avg|min|max|count_distinct|count)_(.*)$/) || [];
    const key = (field || column).split('.').at(-1)!;
    const label = t(`agent.column.${key}`, { defaultValue: t('agent.column.value') });
    return aggregate ? t(`agent.aggregate.${aggregate}`, { field: label }) : label;
  };
}

function valueText(value: unknown, locale: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'object') return '—';
  return String(value);
}

function ResultTable({ columns, rows, labels = {} }: { columns: string[]; rows: Row[]; labels?: Record<string, string> }) {
  const label = useColumnLabel();
  const { locale } = useAppLocale();
  const { t } = useTranslation();
  return <div className="max-w-full overflow-x-auto rounded-xl border border-border/50 bg-card shadow-sm">
    <Table><TableHeader><TableRow>{columns.map(column => <TableHead key={column} className="whitespace-nowrap text-start" title={column}>{labels[column] || label(column)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.length ? rows.map((row, index) => <TableRow key={index}>{columns.map(column => <TableCell key={column} className="max-w-64 text-start">
        <bdi className="line-clamp-3">{valueText(row[column], locale)}</bdi>
      </TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={Math.max(1, columns.length)} className="text-center text-muted-foreground">{t('agent.data.noResults')}</TableCell></TableRow>}</TableBody></Table>
  </div>;
}

function DefinitionSummary({ definition, definitions }: { definition: Row; definitions?: Row }) {
  const { t } = useTranslation();
  const label = useColumnLabel();
  const condition = (value: unknown, depth = 0): string => {
    const row = object(value);
    if (depth > 5) return '';
    if (Array.isArray(row.conditions)) {
      const joined = row.conditions.map(item => condition(item, depth + 1)).join(` ${t(row.match === 'any' ? 'agent.data.or' : 'agent.data.and')} `);
      return row.relation ? `${t(`agent.dataset.${String(row.relation)}`)} (${joined})` : `(${joined})`;
    }
    return row.field ? `${label(String(row.field))} ${t(`agent.operator.${String(row.operator)}`)} ${Array.isArray(row.value) ? row.value.join(', ') : row.value == null ? '' : String(row.value)}` : '';
  };
  return <div className="mt-2 space-y-2">
    <p>{t(`agent.dataset.${String(definition.dataset)}`, { defaultValue: t('agent.report') })}</p>
    {Array.isArray(definition.columns) && definition.columns.length > 0 && <p>{definition.columns.map(column => label(String(column))).join(' · ')}</p>}
    {Array.isArray(definition.filters) && definition.filters.length > 0 && <p>{definition.filters.map(item => condition(item)).join(` ${t(definition.match === 'any' ? 'agent.data.or' : 'agent.data.and')} `)}</p>}
    {Boolean(definition.where) && <p>{condition(definition.where)}</p>}
    {Boolean(definition.start_date && definition.end_date) && <p><bdi>{String(definition.start_date)}</bdi> – <bdi>{String(definition.end_date)}</bdi></p>}
    {Object.keys(definitions || {}).map(key => <p key={key}>{t(`agent.metricDefinition.${key}`)}</p>)}
  </div>;
}

function PrescriptionResults({ result }: { result: Result }) {
  const { t } = useTranslation();
  const { locale } = useAppLocale();
  return <div className="space-y-3">
    {!result.index_ready && <p role="status" className="text-xs text-muted-foreground">{t('agent.data.incompleteIndex')}</p>}
    <p className="text-xs text-muted-foreground">{t('agent.data.closestExplanation')}</p>
    {result.items?.map(patient => <details key={String(patient.client_id)} className="rounded-xl border border-border/50 bg-card p-3 shadow-sm">
      <summary className="cursor-pointer text-sm font-medium">{String(patient.client_full_name || patient.client_id)} <span className="text-xs font-normal text-muted-foreground">· {t('agent.data.recordCount', { count: (patient.matches as Match[])?.length || 0 })}</span></summary>
      <div className="mt-3 space-y-4">{(patient.matches as Match[] || []).map((match, i) => <div key={i} className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{t(match.distance === 0 ? 'agent.data.exact' : 'agent.data.closest')}</span><bdi>{match.source_date}</bdi>
          <AgentLink href={match.source?.path}>{t('agent.openRecord')}</AgentLink></div>
        <p className="text-xs text-muted-foreground">{t('agent.column.component_key')}: <bdi>{match.component_key}</bdi></p>
        <ResultTable columns={['eye', 'sph', 'cyl', 'ax', 'add', 'pd', 'va']} rows={Object.entries(match.eyes || {}).map(([eye, values]) => ({
          ...values.values, eye: t(eye === 'R' ? 'agent.data.rightEye' : 'agent.data.leftEye'),
        }))} />
        <div className="overflow-x-auto"><table className="w-full text-start text-xs"><thead><tr>{['eye', 'measurement', 'requested', 'recorded', 'difference'].map(key => <th key={key} className="p-1.5 text-start font-medium">{t(`agent.data.${key}`)}</th>)}</tr></thead>
          <tbody>{Object.entries(match.eyes || {}).flatMap(([eye, values]) => Object.entries(values.differences || {}).map(([field, delta]) => <tr key={eye + field}>
            <td className="p-1.5">{t(eye === 'R' ? 'agent.data.rightEye' : 'agent.data.leftEye')}</td><td className="p-1.5"><bdi>{field.toUpperCase()}</bdi></td>
            <td className="p-1.5"><bdi>{valueText(delta.requested, locale)}</bdi></td><td className="p-1.5"><bdi>{valueText(delta.recorded, locale)}</bdi></td><td className="p-1.5"><bdi>{valueText(delta.difference, locale)}</bdi></td>
          </tr>))}</tbody></table></div>
      </div>)}</div>
    </details>)}
  </div>;
}

function ReportResult({ initial, embedded = false }: { initial: Result; embedded?: boolean }) {
  const workspace = usePrysmAgent();
  const { t } = useTranslation();
  const { locale, direction } = useAppLocale();
  const label = useColumnLabel();
  const [offset, setOffset] = React.useState(0);
  const queryClient = useQueryClient();
  const [error, setError] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const scope = workspace?.scope;
  const query = useQuery({ queryKey: ['agent-report-run', scope?.userId, scope?.clinicId, scope?.patientId, initial.job_id, offset],
    enabled: Boolean(scope && initial.job_id),
    queryFn: () => agentJson<Result>(scope!, `/reports/${initial.job_id}/page?offset=${offset}`),
    refetchInterval: query => query.state.data?.status && ['queued', 'running'].includes(query.state.data.status) ? 1500 : false,
    retry: false });
  const result = query.data || initial;
  const downloading = async (format: string) => {
    if (!scope || !result.exports?.[format]) return;
    try { await downloadAgentReport(scope, result.exports[format]); } catch { setError(true); }
  };
  const save = async () => {
    if (!scope || !result.definition) return;
    setSaving(true); setError(false);
    try {
      await agentJson(scope, '/saved-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', title: String(result.definition.title || t('agent.report')), definition: result.definition }) });
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['agent-saved-reports'] });
    } catch { setError(true); } finally { setSaving(false); }
  };
  if (query.isError) return <p role="alert" className="text-xs text-destructive">{t('agent.data.unavailable')}</p>;
  if (result.status === 'failed' || result.status === 'cancelled') return <p role="status" className="text-xs text-muted-foreground">{t(`agent.job.${result.status}`)}</p>;
  if (!result.columns) return <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden />{t('agent.job.running')}</p>;
  return <div className="space-y-4">
    {!embedded && <div className="flex flex-wrap items-center gap-2"><p className="me-auto text-sm font-medium">{String(result.definition?.title || t('agent.report'))}</p>
      <Button variant="ghost" size="sm" disabled={saved || saving} onClick={() => void save()}><Bookmark className="size-3.5" />{t(saved ? 'agent.data.saved' : 'agent.data.save')}</Button>
      {['xlsx', 'csv'].map(format => <Button key={format} variant="outline" size="sm" onClick={() => void downloading(format)}><Download className="size-3.5" /><bdi>{format === 'xlsx' ? 'Excel' : 'CSV'}</bdi></Button>)}
    </div>}
    {result.period && <p className="text-xs text-muted-foreground"><bdi>{result.period.start}</bdi> – <bdi>{result.period.end}</bdi></p>}
    {result.show_stats !== false && result.metrics && <dl className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 10rem), 1fr))' }}>{result.metrics.map((metric, index) => <div key={index} className="min-w-0 rounded-xl bg-card p-3 shadow-sm">
      <dt className="truncate text-xs text-muted-foreground" title={result.column_labels?.[metric.key] || t(`agent.metric.${metric.key}`, { defaultValue: label(metric.key) })}>{result.column_labels?.[metric.key] || t(`agent.metric.${metric.key}`, { defaultValue: label(metric.key) })} {metric.currency && <bdi>{metric.currency}</bdi>}</dt>
      <dd className="mt-1 truncate text-lg font-medium tabular-nums" title={valueText(metric.current, locale)}><bdi>{valueText(metric.current, locale)}</bdi></dd>
      {metric.previous !== undefined && metric.previous !== null && <dd className="mt-1 truncate text-xs text-muted-foreground">{t('agent.data.previous')}: <bdi>{valueText(metric.previous, locale)}</bdi>{metric.change_percent !== null && <bdi> · {valueText(metric.change_percent, locale)}%</bdi>}</dd>}
    </div>)}</dl>}
    {result.charts?.map((chart, index) => <ReportChart key={index} chart={chart} label={key => result.column_labels?.[key] || label(key)} />)}
    {result.show_table !== false && <ResultTable columns={result.columns} rows={result.rows || []} labels={result.column_labels} />}
    {result.show_table !== false && result.comparison && <details className="space-y-2 text-xs text-muted-foreground"><summary className="cursor-pointer">{t('agent.data.comparisonPeriod')} · <bdi>{result.comparison.start}</bdi> – <bdi>{result.comparison.end}</bdi></summary>
      <ResultTable columns={result.columns} rows={result.comparison.rows} labels={result.column_labels} />
      <p>{t('agent.data.showing', { count: result.comparison.rows.length, total: result.comparison.total })}</p>
    </details>}
    {result.show_table !== false && <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{t('agent.data.showing', { count: result.rows?.length || 0, total: result.total || 0 })}</span>
      <div className="flex gap-1"><Button variant="ghost" size="sm" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(value => Math.max(0, value - 25))}>{t('agent.data.previous')}</Button>
        <Button variant="ghost" size="sm" disabled={result.next_offset == null || query.isFetching} onClick={() => setOffset(result.next_offset!)}>{t('agent.data.next')}</Button></div></div>}
    {result.definition && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t('agent.data.definition')}</summary><div className="mt-2 space-y-1">
      <DefinitionSummary definition={result.definition} definitions={result.definitions} />
      {embedded && <div className="flex flex-wrap gap-2 py-2">
        <Button variant="ghost" size="sm" disabled={saved || saving} onClick={() => void save()}><Bookmark className="size-3.5" />{t(saved ? 'agent.data.saved' : 'agent.data.save')}</Button>
        {['xlsx', 'csv'].map(format => <Button key={format} variant="outline" size="sm" onClick={() => void downloading(format)}><Download className="size-3.5" /><bdi>{format === 'xlsx' ? 'Excel' : 'CSV'}</bdi></Button>)}
      </div>}
      {(result.limitations || []).map((_, i) => <p key={i}>{t(`agent.data.limitation.${i}`, { defaultValue: t('agent.data.missingData') })}</p>)}
    </div></details>}
    {error && <p role="alert" className="text-xs text-destructive">{t('agent.operationFailed')}</p>}
  </div>;
}

export function AgentDataResults({ output, embedded = false }: { output: unknown; embedded?: boolean }) {
  const result = object(output) as Result;
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(true);
  if (!['record_search', 'prescription_search', 'document_search', 'report_run', 'report_result'].includes(String(result.type))) return null;
  return <section className="min-w-0 space-y-3" aria-label={t('agent.data.results')}>
    {result.type?.startsWith('report_') ? <ReportResult initial={result} embedded={embedded} /> : <>
      <button type="button" aria-expanded={open} className="flex min-h-9 items-center gap-2 text-xs text-muted-foreground" onClick={() => setOpen(value => !value)}>
        {t('agent.data.resultCount', { count: result.total || 0 })}{open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {result.type === 'document_search' && result.coverage && <p role="status" className="text-xs text-muted-foreground">{t(result.coverage.enabled ? 'agent.data.documentCoverage' : 'agent.data.libraryDisabled',
        { ready: Number(result.coverage.ready || 0), total: Number(result.coverage.total_files || 0), pending: Number(result.coverage.pending || 0) })}</p>}
      {open && (result.type === 'prescription_search' ? <PrescriptionResults result={result} /> : <ul className="space-y-2">{result.items?.map((item, index) => {
        const source = object(item.source) as Source;
        const values = object(item.values);
        const title = [values.first_name, values.last_name].filter(Boolean).join(' ') || String(values.test_name || values.file_name || values.name || values.product || values.title || values.id || item.title || t('agent.openRecord'));
        return <li key={index} className="rounded-xl border border-border/50 bg-card p-3 text-sm shadow-sm"><AgentLink href={source.path}>{title}</AgentLink>
          <p className="mt-1 text-xs text-muted-foreground">{Object.values(object(item.matched_fields)).slice(0, 4).map(String).join(' · ') || String(item.excerpt || '')}</p>
          {Array.isArray(object(item.evidence).locations) && <p className="mt-1 text-xs text-muted-foreground">{(object(item.evidence).locations as Row[]).filter(location => typeof location.page_number === 'number').map(location => t('agent.data.page', { number: location.page_number })).join(' · ')}</p>}
        </li>;
      })}</ul>)}
      {result.next_offset != null && <p className="text-xs text-muted-foreground">{t('agent.data.moreAvailable')}</p>}
      {!result.total && <p className="text-xs text-muted-foreground">{t('agent.data.noResults')}</p>}
    </>}
  </section>;
}
