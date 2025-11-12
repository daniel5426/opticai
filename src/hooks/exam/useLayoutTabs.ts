import { useCallback } from 'react'
import { toast } from 'sonner'
import { addLayoutToExam, deleteExamLayoutInstance, setActiveExamLayoutInstance } from '@/lib/db/exam-layouts-db'
import { FULL_DATA_NAME } from '@/helpers/fullDataPackingUtils'

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

interface ExamLayout {
  id?: number | null
  name?: string | null
  layout_data: string
}

interface UseLayoutTabsParams {
  layoutTabs: LayoutTab[]
  setLayoutTabs: React.Dispatch<React.SetStateAction<LayoutTab[]>>
  availableLayouts: ExamLayout[]
  setActiveInstanceId: React.Dispatch<React.SetStateAction<number | null>>
  setCardRows: React.Dispatch<React.SetStateAction<CardRow[]>>
  setCustomWidths: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>
  loadExamComponentData: (layoutInstanceId: number, layoutData?: string, setCurrent?: boolean) => Promise<void>
  initializeFormData: (instanceKey: number, layoutData?: string) => void
  examFormDataByInstance: Record<number | string, Record<string, any>>
  setExamFormDataByInstance: React.Dispatch<React.SetStateAction<Record<number | string, Record<string, any>>>>
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>
  buildFullDataBucket: (instanceId: number, layoutData: string) => Record<string, any>
  exam: { id?: number | null } | null
  isNewMode: boolean
  latestLoadIdRef: React.MutableRefObject<number>
  activeInstanceId: number | null
  isEditing: boolean
}

