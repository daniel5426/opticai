import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { ChatMessage, ChatPart, ChatToolPart } from '@agents24/react';
import { ApprovalTimeline } from '@/components/agent/ApprovalTimeline';
import copy from '@/localization/agent.json';

vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => null }));
vi.mock('@/components/agent/LocalizedHitl', () => ({ LocalizedHitl: () => <div>Approval card</div> }));
vi.mock('thinking-orbs', () => ({ ThinkingOrb: () => null }));

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: Object.fromEntries(Object.entries(copy).map(([locale, translation]) => [locale, { translation }])) });
afterEach(cleanup);

function tool(id: string, title?: string, groupTitle?: string): ChatToolPart {
  return {
    id, toolCallId: id, kind: 'tool', type: 'tool-clinic_context', toolName: 'clinic_context',
    state: 'output-available', presentation: { title: 'Clinic context', generatedActivity: title ? { title, groupTitle } : undefined },
    input: { scope: 'PRIVATE_TOOL_INPUT' }, output: { value: 'PRIVATE_TOOL_OUTPUT' },
  };
}

function mount(parts: ChatPart[], isLoading = false, activity?: ChatMessage['activity']) {
  return <I18nextProvider i18n={i18n}><ApprovalTimeline parts={parts} isLoading={isLoading}
    message={{ id: 'answer', role: 'assistant', content: '', createdAt: '2026-11-18T10:00:00Z', parts, activity }} /></I18nextProvider>;
}

describe('native tool activity in Prysm chat', () => {
  it.each([
    ['he', 'rtl', 'בודק את הגדרות המרפאה'],
    ['en', 'ltr', 'Checking clinic settings'],
    ['fr', 'ltr', 'Vérification des réglages de la clinique'],
  ])('shows the generated title in %s with the correct direction', async (locale, direction, title) => {
    await i18n.changeLanguage(locale);
    render(mount([tool('call', title)]));
    expect(screen.getByText(title).closest('[dir]')).toHaveAttribute('dir', direction);
    expect(screen.queryByText('Clinic context')).toBeNull();
  });

  it('uses the native group title and recaps, keeping payloads out of expanded activity', async () => {
    await i18n.changeLanguage('en');
    const parts = [tool('one', 'Check clinic settings', 'Gathering clinic context'), {
      ...tool('two', 'Check record types', 'Gathering clinic context'), state: 'input-available',
    }] satisfies ChatToolPart[];
    const view = render(mount(parts, true));
    const disclosure = screen.getByRole('button', { name: /Gathering clinic context/ });
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Check clinic settings')).toBeVisible();
    expect(screen.getByText('Check record types')).toBeVisible();
    expect(screen.queryByText(/PRIVATE_TOOL/)).toBeNull();

    view.rerender(mount([parts[0], { ...parts[1], state: 'output-available' }, {
      id: 'text', type: 'text', kind: 'text', text: 'The clinic context is ready.',
      toolSessionRecap: { callIds: ['one', 'two'], label: 'Checked clinic settings and record types' },
    }]));
    expect(screen.getByText('Checked clinic settings and record types')).toBeVisible();
    expect(screen.getByText('The clinic context is ready.')).toBeVisible();
  });

  it('discloses the deferred report with localized safe detail', async () => {
    await i18n.changeLanguage('he');
    const waiting: ChatToolPart = {
      ...tool('report', 'הפקת דוח פגישות'), toolName: 'run_report',
      state: 'input-available', output: undefined,
    };
    const { container } = render(mount([waiting], false, { status: 'waiting', waitingToolCallIds: ['report'] }));
    const row = container.querySelector('[data-agents24-tool-part][data-state="waiting"]');
    const disclosure = screen.getByRole('button', { name: /הפקת דוח פגישות/ });
    expect(row).toContainElement(disclosure);
    fireEvent.click(disclosure);
    expect(screen.getByText(i18n.t('agent.timeline.activity.toolWaitingDetail'))).toBeVisible();
    expect(screen.queryByText(/PRIVATE_TOOL/)).toBeNull();
  });

  it('renders older tool history using the SDK fallback title', () => {
    render(mount([tool('old-call')]));
    expect(screen.getByText('Clinic context')).toBeVisible();
  });

  it('keeps the tool before its approval and hides the internal ask-user invocation', () => {
    render(mount([
      tool('call', 'Check clinic settings'),
      { ...tool('ask-user', 'Internal ask-user call'), toolName: 'runtime__ask_user' },
      { id: 'review', type: 'hitl', kind: 'hitl', hitlKind: 'user_input', status: 'pending', interruptId: 'review', message: '', allowedActions: ['respond'], presentation: {}, questions: [] },
      { id: 'text', type: 'text', kind: 'text', text: 'After the approval' },
    ]));
    const approval = screen.getByText('Approval card');
    expect(screen.getByText('Check clinic settings').compareDocumentPosition(approval) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(approval.compareDocumentPosition(screen.getByText('After the approval')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Internal ask-user call')).toBeNull();
  });
});
