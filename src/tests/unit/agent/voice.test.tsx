import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/localization/i18n';
const mock = vi.hoisted(() => ({json:vi.fn(), submit:vi.fn(), open:vi.fn(), getMedia:vi.fn(), stopTrack:vi.fn(), heard:true, visible:true, reset:vi.fn(),
  runtime:{newThread:vi.fn(), controller:{activeRunId:null as string|null, activeThreadId:'thread-a' as string|null, isLoadingHistory:false}, isSubmitting:false, isBootstrapping:false}}));
vi.mock('@/contexts/PrysmAgentContext', () => ({usePrysmAgent:() => ({available:true, chatVisible:mock.visible, resetJobActivity:mock.reset, scope:{userId:1, clinicId:5}, runtime:mock.runtime, openChat:mock.open})}));
vi.mock('@/contexts/UserContext', () => ({useUser:() => ({currentUser:{id:1}})}));
vi.mock('@/services/agent-client', () => ({agentJson:mock.json}));
vi.mock('@/services/agent-submission', () => ({useAgentSubmission:() => mock.submit}));
import { AgentEntryButtons, AgentVoiceCapture } from '@/components/agent/AgentVoice';
class Recorder {
  static isTypeSupported() {return true;}
  state = 'inactive'; mimeType = 'audio/webm'; onstop?: () => void; ondataavailable?: (event: {data:Blob}) => void;
  start() {this.state = 'recording';}
  stop() {this.state = 'inactive'; this.ondataavailable?.({data:new Blob(['synthetic voice'])}); void this.onstop?.();}
}
const mount = () => render(<I18nextProvider i18n={i18n}><AgentEntryButtons /><AgentVoiceCapture /></I18nextProvider>);
beforeEach(async () => {
  vi.clearAllMocks(); mock.visible = true; mock.runtime.newThread.mockImplementation(() => {mock.runtime.controller.activeThreadId = null; mock.runtime.controller.activeRunId = null;}); localStorage.clear(); mock.heard = true; mock.runtime.controller.activeRunId = null; mock.runtime.controller.activeThreadId = 'thread-a'; mock.runtime.controller.isLoadingHistory = false; mock.runtime.isBootstrapping = false;
  await i18n.changeLanguage('en');
  mock.getMedia.mockResolvedValue({getTracks:() => [{stop:mock.stopTrack}]});
  Object.defineProperty(navigator, 'mediaDevices', {configurable:true, value:{getUserMedia:mock.getMedia}});
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('AudioContext', class {
    createAnalyser() {return {fftSize:256, getByteTimeDomainData:(values:Uint8Array) => values.fill(mock.heard ? 145 : 128)};}
    createMediaStreamSource() {return {connect:vi.fn()};} close() {return Promise.resolve();}
  });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  mock.submit.mockResolvedValue(undefined);
});
afterEach(() => {cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks();});
const down = () => fireEvent.keyDown(window, {key:' ', code:'Space', shiftKey:true});
const up = () => fireEvent.keyUp(window, {key:' ', code:'Space', shiftKey:true});
const voiceInput = {text:'', files:[{name:'voice.webm', mediaType:'audio/webm', data:expect.any(File)}]};
describe('push to talk', () => {
  it('records on hold, submits audio on release, and releases microphone', async () => {
    mount(); down(); await screen.findByText('Listening… Release to send'); up();
    await waitFor(() => expect(mock.submit).toHaveBeenCalledWith(voiceInput));
    expect(mock.open).toHaveBeenCalled(); expect(mock.stopTrack).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });
  it('cancels on Escape without uploading', async () => {
    mount(); down(); await screen.findByText('Listening… Release to send'); fireEvent.keyDown(window, {key:'Escape', code:'Escape'});
    expect(mock.stopTrack).toHaveBeenCalled(); expect(mock.json).not.toHaveBeenCalled(); expect(mock.submit).not.toHaveBeenCalled();
  });
  it('does not send silence', async () => {
    mock.heard = false; mount(); down(); await screen.findByText('Listening… Release to send'); up();
    expect(mock.json).not.toHaveBeenCalled(); expect(mock.submit).not.toHaveBeenCalled();
  });
  it('retains queued audio until the current run is finished', async () => {
    mock.runtime.controller.activeRunId = 'running'; const view = mount(); down(); await screen.findByText('Listening… Release to send'); up();
    await screen.findByText('Waiting to send'); expect(mock.submit).not.toHaveBeenCalled();
    mock.runtime.controller.activeRunId = null;
    view.rerender(<I18nextProvider i18n={i18n}><AgentEntryButtons /><AgentVoiceCapture /></I18nextProvider>);
    await waitFor(() => expect(mock.submit).toHaveBeenCalledTimes(1));
  });
  it('handles denied microphone access', async () => {
    mock.getMedia.mockRejectedValue(new Error('denied')); mount(); down();
    await screen.findByText('Voice message failed. Retry or record again.'); expect(mock.submit).not.toHaveBeenCalled();
  });
});

