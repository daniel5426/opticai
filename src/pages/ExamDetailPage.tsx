import React, { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useNavigate, Link } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getClientById } from "@/lib/db/clients-db"
import { getExamById, updateExam, createExam } from "@/lib/db/exams-db"
import { OpticalExam, Client, User, ExamLayout, ExamLayoutInstance } from "@/lib/db/schema"
import { getAllExamLayouts, getDefaultExamLayout, getExamLayoutInstancesByExamId, getActiveExamLayoutInstanceByExamId, setActiveExamLayoutInstance, addLayoutToExam, getExamLayoutById, deleteExamLayoutInstance } from "@/lib/db/exam-layouts-db"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, PlusCircleIcon, X as XIcon } from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@/contexts/UserContext"
import { getAllUsers } from "@/lib/db/users-db"
import { ExamCardRenderer, CardItem, DetailProps, calculateCardWidth, hasNoteCard, createDetailProps } from "@/components/exam/ExamCardRenderer"
import { createToolboxActions } from "@/components/exam/ExamToolbox"
import { useClientData } from "@/contexts/ClientDataContext"
import { examComponentRegistry, ExamComponentType } from "@/lib/exam-component-registry"
import { copyToClipboard, pasteFromClipboard, getClipboardContentType } from "@/lib/exam-clipboard"
import { ExamFieldMapper } from "@/lib/exam-field-mappings"
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout"
import { useClientSidebar } from "@/contexts/ClientSidebarContext"

