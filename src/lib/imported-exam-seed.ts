type CardRef = { id: string; type: string }

/** Marks a block copied from the imported data; it stops being a copy once the user edits it. */
export const IMPORTED_COPY_FLAG = "__imported_copy"
type Bucket = Record<string, any>

// Imported OptiTech/SoftOptic acuity keeps the 6/x denominator; standard VA cards expect "6/x".
const ACUITY_FIELDS = new Set(["r_va", "l_va", "comb_va", "r_fv", "l_fv", "comb_fv"])
const BARE_ACUITY = /^\d[^/]*$/

// The imported final prescription fills a layout's final subjective (and back) when the layout lacks the other card.
const RESULT_ALIASES: Record<string, string> = {
  "final-subjective": "final-prescription",
  "final-prescription": "final-subjective",
}

function toStandardFields(block: Bucket): Bucket {
  const next: Bucket = {}
  for (const [field, value] of Object.entries(block)) {
    next[field] = ACUITY_FIELDS.has(field) && typeof value === "string" && BARE_ACUITY.test(value.trim())
      ? `6/${value.trim()}`
      : value
  }
  return next
}

/**
 * Fills an empty layout tab from the exam's imported (layout-less) data, card by card.
 * Imported exams keep their data outside any layout, so tabs added later start empty;
 * the copy only becomes persisted when the user saves that tab.
 */
export function seedLayoutFromImportedData(
  imported: Bucket,
  cards: CardRef[],
  layoutInstanceId: number,
): Bucket {
  const seeded: Bucket = {}
  const firstNotesKey = Object.keys(imported).find((key) => key.startsWith("notes-"))
  const layoutTypes = new Set(cards.map((card) => card.type))
  for (const card of cards) {
    const alias = RESULT_ALIASES[card.type]
    const source =
      imported[`${card.type}-${card.id}`] ??
      imported[card.type] ??
      (card.type === "notes" && firstNotesKey ? imported[firstNotesKey] : undefined) ??
      (alias && !layoutTypes.has(alias) ? imported[alias] : undefined)
    if (!source || typeof source !== "object") continue
    const block: Bucket = {
      ...toStandardFields(source),
      card_instance_id: card.id,
      layout_instance_id: layoutInstanceId,
      [IMPORTED_COPY_FLAG]: true,
    }
    delete block.source_layout_instance_id
    seeded[`${card.type}-${card.id}`] = block
    if (!seeded[card.type]) seeded[card.type] = block
  }
  return seeded
}
