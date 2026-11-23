import type { ChatToolPart } from '@agents24/react';
import type { ElementContent } from 'hast';
import { z } from 'zod';

type Output = Record<string, unknown>;
const object = (value: unknown): Output => value && typeof value === 'object' && !Array.isArray(value) ? value as Output : {};
export const reportViews = ['table', 'stats', 'charts'] as const;
export type ReportView = typeof reportViews[number];
const names = z.array(z.string().min(1).max(180)).min(1).max(16);
const indexes = z.array(z.number().int().min(0).max(199)).min(1).max(25);
export const reportLayout = z.object({ job_id: z.string().min(1).max(64), views: z.array(z.union([
  z.enum(reportViews),
  z.object({ view: z.literal('stats'), metrics: names }).strict(),
  z.object({ view: z.literal('charts'), indexes }).strict(),
  z.object({ view: z.literal('table'), columns: names }).strict(),
])).min(1).max(12) }).strict();
export type ReportViewSelection = z.infer<typeof reportLayout>['views'][number];
export const searchLayout = z.object({ result_ref: z.string().min(1).max(255),
  view: z.enum(['records', 'links', 'table']), indexes: indexes.optional(), columns: names.optional() }).strict();
export type SearchLayout = z.infer<typeof searchLayout>;

function readOutput(value: unknown): Output {
  const output = object(value);
  if (output.kind !== 'tool_result' || typeof output.content !== 'string' || output.content.length > 100000) return output;
  try { return object(JSON.parse(output.content)); } catch { return {}; }
}

export function searchMessageResults(parts: readonly { kind: string }[]): Output[] {
  return parts.flatMap(part => {
    if (part.kind !== 'tool') return [];
    const tool = part as ChatToolPart;
    if (tool.state !== 'output-available') return [];
    const output = readOutput(tool.output);
    return ['record_search', 'prescription_search', 'document_search'].includes(String(output.type)) ? [output] : [];
  });
}

export function isAttachedReportLink(node: ElementContent, reportIds: ReadonlySet<string>): boolean {
  if (node.type !== 'element') return false;
  if (node.tagName === 'a' && typeof node.properties.href === 'string') {
    const path = node.properties.href;
    const id = path.match(/^\/api\/v1\/agent\/jobs\/([\w-]+)\/download$/)?.[1]
      ?? path.match(/^\/api\/v1\/agent\/reports\/([\w-]+)\/export\?format=(?:xlsx|csv)$/)?.[1];
    return id !== undefined && reportIds.has(id);
  }
  if (!['p', 'li', 'ul', 'ol', 'strong', 'em'].includes(node.tagName)) return false;
  const content = node.children.filter(child => child.type !== 'text' || child.value.trim());
  return content.length > 0 && content.every(child => isAttachedReportLink(child, reportIds));
}

/** Read public tool receipts, including the SDK's retained legacy result envelope. */
export function reportMessageResults(parts: readonly { kind: string }[]): Output[] {
  const reports = new Map<string, Output>();
  for (const part of parts) {
    if (part.kind !== 'tool') continue;
    const tool = part as ChatToolPart;
    if (tool.state !== 'output-available') continue;
    const output = readOutput(tool.output);
    const name = [tool.toolName, tool.toolKey, tool.displayName, tool.action];
    const native = output.type === 'report_run' || output.type === 'report_result';
    const legacy = name.includes('export_report') || name.includes('job_status') && output.kind === 'report';
    if (!native && !legacy) continue;
    const id = native || name.includes('export_report') ? output.job_id : output.id;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(id)) continue;
    const definition = object(object(tool.input).definition);
    const result = native ? { ...output, title: output.title || definition.title,
      format: object(output.definition).format ?? definition.format, legacy: name.includes('export_report') }
      : { type: 'legacy_report', job_id: id, status: output.status, title: definition.title, format: definition.format };
    const previous = reports.get(id);
    if (!previous || previous.type !== 'report_result' && (native || previous.type === 'legacy_report')) {
      reports.set(id, { ...previous, ...result, title: result.title || previous?.title, format: result.format ?? previous?.format });
    }
  }
  return [...reports.values()];
}
