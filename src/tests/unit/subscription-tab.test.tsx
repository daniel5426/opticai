import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/localization/i18n';
import { SubscriptionTab } from '@/components/settings/SubscriptionTab';

const { getSummary, openExternal } = vi.hoisted(() => ({ getSummary: vi.fn(), openExternal: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { getSubscriptionSummary: getSummary } }));
const summary = { status: 'active', access_mode: 'full', plan_code: 'essential', usage: { clinics: 1, staff: 1 }, limits: { clinics: 1, staff: 5 }, current_period_ends_at: '2026-12-01T00:00:00Z', can_manage_billing: true, can_administer: false, amount_minor: 43000 };
beforeEach(() => { getSummary.mockResolvedValue({ data: summary }); Object.defineProperty(window, 'electronAPI', { configurable: true, value: { openExternalAuthUrl: openExternal } }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Subscription settings', () => {
  it('uses Hebrew RTL and only shows owner administration when authorized', async () => {
    await i18n.changeLanguage('he');
    const { container } = render(<SubscriptionTab />);
    await screen.findByText('₪430.00');
    expect(container.querySelector('section')?.getAttribute('dir')).toBe('rtl');
    expect(screen.queryByRole('button', { name: 'ניהול בעלים' })).toBeNull();
    getSummary.mockResolvedValue({ data: { ...summary, can_administer: true } });
    await act(async () => { window.dispatchEvent(new Event('subscription:attention')); });
    const admin = await screen.findByRole('button', { name: 'ניהול בעלים' });
    fireEvent.click(admin);
    expect(openExternal).toHaveBeenCalledWith('https://prysm.co.il/admin');
  });
  it('uses French LTR and prevents staff billing actions', async () => {
    await i18n.changeLanguage('fr');
    getSummary.mockResolvedValue({ data: { ...summary, can_manage_billing: false } });
    const { container } = render(<SubscriptionTab />);
    const button = await screen.findByRole('button', { name: 'Gérer la facturation' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('section')?.getAttribute('dir')).toBe('ltr');
  });
  it('shows a restriction instead of a payment promise when suspended', async () => {
    await i18n.changeLanguage('en');
    getSummary.mockResolvedValue({ data: { ...summary, access_mode: 'suspended' } });
    render(<SubscriptionTab />);
    await screen.findByText('Workspace access is restricted. Review your billing settings or contact Prysm.');
  });
});
