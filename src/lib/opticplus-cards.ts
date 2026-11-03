import type { TFunction } from 'i18next';

export const OPTICPLUS_CARD_TYPES = [
  'opticplus-prescription-details', 'opticplus-contact-fitting', 'opticplus-measurements',
  'opticplus-ocular-health', 'opticplus-binocular', 'opticplus-questionnaire', 'opticplus-legacy-history',
] as const;
export type OpticPlusCardType = typeof OPTICPLUS_CARD_TYPES[number];
export const isOpticPlusCard = (type: string): type is OpticPlusCardType =>
  (OPTICPLUS_CARD_TYPES as readonly string[]).includes(type);
export const opticPlusMetadata = new Set(['id', 'layout_instance_id', 'source_layout_instance_id', 'layout_instance', 'card_instance_id', 'source_card_type', 'source_table', 'source_key', 'bindings', 'opticplus_source']);
export const opticPlusLabel = (t: TFunction, field: string, table = '') => String(t(`opticplusCards.tableFields.${table}.${field}`, { defaultValue: t(`opticplusCards.fields.${field}`, {
  defaultValue: t('opticplusCards.unknownField', { field }),
}) }));
export const opticPlusValue = (t: TFunction, value: unknown) => typeof value === 'boolean'
  ? String(t(`opticplusCards.${value ? 'yes' : 'no'}`))
  : value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
export const importedExamName = (t: TFunction, name?: string | null) =>
  name?.startsWith('opticplus.exam.') ? String(t(name.replace('opticplus.exam.', 'opticplusCards.exam.'))) : name || '';

/** Imported instance JSON is a real layout even when it has no library template. */
export function hasOpticPlusLayout(value: { instance?: { layout_data?: string | null }; exam_data?: Record<string, unknown> }): boolean {
  if (!Object.entries(value.exam_data || {}).some(([key, block]) => key.startsWith('opticplus-') ||
      typeof block === 'object' && block !== null && 'opticplus_source' in block)) return false;
  try {
    const layout = JSON.parse(value.instance?.layout_data || '{}');
    return layout.version === 2 && Array.isArray(layout.items) && layout.items.length > 0;
  } catch { return false; }
}

export const importedOrderName = (t: TFunction, type?: string | null) => type === 'glasses'
  ? String(t('orderGroupGlasses')) : type === 'contact-lens' ? String(t('orderGroupContact')) : type || '';

/** Date-only presentation without repairing invalid legacy calendar values. */
export function opticPlusDisplayValue(t: TFunction, value: unknown, locale: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T00:00:00)?$/.test(value)) {
    const date = new Date(`${value.slice(0,10)}T12:00:00`);
    if (!Number.isNaN(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` === value.slice(0,10))
      return date.toLocaleDateString(locale);
  }
  if (typeof value === 'string' && /^[+-]?\d+\.\d{12,}$/.test(value) && /[09]{8}/.test(value)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return new Intl.NumberFormat(locale, {maximumFractionDigits:10, useGrouping:false}).format(numeric);
  }
  // Format a numeric display only; retained source strings and editable values stay exact.
  if (typeof value === 'number' && Number.isFinite(value))
    return new Intl.NumberFormat(locale, {maximumFractionDigits:10, useGrouping:false}).format(value);
  return opticPlusValue(t,value);
}
