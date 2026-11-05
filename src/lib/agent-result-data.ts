import { z } from 'zod';

const row = z.record(z.unknown());
const key = z.string().min(1);
const number = z.number().finite();
const period = z.object({ start: z.string(), end: z.string() });
const metric = z.object({ key, currency: z.string().nullable().optional(), current: number.nullable(),
  previous: number.nullable().optional(), change_percent: number.nullable().optional() });
const chart = z.object({ kind: z.enum(['bar', 'line', 'area', 'pie', 'donut']), title: z.string().optional(), x: key,
  series: z.array(key).min(1), rows: z.array(row), currency: z.string().nullable().optional(),
  truncated: z.boolean().optional(), unavailable: z.boolean().optional() });
const match = z.object({ source_date: z.string().nullable().optional(), component_key: z.string().optional(), distance: number.optional(),
  source: z.object({ path: z.string().optional() }).optional(), eyes: z.record(z.object({ values: row.optional(),
    differences: z.record(z.object({ requested: z.unknown(), recorded: z.unknown(), difference: number })).optional() })).optional() });
const result = z.object({ type: z.enum(['record_search', 'prescription_search', 'document_search', 'report_run', 'report_result']),
  title: z.string().optional(), show_table: z.boolean().optional(), show_stats: z.boolean().optional(),
  items: z.array(row).optional(), total: number.optional(), next_offset: number.nullable().optional(), index_ready: z.boolean().optional(),
  columns: z.array(key).optional(), column_labels: z.record(z.string()).optional(), rows: z.array(row).optional(),
  job_id: z.string().optional(), definition: row.optional(), status: z.string().optional(), exports: z.record(z.string()).optional(),
  charts: z.array(chart).optional(), metrics: z.array(metric).optional(), period: period.optional(),
  comparison: period.extend({ total: number, rows: z.array(row) }).optional(), definitions: row.optional(),
  limitations: z.array(z.string()).optional(), coverage: row.optional() });

export type AgentDataResult = z.infer<typeof result>;

/** Tool receipts and saved snapshots are external data, even when TypeScript declares their shape. */
export function parseAgentDataResult(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { data: null, invalid: true };
  const input = { ...value } as Record<string, unknown>;
  let invalid = false;
  // A malformed visual must not prevent access to a valid report table or download.
  for (const [field, schema] of [['metrics', metric], ['charts', chart]] as const) {
    const items = input[field];
    if (items === undefined) continue;
    if (!Array.isArray(items)) { input[field] = []; invalid = true; continue; }
    input[field] = items.flatMap<unknown>(item => {
      const parsed = schema.safeParse(item);
      if (!parsed.success) { invalid = true; return []; }
      return [parsed.data];
    });
  }
  const parsed = result.safeParse(input);
  if (!parsed.success) return { data: null, invalid: true };
  if (parsed.data.type === 'prescription_search') {
    for (const patient of parsed.data.items || []) {
      if (patient.matches !== undefined && !z.array(match).safeParse(patient.matches).success) return { data: null, invalid: true };
    }
  }
  return { data: parsed.data, invalid };
}
