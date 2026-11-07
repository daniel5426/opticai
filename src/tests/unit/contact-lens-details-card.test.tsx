import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/localization/i18n';
import copy from '@/localization/contact-lens-details.json';
import { ContactLensDetailsTab } from '@/components/exam/ContactLensDetailsTab';
import { ExamCardRenderer, type CardItem } from '@/components/exam/ExamCardRenderer';
import { AddComponentDrawer } from '@/pages/ExamLayoutEditorPage';
import { examComponentRegistry } from '@/lib/exam-component-registry';

vi.mock('@/hooks/use-barcode-scanner', () => ({ useBarcodeScanner: () => ({ enabled: false }) }));
vi.mock('@/components/ui/lookup-select', () => ({ LookupSelect: ({ ariaLabel, value, onChange, disabled, dir }: any) =>
  <input aria-label={ariaLabel} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} dir={dir} />,
}));

afterEach(cleanup);

const card: CardItem = { id: 'contact-details-test', type: 'contact-lens-details' };

test.each(['he', 'en', 'fr'] as const)('can add the localized exam card in %s', async locale => {
  await i18n.changeLanguage(locale);
  expect(examComponentRegistry.getLayoutEditorTypes()).toContain(card.type);
  const onSelect = vi.fn();
  render(<AddComponentDrawer selectedType={null} open onOpenChange={() => {}} onSelectComponent={onSelect} />);
  const title = screen.getByText(copy[locale].title);
  expect(title.closest('[dir]')?.getAttribute('dir')).toBe(locale === 'he' ? 'rtl' : 'ltr');
  fireEvent.click(title);
  expect(onSelect).toHaveBeenCalledWith(card.type);
});

test.each(['he', 'en', 'fr'] as const)('exam renderer omits quantity in %s', async locale => {
  await i18n.changeLanguage(locale);
  render(<ExamCardRenderer item={card} rowCards={[card]} isEditing={false} mode="editor" />);
  const title = screen.getByText(copy[locale].title);
  expect(title.closest('[dir]')?.getAttribute('dir')).toBe(locale === 'he' ? 'rtl' : 'ltr');
  expect(screen.queryByText(copy[locale].quantity)).toBeNull();
  expect(screen.getAllByRole('textbox')).toHaveLength(12);
  expect(screen.queryByLabelText(`${copy[locale].quantity} R`)).toBeNull();
  expect(screen.getByLabelText(`${copy[locale].type} R`).getAttribute('dir')).toBe(locale === 'he' ? 'rtl' : 'ltr');
});

test('order card retains quantity and legacy lens types remain editable', async () => {
  await i18n.changeLanguage('en');
  const change = vi.fn();
  render(<ContactLensDetailsTab contactLensDetailsData={{ layout_instance_id: 0, r_lens_type: 'Soft', r_quantity: 3 }}
    onContactLensDetailsChange={change} isEditing />);
  expect(screen.getByText(copy.en.quantity)).toBeTruthy();
  expect(screen.getByLabelText('Quantity R').getAttribute('value')).toBe('3');
  expect(screen.getByLabelText('Type R').getAttribute('value')).toBe('Soft');
  fireEvent.change(screen.getByLabelText('Model L'), { target: { value: 'Trial lens' } });
  expect(change).toHaveBeenCalledWith('l_model', 'Trial lens');
});
