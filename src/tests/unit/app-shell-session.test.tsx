import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { useUser } from '@/contexts/UserContext';
import BaseLayout from '@/layouts/BaseLayout';

const route = vi.hoisted(() => ({ pathname: '/inventory', latestPathname: '/inventory', navigate: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: route.pathname }),
  useRouterState: () => ({ pathname: route.pathname }),
  useNavigate: () => route.navigate,
  useRouter: () => ({ latestLocation: { pathname: route.latestPathname } }),
}));
vi.mock('@/components/agent/GlobalAgentPanel', () => ({ GlobalAgentPanel: () => null }));
vi.mock('@/components/ClientSidebar', () => ({ ClientSidebar: () => null }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ PrysmAgentProvider: ({ children }: any) => children }));
vi.mock('@/contexts/ClientSidebarContext', () => ({ ClientSidebarProvider: ({ children }: any) => children }));
vi.mock('@/contexts/NavigationGuardContext', () => ({ NavigationGuardProvider: ({ children }: any) => children }));
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: any) => <div data-testid="shell">{children}</div>,
  SidebarInset: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/app-sidebar', () => ({ AppSidebar: () => <nav>Clinic navigation</nav> }));
vi.mock('@/components/control-center-sidebar', () => ({ ControlCenterSidebar: () => <nav>Company navigation</nav> }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/kokonutui/loader', () => ({ default: () => <div role="status">Loading</div> }));
vi.mock('@/lib/db/settings-db', () => ({ getSettings: vi.fn(async () => null) }));
vi.mock('@/helpers/theme_helpers', () => ({ applyCompanyThemeColors: vi.fn(), cacheCompanyThemeColors: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { getCompany: vi.fn(async () => ({})), getSubscriptionSummary: vi.fn(async () => ({})) } }));

const staff = { currentUser: { id: 7, role_level: 4 }, currentClinic: { id: 33 }, isLoading: false };
const session = (value: object) => vi.mocked(useUser).mockReturnValue(value as any);
const app = () => <QueryClientProvider client={new QueryClient()}><BaseLayout><div>Protected page</div></BaseLayout></QueryClientProvider>;
beforeEach(() => { route.pathname = '/inventory'; route.latestPathname = '/inventory'; route.navigate.mockReset(); session(staff); });

it('keeps navigation and the header host around an authenticated clinic page', () => {
  render(app());
  expect(screen.getByTestId('shell')).toContainElement(screen.getByText('Protected page'));
  expect(screen.getByRole('navigation')).toHaveTextContent('Clinic navigation');
  expect(document.getElementById('header-container')).toBeInTheDocument();
});
it.each(['/dashboard', '/inventory', '/clients/7', '/control-center/dashboard'])('does not expose a bare %s page after staff sign-out', async pathname => {
  route.pathname = pathname;
  session({ ...staff, currentUser: null });
  render(app());
  expect(screen.queryByText('Protected page')).not.toBeInTheDocument();
  await waitFor(() => expect(route.navigate).toHaveBeenCalledWith({ to: '/user-selection', replace: true }));
});
it('redirects a direct protected link without a clinic to sign-in', async () => {
  session({ currentUser: null, currentClinic: null, isLoading: false });
  render(app());
  expect(screen.queryByText('Protected page')).not.toBeInTheDocument();
  await waitFor(() => expect(route.navigate).toHaveBeenCalledWith({ to: '/control-center', replace: true }));
});
it('waits for session hydration without redirecting or mounting protected content', () => {
  session({ currentUser: null, currentClinic: null, isLoading: true });
  render(app());
  expect(screen.queryByText('Protected page')).not.toBeInTheDocument();
  expect(route.navigate).not.toHaveBeenCalled();
});
it.each(['/user-selection', '/control-center'])('does not restart a pending %s sign-in transition', target => {
  route.pathname = '/ai-assistant';
  route.latestPathname = target;
  session({ currentUser: null, currentClinic: target === '/user-selection' ? {id:33} : null, isLoading: false });
  const view = render(app());
  view.rerender(app());
  expect(screen.queryByText('Protected page')).not.toBeInTheDocument();
  expect(route.navigate).not.toHaveBeenCalled();
});
it('removes mounted protected content immediately when the staff session disappears', async () => {
  const view = render(app());
  session({ ...staff, currentUser: null });
  view.rerender(app());
  expect(screen.queryByText('Protected page')).not.toBeInTheDocument();
  await waitFor(() => expect(route.navigate).toHaveBeenCalledWith({ to: '/user-selection', replace: true }));
});
it.each(['/user-selection', '/control-center', '/auth/callback', '/oauth/callback'])('keeps the public %s route available', pathname => {
  route.pathname = pathname;
  session({ currentUser: null, currentClinic: null, isLoading: false });
  render(app());
  expect(screen.getByText('Protected page')).toBeInTheDocument();
  expect(screen.queryByTestId('shell')).not.toBeInTheDocument();
  expect(route.navigate).not.toHaveBeenCalled();
});
