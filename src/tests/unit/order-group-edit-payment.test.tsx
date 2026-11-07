import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';
import { OrderGroupWorkspace } from '@/components/order-groups/OrderGroupWorkspace';
import { groupRequest } from '@/lib/order-groups';

const fixture = vi.hoisted(() => ({ host: null as HTMLElement | null }));
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ clientId: '1', orderId: 'group-1' }), useSearch: () => ({}),
  useNavigate: () => vi.fn(), useBlocker: () => ({ status: 'idle' }),
}));
vi.mock('@/contexts/NavigationGuardContext', () => ({ useNavigationGuard: () => ({ registerGuard: () => {} }) }));
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ company: { default_currency: 'ILS' } }) }));
vi.mock('@/contexts/ClientSidebarContext', () => ({ useClientSidebar: () => ({
  isOpen: true, panelMode: 'billing', panelHost: fixture.host, resetPanelMode: () => {},
}) }));
vi.mock('@/components/site-header', () => ({ SiteHeader: ({ hasUnsavedChanges }: any) => <output data-testid="dirty">{String(hasUnsavedChanges)}</output> }));
vi.mock('@/layouts/ClientSpaceLayout', () => ({ ClientSpaceLayout: ({ children }: any) => children }));
vi.mock('@/components/ClientSelectModal', () => ({ ClientSelectModal: () => null }));
vi.mock('@/lib/order-groups', async original => ({ ...await original<object>(), groupRequest: vi.fn() }));
vi.mock('@/components/BillingTab', () => ({ BillingTab: ({ billingFormData: bill, setBillingFormData, canPay, paymentAdapter, onSaveBilling }: any) => <>
  <output data-testid="paid">{bill.prepayment_amount}</output>
  <input aria-label="Installments" value={bill.installment_count || 1} onChange={event => setBillingFormData((previous: any) => ({ ...previous, installment_count: Number(event.target.value) }))} />
  <button onClick={() => onSaveBilling()}>Save billing</button>
  <button disabled={!canPay} onClick={() => paymentAdapter.create({ amount: 20, kind: 'payment', paid_at: '2026-11-04' })}>Pay</button>
  <button onClick={() => paymentAdapter.remove(9)}>Remove payment</button>
</> }));
vi.mock('@/pages/OrderDetailPage', () => ({ LegacyOrderDetailPage: ({ workspace }: any) => {
  const [notes, setNotes] = React.useState('');
  React.useEffect(() => {
    workspace.register(workspace.key, { ready: true, serialize: () => ({ order: { ...workspace.record, notes } }) });
    workspace.onChange(workspace.key, JSON.stringify({ formData: { ...workspace.record, notes } }));
    return () => workspace.register(workspace.key, null);
  }, [workspace.key, workspace.register, workspace.onChange, notes]);
  return <input aria-label="Order notes" value={notes} onChange={event => setNotes(event.target.value)} />;
} }));
afterEach(() => { cleanup(); fixture.host?.remove(); });

