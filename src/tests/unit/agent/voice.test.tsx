import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/localization/i18n';
const mock = vi.hoisted(() => ({json:vi.fn(), submit:vi.fn(), open:vi.fn(), getMedia:vi.fn(), stopTrack:vi.fn(), heard:true,
  runtime:{controller:{activeRunId:null as string|null, activeThreadId:'thread-a'}, isSubmitting:false}}));
vi.mock('@/contexts/PrysmAgentContext', () => ({usePrysmAgent:() => ({available:true, scope:{userId:1, clinicId:5}, runtime:mock.runtime, openChat:mock.open})}));
vi.mock('@/contexts/UserContext', () => ({useUser:() => ({currentUser:{id:1}})}));
vi.mock('@/services/agent-client', () => ({agentJson:mock.json}));
vi.mock('@/services/agent-submission', () => ({useAgentSubmission:() => mock.submit}));
import { AgentVoiceCapture } from '@/components/agent/AgentVoice';
class Recorder {
  static isTypeSupported() {return true;}
  state = 'inactive'; mimeType = 'audio/webm'; onstop?: () => void; ondataavailable?: (event: {data:Blob}) => void;
  start() {this.state = 'recording';}
  stop() {this.state = 'inactive'; this.ondataavailable?.({data:new Blob(['synthetic voice'])}); void this.onstop?.();}
}
const mount = () => render(<I18nextProvider i18n={i18n}><AgentVoiceCapture /></I18nextProvider>);
beforeEach(async () => {
  vi.clearAllMocks(); localStorage.clear(); mock.heard = true; mock.runtime.controller.activeRunId = null;
  await i18n.changeLanguage('en');
  mock.getMedia.mockResolvedValue({getTracks:() => [{stop:mock.stopTrack}]});
  Object.defineProperty(navigator, 'mediaDevices', {configurable:true, value:{getUserMedia:mock.getMedia}});
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('AudioContext', class {
    createAnalyser() {return {fftSize:256, getByteTimeDomainData:(values:Uint8Array) => values.fill(mock.heard ? 145 : 128)};}
    createMediaStreamSource() {return {connect:vi.fn()};} close() {return Promise.resolve();}
  });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  mock.submit.mockResolvedValue(undefined);
  mock.json.mockImplementation(async (_scope, path) => path === '/transcriptions' ? {job_id:'voice-job'} : {status:'completed', text:'Received four black frames'});
});
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
const down = () => fireEvent.keyDown(window, {key:' ', code:'Space', shiftKey:true});
const up = () => fireEvent.keyUp(window, {key:' ', code:'Space', shiftKey:true});
describe('push to talk', () => {
  it('records on hold, sends transcription on release, and releases microphone', async () => {
    mount(); down(); await screen.findByText('Listening… Release to send'); up();
    await waitFor(() => expect(mock.submit).toHaveBeenCalledWith({text:'Received four black frames'}));
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
  it('retains a queued transcript until the current run is finished', async () => {
    mock.runtime.controller.activeRunId = 'running'; const view = mount(); down(); await screen.findByText('Listening… Release to send'); up();
    await screen.findByText('Received four black frames'); expect(mock.submit).not.toHaveBeenCalled();
    mock.runtime.controller.activeRunId = null;
    view.rerender(<I18nextProvider i18n={i18n}><AgentVoiceCapture /></I18nextProvider>);
    await waitFor(() => expect(mock.submit).toHaveBeenCalledTimes(1));
  });
  it('handles denied microphone access', async () => {
    mock.getMedia.mockRejectedValue(new Error('denied')); mount(); down();
    await screen.findByText('Voice message failed. Retry or record again.'); expect(mock.submit).not.toHaveBeenCalled();
  });
});
