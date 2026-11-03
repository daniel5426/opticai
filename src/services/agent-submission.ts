import { transcribeAudio } from './agent-transcription';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { agentJson } from './agent-client';
import type { AgentChatInputContract } from '@agents24/chat-react/runtime';
import type { AgentChatRuntimeSubmit } from '@agents24/chat-react/runtime';
// This host accepts spreadsheets by converting them to an authorized text attachment.
// The runtime still validates the converted upload against the unchanged server contract.
export function supplyComposerContract(contract: AgentChatInputContract | null | undefined) {
  const files = contract?.modalities.files;
  if (!contract || !files?.enabled || !files.allowed_mime_types.includes('text/plain')) return contract;
  return { ...contract, modalities: { ...contract.modalities, files: { ...files,
    allowed_mime_types: [...new Set([...files.allowed_mime_types,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'])],
    allowed_extensions: [...new Set([...(files.allowed_extensions || []), '.xlsx', '.xls'])],
  } } };
}
export function useAgentSubmission() {
  const workspace = usePrysmAgent();
  return async (input: AgentChatRuntimeSubmit) => {
    if (!workspace?.scope || !workspace.runtime) throw new Error('agent.sessionRequired');
    const files = [];
    for (const file of input.files || []) {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const form = new FormData();
        const bytes = file.data instanceof Uint8Array || file.data instanceof ArrayBuffer ? file.data : await file.data.arrayBuffer();
        form.append('file', new Blob([bytes as BlobPart], { type: file.mediaType }), file.name);
        const result = await agentJson<{ text: string }>(workspace.scope, '/supply/extract', { method: 'POST', body: form });
        files.push({ name: file.name + '.txt', mediaType: 'text/plain', data: new TextEncoder().encode(result.text) });
      } else if (file.mediaType.startsWith('audio/')) {
        const bytes = file.data instanceof Uint8Array || file.data instanceof ArrayBuffer ? file.data : await file.data.arrayBuffer();
        const result = await transcribeAudio(workspace.scope, new File([bytes as BlobPart], file.name, {type:file.mediaType}));
        files.push({ name: file.name + '.txt', mediaType: 'text/plain', data: new TextEncoder().encode(result.text) });
      } else files.push(file);
    }
    await workspace.runtime.submit({ ...input, files });
  };
}
