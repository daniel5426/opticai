import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PrintingPreferences } from '@/components/settings/PrintingPreferences';
import i18n from '@/localization/i18n';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('shows the setting only when the desktop printing bridge is available', () => {
  vi.stubGlobal('electronAPI', {});
  render(<PrintingPreferences />);
  expect(screen.queryByRole('switch')).toBeNull();
});

it.each(['he', 'en', 'fr'])('defaults to direct printing and remembers opting out in %s', async (locale) => {
  await i18n.changeLanguage(locale);
  vi.stubGlobal('electronAPI', { printHtmlSilently: vi.fn() });
  const { container, unmount } = render(<PrintingPreferences />);
  const preference = screen.getByRole('switch', { name: i18n.t('printing.direct') });

  expect(container.firstElementChild).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
  expect(preference).toBeChecked();
  expect(preference).toHaveAccessibleDescription(i18n.t('printing.description'));
  fireEvent.click(preference);
  expect(preference).not.toBeChecked();

  unmount();
  render(<PrintingPreferences />);
  expect(screen.getByRole('switch', { name: i18n.t('printing.direct') })).not.toBeChecked();
});
