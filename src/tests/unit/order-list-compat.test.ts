import { beforeEach, expect, test, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { groupRequest } from '@/lib/order-groups';
import { legacyOrderRow, loadOrderList, removeOrderListRow } from '@/lib/order-list-compat';
import type { Client, Order } from '@/lib/db/schema-interface';

vi.mock('@/lib/api-client', () => ({ apiClient: {
  getOrdersPaginated: vi.fn(), getOrdersByClient: vi.fn(), getContactLensOrdersByClient: vi.fn(),
  getClient: vi.fn(), deleteOrder: vi.fn(), deleteContactLensOrder: vi.fn(),
} }));
vi.mock('@/lib/order-groups', async original => ({ ...await original<object>(), groupRequest: vi.fn() }));

const options = { clinicId: 3, page: 2, q: 'Test', kind: 'contact', status: 'Ready', direction: 'asc' as const };
const oldOrder = { id: 7, client_id: 5, clinic_id: 3, clientName: 'Test Client', __contact: true,
  order_date: '2026-10-01', type: 'Contact', order_status: 'Ready', billing_id: 9,
  billing_total_after_discount: 120, billing_prepayment_amount: 20, billing_currency: 'EUR',
} as unknown as Order & Record<string, any>;
beforeEach(() => vi.resetAllMocks());

test('adapts old paginated rows while preserving filters, paging, contact identity, names and invoice currency', async () => {
  vi.mocked(apiClient.getOrdersPaginated).mockResolvedValue({data:{items:[oldOrder],total:30,has_more:true}});
  const result = await loadOrderList('legacy', options);
  expect(apiClient.getOrdersPaginated).toHaveBeenCalledExactlyOnceWith(3, {
    includeTotal:false,limit:25,offset:25,q:'Test',kind:'contact',status:'Ready',order:'date_asc',
  });
  expect(result).toMatchObject({total:30,hasMore:true,items:[{
    id:7,legacy_order:{kind:'contact',id:7},payer_client_id:5,
    clients:[{id:5,first_name:'Test Client'}],
    billing:{id:9,total_after_discount:120,prepayment_amount:20,currency:'EUR',contact_lens_id:7},
  }]});
  expect(groupRequest).not.toHaveBeenCalled();
});

test('merges and pages the legacy client feeds without confusing regular and contact orders with the same ID', async () => {
  const regular = Array.from({length:26},(_,index)=>({...oldOrder,id:index+1,__contact:undefined,order_date:`2026-10-${String(index+1).padStart(2,'0')}`}));
  vi.mocked(apiClient.getOrdersByClient).mockResolvedValue({data:regular});
  vi.mocked(apiClient.getContactLensOrdersByClient).mockResolvedValue({data:[oldOrder]} as any);
  vi.mocked(apiClient.getClient).mockResolvedValue({data:{id:5,first_name:'Test',last_name:'Client'} as Client});
  const all = {...options,clientId:5,q:'',kind:'all',status:'all',direction:'desc' as const};
  const first = await loadOrderList('legacy',{...all,page:1});
  const second = await loadOrderList('legacy',{...all,page:2});
  expect(first.items).toHaveLength(25);
  expect(second.items).toHaveLength(2);
  expect(second.total).toBe(27);
  expect([...first.items,...second.items].filter(row=>row.id===7).map(row=>row.legacy_order!.kind).sort()).toEqual(['contact','regular']);
  const filtered = await loadOrderList('legacy',{...all,page:1,kind:'contact',status:'Ready',q:'Test Client'});
  expect(filtered.items).toHaveLength(1);
  expect(filtered.items[0].legacy_order!.kind).toBe('contact');
});

test('does not turn a legacy API failure into an empty table', async () => {
  vi.mocked(apiClient.getOrdersPaginated).mockResolvedValue({error:'Unauthorized',status:401});
  await expect(loadOrderList('legacy',options)).rejects.toThrow('Unauthorized');
});

test.each(['regular','contact'] as const)('deletes only the original %s order on an older backend', async kind => {
  vi.mocked(apiClient.deleteOrder).mockResolvedValue({data:undefined});
  vi.mocked(apiClient.deleteContactLensOrder).mockResolvedValue({data:undefined});
  const row=legacyOrderRow({...oldOrder,__contact:kind==='contact'});
  await removeOrderListRow('legacy',row);
  expect(kind==='contact'?apiClient.deleteContactLensOrder:apiClient.deleteOrder).toHaveBeenCalledExactlyOnceWith(7);
  expect(kind==='contact'?apiClient.deleteOrder:apiClient.deleteContactLensOrder).not.toHaveBeenCalled();
  expect(groupRequest).not.toHaveBeenCalled();
});

test('retains revision-aware deletion on the groups backend', async () => {
  const row={...legacyOrderRow(oldOrder),legacy_order:undefined,id:12,revision:4};
  await removeOrderListRow('groups',row);
  expect(groupRequest).toHaveBeenCalledExactlyOnceWith('/12?revision=4',{method:'DELETE'});
});

test('does not hide a failed legacy delete', async () => {
  vi.mocked(apiClient.deleteContactLensOrder).mockResolvedValue({error:'Forbidden',status:403});
  await expect(removeOrderListRow('legacy',legacyOrderRow(oldOrder))).rejects.toThrow('Forbidden');
});
