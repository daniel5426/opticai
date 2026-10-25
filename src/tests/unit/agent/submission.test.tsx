import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { AskUserInteraction, HitlSubmissionStatus, AgentResponseTimeline } from '@agents24/chat-react/ui';
import { createHitlSubmission } from '@agents24/react';
import translations from '@/localization/agent.json';

afterEach(cleanup);
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const part: any = { id: 'gate', interruptId: 'gate', kind: 'hitl', type: 'hitl', hitlKind: 'user_input',
  status: 'pending', allowedActions: ['respond'], presentation: {}, questions: [{ id: 'q', question: 'Choose', header: 'Choose',
    multiSelect: false, options: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }] }] };
function labels(locale: 'he' | 'en' | 'fr'): any {
  return Object.fromEntries(['submitting', 'checking', 'uncertain', 'retry', 'accepted', 'approved', 'rejected']
    .map(key => [key, translations[locale][`agent.submission.${key}` as keyof typeof translations.en]]));
}
describe('submission feedback', () => {
  it.each(['he', 'en', 'fr'] as const)('renders compact polite feedback and direction in %s', locale => {
    const copy = labels(locale);
    render(<div dir={locale === 'he' ? 'rtl' : 'ltr'}><HitlSubmissionStatus state={{ status: 'submitting' }} labels={copy} /></div>);
    expect(screen.getByRole('status')).toHaveTextContent(copy.submitting);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status').parentElement).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('collapses before acknowledgement, restores the entered answer on rejection, and preserves keyboard submission', async () => {
    const ack = deferred<any>();
    function Form() {
      const [state, setState] = React.useState<any>();
      return <AskUserInteraction part={part} submission={state} error={state?.error} onSubmit={answers => {
        const submission = createHitlSubmission({ response: { action: 'respond', answers: answers.map(answer => ({
          question_id: answer.questionId, selected_option_ids: answer.selectedOptionIds, custom_text: answer.customText })) },
          idempotencyKey: 'draft-key', createAbortController: () => new AbortController(), isCurrent: () => true,
          send: () => ack.promise, reconcile: async () => null, accept: () => undefined, changed: setState });
        void submission.retry().catch(() => undefined);
      }} />;
    }
    render(<Form />);
    const input = screen.getByRole('textbox', { name: 'Other response' });
    fireEvent.change(input, { target: { value: 'Keep my entered answer' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('status')).toHaveTextContent('Submitting'); expect(screen.queryByRole('textbox')).toBeNull();
    await act(async () => { ack.reject(Object.assign(new Error('Denied'), { status: 403 })); });
    expect(screen.getByRole('textbox', { name: 'Other response' })).toHaveValue('Keep my entered answer');
    expect(screen.getByRole('alert')).toHaveTextContent('Denied');
  });
  it('restores focus to a generic failed approval without a comment field', () => {
    const approval = { ...part, hitlKind: 'user_approval', allowedActions: ['approve', 'reject'], questions: [] };
    render(<AgentResponseTimeline message={{ id: 'm', role: 'assistant', content: '', createdAt: '', parts: [approval] }}
      getHitlActionState={() => ({ action: 'approve', status: 'error', error: 'Denied' })} onHitlAction={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveFocus();
  });
  it('checking offers no new answer and retry sends the retained decision', () => {
    render(<AskUserInteraction part={part} submission={{ status: 'uncertain', retry: async () => undefined }} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry submission' })).toBeEnabled();
  });
});
