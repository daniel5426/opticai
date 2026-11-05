import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mock = vi.hoisted(() => ({path:'/dashboard', listeners:new Set<() => void>(), runtime:{state:'ready', isBootstrapping:false, newThread:vi.fn()}}));
vi.mock('@tanstack/react-router', () => ({useLocation:() => ({pathname:mock.path}), useParams:() => ({})}));
vi.mock('@/contexts/UserContext', () => ({useUser:() => ({currentUser:{id:1}, currentClinic:{id:5}})}));
vi.mock('@/contexts/ClientSidebarContext', () => ({useClientSidebar:() => ({resetPanelMode:vi.fn()})}));
vi.mock('@/services/agent-client', () => ({createAgentClient:() => ({})}));
vi.mock('@agents24/react', () => ({Agents24Provider:({children}:React.PropsWithChildren) => children}));
vi.mock('@agents24/chat-react/runtime', () => ({useAgentChatRuntime:() => React.useSyncExternalStore(callback => {mock.listeners.add(callback); return () => {mock.listeners.delete(callback);};}, () => mock.runtime)}));
import { PrysmAgentProvider, usePrysmAgent } from '@/contexts/PrysmAgentContext';
function Probe() {
  const agent = usePrysmAgent();
  return <><span>{agent?.chatVisible ? 'visible' : 'hidden'}</span><button onClick={agent?.openChat}>Open</button><button onClick={agent?.expandChat}>Expand</button></>;
}
const App = () => <PrysmAgentProvider><Probe /></PrysmAgentProvider>;
beforeEach(() => {vi.clearAllMocks(); mock.path='/dashboard'; mock.runtime.isBootstrapping=false;});
afterEach(cleanup);
it('starts a fresh chat on each normal page entry, including the initial visit, without resetting on rerender', async () => {
  mock.path='/ai-assistant'; const view=render(<App />);
  await waitFor(() => expect(mock.runtime.newThread).toHaveBeenCalledTimes(1));
  view.rerender(<App />); expect(mock.runtime.newThread).toHaveBeenCalledTimes(1);
  mock.path='/dashboard'; view.rerender(<App />);
  mock.path='/ai-assistant'; view.rerender(<App />);
  await waitFor(() => expect(mock.runtime.newThread).toHaveBeenCalledTimes(2));
});
it('preserves the visible sidebar conversation when expanding it explicitly', async () => {
  const view=render(<App />);
  await screen.findByText('hidden'); fireEvent.click(screen.getByText('Open'));
  expect(screen.getByText('visible')).toBeVisible();
  fireEvent.click(screen.getByText('Expand')); mock.path='/ai-assistant'; view.rerender(<App />);
  expect(screen.getByText('visible')).toBeVisible(); expect(mock.runtime.newThread).not.toHaveBeenCalled();
});
it('waits for bootstrap before starting the default page conversation', async () => {
  mock.path='/ai-assistant'; mock.runtime.isBootstrapping=true;
  render(<App />); expect(mock.runtime.newThread).not.toHaveBeenCalled();
  await act(async () => {mock.runtime={...mock.runtime,isBootstrapping:false}; mock.listeners.forEach(callback => callback());});
  await waitFor(() => expect(mock.runtime.newThread).toHaveBeenCalledTimes(1));
});
