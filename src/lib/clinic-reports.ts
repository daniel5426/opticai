/** Manual clinic reports: the builder's draft, and the agent report definition it sends. */

export type Dataset = 'clients' | 'appointments' | 'exams' | 'orders' | 'contact_lens_orders' | 'referrals'
  | 'billing' | 'payments' | 'inventory' | 'medical_logs' | 'files';
export type FieldType = 'text' | 'number' | 'date' | 'bool';
export type Operator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'in' | 'empty' | 'not_empty';
export type Operation = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max';
export type ChartKind = 'none' | 'bar' | 'line' | 'area' | 'pie';
export type Period = 'all' | 'this_month' | 'last_month' | 'last_30' | 'this_quarter' | 'this_year' | 'last_12_months' | 'custom';
export type Catalog = Record<string, { fields: Record<string, string> }>;

export const DATASETS: Dataset[] = ['clients', 'appointments', 'exams', 'orders', 'contact_lens_orders', 'referrals',
  'billing', 'payments', 'inventory', 'medical_logs', 'files'];

// Fields a manager can read in a report; ids and technical columns stay out of the builder.
const SHOWN = new Set(['first_name', 'last_name', 'national_id', 'gender', 'date_of_birth', 'age', 'phone_mobile', 'phone_home',
  'phone_work', 'email', 'address_city', 'address_street', 'address_number', 'postal_code', 'occupation', 'status', 'health_fund',
  'price_list', 'discount_percent', 'file_creation_date', 'referring_party', 'sorting_group', 'notes', 'membership_end',
  'service_end', 'service_center', 'family_role', 'total', 'paid', 'outstanding', 'currency', 'last_exam_date', 'id',
  'date', 'time', 'duration', 'exam_name', 'note', 'exam_date', 'test_name', 'type', 'dominant_eye', 'order_date',
  'details.order_status', 'details.promised_date', 'details.delivered_at', 'details.notes', 'details.lens_order_notes',
  'details.bag_number', 'details.manufacturing_lab', 'order_status', 'advisor', 'delivery_date', 'guaranteed_date',
  'approval_date', 'priority', 'supplier_notes', 'recipient', 'urgency_level', 'referral_notes', 'prescription_notes',
  'amount', 'paid_at', 'kind', 'product', 'brand', 'category', 'sku', 'barcode', 'on_hand', 'reserved', 'available',
  'reorder_point', 'target_quantity', 'log_date', 'log', 'file_name', 'file_type', 'file_size', 'upload_date']);
const EYE_FIELDS = new Set(['lens_type', 'model', 'supplier', 'material', 'color', 'quantity', 'order_quantity', 'dx']);
const CLIENT_FIELDS = new Set(['first_name', 'last_name', 'gender', 'date_of_birth', 'phone_mobile', 'email', 'address_city',
  'referring_party', 'sorting_group', 'age']);

export function baseField(key: string): string {
  return key.replace(/\.(month|year)$/, '');
}

export function isShown(key: string): boolean {
  const base = baseField(key);
  if (base.startsWith('client.')) return CLIENT_FIELDS.has(base.slice(7));
  if (/^[rl]_/.test(base)) return EYE_FIELDS.has(base.slice(2));
  return SHOWN.has(base);
}

export function fieldType(raw: string | undefined): FieldType {
  if (raw === 'date' || raw === 'datetime') return 'date';
  if (raw === 'int' || raw === 'float' || raw === 'Decimal' || raw === 'number') return 'number';
  if (raw === 'bool') return 'bool';
  return 'text';
}

/** The dataset's fields a manager can pick, without the derived month/year keys. */
export function fieldsOf(catalog: Catalog | undefined, dataset: Dataset): { key: string; type: FieldType }[] {
  const fields = catalog?.[dataset]?.fields ?? {};
  return Object.entries(fields).filter(([key]) => !/\.(month|year)$/.test(key) && isShown(key))
    .map(([key, type]) => ({ key, type: fieldType(type) }));
}

