import type { ChatToolPart } from '@agents24/react';

type Output = Record<string, unknown>;
const object = (value: unknown): Output => value && typeof value === 'object' && !Array.isArray(value) ? value as Output : {};

/** Read public tool receipts, including the SDK's retained legacy result envelope. */
export function reportMessageResults(parts: readonly { kind: string }[]): Output[] {
  const reports = new Map<string, Output>();
  for (const part of parts) {
    if (part.kind !== 'tool') continue;
    const tool = part as ChatToolPart;
    if (tool.state !== 'output-available') continue;
    let output = object(tool.output);
    if (output.kind === 'tool_result' && typeof output.content === 'string' && output.content.length <= 100000) {
      try { output = object(JSON.parse(output.content)); } catch { /* A clipped receipt cannot authorize or describe a result. */ }
    }
    const name = [tool.toolName, tool.toolKey, tool.displayName, tool.action];
    const native = output.type === 'report_run' || output.type === 'report_result';
    const legacy = name.includes('export_report') || name.includes('job_status') && output.kind === 'report';
    if (!native && !legacy) continue;
    const id = native || name.includes('export_report') ? output.job_id : output.id;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(id)) continue;
    const result = native ? { ...output, title: output.title || object(object(tool.input).definition).title } : { type: 'legacy_report', job_id: id, status: output.status,
      title: object(object(tool.input).definition).title };
    const previous = reports.get(id);
    if (!previous || previous.type !== 'report_result' && (native || previous.type === 'legacy_report')) {
      reports.set(id, { ...previous, ...result, title: result.title || previous?.title });
    }
  }
  return [...reports.values()];
}
