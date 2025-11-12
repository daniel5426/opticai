import { useCallback } from 'react'
import { toast } from 'sonner'
import { createExam, updateExam } from '@/lib/db/exams-db'
import { addLayoutToExam } from '@/lib/db/exam-layouts-db'
import { examComponentRegistry } from '@/lib/exam-component-registry'
import { OpticalExam } from '@/lib/db/schema-interface'

interface LayoutTab {
  id: number
  layout_id: number
  name: string
  layout_data: string
  isActive: boolean
}

interface UseExamSaveParams {
  isNewMode: boolean
  formRef: React.RefObject<HTMLFormElement>
  isSaveInFlight: boolean
  setIsSaveInFlight: React.Dispatch<React.SetStateAction<boolean>>
  clientId?: string
  formData: Partial<OpticalExam>
  currentClinicId?: number | null
  currentUserId?: number | null
  config: {
    dbType: 'exam' | 'opticlens'
    saveErrorNew: string
    saveErrorNewData: string
    saveSuccessNew: string
    saveSuccessUpdate: string
    sidebarTab: string
  }
  setExam: React.Dispatch<React.SetStateAction<OpticalExam | null>>
  setFormData: React.Dispatch<React.SetStateAction<Partial<OpticalExam>>>
  layoutTabs: LayoutTab[]
  setLayoutTabs: React.Dispatch<React.SetStateAction<LayoutTab[]>>
  activeInstanceId: number | null
  setActiveInstanceId: React.Dispatch<React.SetStateAction<number | null>>
  examFormData: Record<string, any>
  examFormDataByInstance: Record<number | string, Record<string, any>>
  setExamFormDataByInstance: React.Dispatch<React.SetStateAction<Record<number | string, Record<string, any>>>>
  navigate: ReturnType<typeof import('@tanstack/react-router').useNavigate>
  allowNavigationRef: React.MutableRefObject<boolean>
  setBaseline: (override?: {
    formData: Partial<OpticalExam>
    examFormData: Record<string, any>
    examFormDataByInstance: Record<number | string, Record<string, any>>
  }) => void
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>
  onSave?: (exam: OpticalExam, ...examData: any[]) => void
  exam: OpticalExam | null
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export const useExamSave = ({
  isNewMode,
  formRef,
  isSaveInFlight,
  setIsSaveInFlight,
  clientId,
  formData,
  currentClinicId,
  currentUserId,
  config,
  setExam,
  setFormData,
  layoutTabs,
  setLayoutTabs,
  activeInstanceId,
  setActiveInstanceId,
  examFormData,
  examFormDataByInstance,
  setExamFormDataByInstance,
  navigate,
  allowNavigationRef,
  setBaseline,
  setIsEditing,
  onSave,
  exam,
  setExamFormData
}: UseExamSaveParams) => {
  const handleSave = useCallback(async () => {
    if (!formRef.current || isSaveInFlight) return

    setIsSaveInFlight(true)

    try {
      if (isNewMode) {
        setIsEditing(false)
        const examData = {
          client_id: Number(clientId),
          exam_date: formData.exam_date || new Date().toISOString().split('T')[0],
          test_name: formData.test_name || '',
          clinic_id: currentClinicId,
          user_id: formData.user_id || currentUserId,
          dominant_eye: formData.dominant_eye || null,
          type: formData.type || config.dbType
        }

        const newExam = await createExam(examData)

        if (!newExam || !newExam.id) {
          toast.error(config.saveErrorNew)
          setIsEditing(true)
          return
        }

        setExam(newExam)
        setFormData({ ...newExam })
        toast.success(config.saveSuccessNew)
        if (onSave) onSave(newExam)

        const activeTempTab = layoutTabs.find(t => t.isActive)
        if (activeTempTab && activeInstanceId != null && activeTempTab.id === activeInstanceId) {
          setExamFormDataByInstance(prev => ({
            ...prev,
            [activeTempTab.id]: examFormData
          }))
        }

        const tempIdToRealId: Record<number, number> = {}
        try {
          for (const tab of layoutTabs) {
            const instance = await addLayoutToExam(Number(newExam.id), Number(tab.layout_id || 0), tab.isActive)
            if (!instance || instance.id == null) throw new Error('failed to create instance')
            tempIdToRealId[tab.id] = Number(instance.id)
            const dataBucket = examFormDataByInstance[tab.id] || {}
            await examComponentRegistry.saveAllData(Number(instance.id), dataBucket)
          }

          const remappedTabs = layoutTabs.map(tab => ({
            ...tab,
            id: tempIdToRealId[tab.id] !== undefined ? tempIdToRealId[tab.id] : tab.id
          }))
          setLayoutTabs(remappedTabs)

          if (activeTempTab && Object.prototype.hasOwnProperty.call(tempIdToRealId, activeTempTab.id)) {
            const realId = Number(tempIdToRealId[activeTempTab.id])
            setActiveInstanceId(realId)
            setExamFormData(examFormDataByInstance[activeTempTab.id] || {})
          }
        } catch (error) {
          toast.error(config.saveErrorNewData)
          setIsEditing(true)
          return
        }

        setBaseline({
          formData: { ...newExam },
          examFormData,
          examFormDataByInstance
        })
        allowNavigationRef.current = true
        navigate({
          to: "/clients/$clientId",
          params: { clientId: String(clientId) },
          search: { tab: config.sidebarTab }
        })
        setTimeout(() => {
          allowNavigationRef.current = false
        }, 0)
      } else {
        const prevExam = exam
        const optimisticExam = { ...(exam || {}), ...(formData as OpticalExam) } as OpticalExam
        setIsEditing(false)
        if (optimisticExam) {
          setExam(optimisticExam)
          setFormData({ ...optimisticExam })
        }
        const localExamData = { ...examFormData }
        toast.success(config.saveSuccessUpdate)

        try {
          const updatedExam = await updateExam(formData as OpticalExam)

          if (activeInstanceId != null) {
            setExamFormDataByInstance(prev => ({
              ...prev,
              [activeInstanceId]: examFormData
            }))
          }

          for (const tab of layoutTabs) {
            if (tab.id > 0) {
              const bucket = examFormDataByInstance[tab.id] || {}
              await examComponentRegistry.saveAllData(tab.id, bucket)
            }
          }

          if (updatedExam) {
            setExam(updatedExam)
            setFormData({ ...updatedExam })
            if (onSave) onSave(updatedExam, ...Object.values(localExamData))
            setBaseline({
              formData: { ...updatedExam },
              examFormData,
              examFormDataByInstance
            })
          } else {
            throw new Error('update failed')
          }
        } catch (error) {
          toast.error('לא הצלחנו לשמור את השינויים')
          setIsEditing(true)
          if (prevExam) {
            setExam(prevExam)
            setFormData({ ...prevExam })
          }
        }
      }
    } finally {
      setIsSaveInFlight(false)
    }
  }, [
    formRef,
    isSaveInFlight,
    isNewMode,
    setIsSaveInFlight,
    setIsEditing,
    clientId,
    formData,
    currentClinicId,
    currentUserId,
    config,
    setExam,
    setFormData,
    layoutTabs,
    activeInstanceId,
    setActiveInstanceId,
    examFormData,
    examFormDataByInstance,
    setExamFormDataByInstance,
    navigate,
    allowNavigationRef,
    setBaseline,
    onSave,
    exam,
    setExamFormData
  ])

  return { handleSave }
}

