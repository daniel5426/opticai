import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import copy from '@/localization/agent.json';

const mock = vi.hoisted(() => ({ submit: vi.fn(), patientId: null as number | null, epoch: 0 }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => ({
  scope: { userId: 1, clinicId: 1, patientId: mock.patientId }, jobActivityKey: mock.epoch, closePatientChat: vi.fn(),
  runtime: { bootstrap: {}, state: 'idle', submit: mock.submit,
    controller: { messages: [], activeRunId: null, hasOlderTurns: false },
    inputContract: { version: 'agents24.runtime-inputs.v3', modalities: { text: { enabled: true, required: false },
      files: { enabled: true, required: false, allowed_mime_types: ['text/plain'], allowed_extensions: ['.txt'] },
      images: { enabled: true, required: false, allowed_mime_types: ['image/png'], allowed_extensions: ['.png'] },
      audio: { enabled: false, required: false, allowed_mime_types: [], allowed_extensions: [], recording_enabled: false } },
      limits: { max_attachments_per_turn: 8, max_file_bytes: 1000000, max_total_bytes: 2000000,
        max_pdf_pages: 50, max_image_pixels: 40000000, max_extracted_characters: 200000, max_inline_processing_bytes: 12288 },
      retention: { mode: 'thread_lifetime' } },
  },
}) }));
vi.mock('@/components/agent/AgentResults', () => ({ AgentResults: () => null }));
vi.mock('@/components/agent/AgentChatActions', () => ({ AgentChatActions: () => null }));
vi.mock('@/components/agent/DailyBrief', () => ({ DailyBrief: () => null }));
vi.mock('@/components/agent/AgentSky', () => ({ AgentSky: () => null }));
import { AgentChatPanel } from '@/components/agent/AgentChatPanel';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false },
  resources: Object.fromEntries(Object.entries(copy).map(([locale, translation]) => [locale, { translation }])) });
function mount(compact = false) { return render(<I18nextProvider i18n={i18n}><AgentChatPanel compact={compact} /></I18nextProvider>); }
beforeEach(() => { mock.patientId = null; mock.epoch = 0; mock.submit.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  URL.createObjectURL = vi.fn(() => 'blob:synthetic-preview'); URL.revokeObjectURL = vi.fn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('default composer and contextual prompts', () => {
  it.each(['he', 'en', 'fr'])('offers three editable clinic prompts with selected blanks in %s', async locale => {
    await i18n.changeLanguage(locale);
    const view = mount();
    const suggestions = screen.getByLabelText(i18n.t('agent.suggestions'));
    expect(within(suggestions).getAllByRole('button')).toHaveLength(3);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.rows).toBe(1);
    expect(view.container.querySelector('.a24-composer__toolbar--external')).toBeNull();
    fireEvent.click(within(suggestions).getAllByRole('button')[0]);
    const blank = i18n.t('agent.prompt.customReport.blank');
    await waitFor(() => expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe(blank));
    expect(mock.submit).not.toHaveBeenCalled();
    expect(view.container.querySelector('section')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
  });

  it('prefills the composer under the development StrictMode lifecycle', async () => {
    await i18n.changeLanguage('en');
    render(<React.StrictMode><I18nextProvider i18n={i18n}><AgentChatPanel /></I18nextProvider></React.StrictMode>);
    fireEvent.click(within(screen.getByLabelText(i18n.t('agent.suggestions'))).getAllByRole('button')[0]);
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(i18n.t('agent.prompt.customReport.prompt', { details: i18n.t('agent.prompt.customReport.blank') })));
  });

  it('keeps a native attachment when prefilling a suggestion, then submits it normally', async () => {
    await i18n.changeLanguage('en');
    const view = mount();
    const file = new File(['synthetic prescription'], 'prescription.png', { type: 'image/png' });
    fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [file] } });
    await screen.findByTestId('agent-chat-composer-attachments');
    const suggestions = screen.getByLabelText(i18n.t('agent.suggestions'));
    fireEvent.click(within(suggestions).getAllByRole('button')[2]);
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('Find a patient'));
    expect(screen.getByTestId('agent-chat-composer-attachments')).toBeInTheDocument();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Find this prescription' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(mock.submit).toHaveBeenCalledTimes(1));
    expect(mock.submit.mock.calls[0][0].files[0]).toMatchObject({ name: 'prescription.png', mediaType: 'image/png' });
  });

  it('uses patient prompts in the sidebar and resets draft ownership for a new conversation', async () => {
    await i18n.changeLanguage('en'); mock.patientId = 42;
    const view = mount(true);
    const suggestions = screen.getByLabelText(i18n.t('agent.suggestions'));
    expect(within(suggestions).getAllByRole('button')).toHaveLength(3);
    expect(suggestions).toHaveTextContent(i18n.t('agent.prompt.patientSummary.label'));
    fireEvent.click(within(suggestions).getAllByRole('button')[0]);
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(i18n.t('agent.prompt.patientSummary.prompt')));
    mock.epoch++;
    view.rerender(<I18nextProvider i18n={i18n}><AgentChatPanel compact /></I18nextProvider>);
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    expect(mock.submit).not.toHaveBeenCalled();
  });
});
