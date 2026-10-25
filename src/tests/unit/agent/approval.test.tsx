import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const mock = vi.hoisted(() => ({ json: vi.fn() }));
vi.mock('@/services/agent-client', () => ({ agentJson: mock.json }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => ({ scope: { userId: 1, clinicId: 1 } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }) }));
vi.mock('@/components/agent/AgentLinks', () => ({ AgentLink: ({ children }: any) => <span>{children}</span> }));
vi.mock('@/components/agent/ToolActivityTimeline', () => ({ ToolActivityTimeline: () => null }));
import { ApprovalTimeline } from '@/components/agent/ApprovalTimeline';
const parts: any[] = [
  { id: 'call', toolCallId: 'call-1', kind: 'tool', toolName: 'commit_change', input: { change_id: 'saved-proposal' } },
  { id: 'interrupt', kind: 'hitl', hitlKind: 'tool_review', presentation: { tool_name: 'commit_change', tool_call_id: 'call-1' }, status: 'pending', allowedActions: ['approve', 'reject'] },
];
function mount(resume: any, timeline = parts, getHitlActionState?: any) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ApprovalTimeline {...({ parts: timeline, onHitlAction: resume, getHitlActionState } as any)} />
  </QueryClientProvider>);
}
describe('saved proposal approval', () => {
  beforeEach(() => { cleanup(); mock.json.mockReset();mock.json.mockImplementation((_scope, path) =>
    path.endsWith('/approve') ? Promise.resolve({ status: 'approved' }) : Promise.resolve({
      id: 'saved-proposal', kind: 'clients', action: 'update', before: { notes: 'Original' }, after: { notes: 'Reviewed' }, status: 'prepared',
    })); });
  it('shows the saved values and obtains product approval before resuming the platform', async () => {
    const order: string[] = [];
    mock.json.mockImplementation((_scope, path) => {
      if (path.endsWith('/approve')) { order.push('receipt');return Promise.resolve({ status: 'approved' }); }
      return Promise.resolve({ before: { notes: 'Original' }, after: { notes: 'Reviewed' }, status: 'prepared' });
    });
    const resume = vi.fn(async (_part, _answer, options) => { await options?.prepare({ signal: new AbortController().signal }); order.push('resume'); });mount(resume);
    await screen.findByText('Original');expect(screen.getByText('Reviewed')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'agent.approve' }));
    await waitFor(() => expect(resume).toHaveBeenCalledWith(parts[1], { action: 'approve' }, { prepare: expect.any(Function) }));
    expect(order).toEqual(['receipt', 'resume']);
    expect(mock.json).toHaveBeenCalledWith({ userId: 1, clinicId: 1 }, '/changes/saved-proposal/approve', { method: 'POST', signal: expect.any(AbortSignal) });
  });
  it('does not resume when the authenticated approval request fails', async () => {
    mock.json.mockImplementation((_scope, path) => path.endsWith('/approve') ? Promise.reject(new Error('Denied'))
      : Promise.resolve({ before: {}, after: { notes: 'Reviewed' }, status: 'prepared' }));
    const platform = vi.fn();
    const resume = vi.fn(async (_part, _answer, options) => {
      await options?.prepare({ signal: new AbortController().signal });
      platform();
    });
    mount((...args) => { void resume(...args).catch(() => undefined); });await screen.findByText('Reviewed');
    fireEvent.click(screen.getByRole('button', { name: 'agent.approve' }));
    await waitFor(() => expect(mock.json).toHaveBeenCalledTimes(2));
    expect(platform).not.toHaveBeenCalled();
  });
  it('rejects without granting a product write receipt', async () => {
    const resume = vi.fn();mount(resume);await screen.findByText('Reviewed');
    fireEvent.click(screen.getByRole('button', { name: 'agent.reject' }));
    await waitFor(() => expect(resume).toHaveBeenCalledWith(parts[1], { action: 'reject' }, undefined));
    expect(mock.json.mock.calls.some(([, path]) => path.endsWith('/approve'))).toBe(false);
  });
  it('restores focus to the failed decision after the shared operation restores editing', async () => {
    mount(vi.fn(), parts, () => ({ action: 'approve', status: 'error', error: 'Denied' }));
    await screen.findByText('Reviewed');
    await waitFor(() => expect(screen.getByRole('button', { name: 'agent.approve' })).toHaveFocus());
  });
  it('links a review before its tool to the exact call, even with another commit nearby', async () => {
    mount(vi.fn(), [{ ...parts[0], id: 'other', toolCallId: 'other', input: { change_id: 'wrong' } }, parts[1], parts[0]]);
    await screen.findByText('Reviewed');
    expect(mock.json.mock.calls.map(([, path]) => path)).toEqual(['/changes/saved-proposal']);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('does not infer a pending approval from an unrelated preceding tool', () => {
    mount(vi.fn(), [parts[0], { ...parts[1], presentation: { tool_name: 'commit_change' } }]);
    expect(screen.getByRole('button', { name: 'agent.approve' })).toBeDisabled();
    expect(screen.getByRole('alert')).toBeVisible();
    expect(mock.json).not.toHaveBeenCalled();
  });
  it('does not show a false error for a resolved historical review without a link', () => {
    mount(vi.fn(), [{ ...parts[1], status: 'resolved', presentation: { tool_name: 'commit_change' } }]);
    expect(screen.getByText('agent.approval.resolved')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
