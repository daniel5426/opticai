import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';
import { AddOrderMenu } from '@/components/order-groups/AddOrderMenu';

const fixture = vi.hoisted(() => ({ navigate: vi.fn(), context: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => fixture.navigate }));
vi.mock('@/lib/api-client', () => ({ apiClient: { getClientOrdersContext: fixture.context } }));
vi.mock('sonner', () => ({ toast: { info: fixture.info, error: fixture.error } }));
vi.mock('@/components/ClientSelectModal', () => ({ ClientSelectModal: ({ isOpen, onClientSelect }: any) =>
  isOpen ? <button onClick={() => onClientSelect(42)}>Choose client</button> : null }));

const latest = { latest_regular_order_id: 11, latest_contact_order_id: 22, latest_exam_id: 33, latest_exam_add_sources: {} };
const mount = (clientId?: number) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <AddOrderMenu clientId={clientId} />
</QueryClientProvider>);
async function openKind(kind: 'regular' | 'contact') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: i18n.t('orderGroupAddOrder') }));
  const trigger = await screen.findByRole('menuitem', { name: i18n.t(kind === 'regular' ? 'orderGroupGlasses' : 'orderGroupContact') });
  await user.hover(trigger);
  await screen.findByRole('menuitem', { name: i18n.t('orderGroupLastOrder') });
  return { user, trigger };
}
beforeEach(() => {
  vi.clearAllMocks();
  fixture.context.mockResolvedValue({ data: latest });
});
afterEach(cleanup);

describe.each(['he', 'en', 'fr'])('%s add order menu', locale => {
  beforeEach(async () => { await i18n.changeLanguage(locale); });
  it.each(['regular', 'contact'] as const)('clicking the %s parent creates an empty order even after hovering', async kind => {
    mount(7);
    const { user, trigger } = await openKind(kind);
    await user.click(trigger);
    expect(fixture.navigate).toHaveBeenCalledWith({ to: '/clients/$clientId/orders/new', params: { clientId: '7' }, search: kind === 'contact' ? { type: 'contact' } : {} });
    await waitFor(() => expect(screen.queryByRole('menuitem')).toBeNull());
  });
  it.each(['regular', 'contact'] as const)('the %s empty order option creates an order with no import', async kind => {
    mount(7);
    await openKind(kind);
    fireEvent.click(screen.getByRole('menuitem', { name: i18n.t('orderGroupEmptyOrder') }));
    expect(fixture.navigate).toHaveBeenCalledWith({ to: '/clients/$clientId/orders/new', params: { clientId: '7' }, search: kind === 'contact' ? { type: 'contact' } : {} });
  });
  it.each([
    ['regular', 'order', 11], ['contact', 'order', 22], ['regular', 'exam', 33], ['contact', 'exam', 33],
  ] as const)('imports the correct %s %s source', async (kind, source, id) => {
    mount(7);
    const { user } = await openKind(kind);
    const item = screen.getByRole('menuitem', { name: i18n.t(source === 'order' ? 'orderGroupLastOrder' : 'orderGroupLastExam') });
    await waitFor(() => expect(item).not.toHaveAttribute('data-disabled'));
    expect(item.closest('[role="menu"]')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    // jsdom has no flyout geometry for Radix's pointer grace area.
    fireEvent.click(item);
    await waitFor(() => expect(fixture.navigate).toHaveBeenCalledWith({ to: '/clients/$clientId/orders/new', params: { clientId: '7' }, search: {
      ...(kind === 'contact' ? { type: 'contact' } : {}), importSourceId: String(id), importSourceType: source === 'order' ? 'order-prescription' : 'exam',
    } }));
  });
});

it('keeps import selection through the global client picker and looks up that client', async () => {
  mount();
  const { user } = await openKind('contact');
  expect(fixture.context).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem', { name: i18n.t('orderGroupLastOrder') }));
  expect(fixture.navigate).not.toHaveBeenCalled();
  await user.click(await screen.findByText('Choose client'));
  await waitFor(() => expect(fixture.context).toHaveBeenCalledWith(42));
  expect(fixture.navigate.mock.calls[0][0]).toMatchObject({ params: { clientId: '42' }, search: { type: 'contact', importSourceId: '22', importSourceType: 'order-prescription' } });
});

it('disables unavailable sources while keeping an empty order available', async () => {
  fixture.context.mockResolvedValue({ data: { ...latest, latest_regular_order_id: null, latest_exam_id: null } });
  mount(7);
  const { user, trigger } = await openKind('regular');
  expect(screen.getByRole('menuitem', { name: i18n.t('orderGroupLastOrder') })).toHaveAttribute('data-disabled');
  expect(screen.getByRole('menuitem', { name: i18n.t('orderGroupLastExam') })).toHaveAttribute('data-disabled');
  await user.click(trigger);
  expect(fixture.navigate).toHaveBeenCalled();
});

it.each(['missing', 'error'])('does not navigate to an empty order when the global source is %s', async mode => {
  fixture.context.mockResolvedValue(mode === 'error' ? { error: 'Unavailable' } : { data: { ...latest, latest_contact_order_id: null } });
  mount();
  const { user } = await openKind('contact');
  fireEvent.click(screen.getByRole('menuitem', { name: i18n.t('orderGroupLastOrder') }));
  await user.click(await screen.findByText('Choose client'));
  await waitFor(() => expect(mode === 'error' ? fixture.error : fixture.info).toHaveBeenCalled());
  expect(fixture.navigate).not.toHaveBeenCalled();
});

it('supports opening the import submenu with the keyboard', async () => {
  mount(7);
  const user = userEvent.setup();
  await user.tab();
  await user.keyboard('{Enter}');
  const trigger = await screen.findByRole('menuitem', { name: i18n.t('orderGroupGlasses') });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowRight' });
  expect(await screen.findByRole('menuitem', { name: i18n.t('orderGroupLastExam') })).toBeVisible();
  expect(fixture.navigate).not.toHaveBeenCalled();
});
