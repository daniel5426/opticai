import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react"
import { useParams, useNavigate, Link, useLocation } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getClientById } from "@/lib/db/clients-db"
import { getExamById, updateExam, createExam } from "@/lib/db/exams-db"
import { OpticalExam, Client, User, ExamLayout, ExamLayoutInstance, NotesExam } from "@/lib/db/schema"
import { getAllExamLayouts, getDefaultExamLayout, getDefaultExamLayouts, getDefaultExamLayoutsByType, getExamLayoutInstancesByExamId, getActiveExamLayoutInstanceByExamId, setActiveExamLayoutInstance, addLayoutToExam, getExamLayoutById, deleteExamLayoutInstance } from "@/lib/db/exam-layouts-db"
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
import { v4 as uuidv4 } from 'uuid';
import { CoverTestExam } from "@/lib/db/schema"

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
  const [activeTab, setActiveTab] = useState(config.sidebarTab)

  const [formData, setFormData] = useState<Partial<OpticalExam>>(isNewMode ? {
    client_id: Number(clientId),
    exam_date: new Date().toISOString().split('T')[0],
    test_name: '',
    clinic: '',
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
  // Track row widths for responsive fixedPx calculation
  const [rowWidths, setRowWidths] = useState<Record<string, number>>({})
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [coverTestTabs, setCoverTestTabs] = useState<Record<string, string[]>>({})
  const [activeCoverTestTabs, setActiveCoverTestTabs] = useState<Record<string, number>>({})


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
    setTimeout(() => {
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
      }, 100)
    return () => {
      observers.forEach(o => o.disconnect())
    }
  }, [cardRows, activeLayoutId, layoutTabs])
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()

  const handleCopy = (card: CardItem) => {
    const cardType = card.type as ExamComponentType
    let cardData, key
    if (cardType === 'cover-test') {
      const cardId = card.id
      const activeTabIndex = activeCoverTestTabs[cardId]
      const activeTabId = coverTestTabs[cardId]?.[activeTabIndex]
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
    let targetData, targetChangeHandler, key
    if (targetType === 'cover-test') {
      const cardId = targetCard.id
      const activeTabIndex = activeCoverTestTabs[cardId]
      const activeTabId = coverTestTabs[cardId]?.[activeTabIndex]
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
    const copiedData = ExamFieldMapper.copyData(sourceData, targetData, sourceType, targetType)
    console.log('Copied data:', copiedData)
    Object.entries(copiedData).forEach(([k, value]) => {
      if (k !== 'id' && k !== 'layout_instance_id' && value !== undefined) {
        targetChangeHandler(k, String(value ?? ''))
      }
    })
    toast.success("הנתונים הודבקו בהצלחה", {
      description: `מ'${sourceType}' ל'${targetType}'.`,
      duration: 2000,
    })
  }

  // Initialize form data for all registered components
  const initializeFormData = (layoutInstanceId: number, layoutData?: string) => {
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
      const baseData: any = { layout_instance_id: layoutInstanceId }
      
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
  }

  // Load all exam component data for a layout instance
  const loadExamComponentData = async (layoutInstanceId: number, layoutData?: string) => {
    try {
      const data = await examComponentRegistry.loadAllData(layoutInstanceId, coverTestTabs)
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
      
      // New: Build coverTestTabs and examFormData directly from DB data
      const coverTestTabsFromDb: { [cardId: string]: string[] } = {}
      const coverTestRows: any[] = []
      Object.entries(data).forEach(([key, value]) => {
        if (key.startsWith('cover-test-') && value && typeof value === 'object') {
          coverTestRows.push(value)
        }
      })
      // Group by card_id
      const tabsByCard: { [cardId: string]: { tabId: string, tabIndex: number }[] } = {}
      coverTestRows.forEach(row => {
        if (!row.card_id || !row.card_instance_id) return;
        if (!tabsByCard[row.card_id]) tabsByCard[row.card_id] = [];
        tabsByCard[row.card_id].push({ tabId: row.card_instance_id, tabIndex: row.tab_index ?? 0 });
      })
      Object.entries(tabsByCard).forEach(([cardId, tabs]) => {
        tabs.sort((a, b) => a.tabIndex - b.tabIndex);
        coverTestTabsFromDb[cardId] = tabs.map(t => t.tabId);
      })
      // If no DB data, fall back to layout (for new exams)
      if (Object.keys(coverTestTabsFromDb).length === 0 && cardInstances['cover-test']) {
        cardInstances['cover-test'].forEach(cardId => {
          coverTestTabsFromDb[cardId] = [window.crypto?.randomUUID?.() || uuidv4()]
        })
      }
      setCoverTestTabs(coverTestTabsFromDb)
      
      // Initialize active tabs for cover tests
      const initialActiveTabs: Record<string, number> = {}
      Object.keys(coverTestTabsFromDb).forEach(cardId => {
        initialActiveTabs[cardId] = 0
      })
      setActiveCoverTestTabs(initialActiveTabs)
      
      // Update form data with loaded data or empty data with layout_instance_id
      const formData: Record<string, any> = {}
      examComponentRegistry.getAllTypes().forEach(type => {
        if (type === 'notes' && cardInstances[type]) {
          // For notes, handle each card instance separately
          cardInstances[type].forEach(cardId => {
            const existingData = data[`${type}-${cardId}`] || { layout_instance_id: layoutInstanceId, card_instance_id: cardId }
            
            // Add title from layout if not already present in data
            if (layoutTitles[cardId] && !existingData.title) {
              existingData.title = layoutTitles[cardId]
            }
            
            formData[`${type}-${cardId}`] = existingData
          })
        } else if (type === 'cover-test' && cardInstances[type]) {
          // For cover-test, handle each card instance and tab
          cardInstances[type].forEach(cardId => {
            const tabIds = coverTestTabsFromDb[cardId] || []
            tabIds.forEach(tabId => {
              const key = `cover-test-${cardId}-${tabId}`
              // Always use the full DB row if present, including id
              if (data[key]) {
                formData[key] = data[key]
              } else {
                formData[key] = { layout_instance_id: layoutInstanceId, card_instance_id: tabId }
              }
            })
          })
        } else {
          const existingData = data[type] || { layout_instance_id: layoutInstanceId }
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

    // Create field handlers for notes card instances
    if (cardRows) {
      cardRows.forEach(row => {
        row.cards.forEach(card => {
          if (card.type === 'notes') {
            const key = `notes-${card.id}`
            handlers[key] = (field: string, value: string) => {
              setExamFormData(prev => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  [field]: value
                }
              }))
            }
          }
          if (card.type === 'cover-test') {
            const cardId = card.id
            const tabIds = coverTestTabs[cardId] || []
            tabIds.forEach(tabId => {
              const key = `cover-test-${cardId}-${tabId}`
              handlers[key] = (field, value) => {
                setExamFormData(prev => {
                  const tabIndex = (coverTestTabs[cardId] || []).indexOf(tabId)
                  return {
                    ...prev,
                    [key]: {
                      ...prev[key],
                      [field]: value,
                      card_instance_id: tabId,
                      card_id: cardId,
                      tab_index: tabIndex
                    }
                  }
                })
              }
            })
          }
        })
      })
    }
    
    return handlers
  }

  const fieldHandlers = createFieldHandlers()
  const toolboxActions = createToolboxActions(examFormData, fieldHandlers)

  const { currentClient, setActiveTab: setSidebarActiveTab } = useClientSidebar()

  // Set the active tab to 'exams' when this page loads
  useEffect(() => {
    setSidebarActiveTab(config.sidebarTab)
  }, [setSidebarActiveTab, config.sidebarTab])

  useEffect(() => {
    const loadData = async () => {
      if (!clientId) return

      try {
        setLoading(true)

        setClipboardContentType(getClipboardContentType())

        const layoutsData = await getAllExamLayouts()
        setAvailableLayouts(layoutsData.filter(layout => layout.type === config.dbType))

        if (examId && !isNewMode) {
          const examData = await getExamById(Number(examId))
          setExam(examData || null)

          if (examData) {
            const examType = examData.type || config.dbType
            const filteredLayouts = layoutsData.filter(layout => layout.type === examType)
            setAvailableLayouts(filteredLayouts)
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
                
                  await loadExamComponentData(activeInstance.id, activeLayout.layout_data)
                }
              }
            } else {
              let defaultLayouts = await getDefaultExamLayoutsByType(config.dbType)
              if (defaultLayouts.length === 0) {
                // Fallback to any exam type layouts if no defaults found
                const examTypeLayouts = layoutsData.filter(layout => layout.type === config.dbType)
                if (examTypeLayouts.length > 0) {
                  defaultLayouts = [examTypeLayouts[0]]
                }
              }

              if (defaultLayouts.length > 0) {
                const layoutTabsData: LayoutTab[] = []
                let firstLayoutInstance: any = null

                for (let i = 0; i < defaultLayouts.length; i++) {
                  const defaultLayout = defaultLayouts[i]
                  const newLayoutInstance = await addLayoutToExam(Number(examId), defaultLayout.id || 1, i === 0)
                  
                  if (newLayoutInstance) {
                    if (i === 0) {
                      firstLayoutInstance = newLayoutInstance
                      setActiveLayoutId(defaultLayout.id || 0)
                      
                      const parsedLayout = JSON.parse(defaultLayout.layout_data)
                      if (Array.isArray(parsedLayout)) {
                        setCardRows(parsedLayout)
                        setCustomWidths({})
                      } else {
                        setCardRows(parsedLayout.rows || [])
                        setCustomWidths(parsedLayout.customWidths || {})
                      }
                      
                      if (newLayoutInstance.id) {
                        await loadExamComponentData(newLayoutInstance.id, defaultLayout.layout_data)
                      }
                    }

                    layoutTabsData.push({
                      id: newLayoutInstance.id || 0,
                      layout_id: defaultLayout.id || 0,
                      name: defaultLayout.name || '',
                      layout_data: defaultLayout.layout_data || '',
                      isActive: i === 0
                    })
                  }
                }

                setLayoutTabs(layoutTabsData)
              }
            }
          }
        } else {
          let defaultLayouts = await getDefaultExamLayoutsByType(config.dbType)
          if (defaultLayouts.length === 0) {
            // Fallback to any exam type layouts if no defaults found
            const examTypeLayouts = layoutsData.filter(layout => layout.type === config.dbType)
            if (examTypeLayouts.length > 0) {
              defaultLayouts = [examTypeLayouts[0]]
            }
          }

          if (defaultLayouts.length > 0) {
            const layoutTabsData: LayoutTab[] = []

            for (let i = 0; i < defaultLayouts.length; i++) {
              const defaultLayout = defaultLayouts[i]
              
              if (i === 0) {
                setActiveLayoutId(defaultLayout.id || 0)
                const parsedLayout = JSON.parse(defaultLayout.layout_data)
                if (Array.isArray(parsedLayout)) {
                  setCardRows(parsedLayout)
                  setCustomWidths({})
                } else {
                  setCardRows(parsedLayout.rows || [])
                  setCustomWidths(parsedLayout.customWidths || {})
                }
                
                initializeFormData(defaultLayout.id || 0, defaultLayout.layout_data)
              }

              layoutTabsData.push({
                id: -Date.now() - i,
                layout_id: defaultLayout.id || 0,
                name: defaultLayout.name || '',
                layout_data: defaultLayout.layout_data || '',
                isActive: i === 0
              })
            }

            setLayoutTabs(layoutTabsData)
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
  }, [clientId, examId, isNewMode, config.dbType])

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

  // On layout load, initialize coverTestTabs for each cover-test card
  useEffect(() => {
    const newTabs: { [cardId: string]: string[] } = {}
    cardRows.forEach(row => {
      row.cards.forEach(card => {
        if (card.type === 'cover-test') {
          if (!coverTestTabs[card.id]) {
            newTabs[card.id] = [uuidv4()]
          } else {
            newTabs[card.id] = coverTestTabs[card.id]
          }
        }
      })
    })
    setCoverTestTabs(newTabs)
    // eslint-disable-next-line
  }, [JSON.stringify(cardRows)])

  // Tab management functions
  const addCoverTestTab = (cardId: string) => {
    setCoverTestTabs(prev => {
      const newTabId = uuidv4()
      const updatedTabs = { ...prev, [cardId]: [...(prev[cardId] || []), newTabId] }
      const tabIndex = updatedTabs[cardId].length - 1
      setExamFormData(formData => ({
        ...formData,
        [`cover-test-${cardId}-${newTabId}`]: {
          card_instance_id: newTabId,
          card_id: cardId,
          tab_index: tabIndex,
          layout_instance_id: activeLayoutId,
          deviation_type: null,
          deviation_direction: null,
          fv_1: null,
          fv_2: null,
          nv_1: null,
          nv_2: null
        }
      }))
      return updatedTabs
    })
  }
  const removeCoverTestTab = (cardId: string, tabIdx: number) => {
    setCoverTestTabs(prev => {
      const tabs = prev[cardId] || []
      if (tabs.length <= 1) return prev
      const newTabs = [...tabs.slice(0, tabIdx), ...tabs.slice(tabIdx + 1)]
      
      setActiveCoverTestTabs(prevActive => ({
        ...prevActive,
        [cardId]: Math.max(0, Math.min(prevActive[cardId], newTabs.length - 1))
      }))
      
      return { ...prev, [cardId]: newTabs }
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    console.log('examFormData', examFormData)
    if (formRef.current) {
      if (isNewMode) {
        const examData = {
          client_id: Number(clientId),
          exam_date: formData.exam_date || new Date().toISOString().split('T')[0],
          test_name: formData.test_name || '',
          clinic: formData.clinic || '',
          user_id: formData.user_id || currentUser?.id,
          dominant_eye: formData.dominant_eye || null,
          type: formData.type || config.dbType
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
            toast.success(config.saveSuccessNew)
            
            if (refreshExams) {
              await refreshExams();
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (onSave) {
              onSave(newExam, ...Object.values(savedData))
            }
          } else {
            toast.error(config.saveErrorNewData)
          }
        } else {
          toast.error(config.saveErrorNew)
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
        
        // Custom save logic for cover-test tabs
        for (const [key, data] of Object.entries(examFormData)) {
          if (key.startsWith('cover-test-')) {
            if (data && (data.__deleted || !examComponentRegistry.getConfig('cover-test')?.hasData(data))) {
              if (data.id) {
                await window.electronAPI.db('deleteCoverTestExam', data.id)
              }
              continue
            }
          }
        }
        // Now call the normal saveAllData for the rest
        const savedData = await examComponentRegistry.saveAllData(activeLayout.id, examFormData)

        if (updatedExam && Object.values(savedData).some(data => data !== null)) {
          setIsEditing(false)
          setExam(updatedExam)
          setExamComponentData(savedData)
          setFormData({ ...updatedExam })
          
          toast.success(config.saveSuccessUpdate)
          
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
        await loadExamComponentData(selectedTab.id, selectedTab.layout_data)
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
          await loadExamComponentData(newLayoutInstance.id, layoutToAdd.layout_data);
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
    if (clientId && value !== config.sidebarTab) {
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
      coverTestTabs,
      setCoverTestTabs,
      activeCoverTestTabs,
      setActiveCoverTestTabs,
      addCoverTestTab,
      removeCoverTestTab,
      layoutInstanceId: activeLayoutId,
      setExamFormData: setExamFormData,
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
        examInfo={isNewMode ? config.newTitle : config.headerInfo(examId || '')}
        tabs={{ activeTab, onTabChange: handleTabChange }}
      />
      <ClientSpaceLayout>
        <div className="flex flex-col flex-1 p-4  lg:p-5 mb-10" dir="rtl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{isNewMode ? config.newTitle : config.detailTitle}</h2>
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
                              isEditing={isEditing}
                              mode="detail"
                              detailProps={{
                                ...detailProps,
                                coverTestTabs,
                                setCoverTestTabs,
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
                                  const activeTabId = coverTestTabs[cardId]?.[activeTabIndex]
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
                                        const activeTabId = coverTestTabs[cardId]?.[activeTabIndex]
                                        sourceKey = `cover-test-${cardId}-${activeTabId}`
                                      }
                                      if (card.type === 'cover-test') {
                                        const cardId = card.id
                                        const activeTabIndex = activeCoverTestTabs[cardId]
                                        const activeTabId = coverTestTabs[cardId]?.[activeTabIndex]
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
                                        const activeTabId = coverTestTabs[cardId]?.[activeTabIndex]
                                        sourceKey = `cover-test-${cardId}-${activeTabId}`
                                      }
                                      if (card.type === 'cover-test') {
                                        const cardId = card.id
                                        const activeTabIndex = activeCoverTestTabs[cardId]
                                        const activeTabId = coverTestTabs[cardId]?.[activeTabIndex]
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
                                        const activeTabId = coverTestTabs[cardId]?.[activeTabIndex]
                                        sourceKey = `cover-test-${cardId}-${activeTabId}`
                                      }
                                      if (card.type === 'cover-test') {
                                        const cardId = card.id
                                        const activeTabIndex = activeCoverTestTabs[cardId]
                                        const activeTabId = coverTestTabs[cardId]?.[activeTabIndex]
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
    </>
  )
} 