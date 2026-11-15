import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AreaChart, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BarChart3, Bookmark, CalendarDays, ChartLine, ChartPie,
  CircleDot, Columns3, Eye, FileSpreadsheet, FileText, Glasses, Loader2, NotebookPen, Package, Play, Plus,
  Receipt, RotateCcw, Send, Sparkles, Users, Wallet, X, Ban,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { DateInput } from "@/components/ui/date";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportChart } from "@/components/agent/ReportChart";
import { apiClient } from "@/lib/api-client";
import { useAppLocale } from "@/localization/use-app-locale";
import { cn } from "@/utils/tailwind";
import {
  type Catalog, type ChartKind, type Condition, type Dataset, type Draft, type Metric, type Operation, type Period,
  DATASETS, OPERATIONS, OPERATORS, TEMPLATES, columnLabel, dateFieldsOf, emptyDraft, fieldLabel, fieldsOf, formatValue,
  fromDefinition, isComplete, metricKey, newId, periodRange, reportColumns, toDefinition,
} from "@/lib/clinic-reports";

type Row = Record<string, unknown>;
type Result = { columns: string[]; total: number; rows: Row[]; limit: number; comparison?: { start: string; end: string; rows: Row[] } };
type SavedReport = { id: string; title: string; revision: number; definition: Parameters<typeof fromDefinition>[0] };

const DATASET_ICONS: Record<Dataset, React.ElementType> = {
  clients: Users, appointments: CalendarDays, exams: Eye, orders: Glasses, contact_lens_orders: CircleDot,
  referrals: Send, billing: Receipt, payments: Wallet, inventory: Package, medical_logs: NotebookPen, files: FileText,
};
const CHART_ICONS: Record<ChartKind, React.ElementType> = { none: Ban, bar: BarChart3, line: ChartLine, area: AreaChart, pie: ChartPie };
const PERIODS: Period[] = ['this_month', 'last_month', 'last_30', 'this_quarter', 'this_year', 'last_12_months', 'all', 'custom'];
const PAGE_SIZE = 50;
const ADDITIVE = new Set<Operation>(['count', 'sum']);

