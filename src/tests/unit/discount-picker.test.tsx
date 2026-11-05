import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DiscountPicker } from '@/components/billing/DiscountPicker';
import i18n from '@/localization/i18n';

vi.mock('@/lib/discounts', () => ({ discountRequest: async () => [
  { id: 1, description: 'Loyalty benefit', amount: 25, currency: 'ILS' },
  { id: 2, description: 'Student benefit', amount: 15, currency: 'ILS' },
  { id: 3, description: 'Euro benefit', amount: 50, currency: 'EUR' },
] }));
afterEach(cleanup);
describe.each(['he', 'en', 'fr'])('discount search in %s', locale => {
  test('filters matching currency by description or amount and handles no results', async () => {
    await i18n.changeLanguage(locale);
    const select = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><DiscountPicker open onClose={vi.fn()} clinicId={1} currency="ILS" onSelect={select} /></QueryClientProvider>);
    await screen.findByRole('button', { name: /Loyalty/ });
    expect(screen.queryByRole('button', { name: /Euro/ })).toBeNull();
    const input = screen.getByRole('textbox', { name: i18n.t('discounts.search') });
    expect(input).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    fireEvent.change(input, { target: { value: 'LOYAL' } });
    expect(screen.queryByRole('button', { name: /Student/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Loyalty/ }));
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    fireEvent.change(input, { target: { value: '15' } });
    expect(screen.getByRole('button', { name: /Student/ })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'missing' } });
    expect(screen.getByText(i18n.t('discounts.noResults'))).toBeInTheDocument();
  });
});
