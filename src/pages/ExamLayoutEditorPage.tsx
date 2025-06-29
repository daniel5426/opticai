import React, { useState, useEffect } from "react"
import { useParams, useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  UniqueIdentifier
} from "@dnd-kit/core"
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from "@dnd-kit/sortable"
import { 
  useSortable
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Edit, Trash2, Move3D, MoveHorizontal, MoveVertical } from "lucide-react"
import { OldRefractionTab, ObjectiveTab } from "@/components/exam/OldRefractionObjectiveTab"
import { SubjectiveTab } from "@/components/exam/SubjectiveTab"
import { AdditionTab } from "@/components/exam/AdditionTab"
import { FinalSubjectiveTab } from "@/components/exam/FinalSubjectiveTab"
import { OldRefractionExam, ObjectiveExam, SubjectiveExam, AdditionExam, FinalSubjectiveExam, ExamLayout } from "@/lib/db/schema"
import { getExamLayoutById, createExamLayout, updateExamLayout } from "@/lib/db/exam-layouts-db"
import { Separator } from "@/components/ui/separator"

interface CardItem {
  id: string
  type: 'exam-details' | 'old-refraction' | 'objective' | 'subjective' | 'final-subjective' | 'addition' | 'notes'
}

interface CardRow {
  id: string
  cards: CardItem[]
}

interface DraggableCardProps {
  id: string
  children: React.ReactNode
  isEditing: boolean
}

function DraggableCard({ id, children, isEditing }: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 150ms ease",
    opacity: isDragging ? 0.1 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group w-full"
    >
      {isEditing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 p-1 rounded-md bg-background/80 backdrop-blur-sm border opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing hover:bg-accent"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {children}
    </div>
  )
}

interface AddComponentDrawerProps {
  isEditing: boolean
  onAddComponent: (componentType: CardItem['type']) => void
}

