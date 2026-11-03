import { BarcodeScanButton, ProductBarcodeScan } from "./BarcodeScanButton";
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { agentJson } from '@/services/agent-client';
import { useAppLocale } from '@/localization/use-app-locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TablePagination } from '@/components/table-pagination';
import { apiClient } from '@/lib/api-client';

type Row = { id: string; source: unknown; values: Record<string, string | number | boolean | null>; variant_id?: number | null; selected: boolean; errors: string[]; action: string; before?: Record<string, any> };
type Proposal = { status: string; operation: string; revision: string; rows: Row[]; applied?: {variant_id: number}[]; platform_failure?: { code: string; failure_id: string; retryable: boolean } };
type Job = { id: string; title?: string; status: string; result?: Proposal };
const fields = ['category','brand','model','preferred_supplier','sku','barcode','color','eye_size','bridge','temple_length','height','sph','bc','dia','cyl','axis','add','pack_size','replacement_schedule','product_type','material','design','currency','default_cost','default_retail','quantity'];
function Match({ row, disabled, onChange }: { row: Row; disabled?: boolean; onChange: (id: number | null) => void }) {
  const workspace = usePrysmAgent(); const { t } = useTranslation(); const [search, setSearch] = React.useState('');
  const [items, setItems] = React.useState<{id: number; display_name: string}[]>([]);
  React.useEffect(() => {
    let active = true; setItems([]);
    const timer = setTimeout(() => { if (search.trim() && workspace?.scope) void apiClient.getInventoryVariants(workspace.scope.clinicId, { search }).then(result => { if (active) setItems(result.data?.items || []); }).catch(() => { if (active) setItems([]); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [search, workspace?.scope?.clinicId]);
  return <div className="space-y-2">
    <p className="text-sm">{row.before?.display_name || t('supply.newItem')}</p>
    <ProductBarcodeScan disabled={disabled} clinicId={workspace?.scope?.clinicId} category={row.values.category === 'frame' || row.values.category === 'contact_lens' ? row.values.category : undefined} onSelect={variant => { onChange(variant.id); setSearch(''); }} />
    <Input aria-label={t('supply.findMatch')} placeholder={t('supply.findMatch')} value={search} onChange={event => setSearch(event.target.value)} />
    {search && items.slice(0, 10).map(item => <Button key={item.id} variant="ghost" size="sm" onClick={() => { onChange(item.id); setSearch(''); }}>{item.display_name}</Button>)}
    {row.variant_id && <Button variant="ghost" size="sm" onClick={() => onChange(null)}>{t('supply.newItem')}</Button>}
  </div>;
}
export function SupplyReview(props: { jobId: string; onApplied?: () => void }) {
  const workspace = usePrysmAgent();
  return <SupplyReviewContent key={`${workspace?.scope?.userId}:${workspace?.scope?.clinicId}:${workspace?.scope?.patientId || 0}:${props.jobId}`} {...props} />;
}

function SupplyReviewContent({ jobId, onApplied }: { jobId: string; onApplied?: () => void }) {
  const workspace = usePrysmAgent(); const { t } = useTranslation(); const cache = useQueryClient();
  const [draft, setDraft] = React.useState<Proposal | null>(null); const [dirty, setDirty] = React.useState(false); const [busy, setBusy] = React.useState(false);
  const [page, setPage] = React.useState(1); const [actionError, setActionError] = React.useState('');
  const { data, error: queryError, isError, refetch } = useQuery({ queryKey: ['supply-job', workspace?.scope?.userId, workspace?.scope?.clinicId, jobId], queryFn: () => agentJson<Job>(workspace!.scope!, `/supply/${jobId}`), enabled: !!workspace?.scope, retry: false,
    refetchInterval: query => ['queued', 'running', 'uploading'].includes(query.state.data?.status || '') ? 1500 : false });
  React.useEffect(() => { setDraft(null); setDirty(false); }, [jobId]);
  React.useEffect(() => { if (data?.result?.rows && (!dirty || data.result.status === 'committed')) setDraft(data.result); }, [data, dirty]);
  const edit = (index: number, update: Partial<Row>) => { setDirty(true); setDraft(current => current && ({ ...current, rows: current.rows.map((row, i) => i === index ? { ...row, ...update } : row) })); };
  const action = async (apply: boolean) => {
    if (!workspace?.scope || !draft) return;
    setBusy(true); setActionError('');
    try {
      const result = await agentJson<Proposal>(workspace.scope, `/supply/${jobId}/${apply ? 'apply' : 'review'}`, { method: 'POST', body: JSON.stringify(apply ? { revision: draft.revision } : draft) });
      cache.setQueryData(['supply-job', workspace.scope.userId, workspace.scope.clinicId, jobId], { ...data, status: 'completed', result });
      setDraft(result); setDirty(false);
      await cache.invalidateQueries({ queryKey: ['supply-job'] }); await cache.invalidateQueries({ queryKey: ['supply-proposals'] });
      if (apply) { toast.success(t('supply.applied')); window.dispatchEvent(new Event('supply-applied')); onApplied?.(); }
    } catch (error) { setActionError(failureKey(error)); } finally { setBusy(false); }
  };
  const failureKey = (error: unknown) => {
    const status = (error as { status?: number })?.status;
    return status === 403 ? 'supply.permissionDenied' : status === 410 ? 'supply.expired' : status === 404 ? 'supply.unavailable' : status === 409 ? 'supply.stale' : 'supply.failed';
  };
  const reload = async () => { setDirty(false); setDraft(null); setActionError(''); await refetch(); };
  if (isError) return <div className="space-y-2"><p role="alert">{t(failureKey(queryError))}</p>
    <Button variant="outline" onClick={() => void refetch()}>{t('supply.reload')}</Button></div>;
  if (['failed', 'cancelled'].includes(data?.status || '')) return <div className="space-y-2">
    <p role="alert">{t(data?.result?.platform_failure?.code === 'BILLING_CREDITS_INSUFFICIENT' ? 'supply.creditsRequired' : 'supply.failed')}</p>
    {data?.result?.platform_failure?.failure_id && <p className="text-xs text-muted-foreground">{t('supply.failureReference')}: <code dir="ltr">{data.result.platform_failure.failure_id}</code></p>}
    {actionError && <p role="alert">{t(actionError)}</p>}
    <Button variant="outline" disabled={busy} onClick={async () => {
      if (!workspace?.scope) return; setBusy(true); setActionError('');
      try { await agentJson(workspace.scope, `/supply/${jobId}/retry`, { method: 'POST' }); await cache.invalidateQueries({ queryKey: ['supply-job'] }); }
      catch (error) { setActionError(failureKey(error)); } finally { setBusy(false); }
    }}>{t('agent.voice.retry')}</Button></div>;
  if (!draft) return <p role="status" aria-live="polite">{t('supply.processing')}</p>;
  if (draft.status === 'committed') return <div role="status"><p>{t('supply.appliedCount', {count: draft.applied?.length || 0})}</p><a className="underline" href="/inventory">{t('supply.openInventory')}</a></div>;
  const selected = draft.rows.filter(row => row.selected);
  return <fieldset disabled={busy} className="min-w-0 space-y-4">
    <Label htmlFor={`supply-operation-${jobId}`}>{t('supply.operation')}</Label>
    <select id={`supply-operation-${jobId}`} className="bg-background h-9 rounded-md border px-3" value={draft.operation} disabled={busy} onChange={event => { setDirty(true); setDraft({...draft, operation: event.target.value}); }}>
      {['catalog','prices','receipt','count'].map(value => <option key={value} value={value}>{t(`supply.${value}`)}</option>)}
    </select>
    <p className="text-sm text-muted-foreground">{t(`supply.${draft.operation}Hint`)}</p>
    {draft.operation === 'catalog' && draft.rows.some(row => row.variant_id) && <p className="text-sm text-muted-foreground">{t('supply.sharedProductHint')}</p>}
    <p className="text-sm">{t('supply.summary', { total: draft.rows.length, selected: selected.length, errors: selected.filter(row => row.errors.length).length })}</p>
    <div className="max-h-[50vh] space-y-2 overflow-auto">
      {draft.rows.slice((page - 1) * 25, page * 25).map((row, localIndex) => { const index = (page - 1) * 25 + localIndex; return <details key={row.id} className="rounded-md border p-3" open={row.errors.length > 0 || undefined}>
        <summary className="cursor-pointer text-sm font-medium">{row.values.brand} {row.values.model || row.values.sku || t('supply.newItem')} · {t(`supply.${row.action}`)}</summary>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={row.selected} onChange={event => edit(index, {selected: event.target.checked})} />{t('supply.include')}</label>
          <Match row={row} disabled={busy} onChange={variant_id => edit(index, {variant_id})} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fields.filter(field => field in row.values || ['category', 'brand', 'model', 'sku', 'barcode', 'quantity', 'default_retail', ...(row.values.category === 'contact_lens' ? ['sph','bc','dia','pack_size'] : ['color','eye_size'])].includes(field)).map(field => {
              const before = row.before?.[field] ?? row.before?.product?.[field] ?? row.before?.attributes?.[field] ?? (field === 'quantity' ? row.before?.balance?.on_hand : undefined);
              return <div key={field} className="space-y-1"><Label htmlFor={`${jobId}-${index}-${field}`}>{t(`supply.field.${field}`)}</Label>
                {field === 'barcode' && <BarcodeScanButton disabled={busy} onScan={code => { edit(index, {values: {...row.values, barcode: code}}); }} />}
                {field === 'category' ? <select id={`${jobId}-${index}-${field}`} className="bg-background h-9 w-full rounded-md border px-3" value={String(row.values[field] || '')} onChange={event => edit(index, {values:{...row.values, [field]:event.target.value}})}><option value="">—</option><option value="frame">{t('supply.categoryFrame')}</option><option value="contact_lens">{t('supply.categoryContact')}</option></select> : <Input id={`${jobId}-${index}-${field}`} dir={['sku','barcode','quantity','default_cost','default_retail','currency','sph','bc','dia','cyl','axis','add','pack_size','eye_size','bridge','height','temple_length'].includes(field) ? 'ltr' : undefined} value={String(row.values[field] ?? '')} onChange={event => edit(index, {values: {...row.values, [field]: event.target.value}})} />}
                {before != null && <p className="text-xs text-muted-foreground">{t('supply.before')}: {String(before)}</p>}
              </div>;
            })}
          </div>
          {'default_cost' in row.values && <Button variant="ghost" size="sm" onClick={() => { const values = {...row.values}; delete values.default_cost; edit(index, {values}); }}>{t('supply.ignoreCost')}</Button>}
          {row.errors.map((error, i) => <p key={i} role="alert" className="text-sm text-destructive">{t(error)}</p>)}
          <details><summary className="text-xs">{t('supply.source')}</summary><pre dir="ltr" className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(row.source, null, 2)}</pre></details>
        </div>
      </details>; })}
    </div>
    <TablePagination page={page} pageSize={25} total={draft.rows.length} onPageChange={setPage} loading={busy} />
    {actionError && <div className="space-y-2"><p role="alert">{t(actionError)}</p>{actionError === 'supply.stale' && <Button variant="outline" onClick={() => void reload()}>{t('supply.reload')}</Button>}</div>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" disabled={busy || !dirty} onClick={() => void action(false)}>{t('supply.validate')}</Button>
      <Button disabled={busy || actionError === 'supply.stale' || dirty || !selected.length || selected.some(row => row.errors.length > 0)} onClick={() => void action(true)}>{t('supply.apply')}</Button>
    </div>
  </fieldset>;
}
export function PreviousSupplyImports() {
  const workspace = usePrysmAgent(); const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const { data, isError } = useQuery({ queryKey: ['supply-proposals', workspace?.scope?.userId, workspace?.scope?.clinicId, 'legacy'],
    queryFn: () => agentJson<Job[]>(workspace!.scope!, '/supply?legacy_only=true'),
    enabled: expanded && !!workspace?.available && !workspace.scope?.patientId });
  React.useEffect(() => { setJobId(null); setExpanded(false); }, [workspace?.scope?.clinicId, workspace?.scope?.userId]);
  if (workspace?.scope?.patientId) return null;
  return <details className="mx-4 rounded-md border p-3 text-sm" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer">{t('supply.previousImports')}</summary>
    {expanded && <div className="mt-3 space-y-3">
      {isError && <p role="alert">{t('supply.failed')}</p>}
      {data?.length === 0 && <p>{t('supply.noPreviousImports')}</p>}
      {data?.map(job => <Button key={job.id} variant="outline" size="sm" className="w-full justify-start" onClick={() => setJobId(job.id)}>{job.title || t('supply.review')}</Button>)}
      {jobId && <SupplyReview jobId={jobId} />}
    </div>}
  </details>;
}
