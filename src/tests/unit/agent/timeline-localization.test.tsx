import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { ApprovalTimeline } from '@/components/agent/ApprovalTimeline';
import copy from '@/localization/agent.json';

vi.mock('@agents24/chat-react/ui', async importOriginal => ({ ...await importOriginal<any>(), useHighlightedCode: (code: string) => code.split('\n') }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => null }));
const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: Object.fromEntries(Object.entries(copy).map(([lang, translation]) => [lang, { translation }])) });
afterEach(cleanup);
const input: any = { id: 'questions', kind: 'hitl', type: 'hitl', interruptId: 'interrupt', hitlKind: 'user_input', status: 'pending', message: '', presentation: {}, allowedActions: ['respond'], questions: [
  { id: 'one', question: 'Choose an option', header: '', multiSelect: false, options: [{ id: 'a', label: 'Option A' }, { id: 'b', label: 'Option B' }] },
  { id: 'two', question: 'Choose more options', header: '', multiSelect: true, options: [{ id: 'c', label: 'Option C' }] },
] };
function mount(parts: any[], props: any = {}) {
  return <I18nextProvider i18n={i18n}><ApprovalTimeline {...{ parts, message: { id: 'message', role: 'assistant', content: '', parts }, ...props } as any} /></I18nextProvider>;
}
const tr = (key: string, values?: Record<string, unknown>) => i18n.t(`agent.timeline.${key}`, values);
describe('localized timeline presentation with real SDK components', () => {
  it.each(['he', 'en', 'fr'])('translates question cards, counts, and accessibility in %s', async locale => {
    await i18n.changeLanguage(locale);
    const { rerender } = render(mount([input], { onHitlAction: vi.fn() }));
    expect(screen.getByRole('button', { name: tr('questions.previous') })).toBeDisabled();
    expect(screen.getByLabelText(tr('questions.progress', { current: 1, total: 2 }))).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('button', { name: tr('questions.next') })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: tr('questions.otherLabel') })).toHaveAttribute('placeholder', tr('questions.other'));
    expect(screen.getByRole('textbox')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    const resolved = { ...input, status: 'resolved', resolution: { answers: [{ questionId: 'one', selectedOptionIds: ['a'], customText: '' }] } };
    rerender(mount([resolved]));
    const disclosure = screen.getByRole('button', { name: tr('questions.asked', { count: 2 }) });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(disclosure);
    expect(screen.getByText('Option A')).toBeVisible();
    expect(screen.getByText(tr('questions.noResponse'))).toBeVisible();
    expect(screen.queryByText(/Asked \d+ questions?/)).toBe(locale === 'en' ? disclosure.firstElementChild : null);
    expect(screen.getByRole('button')).toHaveAttribute('aria-controls');
  });
  it.each(['he', 'en', 'fr'])('translates statuses, fallbacks and code controls in %s', async locale => {
    await i18n.changeLanguage(locale);
    const parts: any[] = [
      { id: 'thinking', kind: 'reasoning', type: 'reasoning', status: 'running', label: 'Thinking' },
      ...['started', 'completed', 'failed'].map(status => ({ id: status, kind: 'context-compression', type: 'context-compression', status })),
      { id: 'node', kind: 'node-activity', type: 'node-activity', status: 'running', label: 'Working', defaultChatVisible: true },
      { id: 'citation', kind: 'citation', type: 'citation', label: null },
      { id: 'attachment', kind: 'attachment', type: 'attachment', attachment: { filename: '' } },
      { id: 'error', kind: 'error', type: 'error', errorText: 'Internal English failure' },
      { id: 'ui-failure', kind: 'ui-blocks', type: 'ui-blocks', state: 'output-error', errorText: 'Internal English rendering failure' },
      { id: 'ui-loading', kind: 'ui-blocks', type: 'ui-blocks', state: 'input-streaming' },
      { id: 'ui', kind: 'ui-blocks', type: 'ui-blocks', state: 'output-available', bundle: { rows: [{ blocks: [{ text: 'Original result value' }] }] } },
      { id: 'code', kind: 'text', type: 'text', text: '```json\n{"value":42}\n```' },
    ];
    render(mount(parts));
    for (const key of ['reasoning', 'context.started', 'context.completed', 'context.failed', 'node.running', 'citation', 'attachment', 'ui.failed', 'ui.running', 'ui.result']) expect(screen.getByText(tr(key))).toBeVisible();
    expect(screen.getByRole('region', { name: tr('ui.results') })).toBeVisible();
    expect(screen.queryByText(/Internal English/)).toBeNull();
    expect(screen.getByRole('button', { name: tr('code.copy') })).toHaveAttribute('title', tr('code.copy'));
    fireEvent.click(screen.getByRole('button', { name: tr('code.wrap') }));
    expect(screen.getByRole('button', { name: tr('code.unwrap') })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: tr('code.download') })).toBeVisible();
    expect(screen.getByLabelText(tr('code.content'))).toHaveAttribute('dir', 'ltr');
  });
  it.each(['he', 'en', 'fr'])('translates generic approvals, comment controls and submission states in %s', async locale => {
    await i18n.changeLanguage(locale);
    const approve = vi.fn();
    const part = { ...input, hitlKind: 'tool_review', questions: [], allowedActions: ['approve', 'reject'], presentation: { tool_name: 'unknown_tool', require_comment: true } };
    const { rerender } = render(mount([part], { onHitlAction: approve }));
    expect(screen.getByText(tr('approval.review'))).toBeVisible();
    expect(screen.getByRole('button', { name: tr('action.allow') })).toBeDisabled();
    const comment = screen.getByRole('textbox', { name: tr('approval.comment') });
    expect(comment).toHaveAttribute('placeholder', tr('approval.commentRequired'));
    fireEvent.change(comment, { target: { value: 'Reviewed by the user' } });
    fireEvent.click(screen.getByRole('button', { name: tr('action.allow') }));
    expect(approve).toHaveBeenCalledWith(part, { action: 'approve', comment: 'Reviewed by the user' });
    rerender(mount([part], { getHitlActionState: () => ({ status: 'submitting', action: 'approve' }) }));
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('agent.submission.submitting'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it.each(['he', 'en', 'fr'])('translates saved proposal field labels and boolean values in %s', async locale => {
    await i18n.changeLanguage(locale);
    const client = new QueryClient();
    client.setQueryData(['agent-change', undefined, undefined, 'change'], { status: 'prepared', before: { notes: 'User note', future_field: false }, after: { notes: 'Edited user note', future_field: true } });
    const commit = { id: 'commit', type: 'tool-commit_change', kind: 'tool', toolName: 'commit_change', toolCallId: 'call', state: 'input-available', input: { change_id: 'change' }, presentation: {} };
    const review = { ...input, id: 'review', hitlKind: 'tool_review', allowedActions: ['approve', 'reject'], questions: [], presentation: { tool_name: 'commit_change', tool_call_id: 'call' } };
    render(<QueryClientProvider client={client}>{mount([commit, review])}</QueryClientProvider>);
    expect(screen.getByText(tr('field.notes'))).toBeVisible();
    expect(screen.getByText(tr('field'))).toBeVisible();
    expect(screen.getByText(tr('yes'))).toBeVisible();
    expect(screen.getByText(tr('no'))).toBeVisible();
    expect(screen.queryByText('future field')).toBeNull();
    expect(screen.getByText('Edited user note')).toBeVisible();
  });
  it('suppresses internal English tool reasoning already covered by the activity group', async () => {
    await i18n.changeLanguage('he');
    render(mount([{ id: 'trace', kind: 'reasoning', type: 'reasoning', label: 'artifact__prysm_clinic_tools_list_records', text: 'Running an internal tool', status: 'running' }]));
    expect(screen.queryByText('Running an internal tool')).toBeNull();
  });
  it('changes locale without losing an entered answer', async () => {
    await i18n.changeLanguage('he');
    const { rerender } = render(mount([input], { onHitlAction: vi.fn() }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'User draft' } });
    await act(async () => { await i18n.changeLanguage('fr'); });
    rerender(mount([input], { onHitlAction: vi.fn() }));
    expect(screen.getByRole('textbox', { name: tr('questions.otherLabel') })).toHaveValue('User draft');
    expect(screen.getByRole('textbox')).toHaveAttribute('dir', 'ltr');
  });
  it('keeps question choices, custom text and SDK submissions intact', async () => {
    await i18n.changeLanguage('en');
    const submit = vi.fn();
    const { rerender } = render(mount([input], { onHitlAction: submit }));
    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    expect(screen.getByText('Choose more options')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Option C' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A custom answer' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(submit).toHaveBeenCalledWith(input, { action: 'respond', answers: [
      { question_id: 'one', selected_option_ids: ['a'] }, { question_id: 'two', selected_option_ids: ['c'], custom_text: 'A custom answer' },
    ] });
    rerender(mount([input], { onHitlAction: submit, getHitlActionState: () => ({ status: 'submitting' }) }));
    expect(screen.queryByRole('textbox')).toBeNull();
    rerender(mount([input], { onHitlAction: submit, getHitlActionState: () => ({ status: 'error', error: 'English error' }) }));
    expect(screen.getByRole('textbox')).toHaveValue('A custom answer');
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('agent.operationFailed'));
  });
  it('keeps checking/uncertain retries inside the SDK and preserves the draft', async () => {
    await i18n.changeLanguage('he');
    const retry = vi.fn().mockResolvedValue(undefined);
    const submit = vi.fn();
    const { rerender } = render(mount([input], { onHitlAction: submit }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'User draft' } });
    rerender(mount([input], { onHitlAction: submit, getHitlActionState: () => ({ status: 'uncertain', retry }) }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('agent.submission.retry') }));
    expect(retry).toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
  it('announces translated copy success without English SDK announcements', async () => {
    await i18n.changeLanguage('fr');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(mount([{ id: 'code', kind: 'text', type: 'text', text: '```text\nexample\n```' }]));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: tr('code.copy') })));
    expect(screen.getByRole('button', { name: tr('code.copied') })).toBeVisible();
    expect(screen.getByText(tr('code.copied'))).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByText('Copied')).toBeNull();
  });
});
