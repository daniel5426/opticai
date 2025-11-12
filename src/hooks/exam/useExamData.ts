import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { getAllExamLayouts } from '@/lib/db/exam-layouts-db'
import { getExamPageData } from '@/lib/db/exams-db'
import { ExamLayout, OpticalExam } from '@/lib/db/schema-interface'
import { getClipboardContentType } from '@/lib/exam-clipboard'
import { FULL_DATA_NAME } from '@/helpers/fullDataPackingUtils'

interface CardItem {
  id: string
  type: string
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

interface UseExamDataParams {
  clientId?: string
  examId?: string
  isNewMode: boolean
  dbType: 'exam' | 'opticlens'
  currentClinicId?: number | null
  setClipboardContentType: (type: any) => void
  setExam: React.Dispatch<React.SetStateAction<OpticalExam | null>>
  setLayoutTabs: React.Dispatch<React.SetStateAction<LayoutTab[]>>
  setActiveInstanceId: React.Dispatch<React.SetStateAction<number | null>>
  setCardRows: React.Dispatch<React.SetStateAction<CardRow[]>>
  setCustomWidths: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>
  initializeFormData: (instanceKey: number, layoutData?: string) => void
  loadExamComponentData: (layoutInstanceId: number, layoutData?: string, setCurrent?: boolean) => Promise<void>
  setAvailableLayouts: React.Dispatch<React.SetStateAction<ExamLayout[]>>
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>
  setExamFormDataByInstance: React.Dispatch<React.SetStateAction<Record<number | string, Record<string, any>>>>
  buildFullDataBucket: (instanceId: number, layoutData: string) => Record<string, any>
}

export const useExamData = ({
  clientId,
  examId,
  isNewMode,
  dbType,
  currentClinicId,
  setClipboardContentType,
  setExam,
  setLayoutTabs,
  setActiveInstanceId,
  setCardRows,
  setCustomWidths,
  initializeFormData,
  loadExamComponentData,
  setAvailableLayouts,
  setExamFormData,
  setExamFormDataByInstance,
  buildFullDataBucket
}: UseExamDataParams) => {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!clientId) return
      try {
        setLoading(true)
        setClipboardContentType(getClipboardContentType())
        if (examId && !isNewMode) {
          const pageData = await getExamPageData(Number(examId))
          if (pageData) {
            const { exam: examData, instances, chosen_active_instance_id, available_layouts } = pageData
            setExam(examData || null)
            const layoutInstances = (instances || []).map((e: any) => e.instance)
            const layoutMapLocal: Record<number, any> = Object.fromEntries((instances || []).map((e: any) => [e.instance.layout_id, e.layout]))
            if (layoutInstances && layoutInstances.length > 0) {
              const tabs = layoutInstances.map((instance: any) => {
                const layout = layoutMapLocal[instance.layout_id]
                const layoutDataStr = layout?.layout_data || instance?.layout_data || ''
                const name = layout?.name || (instance?.layout_data ? FULL_DATA_NAME : '')
                return {
                  id: instance.id || 0,
                  layout_id: instance.layout_id,
                  name,
                  layout_data: layoutDataStr,
                  isActive: instance.id === (chosen_active_instance_id)
                }
              })
              setLayoutTabs(tabs)
              const chosenInstId = (chosen_active_instance_id) as number | undefined
              const chosen = (instances || []).find((e: any) => e?.instance?.id === chosenInstId) || (instances || [])[0]
              if (chosen && chosen.instance && (chosen.layout || chosen.instance?.layout_data)) {
                setActiveInstanceId(chosen.instance.id || 0)
                const layoutDataStr = (chosen.layout?.layout_data || chosen.instance?.layout_data || '[]')
                const parsedLayout = JSON.parse(layoutDataStr)
                if (Array.isArray(parsedLayout)) {
                  setCardRows(parsedLayout)
                  setCustomWidths({})
                } else {
                  setCardRows(parsedLayout.rows || [])
                  setCustomWidths(parsedLayout.customWidths || {})
                }
                if (chosen.layout && chosen.layout.layout_data) {
                  await loadExamComponentData(chosen.instance.id, layoutDataStr, true)
                } else {
                  const seedBucket = buildFullDataBucket(chosen.instance.id, layoutDataStr)
                  setExamFormData(seedBucket)
                  setExamFormDataByInstance(prev => ({ ...prev, [chosen.instance.id]: seedBucket }))
                }
                if (chosen.exam_data && typeof chosen.exam_data === 'object') {
                  setExamFormData(chosen.exam_data)
                  setExamFormDataByInstance(prev => ({ ...prev, [chosen.instance.id]: chosen.exam_data }))
                }
              }
              const others = (instances || []).filter((e: any) => e?.instance?.id !== (chosen_active_instance_id))
              if (others.length > 0) {
                setTimeout(() => {
                  const preloadPromises: Promise<void>[] = []
                  others.forEach((e: any) => {
                    const inst = e.instance
                    const l = e.layout
                    if (inst?.id && l && l.layout_data) {
                      preloadPromises.push(loadExamComponentData(inst.id, l.layout_data))
                    }
                  })
                  void Promise.all(preloadPromises)
                }, 0)
              }
              if (Array.isArray(available_layouts)) {
                setAvailableLayouts(available_layouts as any)
              }
            }
          }
        } else {
          const availableLayoutsResponse = await apiClient.getExamLayouts(currentClinicId)
          if (!availableLayoutsResponse.error) {
            setAvailableLayouts(availableLayoutsResponse.data || [])
          }
          const availableLayoutsData = availableLayoutsResponse.error ? [] : (availableLayoutsResponse.data || [])
          let defaultLayouts = (await getAllExamLayouts(currentClinicId)).filter(layout => layout.is_default)
          if (defaultLayouts.length === 0) {
            const layoutsData = availableLayoutsData as any[]
            defaultLayouts = layoutsData.filter(l => l.is_default)
            if (defaultLayouts.length === 0 && layoutsData.length > 0) defaultLayouts = [layoutsData[0] as any]
          }
          if (defaultLayouts.length > 0) {
            const layoutTabsData: LayoutTab[] = []
            for (let i = 0; i < defaultLayouts.length; i++) {
              const defaultLayout = defaultLayouts[i]
              const tempInstanceId = -Date.now() - i
              if (i === 0) {
                const parsedLayout = JSON.parse(defaultLayout.layout_data)
                if (Array.isArray(parsedLayout)) {
                  setCardRows(parsedLayout)
                  setCustomWidths({})
                } else {
                  setCardRows(parsedLayout.rows || [])
                  setCustomWidths(parsedLayout.customWidths || {})
                }
                setActiveInstanceId(tempInstanceId)
              }
              initializeFormData(tempInstanceId, defaultLayout.layout_data)
              layoutTabsData.push({
                id: tempInstanceId,
                layout_id: defaultLayout.id || 0,
                name: defaultLayout.name || '',
                layout_data: defaultLayout.layout_data || '',
                isActive: i === 0
              })
            }
            setLayoutTabs(layoutTabsData)
          }
        }
      } catch (error) {
        toast.error('שגיאה בטעינת נתוני הבדיקה')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [
    clientId,
    examId,
    isNewMode,
    dbType,
    currentClinicId,
    setClipboardContentType,
    setExam,
    setLayoutTabs,
    setActiveInstanceId,
    setCardRows,
    setCustomWidths,
    initializeFormData,
    loadExamComponentData,
    setAvailableLayouts,
    setExamFormData,
    setExamFormDataByInstance,
    buildFullDataBucket
  ])

  return loading
}

