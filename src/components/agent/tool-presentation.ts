import type { ChatToolPart } from '@agents24/react';
import type { TFunction } from 'i18next';

export type ActivityStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type ToolActivity = { label: string; detail?: string; status: ActivityStatus; meaningful?: boolean };
type Data = Record<string, unknown>;
const object = (value: unknown): Data => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const kinds = ['clients', 'appointments', 'exams', 'orders', 'contact_lens_orders', 'referrals', 'medical_logs', 'files', 'tasks', 'exam_measurements'] as const;
type ToolName = 'search_catalog' | 'search_records' | 'search_prescriptions' | 'run_report' | 'read_report' | 'saved_reports' | 'search_documents' | 'clinic_context' | 'search_patients' | 'find_staff' | 'patient_history' | 'list_records' | 'exam_layout_catalog' | 'compare_exams' | 'check_order' | 'find_appointments' | 'change_catalog' | 'prepare_change' | 'commit_change' | 'report_catalog' | 'preview_report' | 'export_report' | 'job_status';
type Result = { key?: string; values?: Data; detailKey?: string; detailValues?: Data };
type Definition = { valid: (output: Data) => boolean; result?: (input: Data, output: Data) => Result };
const page = (output: Data, field: string) => Array.isArray(output[field]) && count(output.total) && output.total >= (output[field] as unknown[]).length;
const matches: Definition = {
  valid: o => Array.isArray(o.matches) && typeof o.has_more === 'boolean',
  result: (_, o) => ({ key: o.has_more ? 'more' : 'done', values: { count: (o.matches as unknown[]).length } }),
};
export const toolPresentationRegistry = {
  search_catalog: { valid: o => !!o.datasets },
  search_records: { valid: o => page(o, 'items') },
  search_prescriptions: { valid: o => page(o, 'items') },
  search_documents: { valid: o => page(o, 'items') },
  run_report: { valid: o => typeof o.job_id === 'string' && typeof o.status === 'string' },
  read_report: { valid: o => Array.isArray(o.rows) || typeof o.status === 'string' },
  saved_reports: { valid: o => Array.isArray(o.items) || typeof o.id === 'string' || o.status === 'deleted' },
  clinic_context: { valid: o => typeof o.business_date === 'string' && typeof o.read_only === 'boolean' },
  search_patients: matches,
  find_staff: matches,
  patient_history: { valid: o => Object.keys(object(o.client)).length > 0 },
  list_records: { valid: o => page(o, 'records'), result: (_, o) => ({ values: { count: (o.records as unknown[]).length, total: o.total } }) },
  exam_layout_catalog: { valid: o => Array.isArray(o.layouts) },
  compare_exams: { valid: o => !!o.prescription_comparisons && Array.isArray(o.sources) },
  check_order: { valid: o => o.status === 'review' || o.status === 'missing_prescription', result: (_, o) => ({ key: o.status === 'missing_prescription' ? 'missing' : 'done' }) },
  find_appointments: { valid: o => Array.isArray(o.slots) && typeof o.bounded === 'boolean', result: (_, o) => ({ key: o.bounded ? 'more' : 'done', values: { count: (o.slots as unknown[]).length } }) },
  change_catalog: { valid: o => Array.isArray(o.clients) && Array.isArray(o.appointments) },
  prepare_change: { valid: o => typeof o.change_id === 'string' && o.requires_approval === true && !!o.after, result: () => ({ detailKey: 'prepare_change.detail' }) },
  commit_change: { valid: o => count(object(o.approval).user_id) && Number(object(o.approval).user_id) > 0 && typeof object(o.approval).at === 'string' && Number.isFinite(Date.parse(object(o.approval).at as string)) },
  report_catalog: { valid: o => !!o.datasets && !!o.definition_schema },
  preview_report: { valid: o => page(o, 'rows'), result: (_, o) => ({ detailKey: 'preview_report.detail', detailValues: { count: (o.rows as unknown[]).length, total: o.total } }) },
  // A completed invocation only confirms the export request, never file readiness.
  export_report: { valid: o => typeof o.job_id === 'string' && ['queued', 'running', 'completed'].includes(String(o.status)) },
  job_status: { valid: o => ['queued', 'uploading', 'running', 'completed'].includes(String(o.status)), result: (_, o) => ({ key: o.status === 'completed' ? (o.kind === 'report' ? (typeof o.download_path === 'string' && o.download_path.startsWith('/api/v1/agent/jobs/') ? 'ready' : undefined) : 'done') : o.status === 'queued' ? 'queued' : 'processing' }) },
} satisfies Record<ToolName, Definition>;

function dateRange(input: Data, locale: string): string | undefined {
  const values = [input.start_date, input.end_date];
  if (!values.every(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)) return;
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  return values.map(v => formatter.format(new Date(v as string))).join(' – ');
}

export function presentTool(part: ChatToolPart, t: TFunction, locale: string): ToolActivity {
  const input = object(part.input), output = object(part.output);
  const identity = [part.toolName, part.toolKey, part.action, part.displayName].find(value => typeof value === 'string' && Object.hasOwn(toolPresentationRegistry, value));
  const name = identity as ToolName | undefined;
  const label = (key: string, values: Data = {}) => String(t(`agent.activity.${key}`, values));
  if (part.state === 'cancelled' || output.status === 'cancelled') return { status: 'cancelled', label: label('cancelled') };
  if (part.state === 'output-error' || ['error', 'failed'].includes(String(output.status))) return { status: 'failed', label: label('failed') };
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  let detail: string | undefined;
  if (name === 'list_records' || name === 'prepare_change') {
    if (kinds.includes(input.kind as typeof kinds[number])) detail = label(`kind.${input.kind}`);
  } else if (name === 'find_appointments') detail = dateRange(input, locale);
  else if (name === 'export_report') {
    const format = object(input.definition).format;
    if (format === 'xlsx' || format === 'csv') detail = format === 'xlsx' ? 'Excel' : 'CSV';
  }
  if (running) return { status: 'running', label: detail && (name === 'list_records' || name === 'prepare_change')
    ? label(name === 'list_records' ? 'records.running' : 'draft.running', { kind: detail.toLocaleLowerCase(locale) })
    : label(name ? `${name}.running` : 'fallback.running'), detail };
  const definition: Definition | undefined = name ? toolPresentationRegistry[name] : undefined;
  if (part.state !== 'output-available' || !definition?.valid(output)) return { status: 'completed', label: label(name === 'commit_change' ? 'commit_change.unconfirmed' : 'fallback.done') };
  const result = definition.result?.(input, output) || {};
  if (name === 'job_status' && !result.key) return { status: 'completed', label: label('fallback.done') };
  return { status: 'completed', meaningful: true, label: name === 'list_records' && detail
    ? label('records.done', { ...result.values, kind: detail.toLocaleLowerCase(locale) })
    : label(`${name}.${result.key || 'done'}`, result.values), detail: result.detailKey ? label(result.detailKey, result.detailValues) : detail };
}
