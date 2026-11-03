import type { ChatToolPart } from '@agents24/react';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Only persisted tool receipts may identify a proposal; assistant prose cannot. */
export function supplyMessageResults(parts: readonly { kind: string }[]): string[] {
  const jobs = new Set<string>();
  for (const part of parts) {
    if (part.kind !== 'tool') continue;
    const tool = part as ChatToolPart;
    if (tool.state !== 'output-available') continue;
    let output = object(tool.output);
    if (output.kind === 'tool_result' && typeof output.content === 'string') {
      try { output = object(JSON.parse(output.content)); } catch { continue; }
    }
    const names = [tool.toolName, tool.toolKey, tool.displayName, tool.action];
    if (output.type !== 'supply_proposal' && !names.includes('prepare_supply')) continue;
    if (typeof output.job_id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(output.job_id)) jobs.add(output.job_id);
  }
  return [...jobs];
}