function Step({ number, title, children, aside }: { number: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{number}</span>
        {title}
      </h2>
      {aside}
    </div>
    {children}
  </section>;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active}
    className={cn("rounded-full border px-3 py-1 text-xs transition-colors", active
      ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background hover:border-primary/40 hover:bg-primary/5")}>
    {children}
  </button>;
}

function FieldSelect({ value, onChange, options, placeholder, label, dir }: {
  value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder: string; label: string; dir: 'rtl' | 'ltr';
}) {
  return <Select value={value} onValueChange={onChange} dir={dir} clearable={false}>
    <SelectTrigger aria-label={label} className="h-9 w-full bg-background"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent className="max-h-72">{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}

export default function ControlCenterReportsPage() {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const { locale, direction } = useAppLocale();
  const dir = direction === 'rtl' ? 'rtl' : 'ltr';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clinicId } = useParams({ from: "/control-center/clinics/$clinicId/reports" });
  const { name } = useSearch({ from: "/control-center/clinics/$clinicId/reports" });
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [result, setResult] = useState<Result | null>(null);
  const [ranDefinition, setRanDefinition] = useState<string | null>(null);
  const [ranDraft, setRanDraft] = useState<Draft | null>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null);
  const [page, setPage] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ['clinic-reports', 'catalog', clinicId],
    queryFn: async () => {
      const response = await apiClient.clinicReportRequest<{ datasets: Catalog }>(`/catalog?clinic_id=${clinicId}`);
      if (response.error) throw Object.assign(new Error(response.error), { status: response.status });
      return response.data!.datasets;
    },
    retry: false,
  });
  const savedQuery = useQuery({
    queryKey: ['clinic-reports', 'saved', clinicId],
    queryFn: async () => (await apiClient.clinicReportRequest<{ items: SavedReport[] }>(`/saved?clinic_id=${clinicId}`)).data?.items ?? [],
    enabled: catalogQuery.isSuccess,
  });
  const catalog = catalogQuery.data;

  const fields = useMemo(() => fieldsOf(catalog, draft.dataset), [catalog, draft.dataset]);
  const types = useMemo(() => Object.fromEntries(fields.map(field => [field.key, field.type])), [fields]);
  const dateFields = useMemo(() => dateFieldsOf(catalog, draft.dataset), [catalog, draft.dataset]);
  const fieldOptions = useMemo(() => fields.map(field => ({ value: field.key, label: fieldLabel(tr, field.key) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale)), [fields, tr, locale]);
  const groupOptions = useMemo(() => [
    ...dateFields.flatMap(key => [`${key}.month`, `${key}.year`]),
    ...fields.filter(field => field.type !== 'date').map(field => field.key),
  ].map(key => ({ value: key, label: fieldLabel(tr, key) })), [dateFields, fields, tr]);
  const definition = useMemo(() => toDefinition(draft, tr, catalog), [draft, tr, catalog]);
  const stale = Boolean(result && ranDefinition && ranDefinition !== JSON.stringify(definition));

  const update = (changes: Partial<Draft>) => setDraft(previous => ({ ...previous, ...changes }));
  const setPeriod = (period: Period) => update({ period, ...(periodRange(period) ?? {}) });
  const chooseDataset = (dataset: Dataset) => {
    if (dataset === draft.dataset) return;
    setDraft(previous => ({ ...emptyDraft(dataset), mode: previous.mode, title: '' }));
  };
  const updateCondition = (id: string, changes: Partial<Condition>) =>
    update({ conditions: draft.conditions.map(condition => condition.id === id ? { ...condition, ...changes } : condition) });
  const updateMetric = (id: string, changes: Partial<Metric>) =>
    update({ metrics: draft.metrics.map(metric => metric.id === id ? { ...metric, ...changes } : metric) });

  const run = async (next: Draft = draft) => {
    const body = toDefinition(next, tr, catalog);
    setRunning(true); setFailed(false);
    const response = await apiClient.clinicReportRequest<Result>(`/run?clinic_id=${clinicId}`, { method: 'POST', body: JSON.stringify(body) });
    setRunning(false);
    if (response.error || !response.data) { setFailed(true); return; }
    setResult(response.data); setRanDefinition(JSON.stringify(body)); setRanDraft(next); setPage(0);
  };
  const applyAndRun = (next: Draft) => { setDraft(next); void run(next); };

  const exportReport = async (format: 'xlsx' | 'csv') => {
    setExporting(format);
    try {
      const response = await apiClient.clinicReportFetch(`/export?clinic_id=${clinicId}&format=${format}`, { method: 'POST', body: JSON.stringify(definition) });
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `${definition.title}.${format}`; link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('clinicReports.exportFailed'));
    } finally {
      setExporting(null);
    }
  };

  const saveReport = async (title: string) => {
    const response = await apiClient.clinicReportRequest(`/saved?clinic_id=${clinicId}`, {
      method: 'POST', body: JSON.stringify({ action: 'save', title, definition: toDefinition({ ...draft, title }, tr, catalog) }),
    });
    if (response.error) { toast.error(t('clinicReports.failed')); return; }
    update({ title }); setSaveOpen(false);
    toast.success(t('clinicReports.savedToast'));
    void queryClient.invalidateQueries({ queryKey: ['clinic-reports', 'saved', clinicId] });
  };
  const deleteSaved = async (report: SavedReport) => {
    const response = await apiClient.clinicReportRequest(`/saved?clinic_id=${clinicId}`, {
      method: 'POST', body: JSON.stringify({ action: 'delete', report_id: report.id, revision: report.revision }),
    });
    if (response.error) { toast.error(t('clinicReports.failed')); return; }
    toast.success(t('clinicReports.deletedToast'));
    void queryClient.invalidateQueries({ queryKey: ['clinic-reports', 'saved', clinicId] });
  };

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const header = <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex items-start gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BarChart3 className="size-5" /></div>
      <div>
        <h1 className="text-2xl font-bold">{t('clinicReports.title')}{name ? <span className="text-muted-foreground"> · {name}</span> : null}</h1>
        <p className="text-sm text-muted-foreground">{t('clinicReports.subtitle', { clinic: name || '' })}</p>
      </div>
    </div>
    <Button variant="ghost" className="gap-2" onClick={() => navigate({ to: '/control-center/clinics' })}>
      <BackIcon className="size-4" />{t('clinicReports.back')}
    </Button>
  </div>;

  if (catalogQuery.isError) {
    return <>
      <SiteHeader title={t('clinicReports.title')} />
      <div className="h-full overflow-auto bg-muted/30" dir={dir}><div className="mx-auto max-w-[1400px] space-y-6 p-6">
        {header}
        <Card><CardContent className="py-16 text-center text-muted-foreground">{t('clinicReports.noAccess')}</CardContent></Card>
      </div></div>
    </>;
  }

  return <>
    <SiteHeader title={t('clinicReports.title')} />
    <div className="h-full overflow-auto bg-muted/30" style={{ scrollbarWidth: 'none' }} dir={dir}>
      <div className="mx-auto max-w-[1400px] space-y-5 p-6 pb-20">
        {header}

        <Card className="py-4">
          <CardContent className="space-y-3 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Sparkles className="size-3.5" />{t('clinicReports.templates')}</span>
              {TEMPLATES.map(template => <Button key={template.key} size="sm" variant="outline" className="h-7 rounded-full text-xs"
                disabled={!catalog} onClick={() => applyAndRun({ ...template.draft(new Date()), title: t(`clinicReports.template.${template.key}`) })}>
                {t(`clinicReports.template.${template.key}`)}
              </Button>)}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Bookmark className="size-3.5" />{t('clinicReports.saved')}</span>
              {savedQuery.data?.length ? savedQuery.data.map(report => <span key={report.id} className="group inline-flex items-center rounded-full border bg-background text-xs">
                <button type="button" className="py-1 ps-3 pe-1 hover:text-primary" onClick={() => applyAndRun(fromDefinition(report.definition, report.title))}>{report.title}</button>
                <button type="button" aria-label={t('clinicReports.deleteSaved')} title={t('clinicReports.deleteSaved')}
                  className="me-1 rounded-full p-0.5 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  onClick={() => deleteSaved(report)}><X className="size-3" /></button>
              </span>) : <span className="text-xs text-muted-foreground">{t('clinicReports.noSaved')}</span>}
            </div>
          </CardContent>
        </Card>

        <div className="grid items-start gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="py-5 lg:sticky lg:top-0">
            <CardContent className="space-y-6 px-5">
              <Step number={1} title={t('clinicReports.step.data')}>
                <div className="grid grid-cols-3 gap-2">
                  {DATASETS.map(dataset => {
                    const Icon = DATASET_ICONS[dataset];
                    const active = draft.dataset === dataset;
                    return <button key={dataset} type="button" onClick={() => chooseDataset(dataset)} aria-pressed={active}
                      className={cn("flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-center text-[11px] leading-tight transition-all",
                        active ? "border-primary bg-primary/5 font-semibold text-primary shadow-sm" : "border-border bg-background hover:border-primary/40")}>
                      <Icon className="size-4" />{t(`clinicReports.dataset.${dataset}`)}
                    </button>;
                  })}
                </div>
              </Step>

              <Step number={2} title={t('clinicReports.step.period')}>
                {dateFields.length ? <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('clinicReports.dateField')}</Label>
                    <FieldSelect dir={dir} label={t('clinicReports.dateField')} value={draft.dateField} placeholder={t('clinicReports.chooseField')}
                      onChange={dateField => update({ dateField })} options={dateFields.map(key => ({ value: key, label: fieldLabel(tr, key) }))} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PERIODS.map(period => <Pill key={period} active={draft.period === period} onClick={() => setPeriod(period)}>{t(`clinicReports.period.${period}`)}</Pill>)}
                  </div>
                  {draft.period !== 'all' && <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">{t('clinicReports.from')}</Label>
                      <DateInput name="report_from" value={draft.start} dir="ltr" className="text-center"
                        onChange={event => update({ start: event.target.value, period: 'custom' })} /></div>
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">{t('clinicReports.to')}</Label>
                      <DateInput name="report_to" value={draft.end} dir="ltr" className="text-center"
                        onChange={event => update({ end: event.target.value, period: 'custom' })} /></div>
                  </div>}
                  {draft.mode === 'summary' && draft.period !== 'all' && <label className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 p-2.5">
                    <span><span className="block text-xs font-medium">{t('clinicReports.comparison')}</span>
                      <span className="block text-[11px] text-muted-foreground">{t('clinicReports.comparisonHint')}</span></span>
                    <Switch dir="ltr" checked={draft.comparison} onCheckedChange={comparison => update({ comparison })} />
                  </label>}
                </div> : <p className="text-xs text-muted-foreground">{t('clinicReports.period.all')}</p>}
              </Step>

              <Step number={3} title={t('clinicReports.step.conditions')}
                aside={draft.conditions.length > 1 && <div className="flex gap-1">
                  {(['all', 'any'] as const).map(match => <Pill key={match} active={draft.match === match} onClick={() => update({ match })}>{t(`clinicReports.match.${match}`)}</Pill>)}
                </div>}>
                <div className="space-y-2">
                  {draft.conditions.length === 0 && <p className="text-xs text-muted-foreground">{t('clinicReports.noConditions')}</p>}
                  {draft.conditions.map(condition => {
                    const type = types[condition.field] ?? 'text';
                    const noValue = condition.operator === 'empty' || condition.operator === 'not_empty';
                    const incomplete = condition.field && !isComplete(condition, type);
                    return <div key={condition.id} className={cn("space-y-2 rounded-xl border bg-muted/30 p-2.5", incomplete && "border-amber-300")}>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1"><FieldSelect dir={dir} label={t('clinicReports.chooseField')} value={condition.field} placeholder={t('clinicReports.chooseField')}
                          options={fieldOptions} onChange={field => {
                            const nextType = types[field] ?? 'text';
                            updateCondition(condition.id, { field, operator: OPERATORS[nextType][0], value: nextType === 'bool' ? 'true' : '' });
                          }} /></div>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label={t('clinicReports.remove')}
                          onClick={() => update({ conditions: draft.conditions.filter(item => item.id !== condition.id) })}><X className="size-4" /></Button>
                      </div>
                      {condition.field && <div className="flex gap-2">
                        <div className={noValue ? "flex-1" : "w-[45%] shrink-0"}>
                          <FieldSelect dir={dir} label={t('clinicReports.value')} value={condition.operator} placeholder=""
                            onChange={operator => updateCondition(condition.id, { operator: operator as Condition['operator'] })}
                            options={OPERATORS[type].map(operator => ({ value: operator,
                              label: t(type === 'date' && operator !== 'empty' && operator !== 'not_empty' ? `clinicReports.dateOperator.${operator}` : `clinicReports.operator.${operator}`) }))} />
                        </div>
                        {!noValue && <div className="min-w-0 flex-1">
                          {type === 'date' ? <DateInput name={`condition_${condition.id}`} value={condition.value} dir="ltr" className="h-9 text-center"
                            onChange={event => updateCondition(condition.id, { value: event.target.value })} />
                            : type === 'bool' ? <FieldSelect dir={dir} label={t('clinicReports.value')} value={condition.value} placeholder=""
                              onChange={value => updateCondition(condition.id, { value })}
                              options={[{ value: 'true', label: t('clinicReports.yes') }, { value: 'false', label: t('clinicReports.no') }]} />
                            : <Input className="h-9 bg-background" aria-label={t('clinicReports.value')} type={type === 'number' ? 'number' : 'text'}
                              dir={type === 'number' ? 'ltr' : undefined} value={condition.value}
                              placeholder={condition.operator === 'in' ? t('clinicReports.inHint') : t('clinicReports.value')}
                              onChange={event => updateCondition(condition.id, { value: event.target.value })} />}
                        </div>}
                      </div>}
                    </div>;
                  })}
                  <Button variant="outline" size="sm" className="w-full gap-1.5 border-dashed"
                    onClick={() => update({ conditions: [...draft.conditions, { id: newId(), field: '', operator: 'contains', value: '' }] })}>
                    <Plus className="size-3.5" />{t('clinicReports.addCondition')}
                  </Button>
                </div>
              </Step>

              <Step number={4} title={t('clinicReports.step.display')}>
                <Tabs value={draft.mode} onValueChange={mode => update({ mode: mode as Draft['mode'], sort: null })} dir={dir}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="list" className="gap-1.5"><Columns3 className="size-3.5" />{t('clinicReports.mode.list')}</TabsTrigger>
                    <TabsTrigger value="summary" className="gap-1.5"><BarChart3 className="size-3.5" />{t('clinicReports.mode.summary')}</TabsTrigger>
                  </TabsList>
                </Tabs>
                {draft.mode === 'list' ? <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('clinicReports.columns')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-9 w-full justify-between bg-background font-normal">
                          {t('clinicReports.columnsCount', { count: draft.columns.length })}<Columns3 className="size-4 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="max-h-80 w-72 overflow-y-auto p-1" dir={dir}>
                        {fieldOptions.map(option => {
                          const checked = draft.columns.includes(option.value);
                          return <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                            <Checkbox checked={checked} onCheckedChange={() => update({ columns: checked
                              ? draft.columns.filter(key => key !== option.value) : [...draft.columns, option.value].slice(0, 40) })} />
                            {option.label}
                          </label>;
                        })}
                      </PopoverContent>
                    </Popover>
                    <div className="flex flex-wrap gap-1">
                      {draft.columns.map(key => <span key={key} className="inline-flex items-center gap-1 rounded-md bg-primary/10 py-0.5 ps-2 pe-1 text-[11px] text-primary">
                        {fieldLabel(tr, key)}
                        <button type="button" aria-label={t('clinicReports.remove')} className="rounded hover:bg-primary/20"
                          onClick={() => update({ columns: draft.columns.filter(item => item !== key) })}><X className="size-3" /></button>
                      </span>)}
                    </div>
                  </div>
                </div> : <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map(index => <div key={index} className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t(index ? 'clinicReports.thenBy' : 'clinicReports.groupBy')}</Label>
                      <FieldSelect dir={dir} label={t('clinicReports.groupBy')} value={draft.groupBy[index] ?? '__none'} placeholder=""
                        onChange={value => {
                          const groupBy = [...draft.groupBy];
                          if (value === '__none') groupBy.splice(index); else groupBy[index] = value;
                          update({ groupBy: groupBy.filter(Boolean) });
                        }}
                        options={[{ value: '__none', label: t(index ? 'clinicReports.none' : 'clinicReports.noGroup') },
                          ...groupOptions.filter(option => option.value !== draft.groupBy[1 - index])]} />
                    </div>).slice(0, draft.groupBy.length ? 2 : 1)}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('clinicReports.metrics')}</Label>
                    {draft.metrics.map(metric => {
                      const options = metric.operation === 'count' ? [{ value: 'id', label: t('clinicReports.records') }]
                        : metric.operation === 'count_distinct' ? [{ value: 'client_id', label: t('clinicReports.field.client_id') }, ...fieldOptions]
                          : fieldOptions.filter(option => types[option.value] === 'number' || (metric.operation === 'min' || metric.operation === 'max') && types[option.value] === 'date');
                      return <div key={metric.id} className="flex items-center gap-2">
                        <div className="w-[38%] shrink-0"><FieldSelect dir={dir} label={t('clinicReports.metrics')} value={metric.operation} placeholder=""
                          onChange={value => {
                            const operation = value as Operation;
                            const field = operation === 'count' ? 'id' : operation === 'count_distinct' ? 'client_id'
                              : fields.find(item => item.type === 'number')?.key ?? '';
                            updateMetric(metric.id, { operation, field });
                          }}
                          options={OPERATIONS.map(operation => ({ value: operation, label: t(`clinicReports.operation.${operation}`) }))} /></div>
                        <span className="text-xs text-muted-foreground">{t('clinicReports.of')}</span>
                        <div className="min-w-0 flex-1"><FieldSelect dir={dir} label={t('clinicReports.metrics')} value={metric.field} placeholder={t('clinicReports.chooseField')}
                          onChange={field => updateMetric(metric.id, { field })} options={options} /></div>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label={t('clinicReports.remove')}
                          disabled={draft.metrics.length === 1} onClick={() => update({ metrics: draft.metrics.filter(item => item.id !== metric.id) })}><X className="size-4" /></Button>
                      </div>;
                    })}
                    {draft.metrics.length < 6 && <Button variant="outline" size="sm" className="w-full gap-1.5 border-dashed"
                      onClick={() => update({ metrics: [...draft.metrics, { id: newId(), operation: 'count', field: 'id' }] })}>
                      <Plus className="size-3.5" />{t('clinicReports.addMetric')}
                    </Button>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('clinicReports.chart')}</Label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(['bar', 'line', 'area', 'pie', 'none'] as ChartKind[]).map(kind => {
                        const Icon = CHART_ICONS[kind];
                        return <button key={kind} type="button" onClick={() => update({ chart: kind })} aria-pressed={draft.chart === kind}
                          className={cn("flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[11px] transition-colors", draft.chart === kind
                            ? "border-primary bg-primary/5 text-primary" : "bg-background hover:border-primary/40")}>
                          <Icon className="size-4" />{t(`clinicReports.chart.${kind}`)}
                        </button>;
                      })}
                    </div>
                    {draft.chart !== 'none' && !draft.groupBy.length && <p className="text-[11px] text-muted-foreground">{t('clinicReports.chartNeedsGroup')}</p>}
                  </div>
                </div>}
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('clinicReports.sort')}</Label>
                    <FieldSelect dir={dir} label={t('clinicReports.sort')} value={draft.sort?.key ?? '__default'} placeholder=""
                      onChange={key => update({ sort: key === '__default' ? null : { key, descending: draft.sort?.descending ?? false } })}
                      options={[{ value: '__default', label: t('clinicReports.sortDefault') },
                        ...reportColumns(draft, catalog).map(key => ({ value: key, label: columnLabel(tr, key) }))]} />
                  </div>
                  {draft.sort && <Button variant="outline" className="h-9 gap-1.5 bg-background text-xs"
                    onClick={() => update({ sort: { ...draft.sort!, descending: !draft.sort!.descending } })}>
                    {draft.sort.descending ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                    {t(draft.sort.descending ? 'clinicReports.descending' : 'clinicReports.ascending')}
                  </Button>}
                </div>
              </Step>

              <Step number={5} title={t('clinicReports.step.finish')}>
                <Input value={draft.title} onChange={event => update({ title: event.target.value })} placeholder={t('clinicReports.titlePlaceholder')} className="bg-background" maxLength={200} />
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" disabled={running || !catalog || (draft.mode === 'list' && !draft.columns.length)} onClick={() => run()}>
                    {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}{t(running ? 'clinicReports.running' : 'clinicReports.run')}
                  </Button>
                  <Popover open={saveOpen} onOpenChange={setSaveOpen}>
                    <PopoverTrigger asChild><Button variant="outline" className="gap-1.5" disabled={!catalog}><Bookmark className="size-4" />{t('clinicReports.save')}</Button></PopoverTrigger>
                    <PopoverContent align="end" className="w-72 space-y-2" dir={dir}>
                      <form className="space-y-2" onSubmit={event => {
                        event.preventDefault();
                        const title = String(new FormData(event.currentTarget).get('title') || '').trim();
                        if (title) void saveReport(title);
                      }}>
                        <Label htmlFor="saved-report-title" className="text-xs">{t('clinicReports.saveTitle')}</Label>
                        <Input id="saved-report-title" name="title" defaultValue={draft.title || definition.title} maxLength={200} autoFocus />
                        <Button type="submit" size="sm" className="w-full">{t('clinicReports.save')}</Button>
                      </form>
                    </PopoverContent>
                  </Popover>
                  <Button variant="ghost" size="icon" aria-label={t('clinicReports.reset')} title={t('clinicReports.reset')}
                    onClick={() => setDraft(emptyDraft(draft.dataset))}><RotateCcw className="size-4" /></Button>
                </div>
              </Step>
            </CardContent>
          </Card>

          <ResultPanel result={result} draft={ranDraft} running={running && !result} failed={failed} stale={stale}
            exporting={exporting} onExport={exportReport} page={page} setPage={setPage} locale={locale} dir={dir} tr={tr} />
        </div>
      </div>
    </div>
  </>;
}

