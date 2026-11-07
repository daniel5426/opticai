import type { AgentClient, RuntimeEventHandler } from '@agents24/client';
import type { RuntimeEvent } from '@agents24/client/protocol';

export type OutputClient = AgentClient & {
  subscribeOutputs(listener: RuntimeEventHandler): () => void;
};

// Product transport wiring around the public client. The SDK still owns admission,
// streaming, replay and authorization; output bodies are fetched only by visible rows.
export function withTranscriptOutputs(client: AgentClient): OutputClient {
  const listeners = new Set<RuntimeEventHandler>();
  const observe = (receive: RuntimeEventHandler): RuntimeEventHandler => (event: RuntimeEvent) => {
    const result = receive(event);
    if (event.event.startsWith('workflow.output.') || event.event === 'run.snapshot' ||
        ['run.completed', 'run.failed', 'run.cancelled'].includes(event.event)) {
      for (const listener of listeners) {
        try { void Promise.resolve(listener(event)).catch(() => undefined); } catch { /* Presentation must not interrupt the SDK stream. */ }
      }
    }
    return result;
  };
  const selection = (ids?: readonly string[]) => ids?.length ? { requestedOutputs: ['transcript'] } : {};
  return {
    ...client,
    chat: { ...client.chat, stream: (input, receive) => client.chat.stream({ ...input, ...selection(input.attachmentIds) }, observe(receive)) },
    runs: { ...client.runs, attach: (input, receive) => client.runs.attach(input, observe(receive)) },
    threads: { ...client.threads, messages: { ...client.threads.messages,
      submit: input => client.threads.messages.submit({ ...input, ...selection(input.attachmentIds) }),
    } },
    subscribeOutputs(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
