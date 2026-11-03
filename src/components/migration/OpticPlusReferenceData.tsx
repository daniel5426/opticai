import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { TablePagination } from '@/components/table-pagination';
import { opticPlusLabel, opticPlusDisplayValue } from '@/lib/opticplus-cards';

const tables = ['tb_ad_catalog', 'tb_catalog', 'sapakim', 'bank_list', 'credit_list', 'presence_type', 'add_num', 'add_order', 'companyn', 'doc_title'];
export function OpticPlusReferenceData({ jobId }: { jobId: string }) {
  const { t, i18n } = useTranslation();
  const [table, setTable] = useState('tb_ad_catalog');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<{ source_key: string; values: Record<string, unknown> }>; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setFailed(false); setData(null);
    const timer = setTimeout(() => {
      void apiClient.getMigrationReferenceData(jobId, table, search, page).then(result => {
        if (cancelled) return;
        if (result.error || !result.data) setFailed(true); else setData(result.data);
      }).catch(() => { if (!cancelled) setFailed(true); }).finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [jobId, table, search, page]);
  return <section className="space-y-3" dir={i18n.dir()} aria-label={t('opticplusCards.referenceTitle')}>
    <h3 className="font-medium">{t('opticplusCards.referenceTitle')}</h3>
    <div className="flex flex-wrap gap-2">
      <select aria-label={t('opticplus.table')} value={table} onChange={e => { setTable(e.target.value); setPage(1); }} className="h-9 rounded-md border bg-field px-2 text-sm">
        {tables.map(name => <option key={name} value={name}>{t(`opticplusCards.tables.${name}`)}</option>)}
      </select>
      <Input aria-label={t('opticplusCards.referenceSearch')} placeholder={t('opticplusCards.referenceSearch')}
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
    </div>
    {failed ? <p role="alert">{t('opticplusCards.referenceFailed')}</p> : <>
      <div className="max-h-96 space-y-3 overflow-auto rounded-xl bg-card p-3 shadow-sm" aria-busy={loading}>
        {loading ? <p role="status">{t('opticplus.checking')}</p> : data?.items.length ? data.items.map(item => <div key={item.source_key} className="border-b border-border/50 pb-3 last:border-0">
          <p className="mb-2 text-xs text-muted-foreground" dir="ltr">{table} / {item.source_key}</p>
          <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-1 text-sm">
            {Object.entries(item.values).filter(([, value]) => value !== null && value !== '').map(([field, value]) => <React.Fragment key={field}>
              <dt className="text-muted-foreground">{opticPlusLabel(t, field)}</dt><dd dir="auto" className="break-words">{opticPlusDisplayValue(t, value, i18n.language)}</dd>
            </React.Fragment>)}
          </dl>
        </div>) : <p>{t('opticplusCards.referenceEmpty')}</p>}
      </div>
      <TablePagination page={page} pageSize={25} total={data?.total ?? null} onPageChange={setPage} loading={loading} />
    </>}
  </section>;
}
