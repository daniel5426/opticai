import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderGroupToolbar } from '@/components/order-groups/OrderGroupChrome';
import i18n from '@/localization/i18n';

afterEach(cleanup);

it('offers a Word export of the current order beside printing', async () => {
  await i18n.changeLanguage('he');
  const onExportWord = vi.fn();
  render(<OrderGroupToolbar direction="rtl" printDisabled={false} printing={false} onPrint={() => {}} onExportWord={onExportWord}
    billingOpen={false} billingDisabled onToggleBilling={() => {}} editing={false} saving={false} editDisabled onEditOrSave={() => {}} />);
  await userEvent.click(screen.getByLabelText('הדפס'));
  fireEvent.click(await screen.findByText('ייצוא הזמנה נוכחית ל־Word'));
  expect(onExportWord).toHaveBeenCalledOnce();
});
