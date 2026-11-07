import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';
import { apiClient } from '@/lib/api-client';
import { discountLine, recalculateLineBilling } from '@/lib/discounts';
import { editBillingSummary } from '@/lib/billing-summary';
import { DiscountsTab } from '@/components/settings/DiscountsTab';
import { BillingTab } from '@/components/BillingTab';
import type { Billing, OrderLineItem } from '@/lib/db/schema-interface';
import { buildRegularOrderPrintModel, buildContactOrderPrintModel, renderOrderPdfHtml } from '@/lib/order-docx';

vi.mock('@/lib/api-client', () => ({ apiClient: { discountRequest: vi.fn() } }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentClinic: { id: 1 }, currentUser: { role_level: 2 } }) }));
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ company: { default_currency: 'ILS' } }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const template = { id: 1, clinic_id: 1, description: 'Loyalty', amount: 25, currency: 'ILS' as const };
const originalItems: OrderLineItem[] = [{ id: 10, billings_id: 5, description: 'Imported lens', price: 200, quantity: 1, discount: 50, line_total: 150 }];
const originalBill: Billing = { id: 5, currency: 'ILS', total_before_discount: 120, total_after_discount: 108, discount_amount: 10, prepayment_amount: 30 };

test('fixed discount snapshots, currency isolation, imported preview and summary edits', () => {
  const line = discountLine(template, originalBill, originalItems);
  expect(line).toMatchObject({ description: 'Loyalty', price: 0, discount: 25, line_total: -25 });
  expect(() => discountLine({ ...template, currency: 'EUR' }, originalBill, originalItems)).toThrow('cannotMixCurrencies');
  const preview = recalculateLineBilling(originalBill, [...originalItems, line], originalBill, originalItems);
  expect(preview).toMatchObject({ total_before_discount: 95, total_after_discount: 83, prepayment_amount: 30 });
  const summary = editBillingSummary(originalBill, originalItems, 'total_after_discount', 150, 'Adjustment');
  expect(recalculateLineBilling(summary.billing, summary.items, originalBill, originalItems).total_after_discount).toBe(150);
  const overdiscounted = { ...originalBill, line_subtotal_offset: -30, line_total_offset: -32, total_before_discount: 0, total_after_discount: 0 };
  const excess = [...originalItems, { ...line, discount: 300, line_total: -300 }];
  const restored = editBillingSummary(overdiscounted, excess, 'total_after_discount', 50, 'Adjustment');
  expect(recalculateLineBilling(restored.billing, restored.items, overdiscounted, excess).total_after_discount).toBe(50);
});

