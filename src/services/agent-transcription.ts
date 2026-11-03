import { agentJson, type AgentScope } from './agent-client';
export async function transcribeAudio(scope: AgentScope, file: File, signal?: AbortSignal) {
  const form = new FormData(); form.append('file', file);
  const job = await agentJson<{job_id: string}>(scope, '/transcriptions', {method:'POST', body:form, signal});
  for (let attempt = 0; attempt < 180; attempt++) {
    signal?.throwIfAborted();
    const result = await agentJson<{status: string; text?: string}>(scope, `/transcriptions/${job.job_id}`, {signal});
    if (['failed', 'cancelled'].includes(result.status)) throw new Error('agent.voice.failed');
    if (result.status === 'completed') {
      if (!result.text?.trim()) throw new Error('agent.voice.failed');
      return { text: result.text, jobId: job.job_id };
    }
    await new Promise<void>((resolve, reject) => {
      const aborted = () => {clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError'));};
      const timer = setTimeout(() => {signal?.removeEventListener('abort', aborted); resolve();}, 1500);
      signal?.addEventListener('abort', aborted, {once:true});
    });
  }
  throw new Error('agent.voice.failed');
}