function AddComponentDrawer({ isEditing, onAddComponent }: AddComponentDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isEditing) return null

  const eyeComponents = [
    { id: 'old-refraction', label: 'Old Refraction', description: 'רפרקציה ישנה' },
    { id: 'objective', label: 'Objective', description: 'אובייקטיבי' },
    { id: 'subjective', label: 'Subjective', description: 'סובייקטיבי' },
    { id: 'final-subjective', label: 'Final Subjective', description: 'סובייקטיבי סופי' },
    { id: 'addition', label: 'Addition', description: 'תוספות' },
    { id: 'notes', label: 'Notes', description: 'הערות' },
  ] as const

  const handleSelectComponent = (componentType: CardItem['type']) => {
    onAddComponent(componentType)
    setIsOpen(false)
    toast.success(`${eyeComponents.find(c => c.id === componentType)?.description} נוסף לשורה`)
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
          <Plus className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[60vh]">
        <DrawerHeader>
          <DrawerTitle className="text-center">הוסף רכיב לשורה</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-2">
          {eyeComponents.map((component) => (
            <Button
              key={component.id}
              variant="outline"
              className="w-full justify-between"
              onClick={() => handleSelectComponent(component.id as CardItem['type'])}
            >
              <span>{component.description}</span>
              <span className="text-sm text-muted-foreground">{component.label}</span>
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

interface AddRowButtonProps {
  onAddRow: () => void
  isEditing: boolean
}

function AddRowButton({ onAddRow, isEditing }: AddRowButtonProps) {
  if (!isEditing) return null

  return (
    <div className="flex justify-center py-4">
      <Button 
        variant="outline" 
        className="w-full max-w-md border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-muted/10 hover:bg-muted/20"
        onClick={onAddRow}
      >
        <Plus className="h-4 w-4 mr-2" />
        הוסף שורה חדשה
      </Button>
    </div>
  )
}

interface CardResizerProps {
  rowId: string
  leftCardId: string
  rightCardId: string
  isEditing: boolean
  onResize: (rowId: string, leftCardId: string, rightCardId: string, leftWidth: number) => void
}

function CardResizer({ rowId, leftCardId, rightCardId, isEditing, onResize }: CardResizerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditing) return
    e.preventDefault()
    e.stopPropagation()
    
    setIsDragging(true)
    
    const startX = e.clientX
    const resizerElement = e.currentTarget as HTMLElement
    const cardsContainer = resizerElement.parentElement
    if (!cardsContainer) return

    // Get initial container dimensions
    const initialRect = cardsContainer.getBoundingClientRect()
    const containerWidth = initialRect.width
    
    // Calculate initial resizer position as percentage
    const resizerRect = resizerElement.getBoundingClientRect()
    const initialResizerPos = resizerRect.left - initialRect.left + 12
    let currentLeftPercent = (initialResizerPos / containerWidth) * 100

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaPercent = (deltaX / containerWidth) * 100
      
      let newLeftPercent = currentLeftPercent + deltaPercent
      
      // Apply constraints
      newLeftPercent = Math.max(20, Math.min(80, newLeftPercent))
      
      onResize(rowId, leftCardId, rightCardId, newLeftPercent)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }

    // Prevent text selection and set cursor
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  if (!isEditing) return null

  return (
    <div dir="ltr"  
      className={`flex mx-[-17px] items-center justify-center w-5 cursor-col-resize z-20 relative self-stretch hover:bg-gray-100/50 rounded-sm transition-colors duration-200`}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      title="גרור לשינוי רוחב"
    >
      <div className={`h-16 w-1 rounded-full bg-gray-400 hover:cursor-col-resize transition-opacity duration-200 ${isHovering ? 'opacity-100' : 'opacity-0'}`}></div>
    </div>
  )
}

export default function ExamLayoutEditorPage() {
  const navigate = useNavigate()
  
  // Handle both route cases safely
  let params: { layoutId?: string } = {}
  let search: { name?: string } = {}
  
  try {
    // Try to get layoutId parameter if we're on the detail route
    const routeParams = useParams({ strict: false })
    if ('layoutId' in routeParams) {
      params = routeParams as { layoutId: string }
    }
  } catch {
    // If we can't get params, we're likely on the /new route
  }
  
  try {
    // Try to get search parameters if we're on the new route
    const routeSearch = useSearch({ strict: false })
    search = routeSearch as { name?: string }
  } catch {
    // If we can't get search, continue with empty search
  }
  
  const isNewMode = !params.layoutId || params.layoutId === "new"
  const [loading, setLoading] = useState(!isNewMode)
  const [layoutName, setLayoutName] = useState(isNewMode ? (search.name || "פריסה חדשה") : "")
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditing, setIsEditing] = useState(true)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  
  const [cardRows, setCardRows] = useState<CardRow[]>([
    { id: 'row-1', cards: [{ id: 'exam-details', type: 'exam-details' }] },
    { id: 'row-2', cards: [{ id: 'notes', type: 'notes' }] }
  ])

  // Store custom widths for cards that have been manually resized
  const [customWidths, setCustomWidths] = useState<Record<string, Record<string, number>>>({})

  const emptyOldRefractionData: OldRefractionExam = { exam_id: 0 }
  const emptyObjectiveData: ObjectiveExam = { exam_id: 0 }
  const emptySubjectiveData: SubjectiveExam = { exam_id: 0 }
  const emptyAdditionData: AdditionExam = { exam_id: 0 }
  const emptyFinalSubjectiveData: FinalSubjectiveExam = { exam_id: 0 }

  useEffect(() => {
    const loadLayout = async () => {
      if (isNewMode || !params.layoutId) return
      
      try {
        setLoading(true)
        const layout = await getExamLayoutById(Number(params.layoutId))
        if (layout) {
          setLayoutName(layout.name)
          if (layout.layout_data) {
            const parsedLayout = JSON.parse(layout.layout_data)
            if (Array.isArray(parsedLayout)) {
              setCardRows(parsedLayout)
              setCustomWidths({})
            } else {
              setCardRows(parsedLayout.rows || [])
              setCustomWidths(parsedLayout.customWidths || {})
            }
          }
        }
      } catch (error) {
        console.error('Error loading layout:', error)
        toast.error('שגיאה בטעינת הפריסה')
      } finally {
        setLoading(false)
      }
    }

    loadLayout()
  }, [params.layoutId, isNewMode])

  const getColumnCount = (type: CardItem['type']): number => {
    const columnCounts = {
      'exam-details': 5,
      'old-refraction': 15,
      'objective': 8,
      'subjective': 20,
      'final-subjective': 22,
      'addition': 7,
      'notes': 1
    }
    return columnCounts[type]
  }

  const calculateCardWidth = (cards: CardItem[], rowId: string): Record<string, number> => {
    if (cards.length === 1) {
      return { [cards[0].id]: 100 }
    }
    
    // Check if we have custom widths for this row
    const rowCustomWidths = customWidths[rowId]
    if (rowCustomWidths && cards.length === 2) {
      const leftCard = cards[0]
      const rightCard = cards[1]
      if (rowCustomWidths[leftCard.id] !== undefined) {
        return {
          [leftCard.id]: rowCustomWidths[leftCard.id],
          [rightCard.id]: 100 - rowCustomWidths[leftCard.id]
        }
      }
    }
    
    const totalColumns = cards.reduce((sum, card) => sum + getColumnCount(card.type), 0)
    const widths: Record<string, number> = {}
    
    cards.forEach(card => {
      const cardColumns = getColumnCount(card.type)
      widths[card.id] = (cardColumns / totalColumns) * 100
    })
    
    return widths
  }

  const handleCardResize = (rowId: string, leftCardId: string, rightCardId: string, leftWidth: number) => {
    setCustomWidths(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [leftCardId]: leftWidth
      }
    }))
  }

  const hasNoteCard = (cards: CardItem[]): boolean => {
    return cards.some(card => card.type === 'notes')
  }

  const shouldShowResizer = (cards: CardItem[], index: number): boolean => {
    return cards.length === 2 && hasNoteCard(cards) && index === 0
  }

  const canAddToRow = (rowCards: CardItem[], newType: CardItem['type']): boolean => {
    if (newType === 'exam-details') return false
    if (rowCards.some(card => card.type === 'exam-details')) return false
    if (rowCards.some(card => card.type === newType)) return false
    
    // Allow notes to be combined with other cards, but limit to 2 cards total when notes are involved
    if (newType === 'notes' || rowCards.some(card => card.type === 'notes')) {
      return rowCards.length < 2
    }
    
    return true
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    setCardRows(prevRows => {
      const oldIndex = prevRows.findIndex(row => row.id === active.id)
      const newIndex = prevRows.findIndex(row => row.id === over.id)
      
      return arrayMove(prevRows, oldIndex, newIndex)
    })
  }

  const handleAddComponent = (rowIndex: number, componentType: CardItem['type']) => {
    setCardRows(prevRows => {
      const newRows = [...prevRows]
      const targetRow = newRows[rowIndex]
      
      if (!canAddToRow(targetRow.cards, componentType)) {
        toast.error("לא ניתן להוסיף רכיב זה לשורה הזו")
        return prevRows
      }
      
      const newCardId = `${componentType}-${Date.now()}`
      newRows[rowIndex] = {
        ...targetRow,
        cards: [...targetRow.cards, { id: newCardId, type: componentType }]
      }
      
      return newRows
    })
  }

  const handleAddRow = () => {
    const newRowId = `row-${Date.now()}`
    const newRow: CardRow = {
      id: newRowId,
      cards: []
    }
    
    setCardRows(prevRows => [...prevRows, newRow])
    toast.success("שורה חדשה נוספה")
  }

  const handleRemoveCard = (rowIndex: number, cardId: string) => {
    setCardRows(prevRows => {
      const newRows = [...prevRows]
      const targetRow = newRows[rowIndex]
      
      // Filter out the card to be removed
      const updatedCards = targetRow.cards.filter(card => card.id !== cardId)
      
      if (updatedCards.length === 0) {
        // If row becomes empty, remove the entire row (except if it's the last row)
        if (newRows.length > 1) {
          newRows.splice(rowIndex, 1)
          toast.success("הרכיב והשורה הריקה הוסרו")
        } else {
          // Keep at least one row, but make it empty
          newRows[rowIndex] = { ...targetRow, cards: [] }
          toast.success("הרכיב הוסר")
        }
      } else {
        // Update the row with remaining cards
        newRows[rowIndex] = { ...targetRow, cards: updatedCards }
        toast.success("הרכיב הוסר")
      }
      
      return newRows
    })
  }

  const handleSaveLayout = async () => {
    if (!layoutName.trim()) {
      toast.error("נא להזין שם לפריסה")
      return
    }

    try {
      const layoutData = {
        name: layoutName,
        layout_data: JSON.stringify({
          rows: cardRows,
          customWidths: customWidths
        }),
        is_default: false
      }

      let result
      if (isNewMode || !params.layoutId) {
        result = await createExamLayout(layoutData)
      } else {
        result = await updateExamLayout({
          id: Number(params.layoutId),
          ...layoutData
        })
      }

      if (result) {
        toast.success(isNewMode ? "פריסה חדשה נוצרה בהצלחה" : "הפריסה עודכנה בהצלחה")
        navigate({ to: "/exam-layouts" })
      } else {
        toast.error("שגיאה בשמירת הפריסה")
      }
    } catch (error) {
      console.error('Error saving layout:', error)
      toast.error("שגיאה בשמירת הפריסה")
    }
  }

  const renderCard = (item: CardItem, hideEyeLabels: boolean = false, matchHeight: boolean = false) => {
    switch (item.type) {
      case 'exam-details':
        return (
          <Card className="w-full p-4 shadow-md border-[1px]">
            <div className="grid grid-cols-5 gap-x-3 gap-y-2 w-full">
              <div className="col-span-1">
                <label className="font-semibold text-base">תאריך בדיקה</label>
                <div className="border h-9 px-3 rounded-md text-sm flex items-center mt-1 bg-accent/50">דוגמה</div>
              </div>
              <div className="col-span-1">
                <label className="font-semibold text-base">שם הבדיקה</label>
                <div className="border h-9 px-3 rounded-md text-sm flex items-center mt-1 bg-accent/50">דוגמה</div>
              </div>
              <div className="col-span-1">
                <label className="font-semibold text-base">סניף</label>
                <div className="border h-9 px-3 rounded-md text-sm flex items-center mt-1 bg-accent/50">דוגמה</div>
              </div>
              <div className="col-span-1">
                <label className="font-semibold text-base">בודק</label>
                <div className="border h-9 px-3 rounded-md text-sm flex items-center mt-1 bg-accent/50">דוגמה</div>
              </div>
              <div className="col-span-1">
                <label className="font-semibold text-base">עין דומיננטית</label>
                  <div className="border h-9 px-3 rounded-md text-sm flex items-center mt-1 bg-accent/50">דוגמה</div>
              </div>
            </div>
          </Card>
        )
      
      case 'old-refraction':
        return (
          <OldRefractionTab
            oldRefractionData={emptyOldRefractionData}
            onOldRefractionChange={() => {}}
            isEditing={false}
            onMultifocalClick={() => {}}
            onVHConfirm={() => {}}
            hideEyeLabels={hideEyeLabels}
          />
        )
      
      case 'objective':
        return (
          <ObjectiveTab
            objectiveData={emptyObjectiveData}
            onObjectiveChange={() => {}}
            isEditing={false}
            hideEyeLabels={hideEyeLabels}
          />
        )
      
      case 'subjective':
        return (
          <SubjectiveTab
            subjectiveData={emptySubjectiveData}
            onSubjectiveChange={() => {}}
            isEditing={false}
            onVHConfirm={() => {}}
            onMultifocalClick={() => {}}
            hideEyeLabels={hideEyeLabels}
          />
        )
      
      case 'final-subjective':
        return (
          <FinalSubjectiveTab
            finalSubjectiveData={emptyFinalSubjectiveData}
            onFinalSubjectiveChange={() => {}}
            isEditing={false}
            onVHConfirm={() => {}}
            hideEyeLabels={hideEyeLabels}
          />
        )
      
      case 'addition':
        return (
          <AdditionTab
            additionData={emptyAdditionData}
            onAdditionChange={() => {}}
            isEditing={false}
            hideEyeLabels={hideEyeLabels}
          />
        )
      
      case 'notes':
        return (
          <Card className={`w-full p-5 shadow-md border-[1px] ${matchHeight ? 'h-full flex flex-col' : ''}`} dir="rtl">
            <label className="block text-base font-semibold mb-[-10px]">הערות</label>
            <div className={`text-sm w-full p-3 border rounded-xl bg-gray-50 text-gray-500 ${matchHeight ? 'flex-1' : 'min-h-[90px]'}`}>
              תצוגה מקדימה של שדה הערות
            </div>
          </Card>
        )
      
      default:
        return null
    }
  }

  if (loading) {
    return (
      <>
        <SiteHeader 
          title="פריסות בדיקה"
          backLink="/exam-layouts"
        />
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">טוען נתונים...</h1>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader 
        title="פריסות בדיקה"
        backLink="/exam-layouts"
      />
      <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10" dir="rtl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <Input
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingName(false)
                  }
                }}
                className="text-xl font-semibold border-none p-0 h-auto focus-visible:ring-0"
                autoFocus
              />
            ) : (
              <>
                <h2 className="text-xl font-semibold">{layoutName}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingName(true)}
                  className="h-6 w-6 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/exam-layouts" })}>
              ביטול
            </Button>
            <Button onClick={handleSaveLayout}>
              שמור פריסה
            </Button>
          </div>
        </div>
        
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border">
          <p className="text-sm text-blue-800">
            <strong>הוראות שימוש:</strong> גרור שורות לשינוי הסדר, השתמש בכפתור + להוספת רכיבים לשורות קיימות, לחץ על אייקון הפח להסרת רכיבים, גרור את אייקון הגרירה בין רכיבים לשינוי רוחב, והוסף שורות חדשות בכפתור למטה.
          </p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4" style={{scrollbarWidth: 'none'}}>
            <SortableContext items={cardRows.map(row => row.id)} strategy={verticalListSortingStrategy}>
              {cardRows.map((row, rowIndex) => {
                const cardWidths = calculateCardWidth(row.cards, row.id)
                
                return (
                  <DraggableCard
                    key={row.id}
                    id={row.id}
                    isEditing={isEditing}
                  >
                    <div className="flex gap-4 w-full items-start">
                      <div className="flex-shrink-0">
                        <AddComponentDrawer 
                          isEditing={isEditing}
                          onAddComponent={(componentType) => handleAddComponent(rowIndex, componentType)}
                        />
                      </div>
                      <div className="flex gap-4 flex-1" dir="ltr">
                        {row.cards.length === 0 ? (
                          <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                            שורה ריקה - השתמש בכפתור + להוספת רכיבים
                          </div>
                        ) : (
                          row.cards.map((card, index) => (
                            <React.Fragment key={card.id}>
                              <div 
                                style={{ 
                                  width: `${cardWidths[card.id]}%`,
                                  minWidth: row.cards.length > 1 ? '200px' : 'auto'
                                }}
                                className="relative group"
                              >
                                {isEditing && (
                                  <button
                                    onClick={() => handleRemoveCard(rowIndex, card.id)}
                                    className="absolute top-2 right-2 z-10 p-1 rounded-md bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                    title="הסר רכיב"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                                {renderCard(card, index == 1, hasNoteCard(row.cards) && row.cards.length === 2)}
                              </div>
                              
                              {shouldShowResizer(row.cards, index) && (
                                <CardResizer
                                  rowId={row.id}
                                  leftCardId={row.cards[0].id}
                                  rightCardId={row.cards[1].id}
                                  isEditing={isEditing}
                                  onResize={handleCardResize}
                                />
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </div>
                    </div>
                  </DraggableCard>
                )
              })}
            </SortableContext>
            
            <AddRowButton onAddRow={handleAddRow} isEditing={isEditing} />
          </div>
          
          <DragOverlay>
            {activeId ? (
              <div className="w-full">
                {(() => {
                  const row = cardRows.find(r => r.id === activeId)
                  if (!row) return null
                  const cardWidths = calculateCardWidth(row.cards, row.id)
                  return (
                    <div className="flex gap-4 w-full">
                      <div className="flex-shrink-0">
                        <AddComponentDrawer 
                          isEditing={isEditing}
                          onAddComponent={() => {}}
                        />
                      </div>
                      <div className="flex gap-4 flex-1">
                        {row.cards.map((card, index) => (
                          <div 
                            key={card.id}
                            style={{ 
                              width: `${cardWidths[card.id]}%`,
                              minWidth: row.cards.length > 1 ? '200px' : 'auto'
                            }}
                            className="relative group"
                          >
                            {isEditing && (
                              <button
                                className="absolute top-2 right-2 z-10 p-1 rounded-md bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                title="הסר רכיב"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                            {renderCard(card, index < row.cards.length - 1)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  )
} 