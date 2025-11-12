import React, { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useNavigate, Link, useLocation, useBlocker } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getExamPageData } from "@/lib/db/exams-db"
import { OpticalExam, ExamLayout } from "@/lib/db/schema-interface"
import { getAllExamLayouts } from "@/lib/db/exam-layouts-db"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, PlusCircleIcon, X as XIcon, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@/contexts/UserContext"
import { ExamCardRenderer, CardItem, DetailProps, calculateCardWidth, hasNoteCard, createDetailProps, getColumnCount, getMaxWidth } from "@/components/exam/ExamCardRenderer"
import { createToolboxActions } from "@/components/exam/ExamToolbox"
import { examComponentRegistry } from "@/lib/exam-component-registry"
import { ExamComponentType } from "@/lib/exam-field-mappings"
import { copyToClipboard, pasteFromClipboard, getClipboardContentType } from "@/lib/exam-clipboard"
import { ExamFieldMapper } from "@/lib/exam-field-mappings"
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout"
import { useClientSidebar } from "@/contexts/ClientSidebarContext"
import { v4 as uuidv4 } from 'uuid';
import { CoverTestExam } from "@/lib/db/schema-interface"
import { apiClient } from '@/lib/api-client';
import { Skeleton } from "@/components/ui/skeleton";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog"
import { useUnsavedChanges } from "@/hooks/shared/useUnsavedChanges"
import { useRowWidthTracking } from "@/hooks/shared/useRowWidthTracking"
import { useCoverTestTabs } from "@/hooks/exam/useCoverTestTabs"
import { useExamFormState } from "@/hooks/exam/useExamFormState"
import { useFullDataLayout } from "@/hooks/exam/useFullDataLayout"
import { useLayoutTabs } from "@/hooks/exam/useLayoutTabs"
import { useExamSave } from "@/hooks/exam/useExamSave"
import { useExamData } from "@/hooks/exam/useExamData"
import { sortKeysDeep } from "@/helpers/examDataUtils"
import { FULL_DATA_NAME } from "@/helpers/fullDataPackingUtils"

