vi.mock('@/components/agent/AgentVoice', () => ({ AgentVoiceCapture: () => null }));
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';

const mock = vi.hoisted(() => ({
  json: vi.fn(), sdk: vi.fn(), generate: vi.fn(), getClient: vi.fn(),
  listeners: new Set<() => void>(),
  runtime: { state:'ready', bootstrap: {deployment:{agent_id:'new-agent'}} as object | null, fatalError: null as Error | null, isBootstrapping: false, retryBootstrap: async () => {} },
  user: { id: 1, role_level: 3 }, clinic: { id: 1 },
  sidebar: { isOpen: true, isClientSpacePage: true, panelMode: 'info', currentClient: { id: 1, first_name: 'Test', last_name: 'Patient' },
    activeTab: 'exams', resetPanelMode: vi.fn(), closeSidebar: vi.fn(), setPanelHost: vi.fn() },
}));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentUser: mock.user, currentClinic: mock.clinic }) }));
vi.mock('@/contexts/ClientSidebarContext', () => ({ useClientSidebar: () => mock.sidebar }));
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/clients/1/exams/1' }), useParams: () => ({ clientId: '1' }),
  useSearch: () => ({}), useNavigate: () => vi.fn(),
  Navigate: ({ to }: { to: string }) => <span data-testid="redirect">{to}</span>,
}));
vi.mock('@agents24/react', () => ({ Agents24Provider: ({ children }: React.PropsWithChildren) => children }));
vi.mock('@agents24/chat-react/runtime', () => ({ useAgentChatRuntime: (options: unknown) => { mock.sdk(options); return React.useSyncExternalStore(callback => {mock.listeners.add(callback);return () => {mock.listeners.delete(callback);};},()=>mock.runtime); } }));
vi.mock('@/services/agent-client', () => ({ createAgentClient: () => ({}), agentJson: mock.json }));
vi.mock('@/lib/api-client', () => ({ apiClient: {
  getClientById: mock.getClient, aiGenerateAllStates: mock.generate,
  getSettings: async () => ({ data: {} }),
} }));
vi.mock('@/lib/db/campaigns-db', () => ({ getAllCampaigns: async () => [], createCampaign: vi.fn(), updateCampaign: vi.fn(), deleteCampaign: vi.fn() }));
vi.mock('@/components/agent/AgentChatPanel', () => ({ AgentChatPanel: () => <p>Agent conversation</p> }));
vi.mock('@/components/agent/AgentChatActions', () => ({ AgentChatActions: () => <p>Agent actions</p> }));
vi.mock('@/components/site-header', () => ({ SiteHeader: ({ title, actions }: any) => <header>{title}{actions}</header> }));
vi.mock('@/components/ui/custom-modal', () => ({ CustomModal: ({ isOpen, children }: any) => isOpen ? <div>{children}</div> : null }));
vi.mock('@/components/GlobalSearch', () => ({ GlobalSearch: () => null }));
vi.mock('@/components/nav-main', () => ({ NavMain: ({ items }: any) => <nav>{items.map((item: any) => <a key={item.url} href={item.url}>{item.title}</a>)}</nav> }));
vi.mock('@/components/nav-documents', () => ({ NavDocuments: () => null }));
vi.mock('@/components/nav-secondary', () => ({ NavSecondary: () => null }));
vi.mock('@/components/nav-user', () => ({ NavUser: () => null }));
vi.mock('@/components/clinic-dropdown', () => ({ ClinicDropdown: ({ children }: React.PropsWithChildren) => children }));
vi.mock('@/components/sidebar-quick-actions', () => ({ SidebarQuickActions: ({ children }: any) => children(() => null) }));
vi.mock('@/components/ui/sidebar', () => ({
  ...Object.fromEntries(['Sidebar', 'SidebarContent', 'SidebarFooter', 'SidebarHeader', 'SidebarMenu', 'SidebarMenuButton', 'SidebarMenuItem']
    .map(name => [name, ({ children }: React.PropsWithChildren) => <div>{children}</div>])),
  useSidebar: () => ({ state: 'expanded' }),
}));

