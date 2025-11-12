import { useState, useMemo, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { CardItem } from '@/components/exam/ExamCardRenderer'

interface CardRow {
  id: string
  cards: CardItem[]
}

export const useCoverTestTabs = (
  cardRows: CardRow[],
  examFormData: Record<string, any>,
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  activeInstanceId: number | null,
  loading: boolean
) => {
  const [activeCoverTestTabs, setActiveCoverTestTabs] = useState<Record<string, number>>({})

  const computedCoverTestTabs = useMemo(() => {
    const map: Record<string, string[]> = {}
    const coverCardIds: string[] = []
    cardRows.forEach(row => {
      row.cards.forEach(card => { if (card.type === 'cover-test') coverCardIds.push(card.id) })
    })
    coverCardIds.forEach(cardId => {
      const keys = Object.keys(examFormData).filter(k => k.startsWith(`cover-test-${cardId}-`))
      if (keys.length === 0) return
      const pairs = keys.map(k => ({
        tabId: k.replace(`cover-test-${cardId}-`, ''),
        idx: Number((examFormData[k]?.tab_index ?? 0) as any) || 0
      }))
      pairs.sort((a, b) => a.idx - b.idx)
      map[cardId] = pairs.map(p => p.tabId)
    })
    return map
  }, [examFormData, JSON.stringify(cardRows)])

  useEffect(() => {
    if (loading) return
    const coverCardIds: string[] = []
    cardRows.forEach(row => row.cards.forEach(card => { if (card.type === 'cover-test') coverCardIds.push(card.id) }))
    if (coverCardIds.length === 0) return
    
    let changed = false
    const updates: Record<string, any> = {}
    coverCardIds.forEach(cardId => {
      const keys = Object.keys(examFormData).filter(k => k.startsWith(`cover-test-${cardId}-`))
      if (keys.length === 0) {
        const tabId = uuidv4()
        const key = `cover-test-${cardId}-${tabId}`
        updates[key] = {
          card_instance_id: tabId,
          card_id: cardId,
          tab_index: 0,
          layout_instance_id: activeInstanceId,
          deviation_type: null,
          deviation_direction: null,
          fv_1: null,
          fv_2: null,
          nv_1: null,
          nv_2: null
        }
        changed = true
        setActiveCoverTestTabs(prev => ({ ...prev, [cardId]: 0 }))
      }
    })
    if (changed) setExamFormData(prev => ({ ...prev, ...updates }))
  }, [JSON.stringify(cardRows), activeInstanceId, loading])

  const addCoverTestTab = (cardId: string) => {
    const newTabId = uuidv4()
    const keyPrefix = `cover-test-${cardId}-`
    const currentTabs = Object.keys(examFormData).filter(k => k.startsWith(keyPrefix))
    const tabIndex = currentTabs.length
    setExamFormData(formData => ({
      ...formData,
      [`${keyPrefix}${newTabId}`]: {
        card_instance_id: newTabId,
        card_id: cardId,
        tab_index: tabIndex,
        layout_instance_id: activeInstanceId,
        deviation_type: null,
        deviation_direction: null,
        fv_1: null,
        fv_2: null,
        nv_1: null,
        nv_2: null
      }
    }))
    setActiveCoverTestTabs(prev => ({ ...prev, [cardId]: tabIndex }))
  }

  const removeCoverTestTab = (cardId: string, tabIdx: number) => {
    const tabs = computedCoverTestTabs[cardId] || []
    if (tabs.length <= 1) return
    const toRemoveId = tabs[tabIdx]
    const key = `cover-test-${cardId}-${toRemoveId}`
    setExamFormData(prev => {
      const updated = { ...prev }
      delete updated[key]
      const remaining = (computedCoverTestTabs[cardId] || []).filter((_, i) => i !== tabIdx)
      remaining.forEach((tabId, idx) => {
        const k = `cover-test-${cardId}-${tabId}`
        if (updated[k]) updated[k] = { ...updated[k], tab_index: idx }
      })
      return updated
    })
    setActiveCoverTestTabs(prev => ({ ...prev, [cardId]: Math.max(0, Math.min(prev[cardId] || 0, (tabs.length - 2))) }))
  }

  return {
    activeCoverTestTabs,
    setActiveCoverTestTabs,
    computedCoverTestTabs,
    addCoverTestTab,
    removeCoverTestTab
  }
}

