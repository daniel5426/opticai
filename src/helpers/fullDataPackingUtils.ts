import { CardItem, getColumnCount } from "@/components/exam/ExamCardRenderer"

export const FULL_DATA_NAME = "Full data"

export const isMeaningfulValue = (v: any) => {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  return true
}

export const isNonEmptyComponent = (key: string, value: any) => {
  if (!value || typeof value !== 'object') return false
  const ignored = new Set(['id','layout_instance_id','card_id','card_instance_id','tab_index','__deleted'])
  const specialCover = ['deviation_type','deviation_direction','fv_1','fv_2','nv_1','nv_2']
  const specialNotes = ['title','note']
  if (key.startsWith('cover-test-')) {
    return specialCover.some(k => isMeaningfulValue((value as any)[k]))
  }
  if (key.startsWith('notes-')) {
    return specialNotes.some(k => isMeaningfulValue((value as any)[k]))
  }
  for (const [k, v] of Object.entries(value)) {
    if (ignored.has(k)) continue
    if (isMeaningfulValue(v)) return true
  }
  return false
}

export const pxToCols = (px: number) => {
  const pxPerCol = 1680 / 16
  return Math.max(1, Math.min(16, Math.round(px / pxPerCol)))
}

export const computeCardCols = (type: CardItem['type']): number => {
  const spec = getColumnCount(type, 'editor') as any
  if (typeof spec === 'number') return Math.max(1, Math.min(16, spec))
  if (spec && typeof spec === 'object' && typeof spec.fixedPx === 'number') return pxToCols(spec.fixedPx)
  return 1
}

export const packCardsIntoRows = (cards: { id: string; type: CardItem['type'] }[]) => {
  const items = cards.map(c => ({ ...c, cols: computeCardCols(c.type) }))
  
  const totalCols = items.reduce((sum, item) => sum + item.cols, 0)
  const minRowsNeeded = Math.ceil(totalCols / 16)
  const targetColsPerRow = Math.ceil(totalCols / minRowsNeeded)

  items.sort((a, b) => b.cols - a.cols)

  const rows: { id: string; cards: { id: string; type: CardItem['type']; title?: string }[]; used: number }[] = []

  items.forEach(item => {
    let bestIdx = -1
    let bestScore = -Infinity

    rows.forEach((row, idx) => {
      if (row.cards.length < 3 && row.used + item.cols <= 16) {
        const newUsed = row.used + item.cols
        
        const distanceFromTarget = Math.abs(targetColsPerRow - newUsed)
        
        const currentVariance = rows.reduce((sum, r) => sum + Math.pow(r.used - targetColsPerRow, 2), 0)
        const newVariance = rows.reduce((sum, r, i) => {
          const used = i === idx ? newUsed : r.used
          return sum + Math.pow(used - targetColsPerRow, 2)
        }, 0)
        
        const score = (currentVariance - newVariance) * 100 - distanceFromTarget
        
        if (score > bestScore) {
          bestScore = score
          bestIdx = idx
        }
      }
    })

    if (bestIdx === -1) {
      rows.push({ id: `row-${rows.length + 1}`, cards: [{ id: item.id, type: item.type }], used: item.cols })
    } else {
      const row = rows[bestIdx]
      row.cards.push({ id: item.id, type: item.type })
      row.used += item.cols
    }
  })

  return rows.map(r => ({ id: r.id, cards: r.cards }))
}

