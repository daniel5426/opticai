import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';
import { OrderGroupPaymentCell } from '@/components/order-groups/OrderGroupPaymentCell';
import { OrderGroupList } from '@/components/order-groups/OrderGroupList';
import { groupRequest, type OrderGroup } from '@/lib/order-groups';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import AllOrdersPage from '@/pages/AllOrdersPage';
import { ClientOrdersTab } from '@/components/client/ClientOrdersTab';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({clientId:'1'}),
  Link: ({ to, params, search, children, onClick, ...rest }: any) => <a {...rest} href={`${to.replace('$clientId', params.clientId)}?tab=${search.tab}`} onClick={event => { event.preventDefault(); onClick?.(event); }}>{children}</a>,
}));
vi.mock('@/components/site-header', () => ({ SiteHeader: ({title}: {title:string}) => <h1>{title}</h1> }));
vi.mock('@/components/ClientSelectModal', () => ({ ClientSelectModal: () => null }));
vi.mock('@/lib/order-groups', async original => ({ ...await original<object>(), groupRequest: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { getBilling: vi.fn(), getBillingPayments: vi.fn(), createBillingPayment: vi.fn(), orderGroupRequest: vi.fn(), getOrdersPaginated: vi.fn(), getOrdersByClient: vi.fn(), getContactLensOrdersByClient: vi.fn(), getClient: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const group = {
  id: 10, clinic_id: 1, payer_client_id: 1, revision: 2, opened_date: '2026-10-01',
  clients: [{ id: 1, first_name: 'Test', last_name: 'Client' }, { id: 2, first_name: 'Other', last_name: 'Client' }],
  entries: [{ id: 1, kind: 'regular', position: 0, order: { id: 7, client_id: 1, type: 'Distance' } }, { id: 2, kind: 'contact', position: 1, order: { id: 8, client_id: 2, type: 'Contact' } }],
  billing: { id: 50, total_after_discount: 100, prepayment_amount: 30, currency: 'EUR' }, line_items: [],
} as unknown as OrderGroup;
const payment = { id: 8, billing_id: 50, amount: 20, paid_at: '2026-10-18', currency: 'EUR', kind: 'payment' };
let active: OrderGroup;
let history: typeof payment[];
function wrap(child: React.ReactNode) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cache.setQueryData(['order-groups', 1], { items: [group], total: 1 });
  return { cache, ...render(<QueryClientProvider client={cache}>{child}</QueryClientProvider>) };
}
function paymentButton() { return screen.getByRole('button', { name: new RegExp(i18n.t('orderGroupPartiallyPaid')) }); }
async function enterPayment(value = '20', date = '2026-10-18') {
  fireEvent.change(await screen.findByRole('textbox', { name: i18n.t('orderGroupAmount') }), { target: { value } });
  fireEvent.change(screen.getByRole('textbox', { name: i18n.t('orderGroupDate') }), { target: { value: date } });
  await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('orderGroupAddPayment') })).toBeEnabled());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  active = structuredClone(group); history = [];
  vi.mocked(apiClient.orderGroupRequest).mockResolvedValue({data:{available:true}});
  vi.mocked(useUser).mockReturnValue({ currentUser: { id: 1, role_level: 2 }, currentClinic: { id: 1 } } as any);
  vi.mocked(groupRequest).mockImplementation(async (path, options) => {
    if (path.startsWith('?')) return { items: [active], total: 1 };
    if (path === '/10') return active;
    if (path === '/10/payments') return history;
    if (path.startsWith('/10/payments?revision=') && options?.method === 'POST') {
      active = { ...active, revision: active.revision + 1, billing: { ...active.billing!, prepayment_amount: 50 } };
      history = [payment];
      return { payment, group: active };
    }
    throw new Error(`Unexpected request: ${path}`);
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe.each(['he', 'en', 'fr'] as const)('quick payment in %s', locale => {
  test('shows a paid tag without a redundant zero balance', async () => {
    await i18n.changeLanguage(locale);
    const paidGroup = { ...group, billing: { ...group.billing!, prepayment_amount: 100 } };
    wrap(<OrderGroupPaymentCell group={paidGroup} />);
    const trigger = screen.getByRole('button', { name: i18n.t('orderGroupPaid') });
    expect(trigger).toHaveTextContent(i18n.t('orderGroupPaid'));
    expect(trigger.querySelector('[dir="ltr"]')).toBeNull();
  });

  test('records one payment from the table and updates the shared balance without opening the order', async () => {
    await i18n.changeLanguage(locale);
    const rowClick = vi.fn();
    const { cache } = wrap(<div onClick={rowClick}><OrderGroupPaymentCell group={group} /></div>);
    await userEvent.click(paymentButton());
    await enterPayment();
    const amountInput = screen.getByRole('textbox', { name: i18n.t('orderGroupAmount') });
    expect(amountInput).toHaveAttribute('dir', 'ltr');
    expect(amountInput.closest('[role="menu"]')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    await userEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupAddPayment') }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('orderGroupPaymentSaved')));
    const writes = vi.mocked(groupRequest).mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe('/10/payments?revision=2');
    expect(JSON.parse(writes[0][1]!.body as string)).toEqual({ amount: 20, paid_at: '2026-10-18', kind: 'payment' });
    expect(cache.getQueryData<any>(['order-groups', 1]).items[0].billing.prepayment_amount).toBe(50);
    expect(rowClick).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: i18n.t('orderGroupAmount') })).toHaveValue('');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(rowClick).not.toHaveBeenCalled();
  });
});