interface ExamDetailPageProps {
  mode?: 'view' | 'edit' | 'new';
  clientId?: string;
  examId?: string;
  onSave?: (exam: OpticalExam, ...examData: any[]) => void;
  onCancel?: () => void;
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

export default function ExamDetailPageRefactored({
  mode = 'view',
  clientId: propClientId,
  examId: propExamId,
  onSave,
  onCancel
}: ExamDetailPageProps = {}) {
  let routeClientId: string | undefined, routeExamId: string | undefined;

  try {
    const params = useParams({ from: "/clients/$clientId/exams/$examId" });
    routeClientId = params.clientId;
    routeExamId = params.examId;
  } catch {
    try {
      const params = useParams({ from: "/clients/$clientId/exams/new" });
      routeClientId = params.clientId;
    } catch {
      routeClientId = undefined;
      routeExamId = undefined;
    }
  }

  const clientId = propClientId || routeClientId
  const examId = propExamId || routeExamId

  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [exam, setExam] = useState<OpticalExam | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [availableLayouts, setAvailableLayouts] = useState<ExamLayout[]>([])
  const [activeLayoutId, setActiveLayoutId] = useState<number | null>(null)
  const [layoutTabs, setLayoutTabs] = useState<LayoutTab[]>([])
  const { currentUser } = useUser()
  
  // Unified state management for all exam components
  const [examComponentData, setExamComponentData] = useState<Record<string, any>>({})
  const [examFormData, setExamFormData] = useState<Record<string, any>>({})
  const [clipboardContentType, setClipboardContentType] = useState<ExamComponentType | null>(null)
  
  // Get the client data context to refresh exams after save
  let refreshExams: (() => Promise<void>) | undefined;
  try {
    const clientDataContext = useClientData();
    refreshExams = clientDataContext.refreshExams;
  } catch {
    refreshExams = undefined;
  }

  const isNewMode = mode === 'new'
  const [isEditing, setIsEditing] = useState(isNewMode)
  const [activeTab, setActiveTab] = useState('exams')

  const [formData, setFormData] = useState<Partial<OpticalExam>>(isNewMode ? {
    client_id: Number(clientId),
    exam_date: new Date().toISOString().split('T')[0],
    test_name: '',
    clinic: '',
    user_id: currentUser?.id,
    notes: '',
    dominant_eye: null
  } : {})

  const [cardRows, setCardRows] = useState<CardRow[]>([
    { id: 'row-1', cards: [{ id: 'exam-details', type: 'exam-details' }] },
    { id: 'row-2', cards: [{ id: 'old-refraction', type: 'old-refraction' }] },
    { id: 'row-3', cards: [{ id: 'objective', type: 'objective' }] },
    { id: 'row-4', cards: [{ id: 'subjective', type: 'subjective' }] },
    { id: 'row-5', cards: [{ id: 'final-subjective', type: 'final-subjective' }] },
    { id: 'row-6', cards: [{ id: 'addition', type: 'addition' }] },
    { id: 'row-7', cards: [{ id: 'notes', type: 'notes' }] }
  ])

  const [customWidths, setCustomWidths] = useState<Record<string, Record<string, number>>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()

  const handleCopy = (card: CardItem) => {
    const cardType = card.type as ExamComponentType
    const cardData = examFormData[cardType]
    
    if (!cardData) {
      toast.error("אין נתונים להעתקה")
      return
    }

    copyToClipboard(cardType, cardData)
    setClipboardContentType(cardType)
    toast.success("הבלוק הועתק", {
      description: `סוג: ${cardType}`,
      duration: 2000,
    })
  }

  const handlePaste = (targetCard: CardItem) => {
    const clipboardContent = pasteFromClipboard()
    if (!clipboardContent) {
      toast.error("אין מידע בלוח ההעתקה")
      return
    }

    const { type: sourceType, data: sourceData } = clipboardContent
    const targetType = targetCard.type as ExamComponentType
    const targetData = examFormData[targetType]
    const targetChangeHandler = fieldHandlers[targetType]

    if (!targetData || !targetChangeHandler) {
      toast.error("לא ניתן להדביק לבלוק זה")
      return
    }

    const isCompatible = sourceType === targetType || ExamFieldMapper.getAvailableTargets(sourceType, [targetType]).includes(targetType)

    if (!isCompatible) {
      toast.error("העתקה לא נתמכת", {
        description: `לא ניתן להעתיק מ'${sourceType}' ל'${targetType}'.`,
      })
      return
    }

    const copiedData = ExamFieldMapper.copyData(sourceData, targetData, sourceType, targetType)

    Object.entries(copiedData).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'layout_instance_id' && value !== undefined) {
        targetChangeHandler(key, String(value ?? ''))
      }
    })

    toast.success("הנתונים הודבקו בהצלחה", {
      description: `מ'${sourceType}' ל'${targetType}'.`,
      duration: 2000,
    })
  }

  // Initialize form data for all registered components
  const initializeFormData = (layoutInstanceId: number) => {
    const initialData: Record<string, any> = {}
    examComponentRegistry.getAllTypes().forEach(type => {
      initialData[type] = { layout_instance_id: layoutInstanceId }
    })
    setExamFormData(initialData)
  }

  // Load all exam component data for a layout instance
  const loadExamComponentData = async (layoutInstanceId: number) => {
    try {
      const data = await examComponentRegistry.loadAllData(layoutInstanceId)
      setExamComponentData(data)
      
      // Update form data with loaded data or empty data with layout_instance_id
      const formData: Record<string, any> = {}
      examComponentRegistry.getAllTypes().forEach(type => {
        formData[type] = data[type] || { layout_instance_id: layoutInstanceId }
      })
      setExamFormData(formData)
    } catch (error) {
      console.error('Error loading exam component data:', error)
    }
  }

  // Create field change handlers for all components
  const createFieldHandlers = () => {
    const handlers: Record<string, (field: string, value: string) => void> = {}
    
    examComponentRegistry.getAllTypes().forEach(type => {
      handlers[type] = examComponentRegistry.createFieldChangeHandler(
        type,
        (updater: (prev: any) => any) => {
          setExamFormData(prev => ({
            ...prev,
            [type]: updater(prev[type] || {})
          }))
        }
      )
    })
    
    return handlers
  }

  const fieldHandlers = createFieldHandlers()
  const toolboxActions = createToolboxActions(examFormData, fieldHandlers)

  const { currentClient } = useClientSidebar()

  useEffect(() => {
    const loadData = async () => {
      if (!clientId) return

      try {
        setLoading(true)

        setClipboardContentType(getClipboardContentType())

        const layoutsData = await getAllExamLayouts()
        setAvailableLayouts(layoutsData)

        if (examId && !isNewMode) {
          const examData = await getExamById(Number(examId))
          setExam(examData || null)

          if (examData) {
            const layoutInstances = await getExamLayoutInstancesByExamId(Number(examId))
            
            if (layoutInstances.length > 0) {
              const activeInstance = await getActiveExamLayoutInstanceByExamId(Number(examId))
              
              const tabs = await Promise.all(layoutInstances.map(async (instance) => {
                const layout = await getExamLayoutById(instance.layout_id)
                return {
                  id: instance.id || 0,
                  layout_id: instance.layout_id,
                  name: layout?.name || '',
                  layout_data: layout?.layout_data || '',
                  isActive: instance.is_active || false
                };
              }));
              
              setLayoutTabs(tabs)
              
              if (activeInstance) {
                setActiveLayoutId(activeInstance.layout_id || 0)
                
                const activeLayout = await getExamLayoutById(activeInstance.layout_id)
                
                if (activeLayout && activeLayout.layout_data && activeInstance.id) {
                  const parsedLayout = JSON.parse(activeLayout.layout_data)
                  if (Array.isArray(parsedLayout)) {
                    setCardRows(parsedLayout)
                    setCustomWidths({})
                  } else {
                    setCardRows(parsedLayout.rows || [])
                    setCustomWidths(parsedLayout.customWidths || {})
                  }
                
                  await loadExamComponentData(activeInstance.id)
                }
              }
            } else {
              let defaultLayout = await getDefaultExamLayout()
              if (!defaultLayout && layoutsData.length > 0) {
                defaultLayout = layoutsData[0]
              }

              if (defaultLayout) {
                const newLayoutInstance = await addLayoutToExam(Number(examId), defaultLayout.id || 1, true)
                
                if (newLayoutInstance) {
                  setActiveLayoutId(defaultLayout.id || 0)
                  setLayoutTabs([{
                    id: newLayoutInstance.id || 0,
                    layout_id: defaultLayout.id || 0,
                    name: defaultLayout.name || '',
                    layout_data: defaultLayout.layout_data || '',
                    isActive: true
                  }])
                  
                  const parsedLayout = JSON.parse(defaultLayout.layout_data)
                  if (Array.isArray(parsedLayout)) {
                    setCardRows(parsedLayout)
                    setCustomWidths({})
                  } else {
                    setCardRows(parsedLayout.rows || [])
                    setCustomWidths(parsedLayout.customWidths || {})
                  }
                  
                  if (newLayoutInstance.id) {
                    await loadExamComponentData(newLayoutInstance.id)
                  }
                }
              }
            }
          }
        } else {
          let defaultLayout = await getDefaultExamLayout()
          if (!defaultLayout && layoutsData.length > 0) {
            defaultLayout = layoutsData[0]
          }

          if (defaultLayout) {
            setActiveLayoutId(defaultLayout.id || 0)
            const parsedLayout = JSON.parse(defaultLayout.layout_data)
            if (Array.isArray(parsedLayout)) {
              setCardRows(parsedLayout)
              setCustomWidths({})
            } else {
              setCardRows(parsedLayout.rows || [])
              setCustomWidths(parsedLayout.customWidths || {})
            }
            
            setLayoutTabs([{
              id: 0,
              layout_id: defaultLayout.id || 0,
              name: defaultLayout.name || '',
              layout_data: defaultLayout.layout_data || '',
              isActive: true
            }])
            
            initializeFormData(defaultLayout.id || 0)
          }
        }

        const usersData = await getAllUsers()
        setUsers(usersData)
      } catch (error) {
        console.error('Error loading exam data:', error)
        toast.error('שגיאה בטעינת נתוני הבדיקה')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [clientId, examId, isNewMode])

  useEffect(() => {
    if (exam) {
      setFormData({ ...exam })
    }
    
    // Update form data when exam component data changes
    examComponentRegistry.getAllTypes().forEach(type => {
      const data = examComponentData[type]
      if (data) {
        setExamFormData(prev => ({ ...prev, [type]: { ...data } }))
    } else if (!isNewMode) {
      const activeLayout = layoutTabs.find(tab => tab.isActive);
      if (activeLayout) {
          setExamFormData(prev => ({ 
            ...prev, 
            [type]: { layout_instance_id: activeLayout.id } 
          }))
        }
      }
    })
  }, [exam, examComponentData, layoutTabs, isNewMode])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (formRef.current) {
      if (isNewMode) {
        const examData = {
          client_id: Number(clientId),
          exam_date: formData.exam_date || new Date().toISOString().split('T')[0],
          test_name: formData.test_name || '',
          clinic: formData.clinic || '',
          user_id: formData.user_id || currentUser?.id,
          notes: formData.notes || '',
          dominant_eye: formData.dominant_eye || null
        }
        
        const newExam = await createExam(examData)

        if (newExam && newExam.id) {
          const activeLayout = layoutTabs.find(tab => tab.isActive) || layoutTabs[0];
          
          if (!activeLayout) {
            toast.error("לא נמצאה פריסה פעילה לבדיקה");
            return;
          }
          
          const layoutInstance = await addLayoutToExam(
            newExam.id, 
            activeLayout.layout_id, 
            true
          );
          
          if (!layoutInstance || !layoutInstance.id) {
            toast.error("שגיאה ביצירת פריסת בדיקה");
            return;
          }
          
          const savedData = await examComponentRegistry.saveAllData(layoutInstance.id, examFormData)
          
          if (Object.values(savedData).some(data => data !== null)) {
            toast.success("בדיקה חדשה נוצרה בהצלחה")
            
            if (refreshExams) {
              await refreshExams();
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (onSave) {
              onSave(newExam, ...Object.values(savedData))
            }
          } else {
            toast.error("לא הצלחנו ליצור את נתוני הבדיקה")
          }
        } else {
          toast.error("לא הצלחנו ליצור את הבדיקה")
        }
      } else {
        const updatedExam = await updateExam(formData as OpticalExam)
        
        const activeLayout = layoutTabs.find(tab => tab.isActive);
        
        if (!activeLayout) {
          toast.error("לא נמצאה פריסה פעילה לבדיקה");
          return;
        }
        
        const setActiveResult = await setActiveExamLayoutInstance(Number(examId), activeLayout.id);
        if (!setActiveResult) {
          toast.error("שגיאה בעדכון פריסה פעילה");
          return;
        }
        
        const savedData = await examComponentRegistry.saveAllData(activeLayout.id, examFormData)

        if (updatedExam && Object.values(savedData).some(data => data !== null)) {
          setIsEditing(false)
          setExam(updatedExam)
          setExamComponentData(savedData)
          setFormData({ ...updatedExam })
          
          toast.success("פרטי הבדיקה עודכנו בהצלחה")
          
          if (refreshExams) {
            await refreshExams();
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (onSave) {
            onSave(updatedExam, ...Object.values(savedData))
          }
        } else {
          toast.error("לא הצלחנו לשמור את השינויים")
        }
      }
    }
  }

  const handleLayoutTabChange = async (tabId: number) => {
    const selectedTab = layoutTabs.find(tab => tab.id === tabId)
    if (!selectedTab) return
    
    try {
      // Load data first if not in new mode
      if (!isNewMode) {
        await loadExamComponentData(selectedTab.id)
      }

      const updatedTabs = layoutTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId
      }))
      
      setLayoutTabs(updatedTabs)
      setActiveLayoutId(selectedTab.layout_id)
      
      const parsedLayout = JSON.parse(selectedTab.layout_data)
      if (Array.isArray(parsedLayout)) {
        setCardRows(parsedLayout)
        setCustomWidths({})
      } else {
        setCardRows(parsedLayout.rows || [])
        setCustomWidths(parsedLayout.customWidths || {})
      }
      
      if (exam && exam.id && !isNewMode) {
        setActiveExamLayoutInstance(exam.id, tabId).catch(error => {
          console.error('Error updating active layout in database:', error)
        })
      }
    } catch (error) {
      console.error('Error changing layout tab:', error)
      toast.error('שגיאה בהחלפת לשונית פריסה')
    }
  }

  const handleAddLayoutTab = async (layoutId: number) => {
    const layoutToAdd = availableLayouts.find(layout => layout.id === layoutId)
    if (!layoutToAdd) return
    
    if (layoutTabs.some(tab => tab.layout_id === layoutId)) {
      toast.info(`הפריסה "${layoutToAdd.name}" כבר קיימת בלשוניות`)
      handleLayoutTabChange(layoutTabs.find(tab => tab.layout_id === layoutId)?.id || 0)
      return
    }
    
    if (exam && exam.id && !isNewMode) {
      const newLayoutInstance = await addLayoutToExam(exam.id, layoutId, true)
      
      if (newLayoutInstance) {
        const updatedTabs = layoutTabs.map(tab => ({ ...tab, isActive: false }))
        
        const newTab = {
          id: newLayoutInstance.id || 0,
          layout_id: layoutId,
          name: layoutToAdd.name || '',
          layout_data: layoutToAdd.layout_data || '',
          isActive: true
        }
        
        setLayoutTabs([...updatedTabs, newTab])
        setActiveLayoutId(layoutId)
        
        const parsedLayout = JSON.parse(layoutToAdd.layout_data)
        if (Array.isArray(parsedLayout)) {
          setCardRows(parsedLayout)
          setCustomWidths({})
        } else {
          setCardRows(parsedLayout.rows || [])
          setCustomWidths(parsedLayout.customWidths || {})
        }
        
        // Load data for the new layout instance
        if (newLayoutInstance && newLayoutInstance.id) {
          await loadExamComponentData(newLayoutInstance.id);
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
      setActiveLayoutId(layoutId)
      
      const parsedLayout = JSON.parse(layoutToAdd.layout_data)
      if (Array.isArray(parsedLayout)) {
        setCardRows(parsedLayout)
        setCustomWidths({})
      } else {
        setCardRows(parsedLayout.rows || [])
        setCustomWidths(parsedLayout.customWidths || {})
      }
      toast.success(`פריסה "${layoutToAdd.name}" הוספה והוחלה`)
    }
  }

  const handleRemoveLayoutTab = async (tabId: number) => {
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
        
        setActiveLayoutId(updatedTabs[newActiveIndex].layout_id);
        
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
  }

  const handleEditButtonClick = () => {
    if (isEditing) {
      handleSave();
    } else {
      if (exam) setFormData({ ...exam });
      
      // Copy current component data to form data for editing
      examComponentRegistry.getAllTypes().forEach(type => {
        const data = examComponentData[type]
        if (data) {
          setExamFormData(prev => ({ ...prev, [type]: { ...data } }))
        }
      })
      
      setIsEditing(true);
    }
  }

  const handleTabChange = (value: string) => {
    if (clientId && value !== 'exams') {
      navigate({
        to: "/clients/$clientId",
        params: { clientId: String(clientId) },
        search: { tab: value }
      })
    }
  }

  // Build detail props dynamically
  const detailProps: DetailProps = createDetailProps(
    isEditing,
    isNewMode,
    exam,
    formData,
    examFormData,
    fieldHandlers,
    handleInputChange,
    handleSelectChange,
    setFormData,
    () => {}, // handleNotesChange
    toolboxActions,
    cardRows.map(row => row.cards),
    {
      handleMultifocalOldRefraction: () => {},
      handleVHConfirmOldRefraction: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => {
        const oldRefractionHandler = fieldHandlers['old-refraction'];
        if (oldRefractionHandler) {
          oldRefractionHandler('r_pris', rightPris.toString());
          oldRefractionHandler('r_base', rightBase.toString());
          oldRefractionHandler('l_pris', leftPris.toString());
          oldRefractionHandler('l_base', leftBase.toString());
        }
      },
      handleVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => {
        const subjectiveHandler = fieldHandlers['subjective'];
        if (subjectiveHandler) {
          subjectiveHandler('r_pris', rightPris.toString());
          subjectiveHandler('r_base', rightBase.toString());
          subjectiveHandler('l_pris', leftPris.toString());
          subjectiveHandler('l_base', leftBase.toString());
        }
      },
      handleMultifocalSubjective: () => {},
      handleFinalSubjectiveVHConfirm: (rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string, leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string) => {
        const finalSubjectiveHandler = fieldHandlers['final-subjective'];
        if (finalSubjectiveHandler) {
          finalSubjectiveHandler('r_pr_h', rightPrisH.toString());
          finalSubjectiveHandler('r_base_h', rightBaseH);
          finalSubjectiveHandler('r_pr_v', rightPrisV.toString());
          finalSubjectiveHandler('r_base_v', rightBaseV);
          finalSubjectiveHandler('l_pr_h', leftPrisH.toString());
          finalSubjectiveHandler('l_base_h', leftBaseH);
          finalSubjectiveHandler('l_pr_v', leftPrisV.toString());
          finalSubjectiveHandler('l_base_v', leftBaseV);
        }
      },
      handleMultifocalOldRefractionExtension: () => {},
    }
  )

  if (loading || !currentClient) {
    return (
      <>
        <SiteHeader
          title="לקוחות"
          backLink="/clients"
          tabs={{ activeTab, onTabChange: handleTabChange }}
        />
      </>
    )
  }

  if (!isNewMode && !exam) {
    return (
      <>
        <SiteHeader
          title="לקוחות"
          backLink="/clients"
          tabs={{ activeTab, onTabChange: handleTabChange }}
        />
              <ClientSpaceLayout>

        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">{isNewMode ? "לקוח לא נמצא" : "בדיקה לא נמצאה"}</h1>
        </div>
        </ClientSpaceLayout>
      </>
    )
  }

  return (
    <>
      <SiteHeader
        title="לקוחות"
        backLink="/clients"
        examInfo={isNewMode ? "בדיקה חדשה" : `בדיקה מס' ${examId}`}
        tabs={{ activeTab, onTabChange: handleTabChange }}
      />
      <ClientSpaceLayout>
        <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10" dir="rtl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{isNewMode ? "בדיקה חדשה" : "פרטי בדיקה"}</h2>
            <div className="flex gap-2">
              {!isNewMode && !isEditing && exam?.id && (
                <Link to="/clients/$clientId/orders/new" params={{ clientId: String(clientId) }} search={{ examId: String(exam.id) }}>
                  <Button variant="outline">יצירת הזמנה</Button>
                </Link>
              )}

              <DropdownMenu dir="rtl">
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1">
                    <span>פריסות</span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="text-sm font-bold" disabled>הוספת פריסה</DropdownMenuItem>
                  {availableLayouts.map((layout) => (
                    <DropdownMenuItem 
                      key={layout.id} 
                      onClick={() => handleAddLayoutTab(layout.id || 0)}
                      className="text-sm"
                    >
                      <PlusCircleIcon className="h-4 w-4 mr-2" />
                      {layout.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {isNewMode && onCancel && (
                <Button variant="outline" onClick={onCancel}>ביטול</Button>
              )}
              <Button
                variant={isEditing ? "outline" : "default"}
                onClick={handleEditButtonClick}
              >
                {isNewMode ? "שמור בדיקה" : (isEditing ? "שמור שינויים" : "ערוך בדיקה")}
              </Button>
            </div>
          </div>

          {/* Layout Tabs */}
          {layoutTabs.length > 0 && (
            <div className="">
              <div className="flex flex-wrap items-center gap-2">
                {layoutTabs.map((tab) => (
                  <div 
                    key={tab.id}
                    className={`
                      group relative rounded-t-xl transition-all duration-200 cursor-pointer overflow-hidden
                      ${tab.isActive 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'hover:bg-muted text-foreground'}
                    `}
                    onClick={() => handleLayoutTabChange(tab.id)}
                  >
                    {layoutTabs.length > 1 && isEditing && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveLayoutTab(tab.id);
                        }}
                        className="absolute top-1 right-1 rounded-full w-[14px] h-[14px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center hover:bg-red-500 hover:text-white z-10"
                        aria-label="הסר לשונית"
                      >
                        <XIcon className="h-2.5 w-2.5" />
                      </button>
                    )}
                    <span className="text-sm py-2 px-5 font-medium whitespace-nowrap block">{tab.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form ref={formRef} className="pt-4">
            <div className="space-y-4" style={{ scrollbarWidth: 'none' }}>
              {cardRows.map((row, rowIndex) => {
                const cardWidths = calculateCardWidth(row.cards, row.id, customWidths)

                return (
                  <div key={row.id} className="w-full">
                      <div className="flex gap-4 flex-1" dir="ltr">
                        {row.cards.map((item, cardIndex) => (
                          <div
                            key={item.id}
                            style={{
                              width: `${cardWidths[item.id]}%`,
                              minWidth: row.cards.length > 1 ? '200px' : 'auto'
                            }}
                          >
                            <ExamCardRenderer
                              item={item}
                              rowCards={row.cards}
                              isEditing={isEditing}
                              mode="detail"
                              detailProps={detailProps}
                              hideEyeLabels={cardIndex > 0}
                              matchHeight={hasNoteCard(row.cards) && row.cards.length > 1}
                              currentRowIndex={rowIndex}
                              currentCardIndex={cardIndex}
                              clipboardSourceType={clipboardContentType}
                              onCopy={() => handleCopy(item)}
                              onPaste={() => handlePaste(item)}
                              onClearData={() => toolboxActions.clearData(item.type as ExamComponentType)}
                              onCopyLeft={() => {
                                const currentRow = row.cards.slice(0, cardIndex).filter(c => c.type !== 'exam-details' && c.type !== 'notes')
                                const availableTargets = ExamFieldMapper.getAvailableTargets(item.type as ExamComponentType, currentRow.map(c => c.type as ExamComponentType))
                                if (availableTargets.length > 0) {
                                  toolboxActions.copyToLeft(item.type as ExamComponentType, availableTargets[0])
                                }
                              }}
                              onCopyRight={() => {
                                const currentRow = row.cards.slice(cardIndex + 1).filter(c => c.type !== 'exam-details' && c.type !== 'notes')
                                const availableTargets = ExamFieldMapper.getAvailableTargets(item.type as ExamComponentType, currentRow.map(c => c.type as ExamComponentType))
                                if (availableTargets.length > 0) {
                                  toolboxActions.copyToRight(item.type as ExamComponentType, availableTargets[0])
                                }
                              }}
                              onCopyBelow={() => {
                                if (rowIndex < cardRows.length - 1) {
                                  const belowRow = cardRows[rowIndex + 1].cards
                                  const availableTargets = ExamFieldMapper.getAvailableTargets(item.type as ExamComponentType, belowRow.map(c => c.type as ExamComponentType))
                                  if (availableTargets.length > 0) {
                                    toolboxActions.copyToBelow(item.type as ExamComponentType, availableTargets[0])
                                  }
                                }
                              }}
                            />
                          </div>
                        ))}
                      </div>
                  </div>
                )
              })}
            </div>
          </form>
        </div>
      </ClientSpaceLayout>
    </>
  )
} 