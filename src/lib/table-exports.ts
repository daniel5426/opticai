import { apiClient } from '@/lib/api-client';
import i18n from '@/localization/i18n';
import { toast } from 'sonner';

export const exportColumns = {
  clients: ['id', 'first_name', 'last_name', 'gender', 'national_id', 'phone_mobile', 'email'],
  orders: ['date', 'clients', 'kind', 'status', 'payer', 'balance'],
  exams: ['exam_date', 'test_name', 'client', 'clinic', 'examiner'],
  appointments: ['date', 'time', 'client', 'exam_name', 'examiner', 'note'],
  referrals: ['date', 'type', 'client', 'urgency', 'recipient'],
  files: ['file_name', 'type', 'file_size', 'upload_date', 'client'],
  inventory: ['product', 'category', 'variant', 'sku', 'on_hand', 'reserved', 'available', 'retail', 'cost'],
} as const;
export type ExportTable = keyof typeof exportColumns;
export type ExportFilter = { key: string; value: string; label: string; options: { value: string; label: string }[] };
export type ExportConfig = { table: ExportTable; clinicId?: number; sort: string; columns?: string[]; filters?: ExportFilter[]; productName?: string; placement?: 'beforeNavigation' };
export type ExportSnapshot = ExportConfig & { search: string; filters: ExportFilter[]; clinicName: string };
export type ExportRequest = { table: ExportTable; clinic_id: number | null; search: string; filters: Record<string, string>; columns: string[]; sort: string; locale: 'he' | 'en' | 'fr'; format: 'xlsx' | 'csv'; start_date: string | null; end_date: string | null; request_key: string };
export type ExportJob = { id: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'; expired: boolean; format: 'xlsx' | 'csv'; rows: number | null; error?: string | null };
export type ExportTask = { request: ExportRequest; snapshot: ExportSnapshot; job: ExportJob; pollError?: boolean };

export async function exportJson<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await apiClient.tableExportFetch(path, options); } catch { throw new Error('tableExport.unavailable'); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(typeof body.detail === 'string' && body.detail.startsWith('tableExport.') ? body.detail : response.status === 410 ? 'tableExport.expired' : response.status === 422 ? 'tableExport.invalidRequest' : 'tableExport.unavailable'), { status: response.status });
  }
  return response.json();
}
export async function downloadTableExport(id: string) {
  const response = await apiClient.tableExportFetch(`/${encodeURIComponent(id)}/download`);
  if (!response.ok) throw new Error(response.status === 410 ? 'tableExport.expired' : 'tableExport.unavailable');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  const name = response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  anchor.download = name ? decodeURIComponent(name) : 'export.xlsx';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const tasks = new Map<string, ExportTask>();
const listeners = new Set<() => void>();
export const subscribeExportTasks = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getExportTask = (key: string) => tasks.get(key);
export function setExportTask(key: string, task?: ExportTask) {
  if (task) tasks.set(key, task); else tasks.delete(key);
  listeners.forEach(listener => listener());
}
export async function startExport(key: string, request: ExportRequest, snapshot: ExportSnapshot) {
  const job = await exportJson<ExportJob>('', { method: 'POST', body: JSON.stringify(request) });
  const task = { request, snapshot, job };
  setExportTask(key, task);
  void pollExport(key, task);
}
async function pollExport(key: string, task: ExportTask, failures = 0) {
  if (getExportTask(key)?.job.id !== task.job.id || !['queued', 'running'].includes(task.job.status)) return;
  try {
    const job = await exportJson<ExportJob>(`/${task.job.id}`);
    if (getExportTask(key)?.job.id !== task.job.id) return;
    task = { ...task, job };
    setExportTask(key, task);
    if (job.status === 'completed') {
      toast.success(i18n.t('tableExport.completed'), { action: { label: i18n.t('tableExport.download'), onClick: () => { void downloadTableExport(job.id).catch(error => toast.error(i18n.t(error.message))); } } });
    } else if (job.status === 'failed') {
      toast.error(i18n.t(job.error || 'tableExport.failed'));
    }
    failures = 0;
  } catch (error) {
    if (getExportTask(key)?.job.id !== task.job.id) return;
    if ([401, 403, 404, 410].includes((error as { status?: number }).status || 0)) {
      setExportTask(key, { ...task, job: { ...task.job, status: 'failed', error: error instanceof Error ? error.message : 'tableExport.failed' } });
      return;
    }
    failures = Math.min(failures + 1, 8);
    setExportTask(key, { ...task, pollError: true });
  }
  if (['queued', 'running'].includes(task.job.status)) setTimeout(() => { void pollExport(key, task, failures); }, Math.min(15000, 2000 * Math.max(1, failures)));
}

/** Calendar arithmetic in Israel, independent of the computer's timezone. */
export function exportDatePreset(preset: string, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
  if (preset === 'all') return { start_date: null, end_date: null };
  const end = new Date(`${today}T12:00:00Z`);
  if (preset === 'month') {
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0));
    return { start_date: `${today.slice(0, 7)}-01`, end_date: last.toISOString().slice(0, 10) };
  }
  end.setUTCDate(end.getUTCDate() - 29);
  return { start_date: end.toISOString().slice(0, 10), end_date: today };
}
