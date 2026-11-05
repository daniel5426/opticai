import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { LiveWaveform } from '@/components/ui/live-waveform';

const media = vi.fn();
const stop = vi.fn();
const close = vi.fn();
const source = vi.fn();
const input = {getTracks:() => [{stop}]} as unknown as MediaStream;
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'mediaDevices', {configurable:true, value:{getUserMedia:media}});
  vi.stubGlobal('AudioContext', class {
    state = 'running';
    createAnalyser() {return {};}
    createMediaStreamSource(stream:MediaStream) {source(stream); return {connect:vi.fn()};}
    close() {close(); return Promise.resolve();}
  });
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks();});

describe('LiveWaveform microphone ownership', () => {
  it('visualizes the recorder stream without requesting another microphone or stopping its tracks', async () => {
    const view = render(<React.StrictMode><LiveWaveform active mediaStream={input} /></React.StrictMode>);
    await waitFor(() => expect(source).toHaveBeenCalledWith(input));
    view.unmount();
    expect(media).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('releases a stream it requested if permission arrives after unmount', async () => {
    let grant!: (stream:MediaStream) => void;
    media.mockReturnValue(new Promise<MediaStream>(resolve => {grant = resolve;}));
    const view = render(<LiveWaveform active />);
    expect(media).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => grant(input));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(source).not.toHaveBeenCalled();
  });
});
