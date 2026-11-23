import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ApprovalTimeline } from '@/components/agent/ApprovalTimeline';
import copy from '@/localization/agent.json';

vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => null }));
vi.mock('thinking-orbs', () => ({ ThinkingOrb: () => null }));
const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', resources: Object.fromEntries(Object.entries(copy).map(([locale, translation]) => [locale, { translation }])) });
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });
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
    expect(screen.getAllByText(i18n.t('agent.timeline.activity.planning'))).toHaveLength(1);
  });
  it('does not show historical planning beside the answer', () => {
    render(timeline([turn('old'), text], true));
    expect(screen.queryByText(i18n.t('agent.timeline.activity.planning'))).toBeNull();
    expect(screen.getAllByText(text.text)).toHaveLength(1);
  });
  it('does not show finished planning or completed-response planning', () => {
    const { rerender } = render(timeline([turn('done', 'completed')], true, ''));
    expect(screen.queryByText(i18n.t('agent.timeline.activity.planning'))).toBeNull();
    rerender(timeline([turn('running')], true, '', { responseCompletion: { status: 'completed' } }));
    expect(screen.queryByText(i18n.t('agent.timeline.activity.planning'))).toBeNull();
  });
  it('preserves explicit visible activity and text order without replaying the answer', () => {
    render(timeline([{ ...node('visible'), defaultChatVisible: true }, text]));
    expect(screen.getByText(copy.en['agent.timeline.node.completed'])).toBeVisible();
    expect(screen.getAllByText(text.text)).toHaveLength(1);
  });
  it.each(['he', 'en', 'fr'])('localizes deterministic activity in %s and clears it on completion', async locale => {
    await i18n.changeLanguage(locale);
    const { rerender } = render(timeline([], true, ''));
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('agent.timeline.reasoning'));
    rerender(timeline([turn('running')], true, ''));
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('agent.timeline.activity.planning'));
    rerender(timeline([text], false, text.text, { activity: { status: 'waiting' } }));
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('agent.timeline.activity.waiting'));
    expect(screen.queryByText('Waiting for external work')).toBeNull();
    expect(screen.getByText(text.text)).toBeVisible();
    rerender(timeline([text], false, text.text, { activity: { status: 'waiting' }, isFinal: true }));
    expect(screen.queryByRole('status')).toBeNull();
  });
  it.each([
    [{ status: 'waiting', capacityWait: { reason: 'local_capacity' } }, 'capacity'],
    [{ status: 'interrupted' }, 'interrupted'],
    [{ status: 'cancelling' }, 'cancelling'],
  ])('uses localized wording for %j', (activity, key) => {
    render(timeline([], false, '', { activity }));
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t(`agent.timeline.activity.${key}`));
  });
  it.each(['he', 'en', 'fr'])('localizes retryable model failures in %s without exposing provider text', async locale => {
    await i18n.changeLanguage(locale);
    const error = { id: 'error', type: 'error', kind: 'error', errorText: 'private provider text',
      failure: { code: 'MODEL_INVOCATION_FAILED', retryable: true } };
    const { rerender } = render(timeline([error], false, ''));
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('agent.timeline.modelFailedRetry'));
    expect(screen.queryByText('private provider text')).toBeNull();
    rerender(timeline([{ ...error, failure: { ...error.failure, retryable: false } }], false, ''));
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('agent.timeline.modelFailed'));
    rerender(timeline([{ ...error, failure: undefined }], false, ''));
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('agent.operationFailed'));
  });

  it('localizes planning inside a native tool group without an agent-written group title', async () => {
    await i18n.changeLanguage('he');
    const tool = (id: string) => ({ id, type: 'tool-clinic_context', kind: 'tool', toolName: 'clinic_context', state: 'output-available', presentation: {} });
    render(timeline([tool('one'), tool('two'), turn('planning')], true, ''));
    expect(screen.getByText(i18n.t('agent.timeline.activity.planning')).closest('button')).toBeVisible();
    expect(screen.queryByText('Planning next moves')).toBeNull();
  });
});
