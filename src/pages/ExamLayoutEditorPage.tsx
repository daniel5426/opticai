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
import { GripVertical, Plus, Edit, Trash2 } from "lucide-react"
import { ExamCardRenderer, CardItem, calculateCardWidth, hasNoteCard, DetailProps } from "@/components/exam/ExamCardRenderer"
import { getExamLayoutById, createExamLayout, updateExamLayout } from "@/lib/db/exam-layouts-db"
import { examComponentRegistry } from "@/lib/exam-component-registry"
import { Eye, EyeOff } from "lucide-react"

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
      className="relative group/row w-full"
    >
      {isEditing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 p-1 rounded-md bg-background/80 backdrop-blur-sm border opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing hover:bg-accent"
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
  onAddComponent: (componentType: CardItem['type']) => boolean
}

function AddComponentDrawer({ isEditing, onAddComponent }: AddComponentDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isEditing) return null

  // Generate component list from registry
  const registeredComponents = examComponentRegistry.getAllTypes().map(type => {
    const config = examComponentRegistry.getConfig(type);
    return {
      id: type,
      label: type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      description: config?.name || type
    };
  });
  
  // Add notes and anamnesis component which isn't in the registry
  const eyeComponents = [
    ...registeredComponents,
    { id: 'notes', label: 'Notes', description: 'הערות' },
    { id: 'exam-details', label: 'Exam Details', description: 'פרטי בדיקה' },
    { id: 'anamnesis', label: 'Anamnesis', description: 'אנמנזה' }, // New anamnesis component
  ] as const

  const handleSelectComponent = (componentType: CardItem['type']) => {
    const success = onAddComponent(componentType)
    setIsOpen(false)
    if (success) {
      toast.success(`${eyeComponents.find(c => c.id === componentType)?.description} נוסף לשורה`)
    }
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
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {eyeComponents.map((component) => (
            <Button
              key={component.id}
              variant="outline"
              className="h-auto flex-col items-center justify-center p-4 text-center"
              onClick={() => handleSelectComponent(component.id as CardItem['type'])}
            >
              <span className="font-semibold text-lg mb-1">{component.description}</span>
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
  cardCount: number
  onResize: (rowId: string, leftCardId: string, rightCardId: string, leftWidth: number) => void
}

function CardResizer({ rowId, leftCardId, rightCardId, isEditing, cardCount, onResize }: CardResizerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditing) return
    e.preventDefault()
    e.stopPropagation()
    
    const resizerElement = e.currentTarget as HTMLElement
    const leftCardElement = resizerElement.previousElementSibling as HTMLElement
    const cardsContainer = resizerElement.parentElement
    if (!cardsContainer || !leftCardElement) return
        
    setIsDragging(true)
    
    const startX = e.clientX
    const containerWidth = cardsContainer.getBoundingClientRect().width
    const startLeftWidth = leftCardElement.getBoundingClientRect().width

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      let newLeftPercent = 0
      const newLeftWidth = startLeftWidth + deltaX
      if (cardCount === 3) {
        newLeftPercent = (newLeftWidth / containerWidth) * 103
      } else {
        newLeftPercent = (newLeftWidth / containerWidth) * 102
      }

      
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
  let search: { name?: string, type?: string } = {}
  
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
    search = routeSearch as { name?: string, type?: string }
  } catch {
    // If we can't get search, continue with empty search
  }
  
  const isNewMode = !params.layoutId || params.layoutId === "new"
  const [loading, setLoading] = useState(!isNewMode)
  const [layoutName, setLayoutName] = useState(isNewMode ? (search.name || "פריסה חדשה") : "")
  const [layoutType, setLayoutType] = useState<'opticlens' | 'exam'>(() => {
    const type = search.type;
    if (type === 'opticlens' || type === 'exam') {
      return type;
    }
    return 'exam';
  })
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditing, setIsEditing] = useState(true)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  
  const [cardRows, setCardRows] = useState<CardRow[]>([
    { id: 'row-1', cards: [{ id: 'exam-details', type: 'exam-details' }] },
    { id: 'row-2', cards: [{ id: 'notes', type: 'notes' }] }
  ])

  // Store custom widths for cards that have been manually resized
  const [customWidths, setCustomWidths] = useState<Record<string, Record<string, number>>>({})

  const handleToggleEyeLabels = (rowIndex: number, cardId: string) => {
    setCardRows(prevRows =>
      prevRows.map((row, rIdx) => {
        if (rIdx === rowIndex) {
          return {
            ...row,
            cards: row.cards.map(card =>
              card.id === cardId ? { ...card, showEyeLabels: !card.showEyeLabels } : card
            )
          }
        }
        return row
      })
    )
  }

  const handleCardTitleChange = (rowIndex: number, cardId: string, title: string) => {
    setCardRows(prevRows =>
      prevRows.map((row, rIdx) => {
        if (rIdx === rowIndex) {
          return {
            ...row,
            cards: row.cards.map(card =>
              card.id === cardId ? { ...card, title } : card
            )
          }
        }
        return row
      })
    )
  }

  useEffect(() => {
    const loadLayout = async () => {
      if (isNewMode || !params.layoutId) return
      
      try {
        setLoading(true)
        const layout = await getExamLayoutById(Number(params.layoutId))
        if (layout) {
          setLayoutName(layout.name)
          setLayoutType(layout.type || 'exam')
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

  const handleCardResize = (rowId: string, leftCardId: string, rightCardId: string, leftWidth: number) => {
    setCustomWidths(prev => {
      const newWidths = { ...prev }
      if (!newWidths[rowId]) {
        newWidths[rowId] = {}
      }
      
      // Find the row to get current card widths
      const row = cardRows.find(r => r.id === rowId)
      if (!row) return prev
      
      // Calculate current widths for all cards
      const currentWidths = calculateCardWidth(row.cards, rowId, prev)
      
      // Set the left card to the new width
      newWidths[rowId][leftCardId] = leftWidth
      
      // Calculate the right card width as the remaining space from what these two cards originally had
      const leftIndex = row.cards.findIndex(card => card.id === leftCardId)
      const rightIndex = row.cards.findIndex(card => card.id === rightCardId)
      
      if (leftIndex !== -1 && rightIndex !== -1) {
        // Get the original combined width of left and right cards
        const originalCombinedWidth = currentWidths[leftCardId] + currentWidths[rightCardId]
        
        // Right card gets what's left from their combined original width
        const rightWidth = originalCombinedWidth - leftWidth
        newWidths[rowId][rightCardId] = Math.max(15, rightWidth) // Minimum 15% width
        
        // Preserve widths of other cards by setting them as custom widths
        row.cards.forEach(card => {
          if (card.id !== leftCardId && card.id !== rightCardId) {
            newWidths[rowId][card.id] = currentWidths[card.id]
          }
        })
      }
      
      return newWidths
    })
  }

  const canAddToRow = (rowCards: CardItem[], newType: CardItem['type']): boolean => {
    // Anamnesis cards cannot be added if other cards exist
    if (newType === 'anamnesis') {
      if (rowCards.length > 0) return false;
    }
    // If there's already an anamnesis card, no other cards can be added
    if (rowCards.some(card => card.type === 'anamnesis')) return false;

    // Regular rules for other cards
    if (rowCards.some(card => card.type === newType)) return false
    
    return rowCards.length < 3
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

  const handleAddComponent = (rowIndex: number, componentType: CardItem['type']): boolean => {
    const targetRow = cardRows[rowIndex]
    if (!canAddToRow(targetRow.cards, componentType)) {
      toast.error("לא ניתן להוסיף רכיב זה לשורה הזו")
      return false
    }

    const newCardId = `${componentType}-${Date.now()}`
    const newCard = { id: newCardId, type: componentType }

    setCardRows(prevRows => 
      prevRows.map((row, index) => {
        if (index === rowIndex) {
          return { ...row, cards: [...row.cards, newCard] }
        }
        return row
      })
    )

    setCustomWidths(prev => {
      const newWidths = { ...prev }
      delete newWidths[targetRow.id]
      return newWidths
    })

    return true
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
    const targetRow = cardRows[rowIndex]
    const newCards = targetRow.cards.filter(card => card.id !== cardId)
    let toastMessage = "הרכיב הוסר"

    if (newCards.length === 0 && cardRows.length > 1) {
      setCardRows(prevRows => prevRows.filter((_, i) => i !== rowIndex))
      toastMessage = "הרכיב והשורה הריקה הוסרו"
    } else {
      setCardRows(prevRows =>
        prevRows.map((row, index) => {
          if (index === rowIndex) {
            return { ...row, cards: newCards }
          }
          return row
        })
      )
    }

    setCustomWidths(prev => {
      const newWidths = { ...prev }
      delete newWidths[targetRow.id]
      return newWidths
    })
    
    toast.success(toastMessage)
  }

  const handleSaveLayout = async () => {
    if (!layoutName.trim()) {
      toast.error("נא להזין שם לפריסה")
      return
    }

    try {
      const layoutData = {
        name: layoutName,
        type: layoutType,
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

  if (loading) {
    return (
      <>
        <SiteHeader 
          title={layoutName}
          parentTitle="פריסות בדיקה"
          parentLink="/exam-layouts"
          grandparentTitle="הגדרות"
          grandparentLink="/settings"
        />
      </>
    )
  }

  return (
    <>
      <SiteHeader 
        title={layoutName}
        parentTitle="פריסות בדיקה"
        parentLink="/exam-layouts"
        grandparentTitle="הגדרות"
        grandparentLink="/settings"
      />
      <div className="flex flex-col flex-1 p-4 lg:pt-4 lg:p-6 mb-10" dir="rtl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">סוג:</label>
              <select
                value={layoutType}
                onChange={(e) => setLayoutType(e.target.value as 'opticlens' | 'exam')}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="exam">בדיקה</option>
                <option value="opticlens">עדשות מגע</option>
              </select>
            </div>
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
                const cardWidths = calculateCardWidth(row.cards, row.id, customWidths)
                
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
                                className="relative group/card"
                              >
                                {isEditing && (
                                  <button
                                    onClick={() => handleRemoveCard(rowIndex, card.id)}
                                    className="absolute top-2 right-2 z-10 p-1 rounded-md bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover/card:opacity-100 transition-opacity duration-200"
                                    title="הסר רכיב"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                                {index > 0 && ( // Only show for cards not first in row
                                  <button
                                    onClick={() => handleToggleEyeLabels(rowIndex, card.id)}
                                    className="absolute top-2 left-2 z-10 p-1 rounded-md bg-background/80 hover:bg-accent text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity duration-200"
                                    title={card.showEyeLabels ? "הסתר תוויות עין" : "הצג תוויות עין"}
                                  >
                                    {card.showEyeLabels ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                  </button>
                                )}
                                <ExamCardRenderer
                                  item={card}
                                  rowCards={row.cards}
                                  isEditing={isEditing}
                                  mode="editor"
                                  hideEyeLabels={index > 0}
                                  matchHeight={hasNoteCard(row.cards) && row.cards.length > 1}
                                  onTitleChange={(title) => handleCardTitleChange(rowIndex, card.id, title)}
                                />
                              </div>
                              
                              {index < row.cards.length - 1 && (
                                <CardResizer
                                  rowId={row.id}
                                  leftCardId={card.id}
                                  rightCardId={row.cards[index + 1].id}
                                  isEditing={isEditing}
                                  cardCount={row.cards.length}
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
                  const cardWidths = calculateCardWidth(row.cards, row.id, customWidths)
                  return (
                    <div className="flex gap-4 w-full">
                      <div className="flex-shrink-0">
                        <AddComponentDrawer 
                          isEditing={isEditing}
                          onAddComponent={() => false}
                        />
                      </div>
                      <div className="flex gap-4 flex-1" dir="ltr">
                        {row.cards.map((card, index) => (
                          <div 
                            key={card.id}
                            style={{ 
                              width: `${cardWidths[card.id]}%`,
                              minWidth: row.cards.length > 1 ? '200px' : 'auto'
                            }}
                            className="relative group/card"
                          >
                            
                            <ExamCardRenderer
                              item={card}
                              rowCards={row.cards}
                              isEditing={isEditing}
                              mode="editor"
                              hideEyeLabels={index > 0}
                              matchHeight={false}
                            />
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