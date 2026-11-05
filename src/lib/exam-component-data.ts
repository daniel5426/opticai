type ComponentData = Record<string, unknown>;
type ExamPageData = { instances?: { exam_data?: Record<string, unknown> | null }[] };
const metadata = new Set(['id', 'layout_instance_id', 'card_instance_id', 'card_id', 'tab_index', 'source_layout_instance_id', 'title', 'created_at', 'updated_at', '__deleted']);

function hasMeasurements(value: unknown): value is ComponentData {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).some(([key, item]) => !metadata.has(key) && item !== null && item !== undefined && item !== '');
}

/** Cards belong to the whole exam; layout activity does not select the prescription. */
export function findExamComponentData(page: ExamPageData, type: string): ComponentData | undefined {
  const instances = page.instances || [];
  // The card-specific entry is authoritative; a legacy alias may be stale or empty.
  for (const instance of instances) {
    for (const [key, value] of Object.entries(instance.exam_data || {})) {
      if (key.startsWith(`${type}-`) && hasMeasurements(value)) return value;
    }
  }
  for (const instance of instances) {
    const value = instance.exam_data?.[type];
    if (hasMeasurements(value)) return value;
  }
}
