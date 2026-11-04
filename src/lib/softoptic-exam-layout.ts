import type { CardItem } from "@/components/exam/ExamCardRenderer"
import { computeCardMinGridCols, EXAM_LAYOUT_GRID_COLUMNS, type GridLayoutItem } from "@/pages/exam-detail/utils"

// OpticSoft draws every refraction block across the whole screen.
const FULL_ROW_TYPES = new Set([
  "subjective", "final-subjective", "final-prescription", "old-refraction", "old-refraction-extension", "softoptic-ocular-mot",
])

/**
 * Lays out a SoftOptic tab's cards in OpticSoft's order: rows fill left to right (at most three cards),
 * and each row stretches to full width. A wide card that does not fit starts a row of its own.
 */
export function packSoftopticCards(
  cards: { id: string; type: CardItem["type"]; title?: string }[],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
): GridLayoutItem[] {
  const rows: Array<Array<{ card: (typeof cards)[number]; w: number }>> = []
  let row: (typeof rows)[number] = []
  let used = 0
  for (const card of cards) {
    const fullRow = FULL_ROW_TYPES.has(card.type)
    const w = fullRow ? columns : Math.min(columns, computeCardMinGridCols(card.type, columns))
    if (row.length && (used + w > columns || row.length >= 3)) {
      rows.push(row)
      row = []
      used = 0
    }
    row.push({ card, w })
    used += w
  }
  if (row.length) rows.push(row)

  return rows.flatMap((items, y) => {
    const total = items.reduce((sum, item) => sum + item.w, 0)
    let x = 0
    return items.map(({ card, w }, index) => {
      // Share the free columns in proportion; the last card takes what rounding leaves.
      const width = index === items.length - 1 ? columns - x : Math.floor((w * columns) / total)
      const item: GridLayoutItem = { ...card, w: width, x, y, showEyeLabels: index === 0 }
      x += width
      return item
    })
  })
}