test('uses the latest revision and preserves the draft on a conflict without retrying the payment', async () => {
  await i18n.changeLanguage('en');
  const request = vi.mocked(groupRequest).getMockImplementation()!;
  vi.mocked(groupRequest).mockImplementation(async (path, options) => {
    if (options?.method === 'POST') throw new Error('order_group_conflict');
    if (path === '/10') return { ...active, revision: 4 };
    return request(path, options);
  });
  wrap(<OrderGroupPaymentCell group={group} />);
  await userEvent.click(paymentButton()); await enterPayment();
  await userEvent.click(screen.getByRole('button', { name: 'Add payment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('orderGroupConflict'));
  expect(Number((screen.getByRole('textbox', { name: 'Amount' }) as HTMLInputElement).value)).toBe(20);
  expect(vi.mocked(groupRequest).mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(vi.mocked(groupRequest).mock.calls.find(([, options]) => options?.method === 'POST')![0]).toBe('/10/payments?revision=4');
});

test('rejects non-positive amounts without a write and restricts payment controls to editors', async () => {
  await i18n.changeLanguage('en');
  const view = wrap(<OrderGroupPaymentCell group={group} />);
  await userEvent.click(paymentButton()); await enterPayment('0');
  await userEvent.click(screen.getByRole('button', { name: 'Add payment' }));
  expect(toast.error).toHaveBeenCalledWith(i18n.t('orderGroupPositivePayment'));
  expect(vi.mocked(groupRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  view.unmount();
  vi.mocked(useUser).mockReturnValue({ currentUser: { id: 1, role_level: 1 } } as any);
  wrap(<OrderGroupPaymentCell group={group} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('restores client and payer links and the red delete action independently of the order row', async () => {
  await i18n.changeLanguage('en');
  wrap(<OrderGroupList />);
  const clientLinks = await screen.findAllByRole('link', { name: 'Test Client' });
  expect(clientLinks).toHaveLength(2);
  expect(clientLinks[0]).toHaveAttribute('href', '/clients/1?tab=orders');
  expect(screen.getByRole('link', { name: 'Other Client' })).toHaveAttribute('href', '/clients/2?tab=orders');
  await userEvent.click(clientLinks[0]);
  expect(mocks.navigate).not.toHaveBeenCalled();
  const remove = screen.getByRole('button', { name: i18n.t('orderGroupDelete') });
  expect(remove.querySelector('svg')).toHaveClass('text-red-600');
  await userEvent.click(paymentButton());
  expect(await screen.findByRole('textbox', { name: 'Amount' })).toBeInTheDocument();
  expect(mocks.navigate).not.toHaveBeenCalled();
});


test('keeps the payment action disabled when history cannot be loaded', async () => {
  await i18n.changeLanguage('en');
  const request = vi.mocked(groupRequest).getMockImplementation()!;
  vi.mocked(groupRequest).mockImplementation((path, options) => path === '/10/payments' ? Promise.reject(new Error('Unavailable')) : request(path, options));
  wrap(<OrderGroupPaymentCell group={group} />);
  await userEvent.click(paymentButton());
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('orderGroupPaymentHistoryError'));
  expect(screen.getByRole('button', { name: 'Add payment' })).toBeDisabled();
  expect(vi.mocked(groupRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});

test('links an ungrouped contact order only when a payment is submitted', async () => {
  await i18n.changeLanguage('en');
  vi.mocked(apiClient.getBilling).mockResolvedValue({ data: group.billing } as any);
  vi.mocked(apiClient.getBillingPayments).mockResolvedValue({ data: [] });
  const request = vi.mocked(groupRequest).getMockImplementation()!;
  vi.mocked(groupRequest).mockImplementation((path, options) => path === '/resolve/contact/8' ? Promise.resolve(group) : request(path, options));
  const legacy = { ...group, id: 8, legacy_order: { kind: 'contact' as const, id: 8 }, entries: group.entries.filter(entry => entry.kind === 'contact') };
  wrap(<OrderGroupPaymentCell group={legacy} />);
  await userEvent.click(paymentButton());
  await enterPayment();
  expect(vi.mocked(groupRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: 'Add payment' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('orderGroupPaymentSaved')));
  expect(vi.mocked(groupRequest).mock.calls.filter(([, options]) => options?.method === 'POST').map(([path]) => path)).toEqual(['/resolve/contact/8', '/10/payments?revision=2']);
});

const oldOrder = { id: 8, client_id: 1, clinic_id: 1, clientName: 'Test Client', order_date: '2026-10-01', __contact: true, type: 'Contact', billing_id: 50, billing_total_after_discount: 100, billing_prepayment_amount: 30, billing_currency: 'EUR' };

describe.each(['he', 'en', 'fr'] as const)('one Orders UI in %s', locale => {
  test.each([true, false])('keeps the same table while detecting group support: %s', async available => {
    await i18n.changeLanguage(locale);
    let finish!: (response: any) => void;
    vi.mocked(apiClient.orderGroupRequest).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.mocked(apiClient.getOrdersPaginated).mockResolvedValue({ data: { items: [oldOrder], total: 1, has_more: false } });
    wrap(<AllOrdersPage />);
    const table = screen.getByRole('table');
    const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
    expect(table.closest('[dir]')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    expect(screen.getByRole('button', { name: i18n.t('orderGroupAddOrder') })).toBeDisabled();
    expect(apiClient.getOrdersPaginated).not.toHaveBeenCalled();
    expect(groupRequest).not.toHaveBeenCalled();
    await act(async () => finish({ data: { available } }));
    expect((await screen.findAllByRole('link', { name: 'Test Client' }))[0]).toBeInTheDocument();
    expect(screen.getByRole('table')).toBe(table);
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(headers);
    if (available) expect(apiClient.getOrdersPaginated).not.toHaveBeenCalled();
    else {
      expect(groupRequest).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupOpen') }));
      expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({ params: {clientId:'1',orderId:'8'},search:{type:'contact'} }));
    }
  });
});

test('uses the same client Orders tab on an older backend with separate regular and contact IDs', async () => {
  await i18n.changeLanguage('en');
  vi.mocked(apiClient.orderGroupRequest).mockResolvedValue({ status: 404, error: 'Not Found' });
  vi.mocked(apiClient.getOrdersByClient).mockResolvedValue({data:[{...oldOrder,__contact:undefined}]} as any);
  vi.mocked(apiClient.getContactLensOrdersByClient).mockResolvedValue({data:[oldOrder]} as any);
  vi.mocked(apiClient.getClient).mockResolvedValue({data:group.clients[0]});
  wrap(<ClientOrdersTab />);
  expect(await screen.findAllByRole('link', {name:'Test Client'})).toHaveLength(4);
  expect(apiClient.getOrdersByClient).toHaveBeenCalledWith(1);
  expect(apiClient.getContactLensOrdersByClient).toHaveBeenCalledWith(1);
  expect(groupRequest).not.toHaveBeenCalled();
});

test('shows an error in the same table instead of treating a failed capability check as an old backend', async () => {
  await i18n.changeLanguage('en');
  vi.mocked(apiClient.orderGroupRequest).mockResolvedValue({status:503,error:'Unavailable'});
  wrap(<AllOrdersPage />);
  expect(await screen.findByText(i18n.t('orderGroupLoadError'))).toBeInTheDocument();
  expect(apiClient.getOrdersPaginated).not.toHaveBeenCalled();
  expect(groupRequest).not.toHaveBeenCalled();
});

test('records an old-backend payment against its existing invoice without resolving a group', async () => {
  await i18n.changeLanguage('en');
  vi.mocked(apiClient.getBilling).mockResolvedValue({data:group.billing} as any);
  vi.mocked(apiClient.getBillingPayments).mockResolvedValue({data:[]});
  vi.mocked(apiClient.createBillingPayment).mockResolvedValue({data:payment} as any);
  const row = {...group, id:8,legacy_order:{kind:'contact' as const,id:8}};
  wrap(<OrderGroupPaymentCell group={row} backend="legacy" />);
  await userEvent.click(paymentButton()); await enterPayment();
  await userEvent.click(screen.getByRole('button', {name:'Add payment'}));
  await waitFor(()=>expect(toast.success).toHaveBeenCalledWith(i18n.t('orderGroupPaymentSaved')));
  expect(apiClient.createBillingPayment).toHaveBeenCalledExactlyOnceWith(50,{amount:20,paid_at:'2026-10-18',kind:'payment'});
  expect(groupRequest).not.toHaveBeenCalled();
});

test('shows legacy rows and enables next-page navigation before the background count finishes', async () => {
  await i18n.changeLanguage('en');
  let finishCount!: (response: any) => void;
  vi.mocked(apiClient.orderGroupRequest).mockResolvedValue({data:{available:false}});
  vi.mocked(apiClient.getOrdersPaginated).mockImplementation(async (_clinic, options) => options?.countOnly
    ? new Promise(resolve=>{finishCount=resolve;})
    : {data:{items:[oldOrder],total:null,has_more:true}});
  wrap(<AllOrdersPage />);
  expect((await screen.findAllByRole('link',{name:'Test Client'}))[0]).toBeInTheDocument();
  expect(screen.getByRole('button',{name:i18n.t('orderGroupNext')})).toBeEnabled();
  expect(screen.getByText(i18n.t('orderGroupPagePending',{page:1}))).toBeInTheDocument();
  await waitFor(()=>expect(finishCount).toBeTypeOf('function'));
  await act(async()=>finishCount({data:{items:[],total:80,has_more:false}}));
  expect(await screen.findByText(i18n.t('orderGroupPageSummary',{page:1,totalPages:4,total:80}))).toBeInTheDocument();
});
