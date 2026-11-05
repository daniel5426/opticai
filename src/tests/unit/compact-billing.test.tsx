import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CompactBillingView } from '@/components/billing/CompactBillingView';
import i18n from '@/localization/i18n';

afterEach(cleanup);
describe.each(['he', 'en', 'fr'])('inline billing in %s', locale => {
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
