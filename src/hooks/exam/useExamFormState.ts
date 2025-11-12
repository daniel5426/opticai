import { useMemo, useEffect } from 'react'
import { examComponentRegistry } from '@/lib/exam-component-registry'
import { normalizeFieldValue, shallowEqual } from '@/helpers/examDataUtils'
import { CardItem } from '@/components/exam/ExamCardRenderer'

interface CardRow {
  id: string
  cards: CardItem[]
}

export const useExamFormState = (
  cardRows: CardRow[],
  examFormData: Record<string, any>,
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  examFormDataByInstance: Record<number | string, Record<string, any>>,
  setExamFormDataByInstance: React.Dispatch<React.SetStateAction<Record<number | string, Record<string, any>>>>,
  activeInstanceId: number | null,
  computedCoverTestTabs: Record<string, string[]>
) => {
  const fieldHandlers = useMemo(() => {
    const handlers: Record<string, (field: string, value: string) => void> = {}
    
    examComponentRegistry.getAllTypes().forEach(type => {
      handlers[type] = (field: string, value: string) => {
        setExamFormData(prev => {
          const prevComponent = prev[type] || {}
          const prevValue = prevComponent[field]
          const normalized = normalizeFieldValue(prevValue, value)
          const nextComponent = { ...prevComponent }
          if (nextComponent.layout_instance_id == null && activeInstanceId != null) {
            nextComponent.layout_instance_id = activeInstanceId
          }
          if (normalized === undefined) {
            delete nextComponent[field]
          } else {
            nextComponent[field] = normalized
          }
          return {
            ...prev,
            [type]: nextComponent
          }
        })
      }
    })

    if (cardRows) {
      cardRows.forEach(row => {
        row.cards.forEach(card => {
          if (card.type === 'notes') {
            const key = `notes-${card.id}`
            handlers[key] = (field: string, value: string) => {
              setExamFormData(prev => {
                const prevNote = prev[key] || {}
                const normalized = normalizeFieldValue(prevNote[field], value)
                const nextNote = { ...prevNote }
                if (nextNote.layout_instance_id == null && activeInstanceId != null) {
                  nextNote.layout_instance_id = activeInstanceId
                }
                if (normalized === undefined) {
                  delete nextNote[field]
                } else {
                  nextNote[field] = normalized
                }
                return {
                  ...prev,
                  [key]: nextNote
                }
              })
            }
          }
          if (card.type === 'cover-test') {
            const cardId = card.id
            const tabIds = computedCoverTestTabs[cardId] || []
            tabIds.forEach(tabId => {
              const key = `cover-test-${cardId}-${tabId}`
              handlers[key] = (field, value) => {
                setExamFormData(prev => {
                  const tabIndex = (computedCoverTestTabs[cardId] || []).indexOf(tabId)
                  const prevTab = prev[key] || {}
                  const normalized = normalizeFieldValue(prevTab[field], value)
                  const nextTab = {
                    ...prevTab,
                    card_instance_id: tabId,
                    card_id: cardId,
                    tab_index: tabIndex,
                    layout_instance_id: prevTab.layout_instance_id ?? activeInstanceId
                  }
                  if (normalized === undefined) {
                    delete nextTab[field]
                  } else {
                    nextTab[field] = normalized
                  }
                  return {
                    ...prev,
                    [key]: nextTab
                  }
                })
              }
            })
          }
        })
      })
    }
    
    return handlers
  }, [cardRows, activeInstanceId, computedCoverTestTabs, setExamFormData])

  useEffect(() => {
    if (activeInstanceId != null) {
      const bucket = examFormDataByInstance[activeInstanceId]
      if (!shallowEqual(bucket || {}, examFormData)) {
        setExamFormData(bucket || {})
      }
    }
  }, [activeInstanceId, examFormDataByInstance])

  useEffect(() => {
    if (activeInstanceId != null) {
      const currentBucket = examFormDataByInstance[activeInstanceId] || {}
      if (!shallowEqual(currentBucket, examFormData)) {
        setExamFormDataByInstance(prev => ({
          ...prev,
          [activeInstanceId]: examFormData
        }))
      }
    }
  }, [examFormData, activeInstanceId])

  return {
    fieldHandlers
  }
}

