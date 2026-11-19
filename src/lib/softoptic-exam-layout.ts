import type { CardItem } from "@/components/exam/ExamCardRenderer"
import { computeCardMinGridCols, EXAM_LAYOUT_GRID_COLUMNS, type GridLayoutItem } from "@/pages/exam-detail/utils"

/**
 * Pack cards in source order at their usual Prysm width.
 */
export function packSoftopticCards(
  cards: { id: string; type: CardItem["type"]; title?: string }[],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
): GridLayoutItem[] {
  const rows: Array<Array<{ card: (typeof cards)[number]; w: number }>> = []
  let row: (typeof rows)[number] = []
  let used = 0
  for (const card of cards) {
    const w = computeCardMinGridCols(card.type, columns)
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
    let x = 0
    return items.map(({ card, w }) => {
      const item: GridLayoutItem = { ...card, w, x, y, showEyeLabels: true }
      x += w
      return item
    })
  })
}
