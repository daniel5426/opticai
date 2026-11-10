import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/localization/i18n';
import { GoogleCalendarIntegration, type CalendarStatus } from '@/components/settings/GoogleCalendarIntegration';
const mocks = vi.hoisted(() => ({ request: vi.fn(), setUser: vi.fn(), authenticate: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { googleCalendarRequest: mocks.request } }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentUser: { id: 1 }, setCurrentUser: mocks.setUser }) }));
const disconnected: CalendarStatus = { connected: false, email: null, enabled: false, pending: 0, failed: 0, reconnect: 0 };
const connected: CalendarStatus = { ...disconnected, connected: true, email: 'synthetic@example.com' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockResolvedValue(disconnected);
  window.electronAPI = { googleOAuthAuthenticate: mocks.authenticate } as any;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

for (const locale of ['he', 'en', 'fr']) {
  describe(locale, () => {
    beforeEach(async () => { await i18n.changeLanguage(locale); });
    it('enables connection and saves only OAuth tokens through the authenticated API', async () => {
      mocks.authenticate.mockResolvedValue({ tokens: { access_token: 'marker', refresh_token: 'refresh-marker' } });
      mocks.request.mockResolvedValueOnce(disconnected).mockResolvedValueOnce(connected);
      const { container } = render(<GoogleCalendarIntegration />);
      const button = await screen.findByRole('button', { name: i18n.t('googleCalendar.connect') });
      expect(button).toBeEnabled();
      expect(container.querySelector('[dir]')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
      fireEvent.click(button);
      await screen.findByText('synthetic@example.com');
      expect(mocks.request).toHaveBeenLastCalledWith('connect', { access_token: 'marker', refresh_token: 'refresh-marker' });
      expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ google_account_connected: true }), true);
      expect(screen.getByText(i18n.t('googleCalendar.dataHint'))).toBeVisible();
    });
    it('offers manual sync, automatic sync and a visible reconnect state', async () => {
      mocks.request.mockResolvedValue({ ...connected, enabled: true, reconnect: 1 });
      render(<GoogleCalendarIntegration />);
      expect(await screen.findByRole('button', { name: i18n.t('googleCalendar.reconnectButton') })).toBeEnabled();
      expect(screen.getByRole('button', { name: i18n.t('googleCalendar.sync') })).toBeDisabled();
      expect(screen.getByRole('switch')).toHaveAccessibleName(i18n.t('googleCalendar.autoSync'));
      expect(screen.getByRole('switch')).toBeDisabled();
      expect(screen.getByText(i18n.t('googleCalendar.reconnect'))).toBeVisible();
    });
  });
}

it('queues manual sync and reports pending work instead of claiming completion', async () => {
  mocks.request.mockResolvedValueOnce(connected).mockResolvedValueOnce({ ...connected, pending: 2 });
  render(<GoogleCalendarIntegration />);
  fireEvent.click(await screen.findByRole('button', { name: i18n.t('googleCalendar.sync') }));
  await screen.findByText(i18n.t('googleCalendar.pending', { count: 2 }));
  expect(mocks.request).toHaveBeenLastCalledWith('sync', {});
});

it('shows a safe error when connection is cancelled and does not save tokens', async () => {
  mocks.authenticate.mockResolvedValue({ success: false, error: 'provider-secret-marker' });
  render(<GoogleCalendarIntegration />);
  fireEvent.click(await screen.findByRole('button', { name: i18n.t('googleCalendar.connect') }));
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('googleCalendar.connectionFailed'));
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

it('prevents overlapping requests and keeps disconnect mappings on the API', async () => {
  let finish: (value: CalendarStatus) => void = () => {};
  mocks.request.mockResolvedValueOnce(connected).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<GoogleCalendarIntegration />);
  const disconnect = await screen.findByRole('button', { name: i18n.t('googleCalendar.disconnect') });
  fireEvent.click(disconnect); fireEvent.click(disconnect);
  expect(mocks.request).toHaveBeenCalledTimes(2);
  await act(async () => { finish(disconnected); });
  await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('googleCalendar.connect') })).toBeEnabled());
});
