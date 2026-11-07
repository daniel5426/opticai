import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const RECORDS_CHANGED = 'prysm:client-records-changed';
export type RecordFamily = 'clients' | 'exams' | 'orders' | 'medical-logs' | 'referrals' | 'appointments' | 'files' | 'trash';
export interface RecordChange { family: RecordFamily; ids: number[]; clientIds: number[] }
const families: Record<string, RecordFamily> = { clients: 'clients', families: 'clients', exams: 'exams',
  'unified-exam-data': 'exams', 'exam-layouts': 'exams', orders: 'orders', 'contact-lens-orders': 'orders',
  'order-groups': 'orders', 'medical-logs': 'medical-logs', referrals: 'referrals', appointments: 'appointments', files: 'files', trash: 'trash' };
const pending = new Map<RecordFamily, RecordChange>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function notifyRecordWrite(endpoint: string, options: RequestInit, data: any) {
  if (typeof window === 'undefined' || !options.method || options.method.toUpperCase() === 'GET' || endpoint.includes('recent-visit')) return;
  const root = endpoint.split('/')[1];
  const family = families[root];
  if (!family) return;
  // Template edits are not patient writes. Instance routes still refresh exam views.
  if (root === 'exam-layouts' && !endpoint.includes('/instances')) return;
  let body: any = {};
  try { if (typeof options.body === 'string') body = JSON.parse(options.body); } catch { /* Non-JSON write. */ }
  const value = data?.group || data || {};
  const ids = [value.id, value.exam?.id, ...(root === 'unified-exam-data' ? [] : [Number(endpoint.split('/')[2])])].filter(id => Number.isFinite(id) && id > 0);
  const clientIds = [value.client_id, value.exam?.client_id, value.payer_client_id, body.client_id, body.exam?.client_id,
    ...(value.clients || []).map((client: any) => client.id), ...(value.entries || []).map((entry: any) => entry.order?.client_id),
    ...(body.entries || []).map((entry: any) => entry.order?.client_id), ...(root === 'clients' ? ids : [])]
    .filter(id => Number.isFinite(id) && id > 0);
  const previous = pending.get(family);
  pending.set(family, { family, ids: [...new Set([...(previous?.ids || []), ...ids])],
    clientIds: [...new Set([...(previous?.clientIds || []), ...clientIds])] });
  if (timer === undefined) timer = setTimeout(() => {
    const changes = [...pending.values()]; pending.clear(); timer = undefined;
    for (const change of changes) window.dispatchEvent(new CustomEvent<RecordChange>(RECORDS_CHANGED, { detail: change }));
  }, 0);
}

export function affectsFamily(event: Event, family: RecordFamily) {
  const detail = (event as CustomEvent<RecordChange>).detail;
  // Old import/restore notifications have no detail; keep their refresh behavior.
  return !detail || detail.family === family || detail.family === 'trash' || (family === 'clients' && detail.family !== 'files');
}

export function affectedQuery(key: QueryKey, change: RecordChange, companyId?: number) {
  const root = String(key[0]);
  if (root === 'client') {
    if (companyId && typeof key[2] === 'number' && key[2] !== companyId) return false;
    if (change.clientIds.length && !change.clientIds.includes(Number(key[1]))) return false;
    const section = key.slice(2).find(part => typeof part === 'string');
    if (change.family === 'trash') return true;
    if (change.family === 'clients') return !section;
    if (!section) return false;
    return change.family === 'orders' ? ['orders', 'orders-context'].includes(String(section))
      : change.family === 'exams' ? ['exams', 'exam-dates', 'orders-context'].includes(String(section))
      : section === change.family;
  }
  if (change.family === 'trash') return ['clients', 'orders', 'order-groups', 'exams', 'exam-page-data', 'referrals', 'appointments', 'files', 'trash'].includes(root);
  if (root === 'exam-page-data') return change.family === 'exams' && (!change.ids.length || change.ids.includes(Number(key[1])));
  if (change.family === 'orders') {
    if (root === 'order-groups' && companyId && typeof key[1] === 'number' && key[1] !== companyId) return false;
    return ['orders', 'order-groups', 'order-group-count', 'inventory', 'inventory-allocations'].includes(root);
  }
  return root === change.family || (root === 'clients' && change.family !== 'files');
}

export function invalidateRecordQueries(queryClient: QueryClient, event: Event, companyId?: number) {
  const change = (event as CustomEvent<RecordChange>).detail;
  if (!change) {
    void queryClient.invalidateQueries({ predicate: query => ['client', 'clients', 'orders', 'order-groups', 'exams', 'exam-page-data', 'referrals', 'appointments', 'files', 'trash'].includes(String(query.queryKey[0])) });
    return;
  }
  void queryClient.invalidateQueries({ predicate: query => affectedQuery(query.queryKey, change, companyId) });
}
