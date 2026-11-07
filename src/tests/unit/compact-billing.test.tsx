import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CompactBillingView } from '@/components/billing/CompactBillingView';
import i18n from '@/localization/i18n';

afterEach(cleanup);
describe.each(['he', 'en', 'fr'])('inline billing in %s', locale => {
  test('keeps a zero order discount visible and editable', async () => {
    await i18n.changeLanguage(locale);
    const save = vi.fn().mockResolvedValue(true);
    render(<CompactBillingView items={[]} billing={{ total_before_discount: 100, total_after_discount: 100 }} isEditing
      balanceDue={100} formatCurrency={value => String(value || 0)} formatNumber={value => String(value || 0)}
      onAddItem={vi.fn()} onItemChange={vi.fn()} onDeleteItem={vi.fn()} onOpenHistory={vi.fn()} paymentMenu={null}
      onSummarySave={save} />);
    expect(screen.getByText(i18n.t('orderGroupDiscount')).parentElement).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderWorkspace.editValue', { value: i18n.t('orderGroupDiscount') }) }));
    fireEvent.change(screen.getByLabelText(i18n.t('orderGroupDiscount')), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupSave') }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('discount_amount', 15));
  });
  test('shows fixed, percentage and standalone item deductions as already included without changing invoice totals', async () => {
    await i18n.changeLanguage(locale);
    const items = [
      { id: 1, billings_id: 1, price: 200, quantity: 1, discount: 50, line_total: 150 },
      { id: 2, billings_id: 1, price: 100, quantity: 1, discount_percent: 25, discount: 25, line_total: 75 },
      { id: 3, billings_id: 1, price: 0, quantity: 1, discount: 10, line_total: -10 },
    ];
    render(<CompactBillingView items={items} billing={{ total_before_discount: 215, discount_amount: 20, total_after_discount: 195 }} isEditing={false}
      balanceDue={195} formatCurrency={value => String(value || 0)} formatNumber={value => String(value || 0)}
      onAddItem={vi.fn()} onItemChange={vi.fn()} onDeleteItem={vi.fn()} onOpenHistory={vi.fn()} paymentMenu={null} />);
    const summary = within(screen.getByText(i18n.t('orderWorkspace.itemDiscountsIncluded')).closest('[data-quiet-fields]')! as HTMLElement);
    expect(summary.getByText(i18n.t('orderWorkspace.itemDiscountsIncluded')).parentElement).toHaveTextContent('85');
    expect(screen.getByText(i18n.t('orderWorkspace.subtotal')).parentElement).toHaveTextContent('215');
    expect(summary.getByText(i18n.t('orderGroupDiscount')).parentElement).toHaveTextContent('20');
    expect(screen.getByText(i18n.t('orderWorkspace.total')).parentElement).toHaveTextContent('195');
  });
  test('summary retries a failed save, cancels, and returns to the regular view', async () => {
    await i18n.changeLanguage(locale);
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const view = render(<CompactBillingView items={[]} billing={{ total_after_discount: 100 } as any} isEditing
      balanceDue={100} formatCurrency={value => String(value || 0)} formatNumber={value => String(value || 0)}
      onAddItem={vi.fn()} onItemChange={vi.fn()} onDeleteItem={vi.fn()} onOpenHistory={vi.fn()} paymentMenu={null}
      onSummarySave={save} />);
    const edit = () => screen.getByRole('button', { name: i18n.t('orderWorkspace.editValue', { value: i18n.t('orderWorkspace.total') }) });
    fireEvent.click(edit());
    fireEvent.change(screen.getByLabelText(i18n.t('orderWorkspace.total')), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupSave') }));
    await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('orderGroupSave') })).toBeEnabled());
    expect(Number((screen.getByLabelText(i18n.t('orderWorkspace.total')) as HTMLInputElement).value)).toBe(75);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orderGroupSave') }));
    await waitFor(() => expect(edit()).toBeInTheDocument());
    expect(save).toHaveBeenLastCalledWith('total_after_discount', 75);
    fireEvent.click(edit());
    fireEvent.click(screen.getByRole('button', { name: i18n.t('cancel') }));
    expect(view.container.querySelector('input')).toBeNull();
    expect(save).toHaveBeenCalledTimes(2);
  });
});
