export const OPTITECH_CARD_TYPES = [
  'optitech-examination', 'optitech-prescription', 'optitech-contact-measurements',
  'optitech-accommodation', 'optitech-binocular',
] as const;
export type OptitechCardType = typeof OPTITECH_CARD_TYPES[number];
export const isOptitechCard = (type: string): type is OptitechCardType =>
  (OPTITECH_CARD_TYPES as readonly string[]).includes(type);
export type OptitechBinding = { component: string; field: string; cardInstanceId?: string };
export type OptitechCardData = Record<string, unknown> & {
  bindings?: Record<string, OptitechBinding>;
};
const metadata = new Set(['id', 'layout_instance_id', 'card_instance_id', 'bindings', 'card_id', 'source_section', 'source_table', 'source_provenance', 'source_labels']);
export function optitechFieldNames(data: OptitechCardData): string[] {
  return [...new Set([...Object.keys(data).filter(key => !metadata.has(key) && !key.startsWith('__') && (typeof data[key] === 'string' || typeof data[key] === 'number')), ...Object.keys(data.bindings || {})])];
}

export function formatOptitechValue(type: OptitechCardType, field: string, value: unknown): string {
  const text = String(value ?? '');
  // OptiTech glasses VA/PH columns store the denominator of a 6/x value.
  // Contact-lens PH is kept in its original source representation.
  return type === 'optitech-prescription' && /^(?:P|Obj)?(?:VA[RL]?|PH[RL])$/.test(field) && /^\d+(?:\.\d+)?$/.test(text)
    ? `6/${text}` : text;
}
