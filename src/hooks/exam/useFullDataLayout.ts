import { useCallback } from 'react'
import { toast } from 'sonner'
import { createExamLayoutInstance, updateExamLayoutInstance } from '@/lib/db/exam-layouts-db'
import { FULL_DATA_NAME, packCardsIntoRows, isNonEmptyComponent } from '@/helpers/fullDataPackingUtils'

interface CardItem {
  id: string
  type: string
  title?: string
}

interface CardRow {
  id: string
  cards: CardItem[]
}

interface LayoutTab {
  id: number
  layout_id: number
  name: string
  layout_data: string
  isActive: boolean
}

interface UseFullDataLayoutParams {
  isNewMode: boolean
  exam: { id?: number | null } | null
  layoutTabs: LayoutTab[]
  setLayoutTabs: React.Dispatch<React.SetStateAction<LayoutTab[]>>
  cardRows: CardRow[]
  setCardRows: React.Dispatch<React.SetStateAction<CardRow[]>>
  setCustomWidths: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>
  examFormDataByInstance: Record<number | string, Record<string, any>>
  setExamFormDataByInstance: React.Dispatch<React.SetStateAction<Record<number | string, Record<string, any>>>>
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>
  setActiveInstanceId: React.Dispatch<React.SetStateAction<number | null>>
  activeInstanceId: number | null
  loadExamComponentData: (layoutInstanceId: number, layoutData?: string, setCurrent?: boolean) => Promise<void>
}

