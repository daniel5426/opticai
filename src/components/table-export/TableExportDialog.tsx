import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Download, Loader2, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAppLocale } from '@/localization/use-app-locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportColumns, exportDatePreset, exportJson, downloadTableExport, startExport, getExportTask, setExportTask, subscribeExportTasks, type ExportJob, type ExportRequest, type ExportSnapshot } from '@/lib/table-exports';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; snapshot: ExportSnapshot; taskKey: string; triggerRef?: React.RefObject<HTMLButtonElement | null> };
export function TableExportDialog({ open, onOpenChange, snapshot: openingSnapshot, taskKey, triggerRef }: Props) {
  const { t } = useTranslation();
  const { locale, direction } = useAppLocale();
  const task = useSyncExternalStore(subscribeExportTasks, () => getExportTask(taskKey));
  const [snapshot, setSnapshot] = useState(() => task?.snapshot || openingSnapshot);
  const defaults = (source = snapshot): ExportRequest => ({ table: source.table, column_filters: source.columnFilters || '', clinic_id: source.clinicId ?? null, search: source.search, filters: Object.fromEntries(source.filters.map(f => [f.key, f.value])), columns: source.columns || [...exportColumns[source.table]], sort: source.sort, locale, format: 'xlsx', start_date: null, end_date: null, request_key: crypto.randomUUID() });
  const [request, setRequest] = useState<ExportRequest>(() => task?.request || defaults());
  const [period, setPeriod] = useState(request.start_date ? 'custom' : 'all');
  const [count, setCount] = useState<{ key: string; rows: number } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const job = task?.job;
  const active = Boolean(job && ['queued', 'running'].includes(job.status));
  const dateValid = period !== 'custom' || Boolean(request.start_date && request.end_date && request.start_date <= request.end_date);
  const valid = dateValid && request.columns.length > 0;
  const countKey = JSON.stringify({ ...request, format: 'xlsx', request_key: 'preview' });
  const currentCount = valid && count?.key === countKey ? count.rows : null;
  useEffect(() => {
    if (!valid || job) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setError('');
      void exportJson<{ rows: number }>('/count', { method: 'POST', body: countKey, signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) setCount({ key: countKey, rows: result.rows }); })
        .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [countKey, job, valid]);
  const change = (patch: Partial<ExportRequest>) => { setError(''); setRequest(previous => ({ ...previous, ...patch, request_key: crypto.randomUUID() })); };
  const select = (value: string, onChange: (value: string) => void, items: { value: string; label: string }[], label: string) => <Select clearable={false} value={value} onValueChange={onChange} dir={direction}>
    <SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger>
    <SelectContent dir={direction}>{items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
  </Select>;
  const submit = async () => {
    if (submitting.current || !valid || currentCount === 0 || currentCount === null) return;
    submitting.current = true; setBusy(true); setError('');
    try { await startExport(taskKey, request, snapshot); } catch (error) { setError(error instanceof Error && error.message.startsWith('tableExport.') ? error.message : 'tableExport.failed'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const download = async () => { if (!job) return; setBusy(true); try { await downloadTableExport(job.id); } catch (error) { toast.error(t(error instanceof Error && error.message.startsWith('tableExport.') ? error.message : 'tableExport.failed')); } finally { setBusy(false); } };
  const cancel = async () => { if (!task) return; setBusy(true); try { const job = await exportJson<ExportJob>(`/${task.job.id}/cancel`, { method: 'POST' }); setExportTask(taskKey, { ...task, job, pollError: false }); } catch { setError('tableExport.unavailable'); } finally { setBusy(false); } };
  const configure = () => {
    setExportTask(taskKey);
    if (job?.status === 'failed') change({ request_key: crypto.randomUUID() });
    else { setSnapshot(openingSnapshot); setRequest(defaults(openingSnapshot)); setPeriod('all'); setError(''); }
  };
  const [sortColumn, sortDirection] = [snapshot.sort.replace(/_(asc|desc)$/, ''), snapshot.sort.endsWith('_asc') ? 'asc' : 'desc'];
  const availableColumns = snapshot.columns || [...exportColumns[snapshot.table]];
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onCloseAutoFocus={triggerRef ? event => { event.preventDefault(); triggerRef.current?.focus(); } : undefined} dir={direction} className="flex w-[calc(100%_-_2rem)] max-h-[90dvh] flex-col gap-0 overflow-visible p-0 sm:max-w-[640px]">
      <DialogHeader className="px-6 pt-6 pb-4 pe-12">
        <DialogTitle>{t('tableExport.title', { table: t(`tableExport.table.${snapshot.table}`) })}</DialogTitle>
        <DialogDescription>{t('tableExport.allPages')}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto px-6 py-2">
        <div className="mb-5 space-y-1 text-sm text-muted-foreground">
          <p>{t('tableExport.scope', { clinic: snapshot.clinicName })}</p>
          <p>{t('tableExport.sort', { column: t(`tableExport.column.${sortColumn}`), direction: t(`tableExport.${sortDirection}`) })}</p>
          {snapshot.productName && <p>{t('tableExport.productScope', { product: snapshot.productName })}</p>}
        </div>
        {job ? <div className="space-y-3 py-6" role="status" aria-live="polite">
          <p className="flex items-center gap-2 font-medium">{active && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{t(job.expired ? 'tableExport.expired' : task?.pollError ? 'tableExport.reconnecting' : `tableExport.${job.status}`)}</p>
          {job.rows !== null && <p className="text-sm text-muted-foreground">{t('tableExport.summary', { rows: job.rows, columns: request.columns.length })}</p>}
          {active && <p className="text-sm text-muted-foreground">{t('tableExport.background')}</p>}
          {job.status === 'failed' && <p className="text-sm text-destructive">{t(job.error || 'tableExport.failed')}</p>}
        </div> : <fieldset disabled={busy} className="space-y-5 pb-4">
          <label className="block space-y-2 text-sm font-medium"><span>{t('tableExport.format')}</span>{select(request.format, format => change({ format: format as 'xlsx' | 'csv' }), [{ value: 'xlsx', label: t('tableExport.xlsx') }, { value: 'csv', label: t('tableExport.csv') }], t('tableExport.format'))}</label>
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t('tableExport.filters')}</h3>
            <Input aria-label={t('tableExport.search')} placeholder={t('tableExport.search')} value={request.search} onChange={event => change({ search: event.target.value })} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{snapshot.filters.filter(filter => filter.key !== 'product_id').map(filter => <label key={filter.key} className="block space-y-2 text-sm"><span>{filter.label}</span>{select(request.filters[filter.key] || 'all', value => change({ filters: { ...request.filters, [filter.key]: value } }), filter.options, filter.label)}</label>)}</div>
            {snapshot.table !== 'inventory' && <div className="space-y-3">
              <label className="block space-y-2 text-sm"><span>{t(`tableExport.date.${snapshot.table}`)}</span>{select(period, value => { setPeriod(value); if (value !== 'custom') change(exportDatePreset(value)); else change({ start_date: null, end_date: null }); }, ['all', 'month', 'last30', 'custom'].map(value => ({ value, label: t(`tableExport.${value === 'all' ? 'allDates' : value}`) })), t('tableExport.dates'))}</label>
              {period === 'custom' && <div className="grid grid-cols-2 gap-3">{(['start_date', 'end_date'] as const).map((key, index) => <label key={key} className="block space-y-2 text-sm"><span>{t(`tableExport.${index ? 'to' : 'from'}`)}</span><Input type="date" dir="ltr" aria-label={t(`tableExport.${index ? 'to' : 'from'}`)} value={request[key] || ''} onChange={event => change({ [key]: event.target.value || null })} /></label>)}</div>}
              {!dateValid && <p className="text-sm text-destructive">{t('tableExport.invalidDate')}</p>}
            </div>}
          </div>
          <details className="rounded-lg border p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium"><span>{t('tableExport.columns')} ({request.columns.length}/{availableColumns.length})</span><ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{availableColumns.map(key => <label key={key} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={request.columns.includes(key)} onCheckedChange={checked => change({ columns: availableColumns.filter(column => column === key ? checked === true : request.columns.includes(column)) })} /><span>{t(`tableExport.column.${key}`)}</span></label>)}</div>
          </details>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setSnapshot(openingSnapshot); setRequest(defaults(openingSnapshot)); setPeriod('all'); setError(''); }}>{t('tableExport.reset')}</Button>
        </fieldset>}
        {error && <p role="alert" className="pb-3 text-sm text-destructive">{t(error)}</p>}
      </div>
      <div className="border-t px-6 py-4">
        {!job && <p role="status" aria-live="polite" className="mb-3 text-sm text-muted-foreground">{currentCount === null ? (valid && !error ? t('tableExport.counting') : '') : currentCount === 0 ? t('tableExport.empty') : t('tableExport.summary', { rows: currentCount, columns: request.columns.length })}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t(job ? 'tableExport.close' : 'tableExport.cancel')}</Button>
          {active ? <Button variant="outline" disabled={busy} onClick={() => void cancel()}>{t('tableExport.cancelJob')}</Button> : job ? <>
            <Button variant="outline" disabled={busy} onClick={configure}>{t(job.status === 'failed' ? 'tableExport.retry' : 'tableExport.newExport')}</Button>
            {job.status === 'completed' && !job.expired && <Button disabled={busy} onClick={() => void download()}>{t('tableExport.download')}<Download className="h-4 w-4" aria-hidden="true" /></Button>}
          </> : <Button disabled={busy || !valid || currentCount === null || currentCount === 0 || Boolean(error)} onClick={() => void submit()}>{t('tableExport.export')}{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}</Button>}
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>;
}