describe.each(['he', 'en', 'fr'])('discount flow in %s', locale => {
  test('settings create/edit/delete and billing selection, save retry, reopen and remove', async () => {
    await i18n.changeLanguage(locale);
    let definitions: any[] = [];
    const request = vi.spyOn(apiClient, 'discountRequest').mockImplementation(async (path, options) => {
      if (options?.method === 'POST') definitions = [{ id: 1, clinic_id: 1, ...JSON.parse(String(options.body)) }];
      if (options?.method === 'PUT') definitions = [{ ...definitions[0], ...JSON.parse(String(options.body)) }];
      if (options?.method === 'DELETE') definitions = [];
      return { data: definitions } as any;
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrap = (node: React.ReactNode) => <QueryClientProvider client={client}>{node}</QueryClientProvider>;
    const settings = render(wrap(<DiscountsTab />));
    await screen.findByText(i18n.t('discounts.empty'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('discounts.create') }));
    fireEvent.change(screen.getByLabelText(i18n.t('orderGroupDescription')), { target: { value: 'Loyalty' } });
    fireEvent.change(screen.getByLabelText(i18n.t('orderGroupAmount')), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('discounts.save') }));
    await screen.findByRole('button', { name: i18n.t('discounts.edit') });
    expect(definitions[0].amount).toBe(25);
    settings.unmount();
    let persisted = { bill: originalBill, items: originalItems };
    let fail = true;
    const save = vi.fn(async (bill?: Billing, items?: OrderLineItem[]) => {
      if (fail) { fail = false; return false; }
      persisted = { bill: recalculateLineBilling(bill || draft.bill, items || draft.items, originalBill, originalItems), items: items || draft.items };
      return true;
    });
    let draft = persisted;
    function Panel() {
      const [bill, setBill] = React.useState(persisted.bill);
      const [items, setItems] = React.useState(persisted.items);
      draft = { bill, items };
      return <div dir={locale === 'he' ? 'rtl' : 'ltr'}><BillingTab compact discountClinicId={1} billingFormData={bill} setBillingFormData={setBill} orderLineItems={items} setOrderLineItems={setItems} isEditing onSaveBilling={async (nextBill, nextItems) => { const result = await save(nextBill, nextItems); if (result) { setBill(persisted.bill); setItems(persisted.items); } return result; }} handleDeleteOrderLineItem={vi.fn()} /></div>;
    }
    let panel = render(wrap(<Panel />));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('discounts.newDiscount') }));
    fireEvent.click(await screen.findByRole('button', { name: /Loyalty/ }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(persisted.items).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('button', { name: /Loyalty/ })).toBeEnabled());
    expect(draft.items).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Loyalty/ }));
    await waitFor(() => expect(persisted.items).toHaveLength(2));
    expect(persisted.items[1].discount).toBe(25);
    expect(persisted.bill.total_after_discount).toBe(83);
    expect(screen.queryByLabelText(i18n.t('orderGroupDescription'))).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('orderWorkspace.editItem') }).at(-1)!);
    fail = true;
    expect(await screen.findByLabelText(i18n.t('orderGroupDescription'))).toHaveValue('Loyalty');
    // Discount editor exposes the deduction, not product quantity/price/supply controls.
    expect(screen.queryByLabelText(i18n.t('orderGroupPrice'))).toBeNull();
    const row = within(screen.getByLabelText(i18n.t('orderGroupDescription')).closest('li')!);
    expect(row.queryByText(i18n.t('discounts.rowLabel'))).toBeNull();
    expect(row.getByLabelText(i18n.t('orderGroupDiscount')).parentElement!.parentElement).toHaveTextContent('25');
    fireEvent.change(screen.getByLabelText(i18n.t('orderGroupDiscount')), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderWorkspace.doneEditing') }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('orderWorkspace.doneEditing') })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderWorkspace.doneEditing') }));
    await waitFor(() => expect(persisted.bill.total_after_discount).toBe(78));
    expect(persisted.bill.prepayment_amount).toBe(30);
    panel.unmount();
    // Definition edits/deletion never change a saved invoice snapshot.
    const settingsAgain = render(wrap(<DiscountsTab />));
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('discounts.edit') }));
    fireEvent.change(screen.getByLabelText(i18n.t('orderGroupAmount')), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('discounts.save') }));
    await waitFor(() => expect(definitions[0].amount).toBe(50));
    await waitFor(() => expect(screen.queryByRole('button', { name: i18n.t('discounts.save') })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: i18n.t('discounts.remove') }));
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('discounts.remove') }).at(-1)!);
    await waitFor(() => expect(definitions).toHaveLength(0));
    settingsAgain.unmount();
    panel = render(wrap(<Panel />));
    expect(await screen.findByText('Loyalty')).toBeInTheDocument();
    expect(screen.getAllByText(i18n.t('discounts.rowLabel')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('orderWorkspace.editItem') }).at(-1)!);
    expect(Number((screen.getByLabelText(i18n.t('orderGroupDiscount')) as HTMLInputElement).value)).toBe(30);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupRemoveItem') }));
    await waitFor(() => expect(persisted.items).toHaveLength(1));
    expect(persisted.bill.total_after_discount).toBe(108);
    expect(request).toHaveBeenCalledWith(expect.stringContaining('clinic_id=1'), expect.anything());
  });

  test('prefetches definitions and shows a selected discount in view mode before saving finishes', async () => {
    await i18n.changeLanguage(locale);
    const request = vi.spyOn(apiClient, 'discountRequest').mockResolvedValue({ data: [template] } as any);
    let finish!: (value: boolean) => void;
    const save = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    let draftItems: OrderLineItem[] = [];
    function Panel() {
      const [bill, setBill] = React.useState(originalBill);
      const [items, setItems] = React.useState(originalItems);
      draftItems = items;
      return <BillingTab compact discountClinicId={1} billingFormData={bill} setBillingFormData={setBill}
        orderLineItems={items} setOrderLineItems={setItems} isEditing onSaveBilling={save} handleDeleteOrderLineItem={vi.fn()} />;
    }
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Panel /></QueryClientProvider>);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderWorkspace.editItem') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('discounts.newDiscount') }));
    fireEvent.click(await screen.findByRole('button', { name: /Loyalty/ }));
    expect(draftItems).toHaveLength(2);
    expect(screen.getByText('Loyalty')).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('orderGroupDescription'))).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { finish(true); });
    expect(draftItems).toHaveLength(2);
    expect(screen.queryByLabelText(i18n.t('orderGroupDescription'))).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });

  test.each(['regular', 'contact'] as const)('%s print includes a labeled negative discount and retained balances', async kind => {
    await i18n.changeLanguage(locale);
    const context: any = { kind, order: { id: 1 }, client: {}, clinicsById: {}, lineItems: [discountLine(template, originalBill, [])], billing: originalBill };
    const model = kind === 'regular' ? buildRegularOrderPrintModel(context) : buildContactOrderPrintModel(context);
    const html = renderOrderPdfHtml({ kind, data: model });
    expect(html).toContain(`${i18n.t('discounts.rowLabel')}: Loyalty`);
    expect(model.line_items_rows?.[0].line_total).toContain('-25');
    expect(renderOrderPdfHtml({ kind, data: model, includeBilling: false })).not.toContain('Loyalty');
  });
});