export const useFullDataLayout = ({
  isNewMode,
  exam,
  layoutTabs,
  setLayoutTabs,
  cardRows,
  setCardRows,
  setCustomWidths,
  examFormDataByInstance,
  setExamFormDataByInstance,
  setExamFormData,
  setActiveInstanceId,
  activeInstanceId,
  loadExamComponentData
}: UseFullDataLayoutParams) => {
  const aggregateAllData = useCallback((): Record<string, any> => {
    const aggregated: Record<string, any> = {}
    Object.values(examFormDataByInstance).forEach(bucket => {
      Object.entries(bucket || {}).forEach(([key, val]) => {
        if (val && typeof val === 'object') {
          if (!aggregated[key]) aggregated[key] = val
        }
      })
    })
    return aggregated
  }, [examFormDataByInstance])

  const buildFullDataLayoutData = useCallback((): string | null => {
    const aggregated = aggregateAllData()
    const cardDefs: { id: string; type: CardItem['type']; title?: string }[] = []
    const addedNotesIds = new Set<string>()
    const addedCoverIds = new Set<string>()
    Object.entries(aggregated).forEach(([key, value]) => {
      if (!isNonEmptyComponent(key, value)) return
      if (key.startsWith('notes-')) {
        const cardId = key.slice('notes-'.length) || `auto-${Date.now()}`
        if (!addedNotesIds.has(cardId)) {
          const title = (value as any)?.title
          cardDefs.push({ id: cardId, type: 'notes', ...(title ? { title } : {}) })
          addedNotesIds.add(cardId)
        }
        return
      }
      if (key.startsWith('cover-test-')) {
        const rest = key.slice('cover-test-'.length)
        const dash = rest.indexOf('-')
        const cardId = dash >= 0 ? rest.slice(0, dash) : (rest || `auto-${Date.now()}`)
        if (!addedCoverIds.has(cardId)) {
          cardDefs.push({ id: cardId, type: 'cover-test' })
          addedCoverIds.add(cardId)
        }
        return
      }
      const type = key as CardItem['type']
      const cId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      if (type === 'corneal-topography' && (value as any)?.title) {
        cardDefs.push({ id: cId, type, title: (value as any).title })
      } else {
        cardDefs.push({ id: cId, type })
      }
    })
    if (cardDefs.length === 0) return null
    const rows = packCardsIntoRows(cardDefs)
    const layout = { rows, customWidths: {} as Record<string, Record<string, number>> }
    return JSON.stringify(layout)
  }, [aggregateAllData])

  const buildFullDataBucket = useCallback((instanceId: number, layoutData: string): Record<string, any> => {
    const aggregated = aggregateAllData()
    const bucket: Record<string, any> = {}
    const allowedKeys = new Set<string>()
    try {
      const parsed = JSON.parse(layoutData)
      const rows = Array.isArray(parsed) ? parsed : parsed.rows || []
      rows.forEach((row: any) => {
        row.cards?.forEach((card: any) => {
          if (card.type === 'notes') {
            allowedKeys.add(`notes-${card.id}`)
          } else if (card.type === 'cover-test') {
            const prefix = `cover-test-${card.id}-`
            Object.keys(aggregated).forEach(k => {
              if (k.startsWith(prefix)) allowedKeys.add(k)
            })
          } else {
            allowedKeys.add(card.type)
          }
        })
      })
    } catch {}
    Object.entries(aggregated).forEach(([key, val]) => {
      if (!allowedKeys.has(key)) return
      if (!isNonEmptyComponent(key, val)) return
      const clone = { ...(val as any) }
      clone.layout_instance_id = instanceId
      if (key.startsWith('notes-')) {
        const cardId = key.replace('notes-', '')
        clone.card_instance_id = cardId
      }
      bucket[key] = clone
    })
    return bucket
  }, [aggregateAllData])

  const ensureAllLayoutsLoaded = useCallback(async (): Promise<void> => {
    if (isNewMode) return
    
    const promises: Promise<void>[] = []
    layoutTabs.forEach(tab => {
      if (tab.id > 0 && tab.name !== FULL_DATA_NAME) {
        const existingBucket = examFormDataByInstance[tab.id]
        if (!existingBucket || Object.keys(existingBucket).length === 0) {
          promises.push(loadExamComponentData(tab.id, tab.layout_data))
        }
      }
    })
    
    if (promises.length > 0) {
      await Promise.all(promises)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }, [isNewMode, layoutTabs, examFormDataByInstance, loadExamComponentData])

  const handleAddFullDataTab = useCallback(async () => {
    const existing = layoutTabs.find(t => t.name === FULL_DATA_NAME)
    if (existing) {
      setLayoutTabs(prev => prev.map(tab => ({ ...tab, isActive: tab.id === existing.id })))
      setActiveInstanceId(existing.id)
      const parsed = JSON.parse(existing.layout_data)
      if (Array.isArray(parsed)) {
        setCardRows(parsed)
        setCustomWidths({})
      } else {
        setCardRows(parsed.rows || [])
        setCustomWidths(parsed.customWidths || {})
      }
      const bucket = buildFullDataBucket(existing.id, existing.layout_data)
      setExamFormData(bucket)
      setExamFormDataByInstance(prev => ({ ...prev, [existing.id]: bucket }))
      return
    }
    
    await ensureAllLayoutsLoaded()
    
    const layoutData = buildFullDataLayoutData()
    if (!layoutData) {
      toast.info('אין נתונים להצגה בפריסת Full data')
      return
    }
    if (exam && exam.id && !isNewMode) {
      const newInstance = await createExamLayoutInstance({ exam_id: exam.id, layout_id: null, is_active: true, order: 0, layout_data: layoutData } as any)
      if (!newInstance || !newInstance.id) {
        toast.error('שגיאה בהוספת פריסת Full data')
        return
      }
      const updatedTabs = layoutTabs.map(t => ({ ...t, isActive: false }))
      const newTab = { id: newInstance.id || 0, layout_id: null as any, name: FULL_DATA_NAME, layout_data: layoutData, isActive: true }
      setLayoutTabs([...updatedTabs, newTab])
      setActiveInstanceId(newInstance.id || null)
      const seedBucket = buildFullDataBucket(newInstance.id!, layoutData)
      setExamFormDataByInstance(prev => ({ ...prev, [newInstance.id!]: seedBucket }))
      setExamFormData(seedBucket)
      try {
        const parsed = JSON.parse(layoutData)
        if (Array.isArray(parsed)) {
          setCardRows(parsed)
          setCustomWidths({})
        } else {
          setCardRows(parsed.rows || [])
          setCustomWidths(parsed.customWidths || {})
        }
      } catch {}
      toast.success('Full data הוחל לבדיקה')
    } else {
      const updatedTabs = layoutTabs.map(t => ({ ...t, isActive: false }))
      const tempId = -Date.now()
      const newTab = { id: tempId, layout_id: 0, name: FULL_DATA_NAME, layout_data: layoutData, isActive: true }
      setLayoutTabs([...updatedTabs, newTab])
      setActiveInstanceId(tempId)
      try {
        const parsed = JSON.parse(layoutData)
        if (Array.isArray(parsed)) {
          setCardRows(parsed)
          setCustomWidths({})
        } else {
          setCardRows(parsed.rows || [])
          setCustomWidths(parsed.customWidths || {})
        }
      } catch {}
      const seedBucket = buildFullDataBucket(tempId, layoutData)
      setExamFormData(seedBucket)
      setExamFormDataByInstance(prev => ({ ...prev, [tempId]: seedBucket }))
      toast.success('Full data הוחל לבדיקה')
    }
  }, [
    layoutTabs,
    setLayoutTabs,
    setActiveInstanceId,
    setCardRows,
    setCustomWidths,
    buildFullDataBucket,
    ensureAllLayoutsLoaded,
    buildFullDataLayoutData,
    exam,
    isNewMode,
    setExamFormData,
    setExamFormDataByInstance
  ])

  const handleRegenerateFullData = useCallback(async () => {
    const active = layoutTabs.find(t => t.isActive)
    if (!active || active.name !== FULL_DATA_NAME) return
    
    await ensureAllLayoutsLoaded()
    
    const layoutData = buildFullDataLayoutData()
    if (!layoutData) {
      toast.info('אין עדכונים לפריסת Full data')
      return
    }
    if (exam && exam.id && !isNewMode && active.id > 0) {
      await updateExamLayoutInstance({ id: active.id, exam_id: exam.id, layout_id: null as any, layout_data: layoutData } as any)
      const seedBucket = buildFullDataBucket(active.id, layoutData)
      setExamFormDataByInstance(prev => ({ ...prev, [active.id]: seedBucket }))
      setExamFormData(seedBucket)
    } else {
      const seedBucket = buildFullDataBucket(active.id, layoutData)
      setExamFormDataByInstance(prev => ({ ...prev, [active.id]: seedBucket }))
      setExamFormData(seedBucket)
    }
    const newTabs = layoutTabs.map(t => t.id === active.id ? { ...t, layout_data: layoutData } : t)
    setLayoutTabs(newTabs)
    try {
      const parsed = JSON.parse(layoutData)
      if (Array.isArray(parsed)) {
        setCardRows(parsed)
        setCustomWidths({})
      } else {
        setCardRows(parsed.rows || [])
        setCustomWidths(parsed.customWidths || {})
      }
    } catch {}
    toast.success('Full data רועננה')
  }, [
    layoutTabs,
    ensureAllLayoutsLoaded,
    buildFullDataLayoutData,
    exam,
    isNewMode,
    setExamFormDataByInstance,
    buildFullDataBucket,
    setExamFormData,
    setLayoutTabs,
    setCardRows,
    setCustomWidths
  ])

  return {
    handleAddFullDataTab,
    handleRegenerateFullData,
    buildFullDataBucket
  }
}

