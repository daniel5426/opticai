import { useState, useRef, useLayoutEffect } from 'react'

interface CardRow {
  id: string
  cards: any[]
}

export const useRowWidthTracking = (cardRows: CardRow[], dependencies: any[] = []) => {
  const [rowWidths, setRowWidths] = useState<Record<string, number>>({})
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pendingUpdates = useRef<Record<string, number>>({})
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    const observers: ResizeObserver[] = []
    
    const flushUpdates = () => {
      if (Object.keys(pendingUpdates.current).length > 0) {
        setRowWidths(prev => ({ ...prev, ...pendingUpdates.current }))
        pendingUpdates.current = {}
      }
    }

    Object.entries(rowRefs.current).forEach(([rowId, el]) => {
      if (el) {
        const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
            pendingUpdates.current[rowId] = entry.contentRect.width
          }
          // Debounce: batch updates every 100ms
          if (debounceTimer.current) {
            clearTimeout(debounceTimer.current)
          }
          debounceTimer.current = setTimeout(flushUpdates, 46)
        })
        observer.observe(el)
        observers.push(observer)
      }
    })
    
    return () => {
      observers.forEach(o => o.disconnect())
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [cardRows, ...dependencies])

  return { rowWidths, rowRefs }
}

