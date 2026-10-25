import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { ChatToolPart } from '@agents24/react';
import copy from '@/localization/agent.json';
import { presentTool, toolPresentationRegistry } from '@/components/agent/tool-presentation';
import { ApprovalTimeline } from '@/components/agent/ApprovalTimeline';
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => null }));
vi.mock('@/components/agent/LocalizedHitl', () => ({ LocalizedHitl: () => <div data-testid="native">Approval card</div> }));
vi.mock('@agents24/chat-react/ui', async importOriginal => ({ ...await importOriginal<any>(), AgentResponseTimeline: ({ parts }: any) => <div data-testid="native">{parts[0].kind === 'text' ? parts[0].text : 'Approval card'}</div> }));
const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false }, resources: Object.fromEntries(Object.entries(copy).map(([locale, translation]) => [locale, { translation }])) });
const tool = (name: string, output: unknown = {}, state = 'output-available', input: unknown = {}): ChatToolPart => ({ id: name, type: `tool-${name}`, kind: 'tool', toolName: name, state, input, output, presentation: {} } as ChatToolPart);
const show = (part: ChatToolPart) => presentTool(part, i18n.t.bind(i18n), i18n.language);
const receipt = { user_id: 1, at: '2026-10-18T10:00:00Z' };
const outputs = {
  clinic_context: { business_date: '2026-10-18', read_only: false }, search_patients: { matches: [{ secret: 'PRIVATE' }], has_more: false },
  find_staff: { matches: [], has_more: false }, patient_history: { client: { id: 1 } }, list_records: { records: Array(50).fill({}), total: 143 },
  exam_layout_catalog: { layouts: [] }, compare_exams: { prescription_comparisons: {}, sources: [] }, check_order: { status: 'review' },
  find_appointments: { slots: [], bounded: false }, change_catalog: { clients: [], appointments: [] },
  prepare_change: { change_id: 'secret-id', requires_approval: true, after: {} }, commit_change: { approval: receipt },
  report_catalog: { datasets: {}, definition_schema: {} }, preview_report: { rows: Array(25).fill({}), total: 143 },
  export_report: { job_id: 'secret-job', status: 'queued' }, job_status: { kind: 'report', status: 'completed', download_path: '/api/v1/agent/jobs/secret/download' },
};
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });
describe('safe tool presentation', () => {
  it.each(Object.keys(toolPresentationRegistry))('presents every lifecycle of %s without leaking payloads', name => {
    const output = outputs[name as keyof typeof outputs];
    expect(show(tool(name, output)).label).not.toMatch(/agent\.|PRIVATE|secret|_/);
    expect(show(tool(name, output, 'input-streaming', '{partial')).status).toBe('running');
    expect(show(tool(name, output, 'input-available')).label).toContain('…');
    expect(show(tool(name, output, 'output-error')).status).toBe('failed');
    expect(show(tool(name, output, 'cancelled')).status).toBe('cancelled');
    expect(show(tool(name, { status: 'error', message: 'PRIVATE' })).label).toBe('Step failed');
    for (const malformed of [null, 'PRIVATE', [], 123, {}]) expect(show(tool(name, malformed)).label).toBe(name === 'commit_change' ? 'Save not confirmed' : 'Step finished');
  });
  it('accepts only exact registered identities from public SDK identity fields', () => {
    expect(show({ ...tool('tool', outputs.search_patients), displayName: 'search_patients' }).label).toBe('Found 1 matching patient');
    expect(show(tool('prefix_search_patients', outputs.search_patients)).label).toBe('Step finished');
    expect(show(tool('unknown', {}, 'input-streaming')).label).toBe('Working…');
  });
  it('handles empty, limited, and paginated results honestly', () => {
    expect(show(tool('search_patients', { matches: [], has_more: false })).label).toBe('Found 0 matching patients');
    expect(show(tool('search_patients', { matches: Array(20).fill({}), has_more: true })).label).toContain('at least 20');
    expect(show(tool('list_records', outputs.list_records)).label).toBe('Loaded 50 of 143 records');
    expect(show(tool('list_records', { records: [], total: 0 })).label).toBe('Loaded 0 of 0 records');
    expect(show(tool('list_records', { records: [{}], total: -1 })).label).toBe('Step finished');
    expect(show(tool('preview_report', outputs.preview_report)).detail).toBe('25 of 143 records shown');
    expect(show(tool('find_appointments', { slots: Array(10).fill({}), bounded: true })).label).toContain('at least 10');
  });
  it('never confuses drafts, saves, requests, and readiness', () => {
    expect(show(tool('prepare_change', outputs.prepare_change)).label).toBe('Draft ready for review');
    expect(show(tool('commit_change', { approval: { user_id: 1 } })).label).toBe('Save not confirmed');
    expect(show(tool('commit_change', outputs.commit_change)).label).toBe('Approved changes saved');
    expect(show(tool('export_report', { ...outputs.export_report, status: 'completed', download_path: 'anything' })).label).toBe('Report queued');
    expect(show(tool('job_status', { status: 'queued' })).label).toBe('Job queued');
    expect(show(tool('job_status', { kind: 'report', status: 'completed' })).label).toBe('Step finished');
    expect(show(tool('job_status', outputs.job_status)).label).toBe('Report ready to download');
    expect(show(tool('job_status', { status: 'failed' })).status).toBe('failed');
    expect(show(tool('job_status', { status: 'cancelled' })).status).toBe('cancelled');
  });
  it('uses only allowlisted details and validates dates', () => {
    expect(show(tool('list_records', outputs.list_records, 'input-available', { kind: 'orders', text: 'PRIVATE' })).detail).toBe('Orders');
    expect(show(tool('list_records', {}, 'input-streaming', { kind: 'PRIVATE' })).detail).toBeUndefined();
    expect(show(tool('find_appointments', {}, 'input-streaming', { start_date: '2026-02-30', end_date: '2026-03-01' })).detail).toBeUndefined();
    expect(show(tool('find_appointments', {}, 'input-streaming', { start_date: '2026-10-18', end_date: '2026-10-20' })).detail).toContain('2026');
    expect(show(tool('export_report', {}, 'input-streaming', { definition: { format: 'xlsx', title: 'PRIVATE' } })).detail).toBe('Excel');
    expect(show(tool('unknown_PRIVATE', { text: 'PRIVATE' })).label).toBe('Step finished');
  });
  it.each(['he', 'en', 'fr'])('translates every tool and plural in %s', async locale => {
    await i18n.changeLanguage(locale);
    for (const [name, output] of Object.entries(outputs)) {
      for (const state of ['input-streaming', 'output-available', 'output-error', 'cancelled']) expect(show(tool(name, output, state)).label).not.toMatch(/agent\./);
    }
    for (const n of [0, 1, 2, 7]) expect(i18n.t('agent.activity.steps', { count: n })).not.toMatch(/agent\./);
  });
});
function mount(parts: any[], loading = true) {
  return <I18nextProvider i18n={i18n}><ApprovalTimeline {...({ parts, isLoading: loading, message: { id: 'message', parts } } as any)} /></I18nextProvider>;
}
describe('activity grouping', () => {
  it('keeps expansion while a single tool grows into a streamed group', () => {
    const first = tool('search_patients', {}, 'input-streaming');
    const { rerender } = render(mount([first]));
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button'));
    rerender(mount([tool('search_patients', outputs.search_patients), tool('list_records', {}, 'input-available')]));
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button'));
    rerender(mount([tool('search_patients', outputs.search_patients), tool('list_records', outputs.list_records)], false));
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button')).toHaveTextContent('Loaded 50 of 143 records');
    expect(screen.getByRole('button')).not.toHaveTextContent('2 steps');
  });
  it('preserves text and approval order and reports earlier failure/cancellation', () => {
    render(mount([{ id: 'before', kind: 'text', text: 'Before' }, tool('list_records', {}, 'output-error'), tool('find_staff', {}, 'cancelled'), tool('search_patients', outputs.search_patients), { id: 'review', kind: 'hitl' }, { id: 'after', kind: 'text', text: 'After' }, tool('export_report', outputs.export_report)]));
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Some steps failed or were cancelled');
    expect(screen.getAllByTestId('native').map(node => node.textContent)).toEqual(['Before', 'Approval card', 'After']);
    expect(screen.getByText('Before').compareDocumentPosition(screen.getAllByRole('button')[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('button')[0].compareDocumentPosition(screen.getByText('Approval card')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('keeps the last meaningful result when a following output is unrecognized', () => {
    render(mount([tool('search_patients', outputs.search_patients), tool('unknown', {})], false));
    expect(screen.getByRole('button')).toHaveTextContent('Found 1 matching patient');
  });
  it('preserves expansion when model turns are added around a streamed tool group', () => {
    const { rerender } = render(mount([tool('search_patients', {}, 'input-streaming')]));
    fireEvent.click(screen.getByRole('button'));
    rerender(mount([{id:'planning',kind:'model-turn',turnKind:'agent'},tool('search_patients',outputs.search_patients),{id:'next',kind:'model-turn',turnKind:'agent'}]));
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded','true');
  });
  it('hides internal ask-user calls and keeps their input card visible', () => {
    render(mount([tool('runtime__ask_user'), { id: 'input', kind: 'hitl', hitlKind: 'user_input' }]));
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Approval card')).toBeVisible();
  });
  it.each(['he', 'en', 'fr'])('sets direction and keyboard disclosure semantics in %s', async locale => {
    await i18n.changeLanguage(locale);
    render(mount([tool('search_patients', outputs.search_patients)]));
    const button = screen.getByRole('button');
    expect(button).not.toHaveTextContent(i18n.t('agent.activity.steps', { count: 1 }));
    expect(button.parentElement).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    expect(button).toHaveAttribute('type', 'button');
    expect(document.getElementById(button.getAttribute('aria-controls')!)).not.toBeVisible();
    fireEvent.click(button);
    expect(document.getElementById(button.getAttribute('aria-controls')!)).toBeVisible();
  });
});
