import { useState, useRef, useLayoutEffect } from 'react'

interface CardRow {
  id: string
  cards: any[]
}

export const useRowWidthTracking = (cardRows: CardRow[], dependencies: any[] = []) => {
  const [rowWidths, setRowWidths] = useState<Record<string, number>>({})
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useLayoutEffect(() => {
    const observers: ResizeObserver[] = []
    Object.entries(rowRefs.current).forEach(([rowId, el]) => {
      if (el) {
        const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
            setRowWidths(prev => ({ ...prev, [rowId]: entry.contentRect.width }))
          }
        })
        observer.observe(el)
        observers.push(observer)
      }
    })
    return () => {
      observers.forEach(o => o.disconnect())
    }
  }, [cardRows, ...dependencies])

  return { rowWidths, rowRefs }
}