function ResultPanel({ result, draft, running, failed, stale, exporting, onExport, page, setPage, locale, dir, tr }: {
  result: Result | null; draft: Draft | null; running: boolean; failed: boolean; stale: boolean; exporting: 'xlsx' | 'csv' | null;
  onExport: (format: 'xlsx' | 'csv') => void; page: number; setPage: (page: number) => void; locale: string; dir: 'rtl' | 'ltr';
  tr: (key: string, options?: Record<string, unknown>) => string;
}) {
  const t = tr;
  if (running) return <Card className="py-5"><CardContent className="space-y-4 px-5">
    <Skeleton className="h-6 w-1/3" /><div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(index => <Skeleton key={index} className="h-20" />)}</div>
    <Skeleton className="h-64" /><Skeleton className="h-40" />
  </CardContent></Card>;
  if (!result || !draft) return <Card className="border-dashed py-5"><CardContent className="flex flex-col items-center justify-center gap-3 px-5 py-20 text-center">
    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BarChart3 className="size-7" /></div>
    <h2 className="text-lg font-semibold">{t('clinicReports.emptyTitle')}</h2>
    <p className="max-w-md text-sm text-muted-foreground">{t('clinicReports.emptyText')}</p>
    {failed && <p className="text-sm text-destructive">{t('clinicReports.failed')}</p>}
  </CardContent></Card>;

  const summary = draft.mode === 'summary';
  const format = (value: unknown, key: string) => formatValue(value, key, locale, t);
  const dated = draft.period !== 'all' && draft.dateField;
  const currencies = result.columns.includes('currency') ? [...new Set(result.rows.map(row => row.currency as string | null))] : [null];
  const totals = (rows: Row[], key: string, currency: string | null) => rows
    .filter(row => !result.columns.includes('currency') || row.currency === currency)
    .reduce<number | null>((sum, row) => typeof row[key] === 'number' ? (sum ?? 0) + (row[key] as number) : sum, null);
  const tiles = summary ? draft.metrics.filter(metric => metric.field && (ADDITIVE.has(metric.operation) || !draft.groupBy.length))
    .flatMap(metric => currencies.map(currency => {
      const key = metricKey(metric);
      const current = totals(result.rows, key, currency);
      const previous = result.comparison ? totals(result.comparison.rows, key, currency) : undefined;
      return { key: `${key}:${currency}`, label: columnLabel(t, key), currency, current, previous, column: key };
    })) : [];
  const chartRows = (currency: string | null) => result.rows.filter(row => !result.columns.includes('currency') || row.currency === currency)
    .map(row => ({ ...row, [draft.groupBy[0]]: format(row[draft.groupBy[0]], draft.groupBy[0]) }));
  const series = draft.metrics.filter(metric => metric.field && metric.operation !== 'min' && metric.operation !== 'max')
    .map(metricKey).slice(0, draft.chart === 'pie' ? 1 : 5);
  const showChart = summary && draft.chart !== 'none' && draft.groupBy.length > 0 && series.length > 0 && result.rows.length > 0;
  const pages = Math.max(1, Math.ceil(result.rows.length / PAGE_SIZE));
  const visible = result.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const numeric = (key: string) => result.rows.some(row => typeof row[key] === 'number');

  return <div className="space-y-4">
    <Card className="py-4"><CardContent className="flex flex-wrap items-center justify-between gap-3 px-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{draft.title || t(`clinicReports.dataset.${draft.dataset}`)}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">{t(`clinicReports.dataset.${draft.dataset}`)}</span>
          {dated ? <span className="rounded-full bg-muted px-2 py-0.5" dir="ltr">{format(draft.start, 'date')} – {format(draft.end, 'date')}</span>
            : <span className="rounded-full bg-muted px-2 py-0.5">{t('clinicReports.period.all')}</span>}
          <span className="font-medium text-foreground">{summary && draft.groupBy.length ? t('clinicReports.groupsFound', { count: result.total }) : t('clinicReports.rowsFound', { count: result.total })}</span>
        </div>
      </div>
      <div className="flex gap-2">
        {(['xlsx', 'csv'] as const).map(format => <Button key={format} variant="outline" size="sm" className="gap-1.5" disabled={exporting !== null || stale} onClick={() => onExport(format)}>
          {exporting === format ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}{t(format === 'xlsx' ? 'clinicReports.exportExcel' : 'clinicReports.exportCsv')}
        </Button>)}
      </div>
      {stale && <p className="w-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{t('clinicReports.stale')}</p>}
      {failed && <p className="w-full text-xs text-destructive">{t('clinicReports.failed')}</p>}
    </CardContent></Card>

    {tiles.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map(tile => {
        const change = tile.previous && tile.current !== null ? (tile.current - tile.previous) / Math.abs(tile.previous) * 100 : null;
        return <Card key={tile.key} className="gap-1 py-4"><CardContent className="space-y-1 px-4">
          <p className="text-xs text-muted-foreground">{tile.label}{tile.currency ? <bdi className="ms-1">({tile.currency})</bdi> : null}</p>
          <p className="text-2xl font-bold tabular-nums" dir="ltr" style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>{format(tile.current ?? 0, tile.column)}</p>
          {result.comparison && <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {change !== null && <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
              change >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300")} dir="ltr">
              {change >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}{Math.abs(change).toFixed(1)}%
            </span>}
            {tile.previous == null ? t('clinicReports.noPrevious') : t('clinicReports.previousValue', { value: format(tile.previous, tile.column) })}
          </p>}
        </CardContent></Card>;
      })}
    </div>}
    {result.comparison && summary && <p className="text-[11px] text-muted-foreground">
      {t('clinicReports.previousPeriod', { from: format(result.comparison.start, 'date'), to: format(result.comparison.end, 'date') })}
    </p>}

    {showChart && <div className={cn("grid gap-3", currencies.length > 1 && "xl:grid-cols-2")}>
      {currencies.map(currency => <ReportChart key={String(currency)} label={key => columnLabel(t, key)}
        chart={{ kind: draft.chart === 'none' ? 'bar' : draft.chart, x: draft.groupBy[0], series, rows: chartRows(currency), currency }} />)}
    </div>}

    <Card className="gap-0 overflow-hidden py-0"><CardContent className="p-0">
      {result.rows.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">{t('clinicReports.noRows')}</p> : <>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
              <tr>{result.columns.map(key => <th key={key} className={cn("whitespace-nowrap px-3 py-2.5 text-start text-xs font-semibold text-muted-foreground", numeric(key) && "text-end")}>{columnLabel(t, key)}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((row, index) => <tr key={index} className="border-t transition-colors hover:bg-muted/40">
                {result.columns.map(key => <td key={key} className={cn("max-w-[280px] truncate px-3 py-2", numeric(key) && "text-end tabular-nums")}
                  title={typeof row[key] === 'string' ? row[key] as string : undefined}>{format(row[key], key)}</td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span>{result.total > result.rows.length ? t('clinicReports.shownLimit', { shown: result.rows.length, total: result.total }) : ''}</span>
          {pages > 1 && <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('clinicReports.previousPage')}</Button>
            <span>{t('clinicReports.page', { page: page + 1, pages })}</span>
            <Button variant="ghost" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{t('clinicReports.nextPage')}</Button>
          </div>}
        </div>
      </>}
    </CardContent></Card>
  </div>;
}
