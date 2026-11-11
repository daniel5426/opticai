import { getExamPageData, getExamsByClientId } from "@/lib/db/exams-db";
import { ExamFieldMapper } from "@/lib/exam-field-mappings";

// The newest exams are read one by one until one has new lenses; older ones are not looked at.
const EXAMS_TO_SCAN = 10;

const LENS_FIELDS = Object.keys(ExamFieldMapper.getFieldMapping("new-contact-lenses", "old-contact-lenses"));

const filled = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== "";

/** The New Contact Lenses card of the client's latest exam that filled one. */
export async function findLatestNewContactLenses(clientId: number): Promise<Record<string, unknown> | null> {
  const exams = await getExamsByClientId(clientId); // newest first
  for (const exam of exams.slice(0, EXAMS_TO_SCAN)) {
    if (!exam.id) continue;
    const page = await getExamPageData(exam.id);
    for (const row of page?.instances || []) {
      for (const [key, block] of Object.entries((row?.exam_data || {}) as Record<string, any>)) {
        if (!key.startsWith("new-contact-lenses") || !block || typeof block !== "object") continue;
        if (LENS_FIELDS.some((field) => filled(block[field]))) return block;
      }
    }
  }
  return null;
}

/** Fills the empty fields of every Old Contact Lenses card in the exam data from those lenses. */
export function fillOldContactLenses(examData: Record<string, any>, lenses: Record<string, unknown>) {
  let changed = false;
  const next = { ...examData };
  for (const [key, block] of Object.entries(examData)) {
    if (!key.startsWith("old-contact-lenses") || !block || typeof block !== "object") continue;
    const additions = Object.fromEntries(
      LENS_FIELDS.filter((field) => !filled(block[field]) && filled(lenses[field])).map((field) => [field, lenses[field]]),
    );
    if (Object.keys(additions).length) {
      next[key] = { ...block, ...additions };
      changed = true;
    }
  }
  return changed ? next : examData;
}
