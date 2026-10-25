import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ApprovalTimeline } from '@/components/agent/ApprovalTimeline';
import copy from '@/localization/agent.json';

vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => null }));
const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', resources: { en: { translation: copy.en } } });
afterEach(cleanup);
const text = { id: 'answer', type: 'text', kind: 'text', text: 'A single clinic answer.' };
const node = (id: string) => ({ id, type: 'node-activity', kind: 'node-activity', activityId: id, label: 'Internal activity', nodeKind: 'node', defaultChatVisible: false, status: 'completed' });
const turn = (id: string, status = 'running') => ({ id, type: 'model-turn', kind: 'model-turn', turnKind: 'agent', modelTurnId: id, status });
function timeline(parts: any[], loading = false, content = text.text, extra: Record<string, unknown> = {}) {
  return <I18nextProvider i18n={i18n}><ApprovalTimeline {...({ parts, message: { id: 'message', role: 'assistant', content, parts, ...extra }, isLoading: loading } as any)} /></I18nextProvider>;
}
describe('real SDK timeline rendering', () => {
  it('renders the response once even with multiple SDK-hidden node activities', () => {
    render(timeline([node('before'), text, node('after')]));
    expect(screen.getAllByText(text.text)).toHaveLength(1);
    expect(screen.queryByText('Internal activity')).toBeNull();
  });
  it('does not replay content for a resolved approval filtered by the SDK', () => {
    render(timeline([text, { id: 'resolved', kind: 'hitl', type: 'hitl', hitlKind: 'user_approval', status: 'approved', presentation: {}, allowedActions: [] }]));
    expect(screen.getAllByText(text.text)).toHaveLength(1);
  });
  it('does not create thinking fallbacks for hidden activities during streaming', () => {
    render(timeline([node('one'), node('two')], true, ''));
    expect(screen.queryByText('Thinking')).toBeNull();
    expect(screen.queryByText('Internal activity')).toBeNull();
  });
  it('renders reasoning once without extra thinking placeholders', () => {
    render(timeline([node('one'), { id: 'reasoning', type: 'reasoning', kind: 'reasoning', text: 'Checking appointment availability.', status: 'streaming' }, node('two')], true, ''));
    expect(screen.getAllByText('Checking appointment availability.')).toHaveLength(1);
    expect(screen.queryByText('Thinking')).toBeNull();
  });
  it('shows only the current planning activity, not earlier model turns', () => {
    render(timeline([turn('old'), node('one'), turn('current')], true, ''));
    expect(screen.getAllByText(copy.en['agent.activity.planning'])).toHaveLength(1);
  });
  it('does not show historical planning beside the answer', () => {
    render(timeline([turn('old'), text], true));
    expect(screen.queryByText(copy.en['agent.activity.planning'])).toBeNull();
    expect(screen.getAllByText(text.text)).toHaveLength(1);
  });
  it('does not show finished planning or completed-response planning', () => {
    const { rerender } = render(timeline([turn('done', 'completed')], true, ''));
    expect(screen.queryByText(copy.en['agent.activity.planning'])).toBeNull();
    rerender(timeline([turn('running')], true, '', { responseCompletion: { status: 'completed' } }));
    expect(screen.queryByText(copy.en['agent.activity.planning'])).toBeNull();
  });
  it('preserves explicit visible activity and text order without replaying the answer', () => {
    render(timeline([{ ...node('visible'), defaultChatVisible: true }, text]));
    expect(screen.getByText(copy.en['agent.timeline.node.completed'])).toBeVisible();
    expect(screen.getAllByText(text.text)).toHaveLength(1);
  });
});
