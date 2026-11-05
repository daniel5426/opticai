import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mock = vi.hoisted(() => ({submit:vi.fn(), json:vi.fn()}));
vi.mock('@/contexts/PrysmAgentContext', () => ({usePrysmAgent:() => ({scope:{userId:1, clinicId:5}, runtime:{submit:mock.submit}})}));
vi.mock('@/services/agent-client', () => ({agentJson:mock.json}));
import { useAgentSubmission } from '@/services/agent-submission';

beforeEach(() => {vi.clearAllMocks(); mock.submit.mockResolvedValue(undefined);});
describe('native workflow audio', () => {
  it('passes the original audio attachment to the Agents24 runtime without RAG transcription', async () => {
    const file = {name:'voice.webm', mediaType:'audio/webm', data:new File(['synthetic audio'], 'voice.webm', {type:'audio/webm'})};
    const {result} = renderHook(() => useAgentSubmission());
    await result.current({text:'', files:[file]});
    expect(mock.submit).toHaveBeenCalledExactlyOnceWith({text:'', files:[file]});
    expect(mock.submit.mock.calls[0][0].files[0]).toBe(file);
    expect(mock.json).not.toHaveBeenCalled();
  });
});
