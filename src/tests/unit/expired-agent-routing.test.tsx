import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { useUser } from '@/contexts/UserContext';
import BaseLayout from '@/layouts/BaseLayout';
vi.mock('@/lib/auth/sign-in-navigation', () => ({ replaceBrowserSignInRoute: () => false }));

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


import { createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from '@tanstack/react-router';
import { createBrowserHistory, parseHref } from '@tanstack/history';
import { stripLocalePrefix, localizeHref } from '@/localization/locale';

it('leaves an expired agent page for staff sign-in without a redirect loop', async () => {
  vi.mocked(useUser).mockReturnValue({currentUser:null,currentClinic:{id:33},isLoading:false} as any);
  window.history.replaceState({}, '', '/he/ai-assistant');
  const history=createBrowserHistory({
    parseLocation:()=>parseHref(stripLocalePrefix(window.location.pathname)+window.location.search+window.location.hash,window.history.state),
    createHref:href=>localizeHref(href),
  });
  const root=createRootRoute({component:()=> <BaseLayout><Outlet /></BaseLayout>});
  const tree=root.addChildren([
    createRoute({getParentRoute:()=>root,path:'/ai-assistant',component:()=> <div>Protected agent</div>}),
    createRoute({getParentRoute:()=>root,path:'/user-selection',component:()=> <div>Staff sign-in</div>}),
  ]);
  const router=createRouter({routeTree:tree,history});
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router}/></QueryClientProvider>);
  await screen.findByText('Staff sign-in');
  expect(screen.queryByText('Protected agent')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/he/user-selection');
  history.destroy();
});
