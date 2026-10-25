import { apiClient } from './api-client';
import { groupRequest, type OrderGroup, type OrderKind } from './order-groups';
import type { Client, Order } from './db/schema-interface';

export type OrderListBackend = 'groups' | 'legacy';
export interface OrderListOptions {
  clinicId: number;
  clientId?: number;
  page: number;
  q: string;
  kind: string;
  status: string;
  direction: 'asc' | 'desc';
}
export interface OrderListPage { items: OrderGroup[]; total: number | null; hasMore?: boolean }

function dataOrThrow<T>(response: { data?: T; error?: string }): T {
  if (response.error || response.data == null) throw new Error(response.error || 'orderGroupLoadError');
  return response.data;
}

// This is a view model only. Reading old orders never creates persisted groups.
export function legacyOrderRow(order: Partial<Order> & { __contact?: boolean; clientName?: string }, client?: Client): OrderGroup {
  if (!order.id || !order.client_id) throw new Error('Invalid legacy order');
  const kind: OrderKind = order.__contact ? 'contact' : 'regular';
  const rawDetails = order.order_data?.details;
  const details = rawDetails && typeof rawDetails === 'object' && !Array.isArray(rawDetails) ? rawDetails as Record<string, unknown> : {};
  const status = order.order_status || (typeof details.order_status === 'string' ? details.order_status : '');
  const record = { ...order, order_status: status, order_data: {
    ...order.order_data, details: { ...details, order_status: status },
  } };
  return {
    id: order.id!, clinic_id: order.clinic_id!, payer_client_id: order.client_id, revision: 0,
    legacy_order: { kind, id: order.id! }, opened_date: order.order_date,
    entries: [{ kind, position: 0, order: record }],
    clients: [client || { id: order.client_id, first_name: order.clientName || '', last_name: '' } as Client],
    billing: order.billing_id ? {
      id: order.billing_id,
      ...(kind === 'contact' ? { contact_lens_id: order.id } : { order_id: order.id }),
      total_after_discount: order.billing_total_after_discount,
      prepayment_amount: order.billing_prepayment_amount, currency: order.billing_currency,
    } : null,
    line_items: [],
  };
}

export async function loadOrderList(backend: OrderListBackend, options: OrderListOptions): Promise<OrderListPage> {
  const { clinicId, clientId, page, q, kind, status, direction } = options;
  if (backend === 'groups') {
    return groupRequest<OrderListPage>(`?clinic_id=${clinicId}${clientId ? `&client_id=${clientId}` : ''}&limit=25&offset=${(page - 1) * 25}&q=${encodeURIComponent(q)}&kind=${kind}&status=${encodeURIComponent(status)}&order=date_${direction}`);
  }
  if (!clientId) {
    const result = dataOrThrow(await apiClient.getOrdersPaginated(clinicId, {
      limit: 25, offset: (page - 1) * 25, q, kind, status, order: `date_${direction}`, includeTotal: false,
    }));
    return { items: result.items.map(order => legacyOrderRow(order)), total: result.total, hasMore: result.has_more };
  }
  const [regular, contact, client] = await Promise.all([
    apiClient.getOrdersByClient(clientId), apiClient.getContactLensOrdersByClient(clientId), apiClient.getClient(clientId),
  ]);
  const owner = dataOrThrow(client);
  const rows = [...dataOrThrow(regular), ...dataOrThrow(contact).map(order => ({ ...order, __contact: true }))]
    .map(order => legacyOrderRow(order, owner))
    .filter(row => (kind === 'all' || row.legacy_order!.kind === kind)
      && (status === 'all' || row.entries[0].order.order_status === status)
      && (!q || `${owner.first_name || ''} ${owner.last_name || ''} ${row.entries[0].order.type || ''} ${row.legacy_order!.id}`.toLocaleLowerCase().includes(q.toLocaleLowerCase())))
    .sort((a, b) => (String(a.opened_date || '').localeCompare(String(b.opened_date || '')) || a.id - b.id) * (direction === 'asc' ? 1 : -1));
  return { items: rows.slice((page - 1) * 25, page * 25), total: rows.length };
}

export async function loadLegacyOrderCount(options: OrderListOptions) {
  const result = dataOrThrow(await apiClient.getOrdersPaginated(options.clinicId, {
    q: options.q, kind: options.kind, status: options.status, countOnly: true, includeTotal: false,
  }));
  return result.total;
}

export async function removeOrderListRow(backend: OrderListBackend, row: OrderGroup) {
  if (backend === 'legacy') {
    if (!row.legacy_order) throw new Error('Missing legacy order');
    const result = await (row.legacy_order.kind === 'contact'
      ? apiClient.deleteContactLensOrder(row.legacy_order.id) : apiClient.deleteOrder(row.legacy_order.id));
    if (result.error) throw new Error(result.error);
    return;
  }
  const target = row.legacy_order
    ? await groupRequest<OrderGroup>(`/resolve/${row.legacy_order.kind}/${row.legacy_order.id}`, { method: 'POST' }) : row;
  await groupRequest(`/${target.id}?revision=${target.revision}`, { method: 'DELETE' });
}