import { GlobalAgentPanel } from '@/components/agent/GlobalAgentPanel';
import { PrysmAgentProvider, usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { AppSidebar } from '@/components/app-sidebar';
import { ClientSidebar } from '@/components/ClientSidebar';
import { AIAssistantPage } from '@/pages/AIAssistantPage';
import CampaignsPage from '@/pages/CampaignsPage';

function PatientAction() {
  const workspace = usePrysmAgent();
  return <button onClick={() => workspace?.openPatientChat(1)}>Test patient chat</button>;
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><PrysmAgentProvider>
    <AppSidebar currentUser={mock.user as any} /><ClientSidebar /><GlobalAgentPanel /><AIAssistantPage /><CampaignsPage /><PatientAction />
  </PrysmAgentProvider></QueryClientProvider>);
  return { ...view, client };
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mock.runtime = { state:'ready', bootstrap: {deployment:{agent_id:'new-agent'}}, fatalError: null, isBootstrapping: false, retryBootstrap: async () => {} };
  mock.json.mockResolvedValue({ available: false });
  mock.getClient.mockResolvedValue({ data: { client_updated_date: '2026-10-25' } });
  mock.generate.mockImplementation(async () => ({ data: { locale: i18n.language, states: { ai_exam_state: 'Test insight' } } }));
});
afterEach(cleanup);

describe.each(['he', 'en', 'fr'])('temporary connection loss in %s', locale => {
  it('keeps navigation and the mounted conversation without a health request', async () => {
    await i18n.changeLanguage(locale);
    const view = mount();
    await screen.findByRole('link', {name:i18n.t('smartAssistant')});
    fireEvent.click(screen.getByRole('button',{name:'Test patient chat'}));
    await screen.findByText('Agent conversation');
    await act(async () => {
      mock.runtime = {...mock.runtime,state:'reconnecting',fatalError:new Error('offline')};
      mock.listeners.forEach(callback=>callback());
    });
    expect(view.container.querySelector('a[href="/ai-assistant"]')).not.toBeNull();
    expect(screen.getByText('Agent conversation')).toBeVisible();
    expect(view.container.querySelector('a[href="/clients"]')).not.toBeNull();
    expect(mock.json).not.toHaveBeenCalled();
    expect(view.container.querySelector('[dir]')).toHaveAttribute('dir',locale==='he'?'rtl':'ltr');
  });
});

it('removes access on an authoritative bootstrap denial', async () => {
  mock.runtime={...mock.runtime,state:'denied',bootstrap:null,fatalError:Object.assign(new Error('denied'),{status:403})};
  const view=mount();
  await screen.findByTestId('redirect');
  expect(view.container.querySelector('a[href="/ai-assistant"]')).toBeNull();
  expect(mock.json).not.toHaveBeenCalled();
});

it('keeps a connected chat available when a turn fails so the user can see and retry it', async () => {
  mock.json.mockResolvedValue({ available: true, namespace: 'new-organization-agent' });
  mock.runtime = { ...mock.runtime, fatalError: new Error('MODEL_PROVIDER_CAPACITY_WAIT') };
  mount();
  await screen.findByRole('link', { name: i18n.t('smartAssistant') });
  fireEvent.click(screen.getByRole('button', { name: 'Test patient chat' }));
  await screen.findByText('Agent conversation');
});

it('starts fresh instead of restoring saved threads from any organization', async () => {
  localStorage.setItem('prysm-agent-thread:1:1:0', 'legacy-organization-thread');
  localStorage.setItem('prysm-agent-thread:1:1:0:new-agent', 'current-organization-thread');
  mock.runtime={...mock.runtime,bootstrap:{deployment:{agent_id:'new-agent'}}};
  mount();
  await screen.findByRole('link', { name: i18n.t('smartAssistant') });
  expect(mock.sdk).toHaveBeenCalledWith(expect.objectContaining({ activeThreadId: null }));
  expect(mock.sdk.mock.calls.every(([options]) => options.activeThreadId === null)).toBe(true);
});