export function dateFieldsOf(catalog: Catalog | undefined, dataset: Dataset): string[] {
  return fieldsOf(catalog, dataset).filter(field => field.type === 'date').map(field => field.key);
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function fieldLabel(t: Translate, key: string): string {
  const period = key.match(/\.(month|year)$/)?.[1];
  const base = baseField(key);
  let label: string;
  if (base.startsWith('client.')) label = t('clinicReports.clientField', { field: t(`clinicReports.field.${base.slice(7)}`) });
  else if (/^[rl]_/.test(base) && EYE_FIELDS.has(base.slice(2))) {
    label = t(base[0] === 'r' ? 'clinicReports.rightEye' : 'clinicReports.leftEye', { field: t(`clinicReports.field.${base.slice(2)}`) });
  } else label = t(`clinicReports.field.${base}`);
  return period ? t(`clinicReports.by.${period}`, { field: label }) : label;
}

export function columnLabel(t: Translate, key: string): string {
  const aggregate = key.match(/^(count_distinct|count|sum|avg|min|max)_(.+)$/);
  if (aggregate) {
    if (aggregate[1] === 'count' && aggregate[2] === 'id') return t('clinicReports.operation.count');
    if (aggregate[1] === 'count_distinct' && aggregate[2] === 'client_id') return t('clinicReports.distinctClients');
    return `${t(`clinicReports.operation.${aggregate[1]}`)} · ${fieldLabel(t, aggregate[2])}`;
  }
  return fieldLabel(t, key);
}

export const OPERATORS: Record<FieldType, Operator[]> = {
  text: ['contains', 'eq', 'ne', 'in', 'empty', 'not_empty'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'empty', 'not_empty'],
  date: ['eq', 'gt', 'gte', 'lt', 'lte', 'empty', 'not_empty'],
  bool: ['eq', 'ne'],
};

export const OPERATIONS: Operation[] = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'];

export type Condition = { id: string; field: string; operator: Operator; value: string };
export type Metric = { id: string; operation: Operation; field: string };

export type Draft = {
  dataset: Dataset;
  title: string;
  period: Period;
  dateField: string;
  start: string;
  end: string;
  comparison: boolean;
  match: 'all' | 'any';
  conditions: Condition[];
  mode: 'list' | 'summary';
  columns: string[];
  groupBy: string[];
  metrics: Metric[];
  sort: { key: string; descending: boolean } | null;
  chart: ChartKind;
};

let sequence = 0;
export const newId = () => `r${Date.now().toString(36)}${(sequence++).toString(36)}`;

const iso = (day: Date) => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

export function periodRange(period: Period, today = new Date()): { start: string; end: string } | null {
  const y = today.getFullYear(), m = today.getMonth();
  switch (period) {
    case 'this_month': return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
    case 'last_month': return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
    case 'last_30': return { start: iso(new Date(y, m, today.getDate() - 29)), end: iso(today) };
    case 'this_quarter': {
      const first = m - (m % 3);
      return { start: iso(new Date(y, first, 1)), end: iso(new Date(y, first + 3, 0)) };
    }
    case 'this_year': return { start: iso(new Date(y, 0, 1)), end: iso(new Date(y, 11, 31)) };
    case 'last_12_months': return { start: iso(new Date(y, m - 11, 1)), end: iso(new Date(y, m + 1, 0)) };
    default: return null;
  }
}

export const DEFAULT_DATE_FIELD: Partial<Record<Dataset, string>> = {
  clients: 'file_creation_date', appointments: 'date', exams: 'exam_date', orders: 'order_date',
  contact_lens_orders: 'order_date', referrals: 'date', billing: 'order_date', payments: 'paid_at',
  medical_logs: 'log_date', files: 'upload_date',
};

export const DEFAULT_COLUMNS: Record<Dataset, string[]> = {
  clients: ['first_name', 'last_name', 'phone_mobile', 'address_city', 'file_creation_date'],
  appointments: ['date', 'time', 'client.first_name', 'client.last_name', 'exam_name'],
  exams: ['exam_date', 'client.first_name', 'client.last_name', 'test_name'],
  orders: ['order_date', 'client.first_name', 'client.last_name', 'type', 'details.order_status', 'details.manufacturing_lab'],
  contact_lens_orders: ['order_date', 'client.first_name', 'client.last_name', 'order_status', 'r_supplier', 'r_model'],
  referrals: ['date', 'client.first_name', 'client.last_name', 'recipient', 'urgency_level'],
  billing: ['order_date', 'client.first_name', 'client.last_name', 'total', 'paid', 'outstanding', 'currency'],
  payments: ['paid_at', 'client.first_name', 'client.last_name', 'amount', 'currency', 'kind'],
  inventory: ['product', 'brand', 'category', 'on_hand', 'available', 'reorder_point'],
  medical_logs: ['log_date', 'client.first_name', 'client.last_name', 'log'],
  files: ['upload_date', 'client.first_name', 'client.last_name', 'file_name', 'file_type'],
};

export function emptyDraft(dataset: Dataset = 'orders', today = new Date()): Draft {
  const dateField = DEFAULT_DATE_FIELD[dataset] ?? '';
  const range = periodRange('this_month', today)!;
  return {
    dataset, title: '', period: dateField ? 'this_month' : 'all', dateField, start: range.start, end: range.end,
    comparison: true, match: 'all', conditions: [], mode: 'list', columns: DEFAULT_COLUMNS[dataset], groupBy: [],
    metrics: [{ id: newId(), operation: 'count', field: 'id' }], sort: null, chart: 'bar',
  };
}

const AMOUNTS = new Set(['total', 'paid', 'outstanding', 'amount']);
const CHARTABLE = new Set<Operation>(['count', 'count_distinct', 'sum', 'avg']);

function conditionValue(condition: Condition, type: FieldType): unknown {
  if (condition.operator === 'empty' || condition.operator === 'not_empty') return undefined;
  if (condition.operator === 'in') return condition.value.split(',').map(item => item.trim()).filter(Boolean);
  if (type === 'number') return Number(condition.value);
  if (type === 'bool') return condition.value === 'true';
  return condition.value.trim();
}

export function isComplete(condition: Condition, type: FieldType): boolean {
  if (!condition.field) return false;
  if (condition.operator === 'empty' || condition.operator === 'not_empty' || type === 'bool') return true;
  if (type === 'number') return condition.value.trim() !== '' && Number.isFinite(Number(condition.value));
  return condition.value.trim() !== '';
}

export const metricKey = (metric: Metric) => `${metric.operation}_${metric.field}`;

/** The columns the report returns, in order, for labels the export can use. */
export function reportColumns(draft: Draft, catalog?: Catalog): string[] {
  if (draft.mode === 'list') return draft.columns;
  const keys = [...draft.groupBy];
  const fields = catalog?.[draft.dataset]?.fields ?? {};
  if (draft.metrics.some(metric => AMOUNTS.has(metric.field)) && 'currency' in fields && !keys.includes('currency')) keys.push('currency');
  return [...keys, ...draft.metrics.map(metricKey)];
}

export function toDefinition(draft: Draft, t: Translate, catalog?: Catalog) {
  const types = Object.fromEntries(fieldsOf(catalog, draft.dataset).map(field => [field.key, field.type]));
  const conditions = draft.conditions.filter(condition => isComplete(condition, types[condition.field] ?? 'text'))
    .map(condition => ({ field: condition.field, operator: condition.operator, value: conditionValue(condition, types[condition.field] ?? 'text') }));
  const summary = draft.mode === 'summary';
  const metrics = summary ? draft.metrics.filter(metric => metric.field) : [];
  const columns = reportColumns({ ...draft, metrics }, catalog);
  const sortable = new Set(columns);
  const sort = draft.sort && sortable.has(draft.sort.key) ? [`${draft.sort.descending ? '-' : ''}${draft.sort.key}`]
    : summary ? draft.groupBy.slice(0, 1) : [];
  const series = metrics.filter(metric => CHARTABLE.has(metric.operation)).map(metricKey).slice(0, draft.chart === 'pie' ? 1 : 5);
  const charts = summary && draft.chart !== 'none' && draft.groupBy.length && series.length
    ? [{ kind: draft.chart, x: draft.groupBy[0], series }] : [];
  const dated = draft.period !== 'all' && draft.dateField;
  return {
    version: 2, preset: 'custom', dataset: draft.dataset,
    title: draft.title.trim() || t(`clinicReports.dataset.${draft.dataset}`),
    ...(dated ? { date_field: draft.dateField, start_date: draft.start, end_date: draft.end } : {}),
    comparison: Boolean(dated && draft.comparison),
    ...(conditions.length ? { where: { match: draft.match, conditions } } : {}),
    ...(summary ? { group_by: draft.groupBy, aggregates: metrics.map(({ field, operation }) => ({ field, operation })) } : { columns: draft.columns }),
    sort_by: sort,
    presentation: { labels: Object.fromEntries(columns.map(key => [key, columnLabel(t, key).slice(0, 80)])), charts },
  };
}

type StoredDefinition = {
  dataset?: string; date_field?: string; start_date?: string; end_date?: string; comparison?: boolean;
  columns?: string[]; group_by?: string[]; aggregates?: { field: string; operation: string }[]; sort_by?: string[];
  where?: { match?: 'all' | 'any'; conditions?: { field?: string; operator?: Operator; value?: unknown }[] };
  presentation?: { charts?: { kind?: ChartKind }[] };
};

/** A saved definition back in the builder; nested condition groups are not built manually and are left out. */
export function fromDefinition(definition: StoredDefinition, title: string, today = new Date()): Draft {
  const dataset = DATASETS.includes(definition.dataset as Dataset) ? definition.dataset as Dataset : 'orders';
  const base = emptyDraft(dataset, today);
  const summary = Boolean(definition.aggregates?.length);
  const sortKey = definition.sort_by?.[0];
  return {
    ...base, title,
    period: definition.date_field ? 'custom' : 'all',
    dateField: definition.date_field || base.dateField,
    start: definition.start_date || base.start, end: definition.end_date || base.end,
    comparison: definition.comparison ?? true,
    match: definition.where?.match ?? 'all',
    conditions: (definition.where?.conditions ?? []).filter(item => item.field && item.operator).map(item => ({
      id: newId(), field: item.field!, operator: item.operator!,
      value: Array.isArray(item.value) ? item.value.join(', ') : item.value == null ? '' : String(item.value),
    })),
    mode: summary ? 'summary' : 'list',
    columns: definition.columns?.length ? definition.columns : base.columns,
    groupBy: definition.group_by ?? [],
    metrics: summary ? definition.aggregates!.map(item => ({ id: newId(), operation: item.operation as Operation, field: item.field })) : base.metrics,
    sort: sortKey ? { key: sortKey.replace(/^-/, ''), descending: sortKey.startsWith('-') } : null,
    chart: definition.presentation?.charts?.[0]?.kind ?? (summary ? 'none' : 'bar'),
  };
}

export type Template = { key: string; draft: (today: Date) => Draft };

const summaryOf = (dataset: Dataset, period: Period, groupBy: string[], metrics: [Operation, string][], chart: ChartKind,
  today: Date, extra: Partial<Draft> = {}): Draft => {
  const range = periodRange(period, today);
  return {
    ...emptyDraft(dataset, today), period, ...(range ?? {}), mode: 'summary', groupBy,
    metrics: metrics.map(([operation, field]) => ({ id: newId(), operation, field })), chart, ...extra,
  };
};

export const TEMPLATES: Template[] = [
  { key: 'salesByMonth', draft: today => summaryOf('billing', 'last_12_months', ['order_date.month'], [['sum', 'total'], ['sum', 'paid']], 'bar', today, { comparison: false }) },
  { key: 'newClients', draft: today => summaryOf('clients', 'last_12_months', ['file_creation_date.month'], [['count', 'id']], 'line', today, { comparison: false }) },
  { key: 'appointmentsByType', draft: today => summaryOf('appointments', 'this_month', ['exam_name'], [['count', 'id']], 'pie', today, { sort: { key: 'count_id', descending: true } }) },
  { key: 'ordersByLab', draft: today => summaryOf('orders', 'this_month', ['details.manufacturing_lab'], [['count', 'id']], 'bar', today, { sort: { key: 'count_id', descending: true } }) },
  { key: 'paymentsByKind', draft: today => summaryOf('payments', 'this_month', ['kind'], [['sum', 'amount'], ['count', 'id']], 'bar', today) },
  { key: 'openBalances', draft: today => ({
    ...emptyDraft('billing', today), period: 'all', mode: 'list',
    columns: ['order_date', 'client.first_name', 'client.last_name', 'client.phone_mobile', 'total', 'paid', 'outstanding', 'currency'],
    conditions: [{ id: newId(), field: 'outstanding', operator: 'gt', value: '0' }], sort: { key: 'outstanding', descending: true },
  }) },
  { key: 'stockByCategory', draft: today => summaryOf('inventory', 'all', ['category'], [['sum', 'on_hand'], ['sum', 'available']], 'bar', today) },
];

/** A grouped month key (YYYYMM) or a date as people read it; other values as they are. */
export function formatValue(value: unknown, key: string, locale: string, t: Translate): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return t(value ? 'clinicReports.yes' : 'clinicReports.no');
  if (key.endsWith('.month') && typeof value === 'number') return `${String(value % 100).padStart(2, '0')}/${Math.floor(value / 100)}`;
  if (key.endsWith('.year') && typeof value === 'number') return String(value);
  if (typeof value === 'number') return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-');
    const time = value.length > 10 && !value.slice(11, 19).startsWith('00:00:00') ? ` ${value.slice(11, 16)}` : '';
    return `${d}/${m}/${y}${time}`;
  }
  if (baseField(key).endsWith('gender') && (value === 'male' || value === 'female')) return t(`clinicReports.gender.${value}`);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