describe.each(['he', 'en', 'fr'] as const)('payments during editing in %s', locale => {
  test.each([false, true])('preserves draft and dirty state (changed draft: %s)', async changed => {
    await i18n.changeLanguage(locale);
    const { useUser } = await import('@/contexts/UserContext');
    vi.mocked(useUser).mockReturnValue({ currentUser: { id: 1, role_level: 2 }, currentClinic: { id: 1 } } as any);
    let group: any = { id: 1, clinic_id: 1, payer_client_id: 1, revision: 1,
      clients: [{ id: 1, first_name: 'Test', last_name: 'Client' }],
      entries: [{ id: 1, position: 0, kind: 'regular', order: { id: 1, client_id: 1, type: 'Distance' } }],
      billing: { id: 5, currency: 'ILS', prepayment_amount: 10, installment_count: 1, total_after_discount: 100 }, line_items: [] };
    vi.mocked(groupRequest).mockReset().mockImplementation(async (path, options) => {
      if (options?.method === 'POST' || options?.method === 'DELETE') {
        group = { ...group, revision: group.revision + 1, billing: { ...group.billing, prepayment_amount: options.method === 'POST' ? 30 : 10 } };
        return (options.method === 'POST' ? { payment: { id: 9 }, group } : group) as any;
      }
      return group;
    });
    fixture.host = document.createElement('div'); document.body.append(fixture.host);
    render(<QueryClientProvider client={new QueryClient()}><OrderGroupWorkspace mode="view" /></QueryClientProvider>);
    const edit = await screen.findByRole('button', { name: i18n.t('orderGroupEdit') });
    await waitFor(() => expect(edit).toBeEnabled()); fireEvent.click(edit);
    await waitFor(() => expect(screen.getByTestId('dirty')).toHaveTextContent('false'));
    if (changed) fireEvent.change(screen.getByLabelText('Installments'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await waitFor(() => expect(screen.getByTestId('paid')).toHaveTextContent('30'));
    expect(screen.getByTestId('dirty')).toHaveTextContent(String(changed));
    expect(screen.getByLabelText('Installments')).toHaveValue(changed ? '3' : '1');
    fireEvent.click(screen.getByRole('button', { name: 'Remove payment' }));
    await waitFor(() => expect(screen.getByTestId('paid')).toHaveTextContent('10'));
    expect(screen.getByTestId('dirty')).toHaveTextContent(String(changed));
    expect(vi.mocked(groupRequest).mock.calls.some(([path]) => path === '/1/payments/9?revision=2')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupSave') }));
    if (!changed) {
      expect(vi.mocked(groupRequest).mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
      return;
    }
    await waitFor(() => expect(vi.mocked(groupRequest).mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
    const payload = JSON.parse(vi.mocked(groupRequest).mock.calls.find(([, options]) => options?.method === 'PUT')![1]!.body as string);
    expect(payload.revision).toBe(3);
    if (changed) expect(payload.billing).toMatchObject({ prepayment_amount: 10, installment_count: 3 });
    else expect(payload.billing).toBeUndefined();
  });
});


describe.each(['he', 'en', 'fr'] as const)('independent billing in %s', locale => {
  test.each([false, true])('preserves the order draft and supports retry (failure: %s)', async fail => {
    await i18n.changeLanguage(locale);
    const { useUser } = await import('@/contexts/UserContext');
    vi.mocked(useUser).mockReturnValue({ currentUser: { id: 1, role_level: 2 }, currentClinic: { id: 1 } } as any);
    let group: any = { id: 1, clinic_id: 1, payer_client_id: 1, revision: 1,
      clients: [{ id: 1, first_name: 'Test', last_name: 'Client' }],
      entries: [{ id: 1, position: 0, kind: 'regular', order: { id: 1, client_id: 1, type: 'Distance' } }],
      billing: { id: 5, currency: 'ILS', prepayment_amount: 10, installment_count: 1 }, line_items: [] };
    let reject = fail;
    let release: (() => void) | undefined;
    vi.mocked(groupRequest).mockReset().mockImplementation(async (_path, options) => {
      if (options?.method === 'PUT' || options?.method === 'PATCH') {
        if (reject) { reject = false; throw new Error('order_group_conflict'); }
        if (!fail && options.method === 'PATCH') await new Promise<void>(resolve => { release = resolve; });
        const payload = JSON.parse(options.body as string);
        group = { ...group, revision: group.revision + 1, billing: { ...group.billing, ...payload.billing } };
      }
      return group;
    });
    fixture.host = document.createElement('div'); document.body.append(fixture.host);
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValueOnce(new Promise(() => {}));
    render(<QueryClientProvider client={queryClient}><OrderGroupWorkspace mode="view" /></QueryClientProvider>);
    const edit = await screen.findByRole('button', { name: i18n.t('orderGroupEdit') });
    await waitFor(() => expect(edit).toBeEnabled()); fireEvent.click(edit);
    await waitFor(() => expect(screen.getByTestId('dirty')).toHaveTextContent('false'));
    fireEvent.change(screen.getByLabelText('Order notes'), { target: { value: 'Unsaved order' } });
    fireEvent.change(screen.getByLabelText('Installments'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save billing' }));
    await waitFor(() => expect(vi.mocked(groupRequest).mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1));
    if (fail) { fireEvent.click(screen.getByRole('button', { name: 'Save billing' })); await waitFor(() => expect(group.revision).toBe(2)); }
    else {
      await waitFor(() => expect(release).toBeDefined());
      const orderSave = screen.getByRole('button', { name: i18n.t('orderGroupSave') });
      expect(orderSave.querySelector('.animate-spin')).toBeNull();
      expect(screen.getByLabelText('Order notes')).toBeEnabled();
      await act(async () => release!());
      await waitFor(() => expect(group.revision).toBe(2));
    }
    expect(screen.getByLabelText('Order notes')).toHaveValue('Unsaved order');
    expect(screen.getByTestId('dirty')).toHaveTextContent('true');
    const billingPayload = JSON.parse(vi.mocked(groupRequest).mock.calls.filter(([, options]) => options?.method === 'PATCH').at(-1)![1]!.body as string);
    expect(billingPayload).toEqual({ revision: 1, billing: { installment_count: 3 } });
    expect(billingPayload.billing.installment_count).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupSave') }));
    await waitFor(() => expect(group.revision).toBe(3));
    const orderPayload = JSON.parse(vi.mocked(groupRequest).mock.calls.filter(([, options]) => options?.method === 'PUT').at(-1)![1]!.body as string);
    expect(orderPayload.revision).toBe(2);
    expect(orderPayload.entries[0].order.notes).toBe('Unsaved order');
    expect(orderPayload).not.toHaveProperty('billing');
  });
});
