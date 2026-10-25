import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';
import { LookupSelect } from '@/components/ui/lookup-select';
import { ClientSidebarProvider, useClientSidebar } from '@/contexts/ClientSidebarContext';
import { ClientSidebar } from '@/components/ClientSidebar';
import { OrderGroupWorkspace } from '@/components/order-groups/OrderGroupWorkspace';

const fixtures = vi.hoisted(() => ({
  client: { id: 1, clinic_id: 1, first_name: 'Test', last_name: 'Client' },
  group: { id: 1, clinic_id: 1, payer_client_id: 1, revision: 1, entries: [
    { id: 1, position: 0, kind: 'regular', order: { id: 1, client_id: 1, type: 'Distance' } },
    { id: 2, position: 1, kind: 'contact', order: { id: 2, client_id: 1, type: 'Contact' } },
  ], clients: [{ id: 1, clinic_id: 1, first_name: 'Test', last_name: 'Client' }], billing: null, line_items: [] },
}));
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ clientId: '1', orderId: 'group-1' }),
  useSearch: () => ({}), useLocation: () => ({ pathname: '/clients/1/orders/group-1' }),
  useNavigate: () => vi.fn(), useBlocker: () => ({ status: 'idle' }),
}));
vi.mock('@/contexts/NavigationGuardContext', () => ({ useNavigationGuard: () => ({ registerGuard: () => () => {} }) }));
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ company: { default_currency: 'ILS' } }) }));
vi.mock('@/hooks/useLookupData', () => ({ useLookupData: () => ({ data: [{ id: 1, name: 'Distance' }, { id: 2, name: 'Reading' }], loading: false, createItem: vi.fn(), isCreating: false }) }));
vi.mock('@/lib/api-client', () => ({ apiClient: { getClient: async () => ({ data: fixtures.client }), getClientById: async () => ({ data: fixtures.client }) } }));
vi.mock('@/lib/order-groups', async importOriginal => ({ ...await importOriginal<object>(), groupRequest: async () => fixtures.group }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => null }));
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }));
vi.mock('@/components/ClientSelectModal', () => ({ ClientSelectModal: () => null }));
vi.mock('@/components/agent/AgentChatPanel', () => ({ AgentChatPanel: () => null }));
vi.mock('@/pages/OrderDetailPage', () => ({ LegacyOrderDetailPage: ({ workspace }: any) => {
  const [type, setType] = React.useState(workspace.record.type);
  React.useEffect(() => {
    workspace.register(workspace.key, { ready: true, serialize: () => ({ ...workspace.record, type }), setMetadata: (patch: any) => setType(patch.type) });
    workspace.onChange(workspace.key, JSON.stringify({ formData: { ...workspace.record, type }, contactFormData: { ...workspace.record, type } }));
    return () => workspace.register(workspace.key, null);
  }, [workspace.register, workspace.onChange, workspace.key, type]);
  return <div>{type}</div>;
} }));

function InfoSwitch() {
  const { toggleSidebar } = useClientSidebar();
  return <button onClick={toggleSidebar}>Client info</button>;
}
function renderWorkspace() {
  localStorage.clear();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ClientSidebarProvider><InfoSwitch /><OrderGroupWorkspace mode="view" /><ClientSidebar /></ClientSidebarProvider></QueryClientProvider>);
}
afterEach(cleanup);

describe.each(['he', 'en', 'fr'] as const)('order workspace in %s', locale => {
  test('billing uses the existing panel and survives switching to client info', async () => {
    await i18n.changeLanguage(locale);
    const { useUser } = await import('@/contexts/UserContext');
    vi.mocked(useUser).mockReturnValue({ currentUser: { id: 1, role_level: 2 }, currentClinic: { id: 1 } } as any);
    const view = renderWorkspace();
    const billingButton = await screen.findByRole('button', { name: i18n.t('orderGroupBilling') });
    await waitFor(() => expect(billingButton).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupEdit') }));
    fireEvent.click(billingButton);
    const payer = await screen.findByText(i18n.t('orderGroupPayer'));
    const panel = payer.closest('[data-slot="card"]');
    expect(panel).not.toBeNull();
    expect(view.container.querySelectorAll('[aria-valuenow]')).toHaveLength(1);
    expect(payer.closest('[dir]')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    const installments = view.container.querySelector('input[name="installment_count"]') as HTMLInputElement;
    fireEvent.change(installments, { target: { value: '3' } });
    fireEvent.blur(installments);
    fireEvent.click(screen.getByRole('button', { name: 'Client info' }));
    expect(screen.queryByText(i18n.t('orderGroupPayer'))).not.toBeInTheDocument();
    fireEvent.click(billingButton);
    expect((await screen.findByText(i18n.t('orderGroupPayer'))).closest('[data-slot="card"]')).toBe(panel);
    expect(Number((view.container.querySelector('input[name="installment_count"]') as HTMLInputElement).value)).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('agent.returnInfo') }));
    expect(screen.queryByText(i18n.t('orderGroupPayer'))).not.toBeInTheDocument();
    fireEvent.click(billingButton);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupClosePanel') }));
    expect(billingButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('text lookup supports editing, reopening, and a portalled menu in the active direction', async () => {
    await i18n.changeLanguage(locale);
    const changed = vi.fn();
    render(<LookupSelect variant="text" value="" placeholder="Type" ariaLabel="Order type" lookupType="orderType" dir={locale === 'he' ? 'rtl' : 'ltr'} onChange={changed} />);
    const input = screen.getByRole('textbox', { name: 'Order type' });
    fireEvent.focus(input);
    const choice = await screen.findByText('Reading');
    expect(choice.closest('[dir]')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    fireEvent.mouseDown(choice);
    expect(changed).toHaveBeenCalledWith('Reading');
    expect(screen.queryByText('Distance')).not.toBeInTheDocument();
    fireEvent.click(input);
    expect(await screen.findByText('Reading', { selector: 'span:not([aria-hidden])' })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Dist' } });
    const distance = await screen.findByText('Distance');
    expect(distance).toBeInTheDocument();
    fireEvent.mouseDown(distance);
  });
});