interface ExamDetailPageProps {
  mode?: 'view' | 'edit' | 'new';
  clientId?: string;
  examId?: string;
  onSave?: (exam: OpticalExam, ...examData: any[]) => void;
  onCancel?: () => void;
  pageType?: 'exam' | 'contact-lens';
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

const pageConfig = {
  exam: {
    dbType: 'exam' as 'exam' | 'opticlens',
    sidebarTab: 'exams',
    paramName: 'examId',
    newTitle: "בדיקה חדשה",
    detailTitle: "פרטי בדיקה",
    headerInfo: (id: string) => `בדיקה מס' ${id}`,
    saveSuccessNew: "בדיקה חדשה נוצרה בהצלחה",
    saveSuccessUpdate: "פרטי הבדיקה עודכנו בהצלחה",
    saveErrorNew: "לא הצלחנו ליצור את הבדיקה",
    saveErrorNewData: "לא הצלחנו ליצור את נתוני הבדיקה",
  },
  'contact-lens': {
    dbType: 'opticlens' as 'exam' | 'opticlens',
    sidebarTab: 'contact-lenses',
    paramName: 'contactLensId',
    newTitle: "עדשות מגע חדשות",
    detailTitle: "פרטי עדשות מגע",
    headerInfo: (id: string) => `עדשות מגע מס' ${id}`,
    saveSuccessNew: "עדשות מגע חדשות נוצרו בהצלחה",
    saveSuccessUpdate: "פרטי העדשות מגע עודכנו בהצלחה",
    saveErrorNew: "לא הצלחנו ליצור את העדשות מגע",
    saveErrorNewData: "לא הצלחנו ליצור את נתוני העדשות מגע",
  }
};

export default function ExamDetailPage({
  mode = 'view',
  clientId: propClientId,
  examId: propExamId,
  pageType: propPageType,
  onSave,
  onCancel
}: ExamDetailPageProps = {}) {
  const location = useLocation();
  const pageType = propPageType || (location.pathname.includes('/contact-lenses') ? 'contact-lens' : 'exam');
  const config = pageConfig[pageType];

  // Move all useParams calls to the top level, outside of any conditionals
  let routeClientId: string | undefined, routeExamId: string | undefined;
  if (pageType === 'exam') {
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
  } else {
    try {
      const params = useParams({ from: "/clients/$clientId/contact-lenses/$contactLensId" });
      routeClientId = params.clientId;
      routeExamId = params.contactLensId;
    } catch {
      try {
        const params = useParams({ from: "/clients/$clientId/contact-lenses/new" });
        routeClientId = params.clientId;
      } catch {
        routeClientId = undefined;
        routeExamId = undefined;
      }
    }
  }

  const clientId = propClientId || routeClientId
  const examId = propExamId || routeExamId

  const [exam, setExam] = useState<OpticalExam | null>(null)
  const [availableLayouts, setAvailableLayouts] = useState<ExamLayout[]>([])
  const [activeInstanceId, setActiveInstanceId] = useState<number | null>(null)
  const [layoutTabs, setLayoutTabs] = useState<LayoutTab[]>([])
  const { currentUser, currentClinic } = useUser()
  
  // Unified state management for all exam components
  const [examComponentData, setExamComponentData] = useState<Record<string, any>>({})
  const [examFormData, setExamFormData] = useState<Record<string, any>>({})
  const [examFormDataByInstance, setExamFormDataByInstance] = useState<Record<number | string, Record<string, any>>>({})
  const [clipboardContentType, setClipboardContentType] = useState<ExamComponentType | null>(null)
  
  // Get the client data context to refresh exams after save

  const isNewMode = mode === 'new'
  const [isEditing, setIsEditing] = useState(isNewMode)
  const [activeTab, setActiveTab] = useState(config.sidebarTab)

  const [formData, setFormData] = useState<Partial<OpticalExam>>(isNewMode ? {
    client_id: Number(clientId),
    exam_date: new Date().toISOString().split('T')[0],
    test_name: '',
    user_id: currentUser?.id,
    dominant_eye: null,
    type: config.dbType
  } : {})

  const [cardRows, setCardRows] = useState<CardRow[]>([
    { id: 'row-1', cards: [{ id: 'exam-details-1', type: 'exam-details' }] },
    { id: 'row-2', cards: [{ id: 'old-refraction-1', type: 'old-refraction' }] },
    { id: 'row-3', cards: [{ id: 'objective-1', type: 'objective' }] },
    { id: 'row-4', cards: [{ id: 'subjective-1', type: 'subjective' }] },
    { id: 'row-5', cards: [{ id: 'final-subjective-1', type: 'final-subjective' }] },
    { id: 'row-6', cards: [{ id: 'addition-1', type: 'addition' }] },
    { id: 'row-7', cards: [{ id: 'notes-1', type: 'notes' }] }
  ])

  const [customWidths, setCustomWidths] = useState<Record<string, Record<string, number>>>({})
  const latestLoadIdRef = useRef(0)

  const getSerializedState = useCallback(() => JSON.stringify({
    formData: sortKeysDeep(formData),
    examFormData: sortKeysDeep(examFormData),
    examFormDataByInstance: sortKeysDeep(examFormDataByInstance)
  }), [formData, examFormData, examFormDataByInstance])

  const {
    hasUnsavedChanges,
    showUnsavedDialog,
    isSaveInFlight,
    setIsSaveInFlight,
    handleNavigationAttempt,
    handleUnsavedConfirm,
    handleUnsavedCancel,
    setBaseline,
    baselineInitializedRef,
    allowNavigationRef
  } = useUnsavedChanges({
    getSerializedState,
    isEditing,
    isNewMode
  })

  const { rowWidths, rowRefs } = useRowWidthTracking(cardRows, [activeInstanceId, layoutTabs])

  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    baselineInitializedRef.current = false
  }, [clientId, examId, isNewMode])

  const handleCopy = (card: CardItem) => {
    const cardType = card.type as ExamComponentType
    let cardData, key
    if (cardType === 'cover-test') {
      const cardId = card.id
      const activeTabIndex = activeCoverTestTabs[cardId]
      const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex]
      key = `cover-test-${cardId}-${activeTabId}`
      cardData = examFormData[key]
    } else {
      cardData = examFormData[cardType]
      key = undefined
    }
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
    let targetData: any, targetChangeHandler: ((field: string, value: string) => void) | undefined, key: string | undefined
    if (targetType === 'cover-test') {
      const cardId = targetCard.id
      const activeTabIndex = activeCoverTestTabs[cardId]
      const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex]
      key = `cover-test-${cardId}-${activeTabId}`
      targetData = examFormData[key]
      targetChangeHandler = fieldHandlers[key]
    } else {
      targetData = examFormData[targetType]
      targetChangeHandler = fieldHandlers[targetType]
      key = undefined
    }
    console.log('Target data:', targetData)
    console.log('Target change handler:', targetChangeHandler)
    if (!targetData || !targetChangeHandler) {
      toast.error("לא ניתן להדביק לבלוק זה")
      return
    }
    const fieldMapper = new ExamFieldMapper()
    const isCompatible = sourceType === targetType || ExamFieldMapper.getAvailableTargets(sourceType, [targetType]).includes(targetType)
    if (!isCompatible) {
      toast.error("העתקה לא נתמכת", {
        description: `לא ניתן להעתיק מ'${sourceType}' ל'${targetType}'.`,
      })
      return
    }
    const copiedData = ExamFieldMapper.copyData(sourceData as any, targetData as any, sourceType, targetType)
    console.log('Copied data:', copiedData)
    Object.entries(copiedData).forEach(([k, value]) => {
      if (k !== 'id' && k !== 'layout_instance_id' && value !== undefined && targetChangeHandler) {
        targetChangeHandler(k, String(value ?? '') )
      }
    })
    toast.success("הנתונים הודבקו בהצלחה", {
      description: `מ'${sourceType}' ל'${targetType}'.`,
      duration: 2000,
    })
  }

  // Initialize form data for all registered components
  const initializeFormData = (instanceKey: number, layoutData?: string) => {
    const initialData: Record<string, any> = {}
    
    // Parse layout data to get titles and card instances
    const layoutTitles: Record<string, string> = {}
    const cardInstances: Record<string, string[]> = {}
    if (layoutData) {
      try {
        const parsedLayout = JSON.parse(layoutData)
        const rows = Array.isArray(parsedLayout) ? parsedLayout : parsedLayout.rows || []
        
        rows.forEach((row: any) => {
          row.cards?.forEach((card: any) => {
            if (card.title) {
              layoutTitles[card.id] = card.title
            }
            // Collect card instances for each type
            if (!cardInstances[card.type]) {
              cardInstances[card.type] = []
            }
            cardInstances[card.type].push(card.id)
          })
        })
      } catch (error) {
        console.error('Error parsing layout data:', error)
      }
    }
    
    examComponentRegistry.getAllTypes().forEach(type => {
      const baseData: any = { layout_instance_id: instanceKey }
      
      // For notes, create separate data for each card instance
      if (type === 'notes' && cardInstances[type]) {
        cardInstances[type].forEach(cardId => {
           const instanceData = { ...baseData, card_instance_id: cardId }
          // Add title from layout if available for this specific card
          if (layoutTitles[cardId]) {
            instanceData.title = layoutTitles[cardId]
          }
          initialData[`${type}-${cardId}`] = instanceData
        })
      } else {
        // For other components, add title from layout if available
        if (type === 'corneal-topography' && cardInstances[type] && cardInstances[type].length > 0) {
          const cardId = cardInstances[type][0]
          if (layoutTitles[cardId]) {
            baseData.title = layoutTitles[cardId]
          }
        }
        initialData[type] = baseData
      }
    })
    
    setExamFormData(initialData)
    setExamFormDataByInstance(prev => ({ ...prev, [instanceKey]: initialData }))
  }

  // Load all exam component data for a layout instance
  const loadExamComponentData = async (layoutInstanceId: number, layoutData?: string, setCurrent: boolean = false) => {
    try {
      const data = await examComponentRegistry.loadAllData(layoutInstanceId)
      setExamComponentData(data)
      
      // Parse layout data to get titles and card instances
      const layoutTitles: Record<string, string> = {}
      const cardInstances: Record<string, string[]> = {}
      if (layoutData) {
        try {
          const parsedLayout = JSON.parse(layoutData)
          const rows = Array.isArray(parsedLayout) ? parsedLayout : parsedLayout.rows || []
          
          rows.forEach((row: any) => {
            row.cards?.forEach((card: any) => {
              if (card.title) {
                layoutTitles[card.id] = card.title
              }
              // Collect card instances for each type
              if (!cardInstances[card.type]) {
                cardInstances[card.type] = []
              }
              cardInstances[card.type].push(card.id)
            })
          })
        } catch (error) {
          console.error('Error parsing layout data:', error)
        }
      }
      
      // No explicit tab state; tabs are derived from keys in data
      
      // Update form data with loaded data or empty data with layout_instance_id
      const formData: Record<string, any> = {}
      examComponentRegistry.getAllTypes().forEach(type => {
        if (type === 'notes' && cardInstances[type]) {
          // For notes, handle each card instance separately
          cardInstances[type].forEach(cardId => {
            const existingData: any = data[`${type}-${cardId}`] || { layout_instance_id: layoutInstanceId, card_instance_id: cardId }
            
            // Add title from layout if not already present in data
            if (layoutTitles[cardId] && !existingData.title) {
              existingData.title = layoutTitles[cardId]
            }
            
            formData[`${type}-${cardId}`] = existingData
          })
        } else if (type === 'cover-test' && cardInstances[type]) {
          // For cover-test, include all tab keys found in loaded data for each card instance
          cardInstances[type].forEach(cardId => {
            Object.keys(data).forEach(k => {
              if (k.startsWith(`cover-test-${cardId}-`)) {
                formData[k] = (data as any)[k]
              }
            })
          })
        } else {
          const existingData: any = data[type] || { layout_instance_id: layoutInstanceId }
          // Add title from layout if not already present in data
          if (type === 'corneal-topography' && cardInstances[type] && cardInstances[type].length > 0) {
            const cardId = cardInstances[type][0]
            if (layoutTitles[cardId] && !existingData.title) {
              existingData.title = layoutTitles[cardId]
            }
          }
          formData[type] = existingData
        }
      })
      setExamFormDataByInstance(prev => ({ ...prev, [layoutInstanceId]: formData }))
      if (setCurrent || activeInstanceId === layoutInstanceId) {
        setExamFormData(formData)
      }
    } catch (error) {
      console.error('Error loading exam component data:', error)
    }
  }

  const {
    handleAddFullDataTab,
    handleRegenerateFullData,
    buildFullDataBucket
  } = useFullDataLayout({
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
  })

  const loading = useExamData({
    clientId,
    examId,
    isNewMode,
    dbType: config.dbType,
    currentClinicId: currentClinic?.id,
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
  })

  const {
    handleLayoutTabChange,
    handleAddLayoutTab,
    handleRemoveLayoutTab
  } = useLayoutTabs({
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
  })

  const {
    activeCoverTestTabs,
    setActiveCoverTestTabs,
    computedCoverTestTabs,
    addCoverTestTab,
    removeCoverTestTab
  } = useCoverTestTabs(cardRows, examFormData, setExamFormData, activeInstanceId, loading)

  const { handleSave } = useExamSave({
    isNewMode,
    formRef,
    isSaveInFlight,
    setIsSaveInFlight,
    clientId,
    formData,
    currentClinicId: currentClinic?.id,
    currentUserId: currentUser?.id,
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
  })

  const { fieldHandlers } = useExamFormState(
    cardRows,
    examFormData,
    setExamFormData,
    examFormDataByInstance,
    setExamFormDataByInstance,
    activeInstanceId,
    computedCoverTestTabs
  )
  
  const toolboxActions = createToolboxActions(examFormData, fieldHandlers)

  const { currentClient, setActiveTab: setSidebarActiveTab } = useClientSidebar()

  // Set the active tab to 'exams' when this page loads
  useEffect(() => {
    setSidebarActiveTab(config.sidebarTab)
  }, [setSidebarActiveTab, config.sidebarTab])

  useEffect(() => {
    if (!loading && !baselineInitializedRef.current) {
      const timer = setTimeout(() => {
        setBaseline()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [loading, setBaseline])

  useEffect(() => {
    const prefetch = async () => {
      const types = ['old-refraction','objective','subjective','final-subjective','addition','notes','final-prescription'] as const
      await Promise.all(types.map(t => {
        const cfg = examComponentRegistry.get(t as any)
        return cfg?.component ? cfg.component().catch(() => null) : Promise.resolve(null)
      }))
    }
    prefetch()
  }, [])

  useEffect(() => {
    if (exam) setFormData({ ...exam })
  }, [exam])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }


  const handleEditButtonClick = () => {
    if (isEditing) {
      handleSave();
    } else {
      setIsEditing(true);
      setTimeout(() => {
        setBaseline();
      }, 0);
    }
  }

  const handleTabChange = (value: string) => {
    if (clientId && value !== config.sidebarTab) {
      handleNavigationAttempt(() => {
        navigate({
          to: "/clients/$clientId",
          params: { clientId: String(clientId) },
          search: { tab: value }
        })
      })
    }
  }

  // Build detail props dynamically
  const detailProps = createDetailProps(
    isEditing,
    isNewMode,
    exam,
    formData,
    examFormData,
    fieldHandlers,
    handleInputChange,
    handleSelectChange,
    setFormData,
    (value: string) => {},
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
      // Add tab management for cover-test
      coverTestTabs: computedCoverTestTabs as any,
      activeCoverTestTabs: activeCoverTestTabs as any,
      setActiveCoverTestTabs: setActiveCoverTestTabs as any,
      addCoverTestTab: addCoverTestTab as any,
      removeCoverTestTab: removeCoverTestTab as any,
      layoutInstanceId: activeInstanceId,
      setExamFormData: setExamFormData,
    } as any
  )

  if (loading || !currentClient) {
    return (
      <>
        <SiteHeader
          title="לקוחות"
          backLink="/clients"
          tabs={{ activeTab, onTabChange: handleTabChange }}
        />
        <ClientSpaceLayout>
          <div className="flex flex-col flex-1 p-4 lg:p-5 mb-10 no-scrollbar" dir="rtl" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{config.detailTitle}</h2>
              <div className="flex gap-2">
                <Button variant="outline" disabled>יצירת הזמנה</Button>
                <DropdownMenu >
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-1" onClick={async () => {
                      if (availableLayouts.length === 0 && currentClinic?.id) {
                        const res = await apiClient.getExamLayouts(currentClinic.id)
                        if (!res.error) setAvailableLayouts((res.data || []) as any)
                      }
                    }}>
                      <span>פריסות</span>
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem dir="rtl" className="text-sm font-bold" disabled>הוספת פריסה</DropdownMenuItem>
                    {availableLayouts.length === 0 ? (
                      <DropdownMenuItem disabled className="text-sm">טוען...</DropdownMenuItem>
                    ) : (
                      availableLayouts.map((layout) => (
                        <DropdownMenuItem dir="rtl"
                          key={layout.id} 
                          onClick={() => handleAddLayoutTab(layout.id || 0)}
                          className="text-sm"
                        >
                          <PlusCircleIcon className="h-4 w-4 mr-2" />
                          {layout.name}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {isNewMode && onCancel && (
                  <Button variant="outline" onClick={onCancel} disabled>ביטול</Button>
                )}
                <Button
                  variant={isEditing ? "outline" : "default"}
                  disabled
                >
                  {isNewMode ? "שמור בדיקה" : (isEditing ? "שמור שינויים" : "ערוך בדיקה")}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-8 w-20 rounded-xl" />
              <Skeleton className="h-8 w-24 rounded-xl" />
              <Skeleton className="h-8 w-28 rounded-xl" />
            </div>

            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="w-full">
                  <div className="flex gap-4" dir="ltr">
                    <Skeleton className="h-40 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ClientSpaceLayout>
      </>
    )
  }

  if (!isNewMode && !loading && !exam) {
    return (
      <>
        <SiteHeader
          title="לקוחות"
          backLink="/clients"
          tabs={{ activeTab, onTabChange: handleTabChange }}
        />
        <ClientSpaceLayout>
          <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl">בדיקה לא נמצאה</h1>
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
        examInfo={isNewMode ? config.newTitle : config.headerInfo(examId || '')}
        tabs={{ activeTab, onTabChange: handleTabChange }}
      />
      <ClientSpaceLayout>
        <div className="flex flex-col flex-1 p-4  lg:p-5 mb-10 no-scrollbar" dir="rtl" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{isNewMode ? config.newTitle : config.detailTitle}</h2>
            <div className="flex gap-2">
              {!isNewMode && !isEditing && exam?.id && (
                <Link
                  to="/clients/$clientId/orders/new"
                  params={{ clientId: String(clientId) }}
                  search={{ examId: String(exam.id) }}
                  onClick={(e) => {
                    if (!hasUnsavedChanges) return
                    e.preventDefault()
                    handleNavigationAttempt(() => {
                      navigate({
                        to: "/clients/$clientId/orders/new",
                        params: { clientId: String(clientId) },
                        search: { examId: String(exam.id) }
                      })
                    })
                  }}
                >
                  <Button variant="outline">יצירת הזמנה</Button>
                </Link>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1" onClick={async () => {
                    if (availableLayouts.length === 0 && currentClinic?.id) {
                      const res = await apiClient.getExamLayouts(currentClinic.id)
                      if (!res.error) setAvailableLayouts((res.data || []) as any)
                    }
                  }}>
                    <span>פריסות</span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem dir="rtl" className="text-sm font-bold" disabled>הוספת פריסה</DropdownMenuItem>
                  <DropdownMenuItem dir="rtl"
                    className="text-sm"
                    onClick={(e) => {
                        e.preventDefault();
                        handleAddFullDataTab();
                      }}
                    >
                      <PlusCircleIcon className="h-4 w-4 mr-2" />
                      Full data
                    </DropdownMenuItem>
                    {availableLayouts
                      .filter(layout => layout.name !== FULL_DATA_NAME)
                      .map((layout) => (
                        <DropdownMenuItem dir="rtl"
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
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault()
                    handleNavigationAttempt(() => {
                      if (onCancel) onCancel()
                    })
                  }}
                >
                  ביטול
                </Button>
              )}
              <Button
                variant={isEditing ? "outline" : "default"}
                onClick={handleEditButtonClick}
                title={layoutTabs.find(t => t.isActive)?.name === FULL_DATA_NAME ? 'פריסת Full data היא לתצוגה בלבד' : undefined}
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
                    <span className="text-sm py-2 px-5 font-medium whitespace-nowrap flex items-center gap-2">
                      {tab.name}
                      {tab.isActive && tab.name === FULL_DATA_NAME && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRegenerateFullData();
                          }}
                          className="rounded-full w-[18px] h-[18px] flex items-center justify-center hover:bg-primary-foreground/20"
                          aria-label="רענן Full data"
                          title="רענן"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form ref={formRef} className="pt-4">
            <div className="space-y-4 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {cardRows.map((row, rowIndex) => {
                const pxPerCol = rowWidths[row.id] || 1380
                const cardWidths = calculateCardWidth(row.cards, row.id, customWidths, pxPerCol, 'detail')
                return (
                  <div key={row.id} className="w-full">
                      <div
                        className="flex gap-4 flex-1"
                        dir="ltr"
                        ref={el => { rowRefs.current[row.id] = el }}
                      >
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
                              isEditing={isEditing && layoutTabs.find(t => t.isActive)?.name !== FULL_DATA_NAME}
                              mode="detail"
                              detailProps={{
                                ...detailProps,
                                isEditing: (layoutTabs.find(t => t.isActive)?.name !== FULL_DATA_NAME) && (detailProps as any)?.isEditing,
                                coverTestTabs: computedCoverTestTabs,
                              }}
                              hideEyeLabels={cardIndex > 0}
                              matchHeight={hasNoteCard(row.cards) && row.cards.length > 1}
                              currentRowIndex={rowIndex}
                              currentCardIndex={cardIndex}
                              clipboardSourceType={clipboardContentType}
                              onCopy={() => handleCopy(item)}
                              onPaste={() => handlePaste(item)}
                              onClearData={() => {
                                if (item.type === 'cover-test') {
                                  const cardId = item.id
                                  const activeTabIndex = activeCoverTestTabs[cardId]
                                  const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex]
                                  if (activeTabId) {
                                    const key = `cover-test-${cardId}-${activeTabId}`
                                    setExamFormData(prev => ({
                                      ...prev,
                                      [key]: {
                                        ...prev[key],
                                        deviation_type: '',
                                        deviation_direction: '',
                                        fv_1: '',
                                        fv_2: '',
                                        nv_1: '',
                                        nv_2: '',
                                        __deleted: true
                                      }
                                    }))
                                    toolboxActions.clearData(item.type as ExamComponentType, key)
                                  }
                                } else {
                                  toolboxActions.clearData(item.type as ExamComponentType)
                                }
                              }}
                              onCopyLeft={() => {
                                const cardsToTheLeft = row.cards.slice(0, cardIndex).reverse()
                                for (const card of cardsToTheLeft) {
                                  if (card.type !== 'exam-details' && card.type !== 'notes') {
                                    const type = card.type as ExamComponentType
                                    const available = ExamFieldMapper.getAvailableTargets(item.type as ExamComponentType, [type])
                                    if (available.length > 0) {
                                      // --- FIX: handle cover-test keys ---
                                      let sourceKey, targetKey
                                      if (item.type === 'cover-test') {
                                        const cardId = item.id
                                        const activeTabIndex = activeCoverTestTabs[cardId]
                                        const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex]
                                        sourceKey = `cover-test-${cardId}-${activeTabId}`
                                      }
                                      if (card.type === 'cover-test') {
                                        const cardId = card.id
                                        const activeTabIndex = activeCoverTestTabs[cardId]
                                        const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex]
                                        targetKey = `cover-test-${cardId}-${activeTabId}`
                                      }
                                      toolboxActions.copyToLeft(item.type as ExamComponentType, type, sourceKey, targetKey)
                                      return
                                    }
                                  }
                                }
                              }}
                              onCopyRight={() => {
                                const cardsToTheRight = row.cards.slice(cardIndex + 1)
                                for (const card of cardsToTheRight) {
                                  if (card.type !== 'exam-details' && card.type !== 'notes') {
                                    const type = card.type as ExamComponentType
                                    const available = ExamFieldMapper.getAvailableTargets(item.type as ExamComponentType, [type])
                                    if (available.length > 0) {
                                      // --- FIX: handle cover-test keys ---
                                      let sourceKey, targetKey
                                      if (item.type === 'cover-test') {
                                        const cardId = item.id
                                        const activeTabIndex = activeCoverTestTabs[cardId]
                                        const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex]
                                        sourceKey = `cover-test-${cardId}-${activeTabId}`
                                      }
                                      if (card.type === 'cover-test') {
                                        const cardId = card.id
                                        const activeTabIndex = activeCoverTestTabs[cardId]
                                        const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex]
                                        targetKey = `cover-test-${cardId}-${activeTabId}`
                                      }
                                      toolboxActions.copyToRight(item.type as ExamComponentType, type, sourceKey, targetKey)
                                      return
                                    }
                                  }
                                }
                              }}
                              onCopyBelow={() => {
                                if (rowIndex >= cardRows.length - 1) return
                                const belowRow = cardRows[rowIndex + 1].cards
                                for (const card of belowRow) {
                                  if (card.type !== 'exam-details' && card.type !== 'notes') {
                                    const type = card.type as ExamComponentType
                                    const available = ExamFieldMapper.getAvailableTargets(item.type as ExamComponentType, [type])
                                    if (available.length > 0) {
                                      // --- FIX: handle cover-test keys ---
                                      let sourceKey, targetKey
                                      if (item.type === 'cover-test') {
                                        const cardId = item.id
                                        const activeTabIndex = activeCoverTestTabs[cardId]
                                        const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex]
                                        sourceKey = `cover-test-${cardId}-${activeTabId}`
                                      }
                                      if (card.type === 'cover-test') {
                                        const cardId = card.id
                                        const activeTabIndex = activeCoverTestTabs[cardId]
                                        const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex]
                                        targetKey = `cover-test-${cardId}-${activeTabId}`
                                      }
                                      toolboxActions.copyToBelow(item.type as ExamComponentType, type, sourceKey, targetKey)
                                      return
                                    }
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
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onConfirm={handleUnsavedConfirm}
        onCancel={handleUnsavedCancel}
      />
    </>
  )
} 