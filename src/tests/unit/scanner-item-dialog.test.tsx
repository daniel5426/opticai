import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/localization/i18n';
import { ScannerItemDialog } from '@/components/scanner/ScannerItemDialog';
import type { CatalogVariant } from '@/lib/inventory';
import type { ScanCommand } from '@/lib/scanner';

const locale = vi.hoisted(() => ({ direction: 'rtl', locale: 'he' }));
vi.mock('@/localization/use-app-locale', () => ({ useAppLocale: () => locale }));
afterEach(cleanup);

test.each(['he', 'en', 'fr'])('aligns every scanned value consistently and uses compact actions in %s', async language => {
  await i18n.changeLanguage(language);
  locale.direction = language === 'he' ? 'rtl' : 'ltr';
  locale.locale = language;
  const scan = { barcode: '0012345678905', summary: { name: 'Atlas A101 — Black / 50' } } as ScanCommand;
  const variant: CatalogVariant = { id: 1, company_id: 1, product_id: 1, display_name: 'Atlas A101', is_stockable: true,
    product: { id: 1, company_id: 1, category: 'frame', brand: 'Atlas', model: 'A101' }, attributes: { color: 'Black', eye_size: 50 },
    balance: { clinic_id: 1, variant_id: 1, on_hand: 2, reserved: 0, available: 2, reorder_point: 0, target_quantity: 0, version: 1 }, default_retail: 234, currency: 'ILS' };
  const close = vi.fn(), open = vi.fn();
  render(<ScannerItemDialog scan={scan} variant={variant} onClose={close} onOpenInventory={open}/>);
  const dialog = screen.getByRole('dialog', { name: 'Atlas A101' });
  expect(dialog).toHaveAttribute('dir', locale.direction);
  expect(dialog).toHaveClass('sm:max-w-sm');
  for (const value of ['Black', '50', '2', '234 ILS']) {
    expect(screen.getByText(value).closest('dd')).toHaveClass('text-start');
    expect(screen.getByText(value).closest('dd')).not.toHaveAttribute('dir', 'ltr');
  }
  expect(screen.getByText('0012345678905').tagName).toBe('BDI');
  fireEvent.click(screen.getByRole('button', { name: i18n.t('scanner.openInventory') }));
  expect(open).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText(i18n.t('scanner.close'), { selector: 'button' }));
  expect(close).toHaveBeenCalledOnce();
});