export const useLayoutTabs = ({
  layoutTabs,
  setLayoutTabs,
  availableLayouts,
  setActiveInstanceId,
  setCardRows,
  setCustomWidths,
  loadExamComponentData,
  initializeFormData,
  examFormDataByInstance,
  setExamFormDataByInstance,
  setExamFormData,
  buildFullDataBucket,
  exam,
  isNewMode,
  latestLoadIdRef,
  activeInstanceId,
  isEditing
}: UseLayoutTabsParams) => {
  const handleLayoutTabChange = useCallback(async (tabId: number) => {
    const selectedTab = layoutTabs.find(tab => tab.id === tabId)
    if (!selectedTab) return
    
    try {
      const loadId = ++latestLoadIdRef.current
      const updatedTabs = layoutTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId
      }))
      
      setLayoutTabs(updatedTabs)
      setActiveInstanceId(selectedTab.id)
      
      const parsedLayout = JSON.parse(selectedTab.layout_data)
      if (Array.isArray(parsedLayout)) {
        setCardRows(parsedLayout)
        setCustomWidths({})
      } else {
        setCardRows(parsedLayout.rows || [])
        setCustomWidths(parsedLayout.customWidths || {})
      }
      const existingBucket = examFormDataByInstance[selectedTab.id]
      if (selectedTab.name === FULL_DATA_NAME && selectedTab.layout_data) {
        const refreshedBucket = buildFullDataBucket(selectedTab.id, selectedTab.layout_data)
        setExamFormDataByInstance(prev => ({ ...prev, [selectedTab.id]: refreshedBucket }))
        setExamFormData(refreshedBucket)
      } else if (existingBucket && Object.keys(existingBucket).length > 0) {
        setExamFormData(existingBucket)
      }
      
      const promises: Promise<void | unknown>[] = []
      
      if (!isNewMode && selectedTab.name !== FULL_DATA_NAME && (!isEditing || !(existingBucket && Object.keys(existingBucket).length > 0))) {
        promises.push((async () => {
          await loadExamComponentData(selectedTab.id, selectedTab.layout_data)
          if (loadId === latestLoadIdRef.current) {
            const bucket = examFormDataByInstance[selectedTab.id]
            if (bucket && Object.keys(bucket).length > 0) {
              setExamFormData(bucket)
            }
          }
        })())
      }
      
      if (exam && exam.id && !isNewMode) {
        promises.push(setActiveExamLayoutInstance(exam.id, tabId))
      }
      
      await Promise.all(promises)
    } catch (error) {
      console.error('Error changing layout tab:', error)
      toast.error('שגיאה בהחלפת לשונית פריסה')
    }
  }, [
    layoutTabs,
    latestLoadIdRef,
    setLayoutTabs,
    setActiveInstanceId,
    setCardRows,
    setCustomWidths,
    examFormDataByInstance,
    setExamFormDataByInstance,
    setExamFormData,
    buildFullDataBucket,
    isNewMode,
    loadExamComponentData,
    isEditing,
    exam
  ])

  const handleAddLayoutTab = useCallback(async (layoutId: number) => {
    const layoutToAdd = availableLayouts.find(layout => (layout.id || 0) === layoutId)
    if (!layoutToAdd) return
    
    if (layoutTabs.some(tab => tab.layout_id === layoutId)) {
      toast.info(`הפריסה "${layoutToAdd.name}" כבר קיימת בלשוניות`)
      const existing = layoutTabs.find(tab => tab.layout_id === layoutId)
      if (existing) {
        void handleLayoutTabChange(existing.id)
      }
      return
    }
    
    if (exam && exam.id && !isNewMode) {
      const newLayoutInstance = await addLayoutToExam(exam.id, layoutId, true)
      
      if (newLayoutInstance) {
        latestLoadIdRef.current++
        const updatedTabs = layoutTabs.map(tab => ({ ...tab, isActive: false }))
        
        const newTab = {
          id: newLayoutInstance.id || 0,
          layout_id: layoutId,
          name: layoutToAdd.name || '',
          layout_data: layoutToAdd.layout_data || '',
          isActive: true
        }
        
        setLayoutTabs([...updatedTabs, newTab])
        setActiveInstanceId(newLayoutInstance.id || null)
        
        const parsedLayout = JSON.parse(layoutToAdd.layout_data)
        if (Array.isArray(parsedLayout)) {
          setCardRows(parsedLayout)
          setCustomWidths({})
        } else {
          setCardRows(parsedLayout.rows || [])
          setCustomWidths(parsedLayout.customWidths || {})
        }
        
        if (newLayoutInstance && newLayoutInstance.id) {
          await loadExamComponentData(newLayoutInstance.id, layoutToAdd.layout_data)
        }

        toast.success(`פריסה "${layoutToAdd.name}" הוספה והוחלה`)
      } else {
        toast.error('שגיאה בהוספת לשונית פריסה')
      }
    } else {
      const updatedTabs = layoutTabs.map(tab => ({ ...tab, isActive: false }))
      
      const newTab = {
        id: -Date.now(),
        layout_id: layoutId,
        name: layoutToAdd.name || '',
        layout_data: layoutToAdd.layout_data || '',
        isActive: true
      }
      
      setLayoutTabs([...updatedTabs, newTab])
      setActiveInstanceId(newTab.id)
      
      const parsedLayout = JSON.parse(layoutToAdd.layout_data)
      if (Array.isArray(parsedLayout)) {
        setCardRows(parsedLayout)
        setCustomWidths({})
      } else {
        setCardRows(parsedLayout.rows || [])
        setCustomWidths(parsedLayout.customWidths || {})
      }
      initializeFormData(newTab.id, layoutToAdd.layout_data)
      toast.success(`פריסה "${layoutToAdd.name}" הוספה והוחלה`)
    }
  }, [
    availableLayouts,
    layoutTabs,
    exam,
    isNewMode,
    setLayoutTabs,
    setActiveInstanceId,
    setCardRows,
    setCustomWidths,
    loadExamComponentData,
    initializeFormData,
    latestLoadIdRef,
    handleLayoutTabChange
  ])

  const handleRemoveLayoutTab = useCallback(async (tabId: number) => {
    if (layoutTabs.length <= 1) {
      toast.error('לא ניתן להסיר את הלשונית האחרונה');
      return;
    }
    
    const tabIndex = layoutTabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;
    
    const tabToRemove = layoutTabs[tabIndex];
    const isActive = tabToRemove.isActive;
    
    try {
      if (exam && exam.id && !isNewMode && tabId > 0) {
        const success = await deleteExamLayoutInstance(tabId);
        if (!success) {
          toast.error('שגיאה במחיקת פריסה');
          return;
        }
      }
      
      const updatedTabs = [...layoutTabs];
      updatedTabs.splice(tabIndex, 1);
      
      if (isActive && updatedTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, updatedTabs.length - 1);
        updatedTabs[newActiveIndex].isActive = true;
        
        if (exam && exam.id && !isNewMode) {
          await setActiveExamLayoutInstance(exam.id, updatedTabs[newActiveIndex].id);
        }
        
        setActiveInstanceId(updatedTabs[newActiveIndex].id);
        
        try {
          const newActiveTab = updatedTabs[newActiveIndex];
          const parsedLayout = JSON.parse(newActiveTab.layout_data);
          if (Array.isArray(parsedLayout)) {
            setCardRows(parsedLayout);
            setCustomWidths({});
          } else {
            setCardRows(parsedLayout.rows || []);
            setCustomWidths(parsedLayout.customWidths || {});
          }
        } catch (error) {
          console.error('Error applying layout after tab removal:', error);
        }
      }
      
      setLayoutTabs(updatedTabs);
      toast.success('לשונית הפריסה הוסרה');
    } catch (error) {
      console.error('Error removing layout tab:', error);
      toast.error('שגיאה במחיקת לשונית פריסה');
    }
  }, [
    layoutTabs,
    exam,
    isNewMode,
    setActiveInstanceId,
    setCardRows,
    setCustomWidths,
    setLayoutTabs
  ])

  return {
    handleLayoutTabChange,
    handleAddLayoutTab,
    handleRemoveLayoutTab
  }
}

