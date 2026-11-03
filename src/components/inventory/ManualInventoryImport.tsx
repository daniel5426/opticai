import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/contexts/UserContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { apiClient } from '@/lib/api-client';
import type { InventoryImportPreview, ImportDiagnostic } from '@/lib/inventory-import';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/table-pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const PAGE_SIZE = 25;
const columns = ['brand', 'model', 'sku', 'barcode', 'default_cost', 'default_retail', 'on_hand'];
const aliases: Record<string, string> = { brand: 'manufacturer', default_cost: 'cost', default_retail: 'retail' };
const templateColumns = ['category','brand','model','product_type','material','preferred_supplier','replacement_schedule','color','eye_size','bridge','temple_length','height','sph','bc','dia','pack_size','cyl','axis','add','design','sku','barcode','default_cost','default_retail','currency','is_stockable','on_hand','reorder_point','target_quantity'];

function ManualImport({ clinicId, onFinished }: { clinicId: number; onFinished: () => void }) {
  const { t } = useTranslation();
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<InventoryImportPreview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<{ created: number; skipped: number; errors: { row_number: number; error_details?: ImportDiagnostic[] }[] } | null>(null);
  const requestId = React.useRef(0);
  const receipt = React.useRef('');
  const worksheetSelection = React.useRef<string | undefined>(undefined);
  const fileInput = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => () => { requestId.current += 1; }, []);
  const diagnostic = (item: ImportDiagnostic) => t(item.key, { field: item.field ? t(`supply.field.${item.field}`) : '' });
  const failure = (status?: number, message?: string) => status === 403 ? 'supply.permissionDenied' : message?.startsWith('supply.') ? message : 'supply.manual.failed';
  const choose = async (chosen: File, worksheet?: string) => {
    const request = ++requestId.current; worksheetSelection.current = worksheet;
    setFile(chosen); setBusy(true); setError(''); setPreview(null); setResult(null); setPage(1);
    try {
      const response = await apiClient.previewInventoryImportFile(chosen, worksheet);
      if (request !== requestId.current) return;
      if (response.error || !response.data) { setError(failure(response.status, response.error)); return; }
      receipt.current = crypto.randomUUID(); setPreview(response.data);
    } catch { if (request === requestId.current) setError('supply.manual.failed'); }
    finally { if (request === requestId.current) setBusy(false); }
  };
  const apply = async () => {
    if (!preview?.valid || busy) return;
    const request = ++requestId.current;
    setBusy(true); setError('');
    try {
      const response = await apiClient.commitInventoryImport(clinicId, preview.rows.filter(row => row.status === 'valid'), receipt.current);
      if (request !== requestId.current) return;
      if (response.error || !response.data) { setError(failure(response.status, response.error)); return; }
      setResult({ created: response.data.created, skipped: preview.invalid + response.data.skipped, errors: response.data.validation_errors });
      setPreview(null);
      window.dispatchEvent(new Event('supply-applied')); onFinished();
    } catch { if (request === requestId.current) setError('supply.manual.failed'); }
    finally { if (request === requestId.current) setBusy(false); }
  };
  const template = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + templateColumns.join(',') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'inventory-template.csv'; link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="min-w-0 space-y-4">
    <p className="text-sm text-muted-foreground">{t('supply.manual.hint')}</p>
    <Button variant="outline" onClick={template}>{t('supply.manual.template')}</Button>
    <div className="space-y-2"><Label htmlFor="manual-supply-file">{t('supply.file')}</Label>
      <input ref={fileInput} className="sr-only" tabIndex={-1} id="manual-supply-file" type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={event => { const chosen = event.target.files?.[0]; if (chosen) void choose(chosen); }} />
      <Button variant="outline" className="w-full" dir={file ? 'ltr' : undefined} disabled={busy} onClick={() => fileInput.current?.click()}>{file?.name || t('supply.manual.chooseFile')}</Button></div>
    {busy && <p role="status" aria-live="polite">{t('supply.manual.processing')}</p>}
    {error && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{t(error)}</p>
      {!preview && file && <Button variant="outline" disabled={busy} onClick={() => void choose(file, worksheetSelection.current)}>{t('supply.manual.retryPreview')}</Button>}</div>}
    {preview && <>
      {file && /\.xlsx?$/i.test(file.name) && <div className="space-y-2"><Label htmlFor="manual-supply-sheet">{t('supply.manual.worksheet')}</Label>
        <select id="manual-supply-sheet" className="h-9 w-full rounded-md border bg-background px-3" value={preview.selected_worksheet} disabled={busy}
          onChange={event => void choose(file, event.target.value)}>{preview.worksheets.map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}</select></div>}
      {preview.file_error ? <p role="alert" className="text-sm text-destructive">{t(preview.file_error)}</p> : <>
        <p className="text-sm">{t('supply.manual.summary', { total: preview.total, valid: preview.valid, invalid: preview.invalid })}</p>
        <div className="max-h-[40vh] overflow-auto rounded-md border">
          <Table><TableHeader><TableRow><TableHead className="text-start">{t('supply.manual.row')}</TableHead>{columns.map(column => <TableHead key={column} className="text-start">{t(`supply.field.${column}`)}</TableHead>)}<TableHead className="text-start">{t('supply.manual.validation')}</TableHead></TableRow></TableHeader>
            <TableBody>{preview.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(row => <TableRow key={row.row_number}>
              <TableCell><span dir="ltr">{row.worksheet} · {row.row_number}</span></TableCell>
              {columns.map(column => <TableCell key={column} dir={['brand', 'model'].includes(column) ? undefined : 'ltr'}>{String(row.source_values[column] ?? row.source_values[aliases[column]] ?? '—')}</TableCell>)}
              <TableCell className="min-w-56 max-w-sm whitespace-normal">{row.status === 'valid' ? t('supply.manual.valid') : <ul className="space-y-1 text-destructive">{row.error_details.map((item, index) => <li key={index}>{diagnostic(item)}</li>)}</ul>}</TableCell>
            </TableRow>)}</TableBody></Table>
        </div>
        <TablePagination page={page} pageSize={PAGE_SIZE} total={preview.total} onPageChange={setPage} loading={busy} />
        <p className="text-sm text-muted-foreground">{t('supply.manual.skip', { count: preview.invalid })}</p>
        <div className="flex justify-end"><Button disabled={busy || !preview.valid} onClick={() => void apply()}>{t('supply.manual.apply', { count: preview.valid })}</Button></div>
      </>}
    </>}
    {result && <div role="status" className="space-y-2"><p>{t('supply.manual.result', { created: result.created, skipped: result.skipped })}</p>
      {result.errors.map(row => <div key={row.row_number} className="text-sm text-destructive">{t('supply.rowError', { row: row.row_number })}
        {row.error_details?.map((item, index) => <p key={index}>{diagnostic(item)}</p>)}</div>)}</div>}
  </div>;
}

export function ManualInventoryImportDialog({ open, onOpenChange, onFinished }: { open: boolean; onOpenChange: (open: boolean) => void; onFinished: () => void }) {
  const { currentClinic } = useUser(); const { t } = useTranslation(); const { direction } = useAppLocale();
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir={direction} className="flex max-h-[90vh] sm:max-w-5xl flex-col">
    <DialogHeader><DialogTitle>{t('supply.manual.import')}</DialogTitle><DialogDescription>{t('supply.manual.description')}</DialogDescription></DialogHeader>
    <div className="min-h-0 overflow-y-auto">{open && currentClinic?.id && <ManualImport key={currentClinic.id} clinicId={currentClinic.id} onFinished={onFinished} />}</div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t('supply.close')}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
