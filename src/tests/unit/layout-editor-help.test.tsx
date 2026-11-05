import React from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/localization/i18n';
import { LayoutEditorHelp } from '@/components/exam/LayoutEditorHelp';

afterEach(cleanup);

test.each(['he', 'en', 'fr'])('help stays compact until clicked and uses %s direction', async locale => {
  await i18n.changeLanguage(locale);
  render(<LayoutEditorHelp />);
  expect(screen.queryByText(i18n.t('examPreview.editorHelp'))).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('examPreview.editorHelpLabel') }));
  const popover = screen.getByRole('dialog');
  expect(popover.textContent).toContain(i18n.t('examPreview.editorHelp'));
  expect(popover.getAttribute('dir')).toBe(locale === 'he' ? 'rtl' : 'ltr');
  fireEvent.keyDown(popover, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
