import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from "react"
import { useParams, useNavigate, Link, useLocation, useBlocker } from "@tanstack/react-router"
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter, rectIntersection, pointerWithin, CollisionDetection } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SiteHeader } from "@/components/site-header"
import { getClientById } from "@/lib/db/clients-db"
import { getExamById, getExamWithLayouts, updateExam, createExam, getExamPageData } from "@/lib/db/exams-db"
import { OpticalExam, Client, User, ExamLayout, ExamLayoutInstance, NotesExam } from "@/lib/db/schema-interface"
import { getAllExamLayouts, getDefaultExamLayout, getDefaultExamLayouts, getExamLayoutInstancesByExamId, getActiveExamLayoutInstanceByExamId, setActiveExamLayoutInstance, addLayoutToExam, getExamLayoutById, deleteExamLayoutInstance, createExamLayoutInstance, updateExamLayoutInstance } from "@/lib/db/exam-layouts-db"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, PlusCircleIcon, X as XIcon, RefreshCw, FolderTree } from "lucide-react"
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
import { ExamDetailsCard } from "@/components/exam/ExamDetailsCard"

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

const flattenExamLayouts = (nodes: ExamLayout[]): ExamLayout[] => {
  const list: ExamLayout[] = [];
  nodes.forEach((node) => {
    list.push(node);
    if (node.children && node.children.length) {
      list.push(...flattenExamLayouts(node.children as ExamLayout[]));
    }
  });
  return list;
};

const sortKeysDeep = (value: any): any => {
  if (Array.isArray(value)) {
    return value
      .map(sortKeysDeep)
      .filter((item) => item !== undefined)
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .reduce((acc, key) => {
        const child = sortKeysDeep(value[key])
        if (child !== undefined) {
          acc[key] = child
        }
        return acc
      }, {} as Record<string, any>)
  }
  if (value === null) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" ? undefined : trimmed
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return value
}

