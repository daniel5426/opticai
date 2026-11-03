import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { capturePageContext, setAgentPageContext, useAgentDraft, withSubmissionContext, submissionPageContext } from '@/lib/agent-page-context';
import { shortcutFromEvent, validVoiceShortcut } from '@/lib/agent-voice-preferences';
function Draft({ value }: {value: unknown}) {useAgentDraft('exam', () => value); return null;}
afterEach(cleanup);
describe('page hints are separate from conversation authority', () => {
  it('captures current unsaved values and removes credentials', () => {
    setAgentPageContext({path:'/clients/1/exams/2', recordIds:{clientId:'1'}});
    const view = render(<Draft value={{sph:-2, password:'private', nested:{api_key:'private', axis:90}}} />);
    const first = capturePageContext();
    expect(Object.values(first.drafts!)[0]).toEqual({sph:-2, nested:{axis:90}});
    view.rerender(<Draft value={{sph:-3}} />);
    expect(Object.values(capturePageContext().drafts!)[0]).toEqual({sph:-3});
    expect(Object.values(first.drafts!)[0]).toEqual({sph:-2, nested:{axis:90}});
    setAgentPageContext({path:'/inventory'});
    expect(capturePageContext().drafts).toEqual({});
  });
  it('keeps the voice start snapshot for sending and restores live context', async () => {
    setAgentPageContext({path:'/inventory'});
    await withSubmissionContext({path:'/clients/1'}, async () => {expect(submissionPageContext().path).toBe('/clients/1');});
    expect(submissionPageContext().path).toBe('/inventory');
  });
  it('accepts configurable shortcuts and rejects common app conflicts', () => {
    expect(shortcutFromEvent({code:'Space', shiftKey:true, ctrlKey:false, altKey:false, metaKey:false})).toBe('Shift+Space');
    expect(validVoiceShortcut('Shift+Space')).toBe(true);
    expect(validVoiceShortcut('Control+Alt+KeyV')).toBe(true);
    expect(validVoiceShortcut('KeyV')).toBe(false);
    expect(validVoiceShortcut('Meta+KeyS')).toBe(false);
    expect(validVoiceShortcut('')).toBe(true);
  });
});
