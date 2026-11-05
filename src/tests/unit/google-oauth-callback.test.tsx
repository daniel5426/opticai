import React from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import translations from '@/localization/auth-login.json';
import GoogleAuthCallbackPage from '@/pages/GoogleAuthCallbackPage';
import { publishGoogleOAuthCallback } from '@/lib/google/google-web-oauth';

vi.mock('@/lib/google/google-web-oauth', () => ({ publishGoogleOAuthCallback: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(['he', 'en', 'fr'] as const)('renders the callback in %s with the correct direction and centered content', async language => {
  const i18n = createInstance();
  await i18n.init({ lng: language, resources: { [language]: { translation: { authLogin: translations[language] } } } });
  vi.mocked(publishGoogleOAuthCallback).mockReturnValue(true);
  vi.spyOn(window, 'close').mockImplementation(() => {});
  const { container } = render(<I18nextProvider i18n={i18n}><GoogleAuthCallbackPage /></I18nextProvider>);
  expect(screen.getByRole('heading', { name: translations[language].google.callbackSuccess })).toBeTruthy();
  expect(container.firstElementChild?.getAttribute('dir')).toBe(language === 'he' ? 'rtl' : 'ltr');
  expect(container.firstElementChild?.classList.contains('text-center')).toBe(true);
  expect(screen.getByRole('button', { name: translations[language].google.close })).toBeTruthy();
});

it('does not report success when the callback has no state or contains an OAuth error', async () => {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en: { translation: { authLogin: translations.en } } } });
  vi.mocked(publishGoogleOAuthCallback).mockReturnValue(false);
  render(<I18nextProvider i18n={i18n}><GoogleAuthCallbackPage /></I18nextProvider>);
  expect(screen.getByRole('heading', { name: translations.en.google.callbackError })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: translations.en.google.callbackSuccess })).toBeNull();
});