export default function ExamDetailPage({
  mode = 'view',
  clientId: propClientId,
  examId: propExamId,
  pageType: propPageType,
  onSave,
  onCancel
}: ExamDetailPageProps = {}) {
  const shallowEqual = (a: any, b: any) => {
    if (a === b) return true
    if (!a || !b) return false
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    for (const k of aKeys) {
      if (a[k] !== b[k]) return false
    }
    return true
  }
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
  const [availableLayouts, setAvailableLayouts] = useState<ExamLayout[]>([])
  const [activeInstanceId, setActiveInstanceId] = useState<number | null>(null)
  const [layoutTabs, setLayoutTabs] = useState<LayoutTab[]>([])
  const [isAddingLayouts, setIsAddingLayouts] = useState(false)
  const layoutTabsRef = useRef<LayoutTab[]>([])
  const tempLayoutIdCounterRef = useRef(0)
  const { currentUser, currentClinic } = useUser()
  
  useEffect(() => {
    layoutTabsRef.current = layoutTabs
  }, [layoutTabs])
  
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
  const [activeCoverTestTabs, setActiveCoverTestTabs] = useState<Record<string, number>>({})
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [draggedTabWidth, setDraggedTabWidth] = useState<number | null>(null)
  const [isRegeneratingFullData, setIsRegeneratingFullData] = useState(false)
  const tabRefs = useRef<Record<string, HTMLElement | null>>({})
  const lastOverIdRef = useRef<string | null>(null)
  const flattenedAvailableLayouts = useMemo(() => flattenExamLayouts(availableLayouts), [availableLayouts])
  const layoutMap = useMemo(() => {
    const map = new Map<number, ExamLayout>()
    flattenedAvailableLayouts.forEach((layout) => {
      if (layout.id != null) {
        map.set(layout.id, layout)
      }
    })
    return map
  }, [flattenedAvailableLayouts])
  const childrenByParentId = useMemo(() => {
    const map = new Map<number, ExamLayout[]>()
    flattenedAvailableLayouts.forEach((layout) => {
      if (layout.parent_layout_id == null || layout.id == null) return
      const list = map.get(layout.parent_layout_id) ?? []
      list.push(layout)
      map.set(layout.parent_layout_id, list)
    })
    map.forEach((list) => {
      list.sort((a, b) => {
        const sortDiff = (a.sort_index ?? 0) - (b.sort_index ?? 0)
        if (sortDiff !== 0) return sortDiff
        return (a.id ?? 0) - (b.id ?? 0)
      })
    })
    return map
  }, [flattenedAvailableLayouts])
  const isGroupLayout = useCallback((layout?: ExamLayout | null) => {
    if (!layout) return false
    if (layout.is_group) return true
    if (Array.isArray(layout.children) && layout.children.length > 0) return true
    if (layout.id != null) {
      const children = childrenByParentId.get(layout.id) ?? []
      if (children.length > 0) return true
    }
    return false
  }, [childrenByParentId])
  const leafLayouts = useMemo(() => flattenedAvailableLayouts.filter(layout => !isGroupLayout(layout)), [flattenedAvailableLayouts, isGroupLayout])
  const collectDescendantLayouts = useCallback((groupId: number): ExamLayout[] => {
    const collected: ExamLayout[] = []
    const visit = (currentId: number) => {
      const children = childrenByParentId.get(currentId) ?? []
      children.forEach((child) => {
        if (child.id == null) {
          return
        }
        if (isGroupLayout(child)) {
          visit(child.id)
        } else {
          collected.push(child)
        }
      })
    }
    visit(groupId)
    return collected
  }, [childrenByParentId, isGroupLayout])
  const computedCoverTestTabs = React.useMemo(() => {
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

  const applyLayoutStructure = (layoutData?: string) => {
    if (!layoutData) {
      setCardRows([])
      setCustomWidths({})
      return
    }
    try {
      const parsed = JSON.parse(layoutData)
      if (Array.isArray(parsed)) {
        setCardRows(parsed)
        setCustomWidths({})
      } else {
        setCardRows(parsed.rows || [])
        setCustomWidths(parsed.customWidths || {})
      }
    } catch (error) {
      console.error('Error parsing layout structure:', error)
      setCardRows([])
      setCustomWidths({})
    }
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

  const normalizeFieldValue = (previous: any, rawValue: string) => {
    const trimmed = typeof rawValue === "string" ? rawValue.trim() : rawValue
    if (trimmed === "") {
      if (previous === null) return null
      return undefined
    }
    if (typeof previous === "number") {
      const normalizedNumber = Number(String(trimmed).replace(",", "."))
      return Number.isFinite(normalizedNumber) ? normalizedNumber : rawValue
    }
    if (typeof previous === "boolean") {
      if (trimmed === "true" || trimmed === "1") return true
      if (trimmed === "false" || trimmed === "0") return false
      return rawValue
    }
    return trimmed
  }

  // Create field change handlers for all components
  const createFieldHandlers = () => {
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

    // Create field handlers for notes card instances
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
  }

  const fieldHandlers = createFieldHandlers()
  const toolboxActions = createToolboxActions(examFormData, fieldHandlers)

  const { currentClient, setActiveTab: setSidebarActiveTab } = useClientSidebar()

  // Set the active tab to 'exams' when this page loads
  useEffect(() => {
    setSidebarActiveTab(config.sidebarTab)
  }, [setSidebarActiveTab, config.sidebarTab])

  useEffect(() => {
    baselineInitializedRef.current = false
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

                // Populate examFormDataByInstance for ALL instances from the page-data response
                const initialFormDataByInstance: Record<number, any> = {}
                instances.forEach((instanceData: any) => {
                  if (instanceData.exam_data && typeof instanceData.exam_data === 'object') {
                    initialFormDataByInstance[instanceData.instance.id] = instanceData.exam_data
                  }
                })
                setExamFormDataByInstance(initialFormDataByInstance)

                // Set the active instance data to the form
                const activeExamData = initialFormDataByInstance[chosen.instance.id]
                const chosenTab = layoutTabs.find(tab => tab.id === chosenInstId)

                if (chosenTab && chosenTab.name === FULL_DATA_NAME) {
                  // For Full Data, always rebuild aggregated data to ensure it's current
                  const seedBucket = buildFullDataBucket(chosen.instance.id)
                  setExamFormData(seedBucket)
                  setExamFormDataByInstance(prev => ({ ...prev, [chosen.instance.id]: seedBucket }))
                } else if (activeExamData && Object.keys(activeExamData).length > 0) {
                  setExamFormData(activeExamData)
                } else if (chosen.layout && chosen.layout.layout_data) {
                  // Fallback for instances without exam_data
                  await loadExamComponentData(chosen.instance.id, layoutDataStr, true)
                } else {
                  const seedBucket = buildFullDataBucket(chosen.instance.id)
                  setExamFormData(seedBucket)
                  setExamFormDataByInstance(prev => ({ ...prev, [chosen.instance.id]: seedBucket }))
                }
              }
              if (Array.isArray(available_layouts)) {
                setAvailableLayouts(available_layouts as any)
              }
            }
          }
        } else {
          const layoutsTree = await getAllExamLayouts(currentClinic?.id)
          setAvailableLayouts(layoutsTree as ExamLayout[])
          const flattenedLayouts = flattenExamLayouts(layoutsTree as ExamLayout[])
          const selectableLayouts = flattenedLayouts.filter(layout => !isGroupLayout(layout))
          let defaultLayouts = selectableLayouts.filter(layout => layout.is_default)
          if (defaultLayouts.length === 0 && selectableLayouts.length > 0) {
            defaultLayouts = [selectableLayouts[0]]
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
  }, [clientId, examId, isNewMode, config.dbType, currentClinic?.id])

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

  useEffect(() => {
    if (activeInstanceId != null) {
      const bucket = examFormDataByInstance[activeInstanceId]
      if (!shallowEqual(bucket || {}, examFormData)) {
        setExamFormData(bucket || {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInstanceId])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examFormData])

  // Ensure there is a first tab when none exist for a cover-test card
  useEffect(() => {
    if (loading) return
    const coverCardIds: string[] = []
    cardRows.forEach(row => row.cards.forEach(card => { if (card.type === 'cover-test') coverCardIds.push(card.id) }))
    if (coverCardIds.length === 0) return
    // Create the first tab lazily per card if no keys exist yet
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
    // eslint-disable-next-line
  }, [JSON.stringify(cardRows), activeInstanceId, loading])

  // Tab management functions: derive tabs from data; we only add/remove by mutating examFormData
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
      // Recompute indices
      const remaining = (computedCoverTestTabs[cardId] || []).filter((_, i) => i !== tabIdx)
      remaining.forEach((tabId, idx) => {
        const k = `cover-test-${cardId}-${tabId}`
        if (updated[k]) updated[k] = { ...updated[k], tab_index: idx }
      })
      return updated
    })
    setActiveCoverTestTabs(prev => ({ ...prev, [cardId]: Math.max(0, Math.min(prev[cardId] || 0, (tabs.length - 2))) }))
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
    console.log('activeInstanceId', activeInstanceId)
    console.log('layoutTabs', layoutTabs)
    console.log('activeLayout', layoutTabs.find(tab => tab.isActive))

    if (!formRef.current || isSaveInFlight) return

    setIsSaveInFlight(true)

    try {
      if (isNewMode) {
        setIsEditing(false)
        const examData = {
          client_id: Number(clientId),
          exam_date: formData.exam_date || new Date().toISOString().split('T')[0],
          test_name: formData.test_name || '',
          clinic_id: currentClinic?.id,
          user_id: formData.user_id || currentUser?.id,
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
  }

  const handleLayoutTabChange = async (tabId: number) => {
    const selectedTab = layoutTabs.find(tab => tab.id === tabId)
    if (!selectedTab) return
    
    try {
      const loadId = ++latestLoadIdRef.current
      // Update UI immediately for better responsiveness
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
        const refreshedBucket = buildFullDataBucket(selectedTab.id)
        setExamFormDataByInstance(prev => ({ ...prev, [selectedTab.id]: refreshedBucket }))
        setExamFormData(refreshedBucket)
      } else if (existingBucket && Object.keys(existingBucket).length > 0) {
        setExamFormData(existingBucket)
      }
      
      // Update database - no need to load data since it's already available
      if (exam && exam.id && !isNewMode) {
        await setActiveExamLayoutInstance(exam.id, tabId)
      }
    } catch (error) {
      console.error('Error changing layout tab:', error)
      toast.error('שגיאה בהחלפת לשונית פריסה')
    }
  }

  const addLayoutNode = async (layout: ExamLayout, activate: boolean): Promise<{ added: boolean; existed: boolean }> => {
    if (!layout.id) {
      return { added: false, existed: false }
    }
    if (isGroupLayout(layout)) {
      toast.error("לא ניתן להוסיף קבוצה בלשוניות")
      return { added: false, existed: false }
    }
    toast.info(`הוספת פריסה "${layout.name || ''}"`)
    const existingTab = layoutTabsRef.current.find(tab => tab.layout_id === layout.id)
    if (existingTab) {
      if (activate) {
        await handleLayoutTabChange(existingTab.id)
      }
      return { added: false, existed: true }
    }
    if (exam && exam.id && !isNewMode) {
      const newLayoutInstance = await addLayoutToExam(exam.id, layout.id, activate)
      if (!newLayoutInstance) {
        toast.error('שגיאה בהוספת לשונית פריסה')
        return { added: false, existed: false }
      }
      setLayoutTabs(prev => {
        const base = activate ? prev.map(tab => ({ ...tab, isActive: false })) : prev
        return [
          ...base,
          {
            id: newLayoutInstance.id || 0,
            layout_id: layout.id,
            name: layout.name || '',
            layout_data: layout.layout_data || '',
            isActive: activate
          }
        ]
      })
      if (activate) {
        setActiveInstanceId(newLayoutInstance.id || null)
        applyLayoutStructure(layout.layout_data)
        if (newLayoutInstance.id) {
          await loadExamComponentData(newLayoutInstance.id, layout.layout_data)
        }
      }
    } else {
      tempLayoutIdCounterRef.current += 1
      const tempId = -Date.now() - tempLayoutIdCounterRef.current
      setLayoutTabs(prev => {
        const base = activate ? prev.map(tab => ({ ...tab, isActive: false })) : prev
        return [
          ...base,
          {
            id: tempId,
            layout_id: layout.id,
            name: layout.name || '',
            layout_data: layout.layout_data || '',
            isActive: activate
          }
        ]
      })
      initializeFormData(tempId, layout.layout_data)
      if (activate) {
        setActiveInstanceId(tempId)
        applyLayoutStructure(layout.layout_data)
      }
    }
    return { added: true, existed: false }
  }

  const handleSelectLayoutOption = async (layoutId: number) => {
    const targetLayout = layoutMap.get(layoutId)
    if (!targetLayout) {
      toast.error("הפריסה לא נמצאה")
      return
    }
    setIsAddingLayouts(true)
    try {
      const groupLike = isGroupLayout(targetLayout)
      if (groupLike && targetLayout.id != null) {
        const descendants = collectDescendantLayouts(targetLayout.id).filter((layout) => !isGroupLayout(layout) && layout.id != null && layout.layout_data)
        if (descendants.length === 0) {
          toast.info(`לא נמצאו פריסות בקבוצה "${targetLayout.name}"`)
          return
        }
        let addedCount = 0
        let existingCount = 0
        let activated = false
        for (const layout of descendants) {
          const result = await addLayoutNode(layout, !activated)
          if (result.added) {
            addedCount += 1
            if (!activated) activated = true
          } else if (result.existed) {
            existingCount += 1
            if (!activated) activated = true
          }
        }
        if (addedCount > 0) {
          toast.success(`נוספו ${addedCount} פריסות מקבוצה "${targetLayout.name}"`)
        }
        if (existingCount > 0) {
          if (addedCount === 0) {
            toast.info(`כל פריסות הקבוצה "${targetLayout.name}" כבר קיימות`)
          } else {
            toast.info(`${existingCount} פריסות כבר היו קיימות`)
          }
        }
        return
      } else {
        if (!targetLayout.layout_data) {
          toast.error("לא נמצאו נתונים עבור פריסה זו")
          return
        }
        const result = await addLayoutNode(targetLayout, true)
        if (result.added) {
          toast.success(`פריסה "${targetLayout.name}" הוספה והוחלה`)
        } else if (result.existed) {
          toast.info(`הפריסה "${targetLayout.name}" כבר קיימת בלשוניות`)
        }
      }
    } catch (error) {
      console.error('Error selecting layout option:', error)
      toast.error('שגיאה בהוספת פריסה')
    } finally {
      setIsAddingLayouts(false)
    }
  }

  const handleAddLayoutTab = async (layoutId: number) => {
    await handleSelectLayoutOption(layoutId)
  }

  const FULL_DATA_NAME = "Full data"

  const isMeaningfulValue = (v: any) => {
    if (v === null || v === undefined) return false
    if (typeof v === 'string') return v.trim() !== ''
    return true
  }

  const isNonEmptyComponent = (key: string, value: any) => {
    if (!value || typeof value !== 'object') return false
    const ignored = new Set(['id','layout_instance_id','card_id','card_instance_id','tab_index','__deleted'])
    const specialCover = ['deviation_type','deviation_direction','fv_1','fv_2','nv_1','nv_2']
    const specialNotes = ['title','note']
    if (key.startsWith('cover-test-')) {
      return specialCover.some(k => isMeaningfulValue((value as any)[k]))
    }
    if (key.startsWith('notes-')) {
      return specialNotes.some(k => isMeaningfulValue((value as any)[k]))
    }
    for (const [k, v] of Object.entries(value)) {
      if (ignored.has(k)) continue
      if (isMeaningfulValue(v)) return true
    }
    return false
  }

  const pxToCols = (px: number) => {
    const pxPerCol = 1680 / 16
    return Math.max(1, Math.min(16, Math.round(px / pxPerCol)))
  }

  const computeCardCols = (type: CardItem['type']): number => {
    const spec = getColumnCount(type, 'editor') as any
    if (typeof spec === 'number') return Math.max(1, Math.min(16, spec))
    if (spec && typeof spec === 'object' && typeof spec.fixedPx === 'number') return pxToCols(spec.fixedPx)
    return 1
  }

  const packCardsIntoRows = (cards: { id: string; type: CardItem['type'] }[]) => {
    const items = cards.map(c => ({ ...c, cols: computeCardCols(c.type) }))
    
    // Calculate ideal target columns per row
    const totalCols = items.reduce((sum, item) => sum + item.cols, 0)
    const minRowsNeeded = Math.ceil(totalCols / 16)
    const targetColsPerRow = Math.ceil(totalCols / minRowsNeeded)

    // Sort descending by size
    items.sort((a, b) => b.cols - a.cols)

    const rows: { id: string; cards: { id: string; type: CardItem['type']; title?: string }[]; used: number }[] = []

    items.forEach(item => {
      let bestIdx = -1
      let bestScore = -Infinity

      rows.forEach((row, idx) => {
        if (row.cards.length < 3 && row.used + item.cols <= 16) {
          // Calculate how close this placement gets us to the target balance
          const newUsed = row.used + item.cols
          
          // Score based on how close to target this row would be
          const distanceFromTarget = Math.abs(targetColsPerRow - newUsed)
          
          // Also consider overall variance reduction
          const currentVariance = rows.reduce((sum, r) => sum + Math.pow(r.used - targetColsPerRow, 2), 0)
          const newVariance = rows.reduce((sum, r, i) => {
            const used = i === idx ? newUsed : r.used
            return sum + Math.pow(used - targetColsPerRow, 2)
          }, 0)
          
          // Higher score is better: prefer placements that reduce variance and get close to target
          const score = (currentVariance - newVariance) * 100 - distanceFromTarget
          
          if (score > bestScore) {
            bestScore = score
            bestIdx = idx
          }
        }
      })

      if (bestIdx === -1) {
        // No suitable row, create a new one
        rows.push({ id: `row-${rows.length + 1}`, cards: [{ id: item.id, type: item.type }], used: item.cols })
      } else {
        // Place in the best row for balance
        const row = rows[bestIdx]
        row.cards.push({ id: item.id, type: item.type })
        row.used += item.cols
      }
    })

    return rows.map(r => ({ id: r.id, cards: r.cards }))
  }

  const ensureAllLayoutsLoaded = async (): Promise<void> => {
    // All layout data is now loaded upfront from page-data response
    // This function is kept for compatibility but no longer makes API calls
    return Promise.resolve()
  }

  const getContributingInstanceIds = (excludeInstanceId?: number | string) => {
    const excludedKey = excludeInstanceId == null ? null : String(excludeInstanceId)
    return layoutTabs
      .filter(tab => tab.name !== FULL_DATA_NAME && (excludedKey === null || String(tab.id) !== excludedKey))
      .map(tab => String(tab.id))
  }

  const aggregateAllData = (allowedInstanceIds?: Array<number | string>): Record<string, any> => {
    const allowed = allowedInstanceIds ? new Set(allowedInstanceIds.map(String)) : null
    const aggregated: Record<string, any> = {}

    Object.entries(examFormDataByInstance).forEach(([instanceKey, bucket]) => {
      if (allowed && !allowed.has(instanceKey)) return
      Object.entries(bucket || {}).forEach(([key, val]) => {
        if ((val as any)?.__deleted) return
        if (val && typeof val === 'object' && isNonEmptyComponent(key, val)) {
          aggregated[key] = val
        }
      })
    })

    return aggregated
  }

  const buildFullDataLayoutData = (): string | null => {
    const aggregated = aggregateAllData(getContributingInstanceIds())
    const entries = Object.entries(aggregated)
    if (entries.length === 0) return null

    const cardDefs: { id: string; type: CardItem['type']; title?: string }[] = []
    const addedStandard = new Set<string>()
    const addedCoverCards = new Set<string>()

    entries.forEach(([key, value]) => {
      if (key.startsWith('notes-')) {
        if (addedStandard.has(key)) return
        addedStandard.add(key)
        const title = (value as any)?.title
        cardDefs.push({ id: key, type: 'notes', ...(title ? { title } : {}) })
        return
      }

      if (key.startsWith('cover-test-')) {
        const suffix = key.slice('cover-test-'.length)
        const dashIndex = suffix.indexOf('-')
        const cardId = dashIndex >= 0 ? suffix.slice(0, dashIndex) : suffix
        if (addedCoverCards.has(cardId)) return
        addedCoverCards.add(cardId)
        cardDefs.push({ id: cardId, type: 'cover-test' })
        return
      }

      const type = key as CardItem['type']
      if (addedStandard.has(type)) return
      addedStandard.add(type)

      if (type === 'corneal-topography' && (value as any)?.title) {
        cardDefs.push({ id: key, type, title: (value as any).title })
      } else {
        cardDefs.push({ id: key, type })
      }
    })

    if (cardDefs.length === 0) return null
    const rows = packCardsIntoRows(cardDefs)
    console.log(cardDefs)
    console.log(rows)
    const layout = { rows, customWidths: {} as Record<string, Record<string, number>> }
    console.log(layout)
    return JSON.stringify(layout)
  }

  const buildFullDataBucket = (instanceId: number): Record<string, any> => {
    const aggregated = aggregateAllData(getContributingInstanceIds(instanceId))
    const bucket: Record<string, any> = {}

    Object.entries(aggregated).forEach(([key, val]) => {
      if (!isNonEmptyComponent(key, val)) return
      const clone = { ...(val as any) }
      clone.layout_instance_id = instanceId
      if (key.startsWith('notes-')) {
        const cardId = key.replace('notes-', '')
        clone.card_instance_id = cardId
      }
      delete (clone as any).__deleted
      bucket[key] = clone
    })

    return bucket
  }

  // Tabs derive from examFormData; no explicit sync function

  const handleAddFullDataTab = async () => {
    const existing = layoutTabs.find(t => t.name === FULL_DATA_NAME)
    if (existing) {
      handleLayoutTabChange(existing.id)
      return
    }

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
      // Seed the instance bucket with aggregated data
      const seedBucket = buildFullDataBucket(newInstance.id!)
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
      const seedBucket = buildFullDataBucket(tempId)
      setExamFormData(seedBucket)
      setExamFormDataByInstance(prev => ({ ...prev, [tempId]: seedBucket }))
      toast.success('Full data הוחל לבדיקה')
    }
  }

  const handleRegenerateFullData = async () => {
    const active = layoutTabs.find(t => t.isActive)
    if (!active || active.name !== FULL_DATA_NAME) return

    setIsRegeneratingFullData(true)
    try {
      const layoutData = buildFullDataLayoutData()
      if (!layoutData) {
        toast.info('אין עדכונים לפריסת Full data')
        return
      }
      if (exam && exam.id && !isNewMode && active.id > 0) {
        await updateExamLayoutInstance({ id: active.id, exam_id: exam.id, layout_id: null as any, layout_data: layoutData } as any)
        const seedBucket = buildFullDataBucket(active.id)
        setExamFormDataByInstance(prev => ({ ...prev, [active.id]: seedBucket }))
        setExamFormData(seedBucket)
      } else {
        const seedBucket = buildFullDataBucket(active.id)
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
    } finally {
      setIsRegeneratingFullData(false)
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

  // Drag and drop sensors and handlers for layout tabs
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string
    setActiveDragId(id)
    lastOverIdRef.current = id
    const element = tabRefs.current[id]
    if (element) {
      setDraggedTabWidth(element.offsetWidth)
    }
  }

  const customCollisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }
    
    const rectIntersections = rectIntersection(args)
    return rectIntersections
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = layoutTabs.findIndex((tab) => tab.id.toString() === active.id)
      const newIndex = layoutTabs.findIndex((tab) => tab.id.toString() === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        setLayoutTabs((tabs) => arrayMove(tabs, oldIndex, newIndex))
      }
    }

    setActiveDragId(null)
    setDraggedTabWidth(null)
    lastOverIdRef.current = null
  }

  // Sortable tab component
  const SortableTab = ({ tab, index, isRegeneratingFullData }: { tab: LayoutTab; index: number; isRegeneratingFullData: boolean }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ 
      id: tab.id.toString(),
      transition: {
        duration: 200,
        easing: 'ease'
      }
    })

    const setRefs = useCallback((node: HTMLDivElement | null) => {
      tabRefs.current[tab.id.toString()] = node
      setNodeRef(node)
    }, [setNodeRef, tab.id])

    const style = {
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      transition,
    }

    return (
      <div
        ref={setRefs}
        style={style}
        {...attributes}
        {...listeners}
        className={`
          group relative rounded-t-xl transition-all duration-200 cursor-pointer overflow-hidden select-none
          ${tab.isActive
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'hover:bg-muted text-foreground'}
          ${isDragging ? 'opacity-0' : ''}
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
              disabled={isRegeneratingFullData}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRegeneratingFullData ? 'animate-spin' : ''}`} />
            </button>
          )}
        </span>
      </div>
    )
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
  const activeLayoutTab = layoutTabs.find(tab => tab.isActive)
  const isFullDataActive = activeLayoutTab?.name === FULL_DATA_NAME
  const detailPropsWithOverrides: DetailProps = {
    ...detailProps,
    isEditing: !isFullDataActive && detailProps.isEditing,
    coverTestTabs: computedCoverTestTabs,
    availableExamLayouts: availableLayouts,
    onSelectLayout: handleSelectLayoutOption,
    isLayoutSelectionLoading: isAddingLayouts
  }

  const renderLayoutMenuItems = (nodes: ExamLayout[]): React.ReactNode[] => {
    return nodes.flatMap((node) => {
      if (!node.id) {
        return []
      }
      if (isGroupLayout(node)) {
        return (
          <DropdownMenuSub key={`group-${node.id}`}>
            <DropdownMenuSubTrigger dir="rtl" className="flex items-center justify-between text-sm">
              <span>{node.name}</span>
              <FolderTree className="h-4 w-4 ml-2" />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[220px] text-right">
              <DropdownMenuItem
                onClick={() => handleSelectLayoutOption(node.id!)}
                className="text-sm text-primary"
              >
                הוסף את כל הקבוצה
              </DropdownMenuItem>
              {renderLayoutMenuItems(node.children || [])}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )
      }
      return (
        <DropdownMenuItem
          key={`layout-${node.id}`}
          dir="rtl"
          className="text-sm"
          onClick={() => handleSelectLayoutOption(node.id!)}
        >
          <PlusCircleIcon className="h-4 w-4 ml-2" />
          {node.name}
        </DropdownMenuItem>
      )
    })
  }
  const headerActions = (
    <>
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
          <Button variant="outline" className="h-9 px-4">יצירת הזמנה</Button>
        </Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-9 px-4 flex items-center gap-1"
            onClick={async () => {
              if (leafLayouts.length === 0 && currentClinic?.id) {
                const res = await apiClient.getExamLayouts(currentClinic.id)
                if (!res.error) setAvailableLayouts((res.data || []) as ExamLayout[])
              }
            }}
          >
            <span>פריסות</span>
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem dir="rtl" className="text-sm font-bold" disabled>
            הוספת פריסה
          </DropdownMenuItem>
          <DropdownMenuItem
            dir="rtl"
            className="text-sm"
            onClick={(e) => {
              e.preventDefault()
              handleAddFullDataTab()
            }}
          >
            <PlusCircleIcon className="h-4 w-4 mr-2" />
            Full data
          </DropdownMenuItem>
          {leafLayouts.length === 0 ? (
            <DropdownMenuItem disabled className="text-sm">
              אין פריסות זמינות
            </DropdownMenuItem>
          ) : (
            renderLayoutMenuItems(availableLayouts)
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isNewMode && onCancel && (
        <Button
          variant="outline"
          className="h-9 px-4"
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
        className="h-9 px-4"
        onClick={handleEditButtonClick}
        title={isFullDataActive ? "פריסת Full data היא לתצוגה בלבד" : undefined}
      >
        {isNewMode ? "שמור בדיקה" : isEditing ? "שמור שינויים" : "ערוך בדיקה"}
      </Button>
    </>
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
                      if (leafLayouts.length === 0 && currentClinic?.id) {
                        const res = await apiClient.getExamLayouts(currentClinic.id)
                        if (!res.error) setAvailableLayouts((res.data || []) as ExamLayout[])
                      }
                    }}>
                      <span>פריסות</span>
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem dir="rtl" className="text-sm font-bold" disabled>הוספת פריסה</DropdownMenuItem>
                    {leafLayouts.length === 0 ? (
                      <DropdownMenuItem disabled className="text-sm">אין פריסות זמינות</DropdownMenuItem>
                    ) : (
                      renderLayoutMenuItems(availableLayouts)
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
          <div className="mb-4">
            <ExamDetailsCard mode="detail" detailProps={detailPropsWithOverrides} actions={headerActions} />
          </div>

          {/* Layout Tabs */}
          {layoutTabs.length > 0 && (
            <div className="">
              <DndContext
                sensors={sensors}
                collisionDetection={customCollisionDetection}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={layoutTabs.map(tab => tab.id.toString())}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {layoutTabs.map((tab, index) => (
                      <SortableTab key={tab.id} tab={tab} index={index} isRegeneratingFullData={isRegeneratingFullData} />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeDragId ? (
                    <div className="group relative rounded-t-xl bg-primary text-primary-foreground shadow-md overflow-hidden select-none z-50">
                      {(() => {
                        const draggedTab = layoutTabs.find(tab => tab.id.toString() === activeDragId)
                        return draggedTab ? (
                          <>
                            {layoutTabs.length > 1 && isEditing && (
                              <button
                                type="button"
                                className="absolute top-1 right-1 rounded-full w-[14px] h-[14px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center hover:bg-red-500 hover:text-white z-10"
                                aria-label="הסר לשונית"
                              >
                                <XIcon className="h-2.5 w-2.5" />
                              </button>
                            )}
                            <span className="text-sm py-2 px-5 font-medium whitespace-nowrap flex items-center gap-2">
                              {draggedTab.name}
                              {draggedTab.isActive && draggedTab.name === FULL_DATA_NAME && (
                                <button
                                  type="button"
                                  className="rounded-full w-[18px] h-[18px] flex items-center justify-center hover:bg-primary-foreground/20"
                                  aria-label="רענן Full data"
                                  title="רענן"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </span>
                          </>
                        ) : null
                      })()}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
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
                              isEditing={isEditing && !isFullDataActive}
                              mode="detail"
                              detailProps={detailPropsWithOverrides}
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