describe('click to record', () => {
  it('starts a new conversation for audio sent while chat is hidden, even if the old run is busy', async () => {
    mock.visible = false; mock.runtime.controller.activeRunId = 'old-run';
    mount(); fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    fireEvent.click(await screen.findByRole('button', {name:'Send', exact:true}));
    await waitFor(() => expect(mock.submit).toHaveBeenCalledExactlyOnceWith(voiceInput));
    expect(mock.runtime.newThread).toHaveBeenCalledTimes(1);
    expect(mock.runtime.newThread.mock.invocationCallOrder[0]).toBeLessThan(mock.submit.mock.invocationCallOrder[0]);
  });

  it('continues the visible conversation without starting another one', async () => {
    mount(); fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    fireEvent.click(await screen.findByRole('button', {name:'Send', exact:true}));
    await waitFor(() => expect(mock.submit).toHaveBeenCalledTimes(1));
    expect(mock.runtime.newThread).not.toHaveBeenCalled();
  });

  it.each(['bootstrap', 'history'])('waits for %s restoration before binding a recording to a thread', async stage => {
    mock.runtime.isBootstrapping = stage === 'bootstrap';
    mock.runtime.controller.isLoadingHistory = stage === 'history';
    mount();
    expect(screen.getByRole('button', {name:'Record a voice message'})).toBeDisabled();
    down();
    expect(mock.getMedia).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', {name:'Voice message'})).toBeNull();
  });

  it.each([
    ['en', 'ltr', 'Record a voice message', 'Send', 'Voice message'],
    ['he', 'rtl', 'הקלט הודעה קולית', 'שלח', 'הודעה קולית'],
    ['fr', 'ltr', 'Enregistrer un message vocal', 'Envoyer', 'Message vocal'],
  ])('keeps a normal click recording and sends explicitly in %s', async (locale, direction, start, send, label) => {
    await i18n.changeLanguage(locale);
    mount();
    const button = screen.getByRole('button', {name:start});
    fireEvent.pointerDown(button); fireEvent.pointerUp(button); fireEvent.click(button, {detail:1});
    const bar = await screen.findByRole('region', {name:label});
    expect(bar).toHaveAttribute('dir', direction);
    await screen.findByRole('button', {name:send, exact:true});
    expect(mock.getMedia).toHaveBeenCalledTimes(1);
    expect(mock.stopTrack).not.toHaveBeenCalled(); expect(mock.open).not.toHaveBeenCalled();
    fireEvent.blur(window);
    expect(mock.stopTrack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name:send, exact:true}));
    expect(mock.open).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mock.submit).toHaveBeenCalledExactlyOnceWith(voiceInput));
    expect(mock.stopTrack).toHaveBeenCalled(); expect(mock.json).not.toHaveBeenCalled();
    expect(mock.submit.mock.calls[0][0].files[0].data.size).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByRole('region', {name:label})).toBeNull());
  });

  it('keeps stopped audio local until Send without calling the RAG endpoint', async () => {
    mount(); fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    await screen.findByRole('button', {name:'Send', exact:true});
    fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    await screen.findByText('Voice message ready');
    expect(mock.open).not.toHaveBeenCalled(); expect(mock.submit).not.toHaveBeenCalled(); expect(mock.json).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name:'Send', exact:true}));
    await waitFor(() => expect(mock.submit).toHaveBeenCalledTimes(1));
    expect(mock.open).toHaveBeenCalledTimes(1);
  });

  it('shows immediate feedback and cancels while microphone permission is pending', async () => {
    let grant!: (value:unknown) => void;
    mock.getMedia.mockReturnValue(new Promise(resolve => {grant = resolve;}));
    mount(); fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    expect(screen.getByText('Starting microphone…')).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name:'Cancel voice message'}));
    await act(async () => grant({getTracks:() => [{stop:mock.stopTrack}]}));
    expect(mock.stopTrack).toHaveBeenCalled(); expect(mock.json).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', {name:'Voice message'})).toBeNull();
  });

  it('discards a recording without transcribing when cancelled', async () => {
    mount(); fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    await screen.findByRole('button', {name:'Send', exact:true});
    fireEvent.click(screen.getByRole('button', {name:'Cancel voice message'}));
    expect(mock.stopTrack).toHaveBeenCalled(); expect(mock.json).not.toHaveBeenCalled(); expect(mock.submit).not.toHaveBeenCalled();
  });

  it('keeps a new recording alive if an earlier microphone request rejects after cancellation', async () => {
    let deny!: (error:Error) => void;
    mock.getMedia.mockImplementationOnce(() => new Promise((_resolve, reject) => {deny = reject;}));
    mount(); fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    fireEvent.click(screen.getByRole('button', {name:'Cancel voice message'}));
    fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    await screen.findByRole('button', {name:'Send', exact:true});
    await act(async () => deny(new Error('old permission request denied')));
    expect(screen.getByRole('button', {name:'Send', exact:true})).toBeVisible();
    expect(mock.stopTrack).not.toHaveBeenCalled();
  });

  it('retains the same audio attachment for an explicit retry after submission fails', async () => {
    mock.submit.mockRejectedValueOnce(new Error('offline'));
    mount(); fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    fireEvent.click(await screen.findByRole('button', {name:'Send', exact:true}));
    fireEvent.click(await screen.findByRole('button', {name:'Retry'}));
    await waitFor(() => expect(mock.submit).toHaveBeenCalledTimes(2));
    expect(mock.submit.mock.calls[1][0].files[0].data).toBe(mock.submit.mock.calls[0][0].files[0].data);
    expect(mock.json).not.toHaveBeenCalled();
  });

  it('sends on Enter before a focused editor can submit a separate draft', async () => {
    const editorKey = vi.fn();
    const view = mount();
    const editor = document.createElement('textarea');
    view.container.appendChild(editor);
    editor.addEventListener('keydown', editorKey);
    fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    await screen.findByRole('button', {name:'Send', exact:true});
    fireEvent.keyDown(editor, {key:'Enter', code:'Enter'});
    await waitFor(() => expect(mock.submit).toHaveBeenCalledExactlyOnceWith(voiceInput));
    expect(editorKey).not.toHaveBeenCalled();
    expect(mock.open).toHaveBeenCalledTimes(1);
  });

  it('keeps recording during IME confirmation, Shift+Enter and repeated Enter', async () => {
    mount(); fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    await screen.findByRole('button', {name:'Send', exact:true});
    fireEvent.keyDown(window, {key:'Enter', code:'Enter', isComposing:true});
    fireEvent.keyDown(window, {key:'Enter', code:'Enter', shiftKey:true});
    fireEvent.keyDown(window, {key:'Enter', code:'Enter', repeat:true});
    expect(mock.submit).not.toHaveBeenCalled();
    expect(mock.stopTrack).not.toHaveBeenCalled();
  });

  it('sends stopped audio on Enter', async () => {
    mount(); fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    await screen.findByRole('button', {name:'Send', exact:true});
    fireEvent.click(screen.getByRole('button', {name:'Record a voice message'}));
    await screen.findByText('Voice message ready');
    fireEvent.keyDown(window, {key:'Enter', code:'Enter'});
    await waitFor(() => expect(mock.submit).toHaveBeenCalledExactlyOnceWith(voiceInput));
  });
});
