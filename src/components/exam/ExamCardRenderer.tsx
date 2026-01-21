import React, { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { OldRefTab } from "@/components/exam/OldRefTab"
import { OldRefractionTab } from "@/components/exam/OldRefractionTab"
import { OldRefractionExtensionTab } from "@/components/exam/OldRefractionExtensionTab"
import { ObjectiveTab } from "@/components/exam/ObjectiveTab"
import { SubjectiveTab } from "@/components/exam/SubjectiveTab"
import { AdditionTab } from "@/components/exam/AdditionTab"
import { FinalSubjectiveTab } from "@/components/exam/FinalSubjectiveTab"
import { FinalPrescriptionTab } from "@/components/exam/FinalPrescriptionTab"
import { CompactPrescriptionTab } from "@/components/exam/CompactPrescriptionTab"
import { RetinoscopTab } from "@/components/exam/RetinoscopTab"
import { RetinoscopDilationTab } from "@/components/exam/RetinoscopDilationTab"
import { UncorrectedVATab } from "@/components/exam/UncorrectedVATab"
import { KeratometerTab } from "@/components/exam/KeratometerTab"
import { KeratometerFullTab } from "@/components/exam/KeratometerFullTab"
import { CornealTopographyTab } from "@/components/exam/CornealTopographyTab"
import { CoverTestTab } from "@/components/exam/CoverTestTab"
import { AnamnesisTab } from "@/components/exam/AnamnesisTab"
import { SchirmerTestTab } from "@/components/exam/SchirmerTestTab"
import { ContactLensDiametersTab } from "@/components/exam/ContactLensDiametersTab"
import { ContactLensDetailsTab } from "@/components/exam/ContactLensDetailsTab"
import { KeratometerContactLensTab } from "@/components/exam/KeratometerContactLensTab"
import { ContactLensExamTab } from "@/components/exam/ContactLensExamTab"
import { ContactLensOrderTab } from "@/components/exam/ContactLensOrderTab"
import { Edit3 } from "lucide-react"
import { OpticalExam, OldRefractionExam, OldRefractionExtensionExam, ObjectiveExam, SubjectiveExam, AdditionExam, FinalSubjectiveExam, FinalPrescriptionExam, CompactPrescriptionExam, RetinoscopExam, RetinoscopDilationExam, UncorrectedVAExam, KeratometerExam, KeratometerFullExam, CornealTopographyExam, CoverTestExam, AnamnesisExam, NotesExam, SchirmerTestExam, OldRefExam, ContactLensDiameters, ContactLensDetails, KeratometerContactLens, ContactLensExam, ContactLensOrder, SensationVisionStabilityExam, FusionRangeExam, MaddoxRodExam, StereoTestExam, RGExam, OcularMotorAssessmentExam, DiopterAdjustmentPanel, OldContactLenses, OverRefraction, ExamLayout } from "@/lib/db/schema-interface"
import { ExamToolbox, ToolboxActions } from "@/components/exam/ExamToolbox"
import { ExamComponentType } from "@/lib/exam-field-mappings"
import { examComponentRegistry } from "@/lib/exam-component-registry"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { OldContactLensesTab } from "@/components/exam/OldContactLensesTab";
import { OverRefractionTab } from "@/components/exam/OverRefractionTab";
import { ObservationTab } from "@/components/exam/ObservationTab"
import { DiopterAdjustmentPanelTab } from "@/components/exam/DiopterAdjustmentPanelTab";
import { FusionRangeTab } from "@/components/exam/FusionRangeTab"
import { MaddoxRodTab } from "@/components/exam/MaddoxRodTab"
import { StereoTestTab } from "@/components/exam/StereoTestTab"
import { RGTab } from "@/components/exam/RGTab"
import { OcularMotorAssessmentTab } from "@/components/exam/OcularMotorAssessmentTab"
import { v4 as uuidv4 } from 'uuid';
import { ExamDetailsCard } from "@/components/exam/ExamDetailsCard"
import { NotesCard } from "@/components/ui/notes-card"
import { OrdersHistoryModal } from "@/components/exam/OrdersHistoryModal"
import { Order } from "@/lib/db/schema-interface"

// Renaming for consistency within the component props
type Exam = OpticalExam;

const componentsWithMiddleRow: CardItem['type'][] = ['old-refraction', 'old-refraction-extension', 'subjective', 'final-subjective', 'final-prescription', 'compact-prescription', 'corneal-topography', 'anamnesis', 'contact-lens-exam', 'contact-lens-diameters', 'over-refraction', 'old-contact-lenses'];
const componentsDontHaveMiddleRow: CardItem['type'][] = ['objective', 'addition', 'retinoscop', 'retinoscop-dilation', 'uncorrected-va', 'keratometer', 'keratometer-full', 'cover-test', 'schirmer-test', 'contact-lens-diameters', 'contact-lens-details', 'keratometer-contact-lens', 'fusion-range', 'maddox-rod', 'stereo-test', 'rg', 'ocular-motor-assessment'];

export interface CardItem {
  id: string
  type: 'old-ref' | 'old-refraction' | 'old-refraction-extension' | 'objective' | 'subjective' | 'final-subjective' | 'final-prescription' | 'compact-prescription' | 'addition' | 'retinoscop' | 'retinoscop-dilation' | 'uncorrected-va' | 'keratometer' | 'keratometer-full' | 'corneal-topography' | 'cover-test' | 'notes' | 'anamnesis' | 'schirmer-test' | 'contact-lens-diameters' | 'contact-lens-details' | 'keratometer-contact-lens' | 'contact-lens-exam' | 'sensation-vision-stability' | 'diopter-adjustment-panel' | 'fusion-range' | 'maddox-rod' | 'stereo-test' | 'rg' | 'ocular-motor-assessment' | 'old-contact-lenses' | 'over-refraction'
  showEyeLabels?: boolean
  title?: string
}

// Simplified DetailProps interface that uses the registry
export interface DetailProps {
  isEditing: boolean;
  isNewMode: boolean;
  exam: Exam | null | undefined;
  formData: Partial<Exam>;
  examFormData: Record<string, unknown>; // All exam component form data
  fieldHandlers: Record<string, (field: string, value: string) => void>; // All field change handlers
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (value: string, name: string) => void;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Exam>>>;
  handleNotesChange: (value: string) => void;
  // Legacy handlers for components with special behaviors
  handleMultifocalOldRefraction?: () => void;
  handleVHConfirmOldRefraction?: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  handleVHConfirm?: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  handleMultifocalSubjective?: () => void;
  handleFinalSubjectiveVHConfirm?: (rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string, leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string) => void;
  handleMultifocalOldRefractionExtension?: () => void;
  toolboxActions?: ToolboxActions;
  allRows?: CardItem[][];
  coverTestTabs?: Record<string, string[]>; // New prop for cover test tabs
  addCoverTestTab?: (cardId: string) => void; // New prop for adding cover test tabs
  layoutInstanceId?: number; // New prop for layout instance ID
  setExamFormData?: React.Dispatch<React.SetStateAction<Record<string, unknown>>>; // New prop for setting exam form data
  setCoverTestTabs?: React.Dispatch<React.SetStateAction<Record<string, string[]>>>; // New prop for setting cover test tabs
  activeCoverTestTabs?: Record<string, number>; // New prop for active cover test tabs
  setActiveCoverTestTabs?: React.Dispatch<React.SetStateAction<Record<string, number>>>; // New prop for setting active cover test tabs
  oldRefractionTabs?: Record<string, string[]>;
  activeOldRefractionTabs?: Record<string, string>;
  setActiveOldRefractionTabs?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addOldRefractionTab?: (cardId: string, type: string) => void;
  removeOldRefractionTab?: (cardId: string, tabIdx: number) => void;
  duplicateOldRefractionTab?: (cardId: string, tabIdx: number) => void;
  updateOldRefractionTabType?: (cardId: string, tabIdx: number, newType: string) => void;
  availableExamLayouts?: ExamLayout[];
  onSelectLayout?: (layoutId: number) => void | Promise<void>;
  isLayoutSelectionLoading?: boolean;
}

// Helper functions to get data and handlers from registry
const getExamFormData = (examFormData: Record<string, unknown>, componentType: ExamComponentType) => {
  const data = examFormData[componentType]
  if (data && typeof data === 'object' && data !== null && Object.keys(data).length > 0) {
    return data
  }

  // Return properly typed empty objects
  switch (componentType) {
    case 'old-ref': return { layout_instance_id: 0 } as OldRefExam
    case 'old-refraction': return { layout_instance_id: 0 } as OldRefractionExam
    case 'old-refraction-extension': return { layout_instance_id: 0 } as OldRefractionExtensionExam
    case 'objective': return { layout_instance_id: 0 } as ObjectiveExam
    case 'subjective': return { layout_instance_id: 0 } as SubjectiveExam
    case 'addition': return { layout_instance_id: 0 } as AdditionExam
    case 'final-subjective': return { layout_instance_id: 0 } as FinalSubjectiveExam
    case 'final-prescription': return { layout_instance_id: 0 } as FinalPrescriptionExam
    case 'compact-prescription': return { layout_instance_id: 0 } as CompactPrescriptionExam
    case 'retinoscop': return { layout_instance_id: 0 } as RetinoscopExam
    case 'retinoscop-dilation': return { layout_instance_id: 0 } as RetinoscopDilationExam
    case 'uncorrected-va': return { layout_instance_id: 0 } as UncorrectedVAExam
    case 'keratometer': return { layout_instance_id: 0 } as KeratometerExam
    case 'keratometer-full': return { layout_instance_id: 0 } as KeratometerFullExam
    case 'corneal-topography': return { layout_instance_id: 0 } as CornealTopographyExam
    case 'cover-test': return { layout_instance_id: 0 } as CoverTestExam
    case 'anamnesis': return { layout_instance_id: 0 } as AnamnesisExam
    case 'notes': return { layout_instance_id: 0 } as NotesExam
    case 'schirmer-test': return { layout_instance_id: 0 } as SchirmerTestExam
    case 'contact-lens-diameters': return { layout_instance_id: 0 } as ContactLensDiameters
    case 'contact-lens-details': return { layout_instance_id: 0 } as ContactLensDetails
    case 'keratometer-contact-lens': return { layout_instance_id: 0 } as KeratometerContactLens
    case 'contact-lens-exam': return { layout_instance_id: 0 } as ContactLensExam
    case 'sensation-vision-stability': return { layout_instance_id: 0 } as SensationVisionStabilityExam
    case 'diopter-adjustment-panel': return { layout_instance_id: 0 } as DiopterAdjustmentPanel
    case 'fusion-range': return { layout_instance_id: 0 } as FusionRangeExam
    case 'maddox-rod': return { layout_instance_id: 0 } as MaddoxRodExam
    case 'stereo-test': return { layout_instance_id: 0 } as StereoTestExam
    case 'rg': return { layout_instance_id: 0 } as RGExam
    case 'ocular-motor-assessment': return { layout_instance_id: 0 } as OcularMotorAssessmentExam
    case 'old-contact-lenses': return { layout_instance_id: 0 } as OldContactLenses
    case 'over-refraction': return { layout_instance_id: 0 } as OverRefraction
    default: return { layout_instance_id: 0 }
  }
}

const getFieldHandler = (fieldHandlers: Record<string, unknown>, componentType: ExamComponentType) => {
  const handler = fieldHandlers[componentType]
  if (typeof handler === 'function') {
    return handler as (field: string, value: string | boolean | number | null) => void
  }
  return (() => { }) as (field: string, value: string | boolean | number | null) => void
}

// Utility function to create DetailProps from registry data
export const createDetailProps = (
  isEditing: boolean,
  isNewMode: boolean,
  exam: Exam | null | undefined,
  formData: Partial<Exam>,
  examFormData: Record<string, unknown>,
  fieldHandlers: Record<string, (field: string, value: string) => void>,
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  handleSelectChange: (value: string, name: string) => void,
  setFormData: React.Dispatch<React.SetStateAction<Partial<Exam>>>,
  handleNotesChange: (value: string) => void,
  toolboxActions?: ToolboxActions,
  allRows?: CardItem[][],
  // Optional legacy handlers
  legacyHandlers?: {
    handleMultifocalOldRefraction?: () => void;
    handleVHConfirmOldRefraction?: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
    handleVHConfirm?: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
    handleMultifocalSubjective?: () => void;
    handleFinalSubjectiveVHConfirm?: (rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string, leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string) => void;
    handleMultifocalOldRefractionExtension?: () => void;
  },
  tabProps?: {
    coverTestTabs?: Record<string, string[]>;
    addCoverTestTab?: (cardId: string) => void;
    setCoverTestTabs?: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
    activeCoverTestTabs?: Record<string, number>;
    setActiveCoverTestTabs?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    oldRefractionTabs?: Record<string, string[]>;
    addOldRefractionTab?: (cardId: string, type: string) => void;
    removeOldRefractionTab?: (cardId: string, tabIdx: number) => void;
    duplicateOldRefractionTab?: (cardId: string, tabIdx: number) => void;
    updateOldRefractionTabType?: (cardId: string, tabIdx: number, newType: string) => void;
    activeOldRefractionTabs?: Record<string, string>;
    setActiveOldRefractionTabs?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  }
): DetailProps => {
  return {
    isEditing,
    isNewMode,
    exam,
    formData,
    examFormData,
    fieldHandlers,
    handleInputChange,
    handleSelectChange,
    setFormData,
    handleNotesChange,
    toolboxActions,
    allRows,
    ...legacyHandlers,
    ...tabProps
  }
}

interface RenderCardProps {
  item: CardItem;
  rowCards: CardItem[];
  isEditing: boolean;
  mode: 'editor' | 'detail';
  hideEyeLabels?: boolean;
  matchHeight?: boolean;
  detailProps?: DetailProps;
  currentRowIndex?: number;
  currentCardIndex?: number;
  clipboardSourceType?: ExamComponentType | null;
  onCopy?: () => void;
  onPaste?: () => void;
  onClearData?: () => void;
  onCopyLeft?: () => void;
  onCopyRight?: () => void;
  onCopyBelow?: () => void;
  onTitleChange?: (title: string) => void;
}

// In ExamDetailPage, `DateInput` was used, but it's not a standard component.
// It was probably a regular input with type="date". Let's handle it here.

// Update getColumnCount to support fixedPx for diopter-adjustment-panel
export const getColumnCount = (type: CardItem['type'], mode: 'editor' | 'detail'): number | { fixedPx: number } => {
  switch (type) {
    case 'diopter-adjustment-panel':
      return { fixedPx: mode === 'editor' ? 389 : 369 }
    case 'old-ref': return 3
    case 'old-refraction': return 8
    case 'old-refraction-extension': return 12
    case 'objective': return 4
    case 'subjective': return 8
    case 'final-subjective': return 11
    case 'final-prescription': return 9
    case 'compact-prescription': return 8
    case 'addition': return 6
    case 'retinoscop': return 6
    case 'retinoscop-dilation': return 6
    case 'uncorrected-va': return 3
    case 'keratometer': return 3
    case 'keratometer-full': return 9
    case 'corneal-topography': return 1
    case 'cover-test': return 5
    case 'notes': return 5
    case 'anamnesis': return 11
    case 'schirmer-test': return 2
    case 'contact-lens-diameters': return 2
    case 'contact-lens-details': return 13
    case 'keratometer-contact-lens': return 6
    case 'contact-lens-exam': return 9
    case 'old-contact-lenses': return 13
    case 'over-refraction': return 8
    case 'sensation-vision-stability': return 5
    case 'fusion-range': return 5
    case 'maddox-rod': return 5
    case 'stereo-test': return 2
    case 'rg': return 3
    case 'ocular-motor-assessment': return 5
    default: return 1
  }
}

// Define maximum width constraints for specific card types (in pixels)
// Define maximum width constraints for specific card types (in pixels)
export const getMaxWidth = (type: CardItem['type'], mode: 'editor' | 'detail' = 'detail'): number | null => {
  switch (type) {
    case 'rg': return 290
    case 'maddox-rod': return 756
    case 'corneal-topography': return 1260
    case 'keratometer': return 420
    case 'notes': return 5000
    case 'sensation-vision-stability': return 1000
    case 'stereo-test': return 200
    default: {
      const col = getColumnCount(type, mode)
      return typeof col === 'number' ? col * 90 : col.fixedPx
    }
  }
}

export const hasNoteCard = (cards: CardItem[]): boolean => {
  return cards.some(card => card.type === 'notes')
}

// Update calculateCardWidth to support fixedPx widths and max width constraints
export const calculateCardWidth = (
  cards: CardItem[],
  rowId: string,
  customWidths: Record<string, Record<string, number>>,
  pxPerCol: number = 1680,
  mode: 'editor' | 'detail' = 'detail'
): Record<string, number> => {
  if (cards.length === 1) {
    const rowCustomWidths = customWidths[rowId]
    if (rowCustomWidths && rowCustomWidths[cards[0].id] !== undefined) {
      return { [cards[0].id]: rowCustomWidths[cards[0].id] }
    }
    const maxWidthPx = getMaxWidth(cards[0].type, mode)
    if (maxWidthPx) {
      const maxWidthPercent = (maxWidthPx / pxPerCol) * 100
      return { [cards[0].id]: Math.min(100, maxWidthPercent) }
    }
    return { [cards[0].id]: 100 }
  }

  // Identify fixedPx and flexible cards
  let totalFixedPx = 0
  const fixedPxCards = cards.filter(card => {
    const col = getColumnCount(card.type, mode)
    if (typeof col === 'object' && 'fixedPx' in col) {
      totalFixedPx += col.fixedPx
      return true
    }
    return false
  })
  const flexibleCards = cards.filter(card => {
    const col = getColumnCount(card.type, mode)
    return typeof col === 'number'
  })

  // If all are fixedPx, just divide equally (respecting max widths)
  if (fixedPxCards.length === cards.length) {
    const percent = 100 / cards.length
    const widths: Record<string, number> = {}
    cards.forEach(card => {
      const maxWidthPx = getMaxWidth(card.type, mode)
      const maxWidthPercent = maxWidthPx ? (maxWidthPx / pxPerCol) * 100 : null
      widths[card.id] = maxWidthPercent ? Math.min(percent, maxWidthPercent) : percent
    })
    return widths
  }

  // Assign fixedPx cards their percent based on current pxPerCol
  const widths: Record<string, number> = {}
  let usedPercent = 0
  fixedPxCards.forEach(card => {
    const col = getColumnCount(card.type, mode)
    if (typeof col === 'object' && 'fixedPx' in col) {
      const percent = (col.fixedPx / pxPerCol) * 100
      const maxWidthPx = getMaxWidth(card.type, mode)
      const maxWidthPercent = maxWidthPx ? (maxWidthPx / pxPerCol) * 100 : null
      const finalPercent = maxWidthPercent ? Math.min(percent, maxWidthPercent) : percent
      widths[card.id] = finalPercent
      usedPercent += finalPercent
    }
  })

  // For flexible cards, use customWidths if present, but scale to remaining percent
  const rowCustomWidths = customWidths[rowId]
  const flexiblePercents: Record<string, number> = {}

  if (rowCustomWidths) {
    // Only use custom widths for flexible cards
    let totalCustom = 0
    let constrainedCards: CardItem[] = []
    let unconstrainedCards: CardItem[] = []
    let constrainedPercent = 0

    // First pass: identify constrained vs unconstrained cards
    flexibleCards.forEach(card => {
      const val = rowCustomWidths[card.id] ?? 0
      const maxWidthPx = getMaxWidth(card.type, mode)
      const maxWidthPercent = maxWidthPx ? (maxWidthPx / pxPerCol) * 100 : null

      // If we have a custom width, we respect it regardless of the default maxWidth
      if (rowCustomWidths[card.id] !== undefined) {
        unconstrainedCards.push(card)
        flexiblePercents[card.id] = rowCustomWidths[card.id]
        totalCustom += rowCustomWidths[card.id]
      } else if (maxWidthPercent && val > maxWidthPercent) {
        // This card is constrained by max width
        constrainedCards.push(card)
        flexiblePercents[card.id] = maxWidthPercent
        constrainedPercent += maxWidthPercent
      } else {
        // This card is not constrained
        unconstrainedCards.push(card)
        flexiblePercents[card.id] = val
        totalCustom += val
      }
    })

    // Calculate remaining space for unconstrained cards
    const remainingForFlexible = 100 - usedPercent - constrainedPercent
    const scale = totalCustom > 0 ? remainingForFlexible / totalCustom : 1

    // Apply scaling to unconstrained cards
    unconstrainedCards.forEach(card => {
      const scaledWidth = flexiblePercents[card.id] * scale

      // Only clamp if it wasn't a custom width
      if (rowCustomWidths[card.id] !== undefined) {
        widths[card.id] = scaledWidth
      } else {
        const maxWidthPx = getMaxWidth(card.type, mode)
        const maxWidthPercent = maxWidthPx ? (maxWidthPx / pxPerCol) * 100 : null
        widths[card.id] = maxWidthPercent ? Math.min(scaledWidth, maxWidthPercent) : scaledWidth
      }
    })

    // Apply constrained widths
    constrainedCards.forEach(card => {
      widths[card.id] = flexiblePercents[card.id]
    })
  } else {
    // Distribute by column count, but respect max widths
    let totalCols = 0
    let constrainedCards: CardItem[] = []
    let unconstrainedCards: CardItem[] = []
    let constrainedPercent = 0
    const remainingPercent = 100 - usedPercent

    // Calculate initial distribution
    const totalColsInitial = flexibleCards.reduce((sum, card) => {
      const col = getColumnCount(card.type, mode)
      return sum + (typeof col === 'number' ? col : 1)
    }, 0)

    // First pass: identify constrained cards
    flexibleCards.forEach(card => {
      const col = getColumnCount(card.type, mode)
      const cols = typeof col === 'number' ? col : 1
      const initialPercent = (cols / (totalColsInitial || 1)) * remainingPercent
      const maxWidthPx = getMaxWidth(card.type, mode)
      const maxWidthPercent = maxWidthPx ? (maxWidthPx / pxPerCol) * 100 : null

      if (maxWidthPercent && initialPercent > maxWidthPercent) {
        // This card is constrained by max width
        constrainedCards.push(card)
        constrainedPercent += maxWidthPercent
        widths[card.id] = maxWidthPercent
      } else {
        // This card is not constrained
        unconstrainedCards.push(card)
        totalCols += cols
      }
    })

    // Distribute remaining space among unconstrained cards
    const remainingForUnconstrained = remainingPercent - constrainedPercent
    unconstrainedCards.forEach(card => {
      const col = getColumnCount(card.type, mode)
      const cols = typeof col === 'number' ? col : 1
      const percent = (cols / (totalCols || 1)) * remainingForUnconstrained
      const maxWidthPx = getMaxWidth(card.type, mode)
      const maxWidthPercent = maxWidthPx ? (maxWidthPx / pxPerCol) * 100 : null
      widths[card.id] = maxWidthPercent ? Math.min(percent, maxWidthPercent) : percent
    })
  }

  return widths
}

export const ExamCardRenderer = React.memo<RenderCardProps>(({
  item,
  rowCards,
  mode,
  hideEyeLabels = false,
  matchHeight = false,
  detailProps,
  currentRowIndex = 0,
  currentCardIndex = 0,
  clipboardSourceType,
  onCopy,
  onPaste,
  onClearData,
  onCopyLeft,
  onCopyRight,
  onCopyBelow,
  onTitleChange
}) => {
  // Move hooks to the very top, before any logic or early returns
  const [isEditingNotesTitle, setIsEditingNotesTitle] = useState(false)
  const [isHoveringNotesTitle, setIsHoveringNotesTitle] = useState(false)
  const [isOrdersHistoryOpen, setIsOrdersHistoryOpen] = useState(false)
  const [, forceUpdate] = React.useReducer(x => x + 1, 0)

  const handleSelectOrder = (order: Order) => {
    setIsOrdersHistoryOpen(false);
    if (!order.order_data || item.type !== 'old-refraction') return;

    // Identify target tab
    const oldRefTabs = detailProps?.oldRefractionTabs?.[item.id] || [];
    const activeTabId = detailProps?.activeOldRefractionTabs?.[item.id] || (oldRefTabs.length > 0 ? oldRefTabs[0] : undefined);

    const tabId = activeTabId;
    const targetKey = tabId ? `old-refraction-${item.id}-${tabId}` : undefined;

    if (!targetKey) return;

    const handler = detailProps?.fieldHandlers?.[targetKey];
    const setFormData = detailProps?.setExamFormData;

    if (!setFormData) {
      toast.error("Error: Could not access form data setter");
      return;
    }

    const isContact = order.type === 'עדשות מגע' || (order as any).__contact;
    const orderData = order.order_data || {};

    let sourceData: any = {};
    if (isContact) {
      sourceData = orderData['contact-lens-exam'] || {};
    } else {
      sourceData = orderData['final-prescription'] || {};
    }

    // Perform bulk update
    setFormData(prev => {
      const prevTab = (prev[targetKey] as any) || {};
      const nextTab = { ...prevTab };

      // Ensure layout_instance_id is set
      if (nextTab.layout_instance_id == null && detailProps?.layoutInstanceId != null) {
        nextTab.layout_instance_id = detailProps.layoutInstanceId;
      }

      const updateFieldRaw = (key: string, value: any) => {
        if (value !== undefined && value !== null) {
          nextTab[key] = String(value);
        }
      };

      // Map fields
      ['r_sph', 'l_sph', 'r_cyl', 'l_cyl', 'r_ax', 'l_ax'].forEach(key => {
        updateFieldRaw(key, sourceData[key]);
      });

      if (!isContact) {
        ['r_pris', 'l_pris', 'r_base', 'l_base'].forEach(key => {
          updateFieldRaw(key, sourceData[key]);
        });
      }

      if (isContact) {
        if (sourceData['r_read_ad'] !== undefined) updateFieldRaw('r_ad', sourceData['r_read_ad']);
        if (sourceData['l_read_ad'] !== undefined) updateFieldRaw('l_ad', sourceData['l_read_ad']);
      } else {
        ['r_ad', 'l_ad'].forEach(key => {
          updateFieldRaw(key, sourceData[key]);
        });
      }

      return { ...prev, [targetKey]: nextTab };
    });

    toast.success("נתוני הבדיקה נמשכו מההזמנה");
  };

  if (mode === 'detail' && !detailProps) {
    console.error("detailProps are required for 'detail' mode.")
    return null
  }

  // Determine the final hideEyeLabels value based on item.showEyeLabels
  const finalHideEyeLabels = item.showEyeLabels ? false : hideEyeLabels;

  const toolbox = mode === 'detail' && detailProps?.isEditing ? (
    <ExamToolbox
      isEditing={detailProps.isEditing}
      mode='detail'
      currentCard={item}
      allRows={detailProps.allRows || []}
      currentRowIndex={currentRowIndex}
      currentCardIndex={currentCardIndex}
      clipboardSourceType={clipboardSourceType || null}
      onClearData={onClearData || (() => { })}
      onCopy={onCopy || (() => { })}
      onPaste={onPaste || (() => { })}
      onCopyLeft={onCopyLeft || (() => { })}
      onCopyRight={onCopyRight || (() => { })}
      onCopyBelow={onCopyBelow || (() => { })}
      onShowOrdersHistory={item.type === 'old-refraction' ? () => setIsOrdersHistoryOpen(true) : undefined}
    />
  ) : null

  const hasSiblingWithMiddleRow = rowCards.some(c => componentsWithMiddleRow.includes(c.type));
  const isComponentWithoutMiddleRow = componentsDontHaveMiddleRow.includes(item.type);
  const needsMiddleSpacer = isComponentWithoutMiddleRow && hasSiblingWithMiddleRow && rowCards.length > 1;

  const emptyOldRefractionData: OldRefractionExam = { layout_instance_id: 0 }
  const emptyOldRefractionExtensionData: OldRefractionExtensionExam = { layout_instance_id: 0 }
  const emptyObjectiveData: ObjectiveExam = { layout_instance_id: 0 }
  const emptySubjectiveData: SubjectiveExam = { layout_instance_id: 0 }
  const emptyAdditionData: AdditionExam = { layout_instance_id: 0 }
  const emptyFinalSubjectiveData: FinalSubjectiveExam = { layout_instance_id: 0 }
  const emptyFinalPrescriptionData: FinalPrescriptionExam = { layout_instance_id: 0 }
  const emptyCompactPrescriptionData: CompactPrescriptionExam = { layout_instance_id: 0 }
  const emptyRetinoscopData: RetinoscopExam = { layout_instance_id: 0 }
  const emptyRetinoscopDilationData: RetinoscopDilationExam = { layout_instance_id: 0 }
  const emptyUncorrectedVaData: UncorrectedVAExam = { layout_instance_id: 0 }
  const emptyKeratometerData: KeratometerExam = { layout_instance_id: 0 }
  const emptyKeratometerFullData: KeratometerFullExam = { layout_instance_id: 0 }
  const emptyCornealTopographyData: CornealTopographyExam = { layout_instance_id: 0 }
  const emptyCoverTestData: CoverTestExam = { layout_instance_id: 0 }
  const emptyAnamnesisData: AnamnesisExam = { layout_instance_id: 0 }
  const emptyNotesData: NotesExam = { layout_instance_id: 0 }
  const emptySchirmerTestData: SchirmerTestExam = { layout_instance_id: 0 }
  const emptyOldRefData: OldRefExam = { layout_instance_id: 0 }
  const emptyContactLensDiametersData: ContactLensDiameters = { layout_instance_id: 0 }
  const emptyContactLensDetailsData: ContactLensDetails = { layout_instance_id: 0 }
  const emptyKeratometerContactLensData: KeratometerContactLens = { layout_instance_id: 0 }
  const emptyContactLensExamData: ContactLensExam = { layout_instance_id: 0 }
  const emptyContactLensOrderData: ContactLensOrder = { layout_instance_id: 0 }
  const emptySensationVisionStabilityExam: SensationVisionStabilityExam = {
    layout_instance_id: 0,
    r_sensation: '',
    l_sensation: '',
    r_vision: '',
    l_vision: '',
    r_stability: '',
    l_stability: '',
    r_movement: '',
    l_movement: '',
    r_recommendations: '',
    l_recommendations: ''
  }
  const emptyFusionRangeData: FusionRangeExam = { layout_instance_id: 0 }
  const emptyMaddoxRodData: MaddoxRodExam = { layout_instance_id: 0 }
  const emptyOcularMotorAssessmentData: OcularMotorAssessmentExam = { layout_instance_id: 0 }
  const emptyDiopterAdjustmentPanelData: DiopterAdjustmentPanel = { layout_instance_id: 0 }
  const emptyOldContactLensesData: OldContactLenses = { layout_instance_id: 0 }
  const emptyOverRefractionData: OverRefraction = { layout_instance_id: 0 }

  const legacyHandlers = mode === 'detail' ? {
    handleMultifocalOldRefraction: detailProps!.handleMultifocalOldRefraction,
    handleVHConfirmOldRefraction: detailProps!.handleVHConfirmOldRefraction,
    handleVHConfirm: detailProps!.handleVHConfirm,
    handleMultifocalSubjective: detailProps!.handleMultifocalSubjective,
    handleFinalSubjectiveVHConfirm: detailProps!.handleFinalSubjectiveVHConfirm,
    handleMultifocalOldRefractionExtension: detailProps!.handleMultifocalOldRefractionExtension
  } : {}

  const getExamData = (type: ExamComponentType, cardInstanceId?: string) => {
    if (mode === 'detail' && detailProps) {
      // Prefer instance-specific data if available
      if (cardInstanceId) {
        const key = `${type}-${cardInstanceId}`
        if (detailProps.examFormData[key]) {
          return detailProps.examFormData[key]
        }
      }

      const data = getExamFormData(detailProps.examFormData, type)
      if (type === 'diopter-adjustment-panel') {
        console.log(`DiopterAdjustmentPanel: Getting exam data for ${type}:`, data)
      }
      return data
    }
    // Return empty/default data for editor mode
    switch (type) {
      case 'old-ref': return emptyOldRefData
      case 'old-refraction': return emptyOldRefractionData
      case 'old-refraction-extension': return emptyOldRefractionExtensionData
      case 'objective': return emptyObjectiveData
      case 'subjective': return emptySubjectiveData
      case 'addition': return emptyAdditionData
      case 'final-subjective': return emptyFinalSubjectiveData
      case 'final-prescription': return emptyFinalPrescriptionData
      case 'compact-prescription': return emptyCompactPrescriptionData
      case 'retinoscop': return emptyRetinoscopData
      case 'retinoscop-dilation': return emptyRetinoscopDilationData
      case 'uncorrected-va': return emptyUncorrectedVaData
      case 'keratometer': return emptyKeratometerData
      case 'keratometer-full': return emptyKeratometerFullData
      case 'corneal-topography': return emptyCornealTopographyData
      case 'cover-test': return emptyCoverTestData
      case 'anamnesis': return emptyAnamnesisData
      case 'notes': return emptyNotesData
      case 'schirmer-test': return emptySchirmerTestData
      case 'contact-lens-diameters': return emptyContactLensDiametersData
      case 'contact-lens-details': return emptyContactLensDetailsData
      case 'keratometer-contact-lens': return emptyKeratometerContactLensData
      case 'contact-lens-exam': return emptyContactLensExamData
      case 'sensation-vision-stability': return emptySensationVisionStabilityExam
      case 'diopter-adjustment-panel': return emptyDiopterAdjustmentPanelData
      case 'fusion-range': return emptyFusionRangeData
      case 'maddox-rod': return emptyMaddoxRodData
      case 'ocular-motor-assessment': return emptyOcularMotorAssessmentData
      case 'old-contact-lenses': return emptyOldContactLensesData
      case 'over-refraction': return emptyOverRefractionData
      default: return { layout_instance_id: 0 }
    }
  }

  const getChangeHandler = (type: ExamComponentType, cardInstanceId?: string) => {
    if (mode === 'detail' && detailProps) {
      // Prefer instance-specific handler if available
      if (cardInstanceId) {
        const key = `${type}-${cardInstanceId}`
        if (detailProps.fieldHandlers[key]) {
          return detailProps.fieldHandlers[key]
        }
      }

      return getFieldHandler(detailProps.fieldHandlers, type)
    }
    return () => { }
  }

  // Move hooks to top level
  const coverTestActiveTabsRef = React.useRef<Record<string, number>>({})

  switch (item.type) {
    case 'old-ref':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <OldRefTab
            oldRefData={getExamData('old-ref', item.id) as OldRefExam}
            onOldRefChange={getChangeHandler('old-ref', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
          />
        </div>
      )

    case 'old-refraction': {
      const oldRefTabs = detailProps?.oldRefractionTabs?.[item.id] || []
      // Get active tabId directly (not index)
      const activeTabId = detailProps?.activeOldRefractionTabs?.[item.id] || (oldRefTabs.length > 0 ? oldRefTabs[0] : undefined)
      // Derive the index for display purposes
      const activeTabIndex = activeTabId ? oldRefTabs.indexOf(activeTabId) : 0
      const displayActiveTab = activeTabIndex >= 0 ? activeTabIndex : 0

      // When user clicks a tab, store the tabId directly
      const setActiveTab = (idx: number) => {
        const newTabId = oldRefTabs[idx]
        if (newTabId) {
          detailProps?.setActiveOldRefractionTabs?.({ ...detailProps.activeOldRefractionTabs, [item.id]: newTabId });
          forceUpdate();
        }
      }

      const hasTabs = oldRefTabs.length > 0
      const tabId = activeTabId
      const oldRefKey = tabId ? `old-refraction-${item.id}-${tabId}` : undefined

      const oldRefData: OldRefractionExam = oldRefKey && detailProps?.examFormData?.[oldRefKey]
        ? (detailProps.examFormData[oldRefKey] as OldRefractionExam)
        : { layout_instance_id: detailProps?.layoutInstanceId ?? 0 }

      const allTabsData = oldRefTabs.map(tid => {
        const k = `old-refraction-${item.id}-${tid}`
        return (detailProps?.examFormData?.[k] as OldRefractionExam) || { layout_instance_id: detailProps?.layoutInstanceId ?? 0 }
      })

      const onOldRefChange = (field: keyof OldRefractionExam, value: string) => {
        if (!oldRefKey) return
        detailProps?.fieldHandlers?.[oldRefKey]?.(field, value)
      }

      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <OldRefractionTab
            key={`tab-${tabId}`}
            oldRefractionData={oldRefData}
            onOldRefractionChange={onOldRefChange}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            onMultifocalClick={legacyHandlers.handleMultifocalOldRefraction || (() => { })}
            onVHConfirm={legacyHandlers.handleVHConfirmOldRefraction || (() => { })}
            hideEyeLabels={finalHideEyeLabels}
            tabCount={oldRefTabs.length}
            activeTab={displayActiveTab}
            onTabChange={(idx) => setActiveTab(idx)}
            onAddTab={(type) => detailProps?.addOldRefractionTab?.(item.id, type)}
            onDeleteTab={(idx) => detailProps?.removeOldRefractionTab?.(item.id, idx)}
            onDuplicateTab={(idx) => detailProps?.duplicateOldRefractionTab?.(item.id, idx)}
            onUpdateType={(idx, type) => detailProps?.updateOldRefractionTabType?.(item.id, idx, type)}
            allTabsData={allTabsData}
          />
          {isOrdersHistoryOpen && (
            <OrdersHistoryModal
              isOpen={isOrdersHistoryOpen}
              onClose={() => setIsOrdersHistoryOpen(false)}
              clientId={detailProps?.exam?.client_id || detailProps?.formData?.client_id || 0}
              onSelectOrder={handleSelectOrder}
            />
          )}
        </div>
      )
    }

    case 'old-refraction-extension':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <OldRefractionExtensionTab
            oldRefractionExtensionData={getExamData('old-refraction-extension', item.id) as OldRefractionExtensionExam}
            onOldRefractionExtensionChange={getChangeHandler('old-refraction-extension', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            onMultifocalClick={legacyHandlers.handleMultifocalOldRefractionExtension || (() => { })}
            hideEyeLabels={finalHideEyeLabels}
          />
        </div>
      )

    case 'objective':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <ObjectiveTab
            objectiveData={getExamData('objective', item.id) as ObjectiveExam}
            onObjectiveChange={getChangeHandler('objective', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'subjective':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <SubjectiveTab
            subjectiveData={getExamData('subjective', item.id) as SubjectiveExam}
            onSubjectiveChange={getChangeHandler('subjective', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            onVHConfirm={(legacyHandlers as unknown as DetailProps).handleVHConfirm || (() => { })}
            onMultifocalClick={legacyHandlers.handleMultifocalSubjective || (() => { })}
            hideEyeLabels={finalHideEyeLabels}
          />
        </div>
      )

    case 'final-subjective':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <FinalSubjectiveTab
            finalSubjectiveData={getExamData('final-subjective', item.id) as FinalSubjectiveExam}
            onFinalSubjectiveChange={getChangeHandler('final-subjective', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            onVHConfirm={legacyHandlers.handleFinalSubjectiveVHConfirm || (() => { })}
            hideEyeLabels={finalHideEyeLabels}
          />
        </div>
      )

    case 'final-prescription':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <FinalPrescriptionTab
            finalPrescriptionData={getExamData('final-prescription', item.id) as FinalPrescriptionExam}
            onFinalPrescriptionChange={getChangeHandler('final-prescription', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
          />
        </div>
      )

    case 'compact-prescription':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <CompactPrescriptionTab
            data={getExamData('compact-prescription', item.id) as CompactPrescriptionExam}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            onChange={(field, value) => getChangeHandler('compact-prescription', item.id)(field as string, value)}
          />
        </div>
      )

    case 'addition':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <AdditionTab
            additionData={getExamData('addition', item.id) as AdditionExam}
            onAdditionChange={getChangeHandler('addition', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'retinoscop':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <RetinoscopTab
            retinoscopData={getExamData('retinoscop', item.id) as RetinoscopExam}
            onRetinoscopChange={getChangeHandler('retinoscop', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'retinoscop-dilation':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <RetinoscopDilationTab
            retinoscopDilationData={getExamData('retinoscop-dilation', item.id) as RetinoscopDilationExam}
            onRetinoscopDilationChange={getChangeHandler('retinoscop-dilation', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'uncorrected-va':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <UncorrectedVATab
            uncorrectedVaData={getExamData('uncorrected-va', item.id) as UncorrectedVAExam}
            onUncorrectedVaChange={getChangeHandler('uncorrected-va', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'keratometer':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <KeratometerTab
            keratometerData={getExamData('keratometer', item.id) as KeratometerExam}
            onKeratometerChange={getChangeHandler('keratometer', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'keratometer-full':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <KeratometerFullTab
            keratometerFullData={getExamData('keratometer-full', item.id) as KeratometerFullExam}
            onKeratometerFullChange={getChangeHandler('keratometer-full', item.id) as (field: keyof KeratometerFullExam, value: string | boolean) => void}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'corneal-topography':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <CornealTopographyTab
            cornealTopographyData={{
              ...getExamData('corneal-topography', item.id) as CornealTopographyExam,
              title: mode === 'editor' ? item.title : (getExamData('corneal-topography', item.id) as CornealTopographyExam).title
            }}
            onCornealTopographyChange={getChangeHandler('corneal-topography', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
            isEditorMode={mode === 'editor'}
            onTitleChange={onTitleChange}
          />
        </div>
      )

    case 'cover-test': {
      const coverTestTabs = detailProps?.coverTestTabs?.[item.id] || []
      const activeTab = detailProps?.activeCoverTestTabs?.[item.id] ?? 0
      const setActiveTab = (idx: number) => { detailProps?.setActiveCoverTestTabs?.({ ...detailProps.activeCoverTestTabs, [item.id]: idx }); forceUpdate(); }
      const hasTabs = coverTestTabs.length > 0
      const tabId = hasTabs ? (coverTestTabs[activeTab] || coverTestTabs[0]) : undefined
      const coverTestKey = tabId ? `cover-test-${item.id}-${tabId}` : undefined
      const coverTestData: CoverTestExam = coverTestKey && detailProps?.examFormData?.[coverTestKey]
        ? (detailProps.examFormData[coverTestKey] as CoverTestExam)
        : { layout_instance_id: detailProps?.layoutInstanceId ?? 0 }
      const onCoverTestChange = (field: keyof CoverTestExam, value: string) => {
        if (!coverTestKey) return
        detailProps?.fieldHandlers?.[coverTestKey]?.(field, value)
      }
      const handleTabChange = (idx: number) => setActiveTab(idx)
      const handleAddTab = () => detailProps?.addCoverTestTab?.(item.id)
      const handleDeleteTab = async (idx: number) => {
        if (coverTestTabs.length <= 1) return;
        const newTabs = [...coverTestTabs]
        const removedTabId = newTabs.splice(idx, 1)[0]
        const key = `cover-test-${item.id}-${removedTabId}`
        const tabData = detailProps?.examFormData?.[key] as CoverTestExam
        if (tabData && tabData.id) {
        }
        detailProps?.setExamFormData?.(prev => {
          const newData = { ...prev }
          delete newData[key]
          return newData
        })
        if (detailProps?.setCoverTestTabs) {
          detailProps.setCoverTestTabs((prev: Record<string, string[]>) => ({
            ...prev,
            [item.id]: newTabs
          }))
        }
        if (activeTab >= newTabs.length) setActiveTab(newTabs.length - 1)
      }
      const handleDuplicateTab = async (idx: number) => {
        if (coverTestTabs.length >= 5) return;
        const newTabs = [...coverTestTabs]
        const sourceTabId = newTabs[idx]
        const sourceKey = `cover-test-${item.id}-${sourceTabId}`
        const sourceData = detailProps?.examFormData?.[sourceKey] as CoverTestExam
        if (!sourceData) return;
        const newTabId = uuidv4()
        newTabs.splice(idx + 1, 0, newTabId)
        // Prefill the new tab's data, but do not set id, card_instance_id, tab_index
        const {
          deviation_type,
          deviation_direction,
          fv_1,
          fv_2,
          nv_1,
          nv_2
        } = sourceData
        detailProps?.setExamFormData?.(prev => {
          const newData = { ...prev }
          newData[`cover-test-${item.id}-${newTabId}`] = {
            deviation_type,
            deviation_direction,
            fv_1,
            fv_2,
            nv_1,
            nv_2,
            layout_instance_id: detailProps?.layoutInstanceId,
            card_id: sourceData.card_id || item.id,
            card_instance_id: newTabId,
            tab_index: idx + 1
          }
          return newData
        })
        if (detailProps?.setCoverTestTabs) {
          detailProps.setCoverTestTabs((prev: Record<string, string[]>) => ({
            ...prev,
            [item.id]: newTabs
          }))
        }
        setActiveTab(idx + 1)
      }
      // Data is now loaded via the unified API in the parent component
      // No need to load individual component data here
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <CoverTestTab
            key={`tab-${tabId}`}
            coverTestData={coverTestData}
            onCoverTestChange={onCoverTestChange}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
            instanceLabel={String(activeTab + 1)}
            tabCount={coverTestTabs.length}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onAddTab={handleAddTab}
            onDeleteTab={handleDeleteTab}
            onDuplicateTab={handleDuplicateTab}
          />
        </div>
      )
    }

    case 'anamnesis':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <AnamnesisTab
            anamnesisData={getExamData('anamnesis', item.id) as AnamnesisExam}
            onAnamnesisChange={getChangeHandler('anamnesis', item.id) as (field: keyof AnamnesisExam, value: string | boolean) => void}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
          />
        </div>
      )

    case 'schirmer-test':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <SchirmerTestTab
            schirmerTestData={getExamData('schirmer-test', item.id) as SchirmerTestExam}
            onSchirmerTestChange={getChangeHandler('schirmer-test', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'notes': {
      const notesData = getExamData('notes', item.id) as NotesExam
      const onNotesChange = getChangeHandler('notes', item.id)

      const handleNotesTitleChange = (value: string) => {
        if (mode === 'editor' && onTitleChange) {
          onTitleChange(value)
        } else {
          onNotesChange('title', value)
        }
      }

      const handleNotesKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          setIsEditingNotesTitle(false)
        }
      }

      const notesTitle = mode === 'editor' ? (item.title || notesData.title || "הערות") : (notesData.title || item.title || "הערות")


      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          <NotesCard
            title={
              isEditingNotesTitle && mode === 'editor' ? (
                <Input
                  value={notesTitle}
                  onChange={(e) => handleNotesTitleChange(e.target.value)}
                  onBlur={() => setIsEditingNotesTitle(false)}
                  onKeyDown={handleNotesKeyDown}
                  className="text-base font-medium text-muted-foreground border-none bg-transparent px-1 w-fit"
                  autoFocus
                />
              ) : (
                <div
                  className=""
                  onMouseEnter={() => setIsHoveringNotesTitle(true)}
                  onMouseLeave={() => setIsHoveringNotesTitle(false)}
                  onClick={() => mode === 'editor' && setIsEditingNotesTitle(true)}
                >
                  <h3 className="text-base font-medium text-muted-foreground">
                    {notesTitle}
                  </h3>
                  {isHoveringNotesTitle && mode === 'editor' && (
                    <Edit3
                      size={14}
                      className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    />
                  )}
                </div>
              )
            }
            value={notesData.note || ''}
            onChange={(value) => onNotesChange('note', value)}
            disabled={!detailProps?.isEditing}
            height={matchHeight ? 'full' : undefined}
            placeholder={detailProps?.isEditing ? "הערות..." : ""}
          />
        </div>
      )
    }

    case 'contact-lens-diameters':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <ContactLensDiametersTab
            contactLensDiametersData={getExamData('contact-lens-diameters', item.id) as ContactLensDiameters}
            onContactLensDiametersChange={getChangeHandler('contact-lens-diameters', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
          />
        </div>
      )

    case 'contact-lens-details':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <ContactLensDetailsTab
            contactLensDetailsData={getExamData('contact-lens-details', item.id) as ContactLensDetails}
            onContactLensDetailsChange={getChangeHandler('contact-lens-details', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'keratometer-contact-lens':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <KeratometerContactLensTab
            keratometerContactLensData={getExamData('keratometer-contact-lens', item.id) as KeratometerContactLens}
            onKeratometerContactLensChange={getChangeHandler('keratometer-contact-lens', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'contact-lens-exam':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <ContactLensExamTab
            contactLensExamData={getExamData('contact-lens-exam', item.id) as ContactLensExam}
            onContactLensExamChange={getChangeHandler('contact-lens-exam', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
          />
        </div>
      )

    case 'sensation-vision-stability':
      return (
        <div className="relative">
          {toolbox}
          <ObservationTab
            data={getExamData('sensation-vision-stability', item.id) as SensationVisionStabilityExam}
            onChange={getChangeHandler('sensation-vision-stability', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
          />
        </div>
      )

    case 'diopter-adjustment-panel':
      return (
        <DiopterAdjustmentPanelTab
          diopterData={getExamData('diopter-adjustment-panel', item.id) as DiopterAdjustmentPanel}
          onDiopterChange={getChangeHandler('diopter-adjustment-panel', item.id)}
          isEditing={mode === 'detail' ? detailProps!.isEditing : false}
        />
      );

    case 'fusion-range':
      return (
        <div className="relative">
          {toolbox}
          <FusionRangeTab
            fusionRangeData={(() => {
              const data = getExamData('fusion-range', item.id) as FusionRangeExam;
              // Convert numeric fields to strings for the component
              return {
                ...data,
                fv_base_in: data.fv_base_in?.toString() || '',
                fv_base_in_recovery: data.fv_base_in_recovery?.toString() || '',
                nv_base_in: data.nv_base_in?.toString() || '',
                nv_base_in_recovery: data.nv_base_in_recovery?.toString() || '',
                fv_base_out: data.fv_base_out?.toString() || '',
                fv_base_out_recovery: data.fv_base_out_recovery?.toString() || '',
                nv_base_out: data.nv_base_out?.toString() || '',
                nv_base_out_recovery: data.nv_base_out_recovery?.toString() || '',
              };
            })()}
            onFusionRangeChange={getChangeHandler('fusion-range', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
            hideEyeLabels={finalHideEyeLabels}
          />
        </div>
      );

    case 'maddox-rod':
      return (
        <div className="relative">
          {toolbox}
          <MaddoxRodTab
            maddoxRodData={getExamData('maddox-rod', item.id) as MaddoxRodExam}
            onMaddoxRodChange={getChangeHandler('maddox-rod', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      );

    case 'stereo-test':
      return (
        <div className="relative">
          {toolbox}
          <StereoTestTab
            stereoTestData={getExamData('stereo-test', item.id) as StereoTestExam}
            onStereoTestChange={getChangeHandler('stereo-test', item.id) as (field: keyof StereoTestExam, value: string | boolean | number) => void}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      );

    case 'rg':
      return (
        <div className="relative">
          {toolbox}
          <RGTab
            rgData={getExamData('rg', item.id) as RGExam}
            onRGChange={getChangeHandler('rg', item.id) as (field: keyof RGExam, value: string | null) => void}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      );

    case 'old-contact-lenses':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <OldContactLensesTab
            data={getExamData('old-contact-lenses', item.id) as OldContactLenses}
            onChange={getChangeHandler('old-contact-lenses', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
          />
        </div>
      );
    case 'over-refraction':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <OverRefractionTab
            data={getExamData('over-refraction', item.id) as OverRefraction}
            onChange={getChangeHandler('over-refraction', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={finalHideEyeLabels}
          />
        </div>
      );

    case 'ocular-motor-assessment':
      return (
        <div className="relative">
          {toolbox}
          <OcularMotorAssessmentTab
            ocularMotorAssessmentData={getExamData('ocular-motor-assessment', item.id) as OcularMotorAssessmentExam}
            onOcularMotorAssessmentChange={getChangeHandler('ocular-motor-assessment', item.id)}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      );

    default:
      return null;
  }
}, (prev, next) => {
  // 1. Basic prop checks
  if (prev.isEditing !== next.isEditing) return false;
  if (prev.mode !== next.mode) return false;
  if (prev.item.id !== next.item.id) return false;
  if (prev.item.type !== next.item.type) return false;
  if (prev.item.title !== next.item.title) return false;
  if (prev.item.showEyeLabels !== next.item.showEyeLabels) return false;
  if (prev.hideEyeLabels !== next.hideEyeLabels) return false;
  if (prev.matchHeight !== next.matchHeight) return false;
  if (prev.clipboardSourceType !== next.clipboardSourceType) return false;
  if (prev.currentRowIndex !== next.currentRowIndex) return false;
  if (prev.currentCardIndex !== next.currentCardIndex) return false;

  // 2. Data check (The most important part)
  if (next.mode === 'detail' && prev.detailProps && next.detailProps) {
    const prevData = prev.detailProps.examFormData;
    const nextData = next.detailProps.examFormData;
    const type = next.item.type;
    const id = next.item.id;

    // Check specific tab data for multi-tab components
    if (type === 'old-refraction') {
      const prevTabs = prev.detailProps.oldRefractionTabs?.[id] || [];
      const nextTabs = next.detailProps.oldRefractionTabs?.[id] || [];
      if (prevTabs.length !== nextTabs.length) return false;

      const prevActiveId = prev.detailProps.activeOldRefractionTabs?.[id];
      const nextActiveId = next.detailProps.activeOldRefractionTabs?.[id];
      if (prevActiveId !== nextActiveId) return false;

      // Check current tab data
      if (nextActiveId) {
        const key = `old-refraction-${id}-${nextActiveId}`;
        if (prevData[key] !== nextData[key]) return false;
      }
      return true;
    }

    if (type === 'cover-test') {
      const prevTabs = prev.detailProps.coverTestTabs?.[id] || [];
      const nextTabs = next.detailProps.coverTestTabs?.[id] || [];
      if (prevTabs.length !== nextTabs.length) return false;

      const prevActiveIdx = prev.detailProps.activeCoverTestTabs?.[id];
      const nextActiveIdx = next.detailProps.activeCoverTestTabs?.[id];
      if (prevActiveIdx !== nextActiveIdx) return false;

      if (nextActiveIdx !== undefined) {
        const tabId = nextTabs[nextActiveIdx];
        if (tabId) {
          const key = `cover-test-${id}-${tabId}`;
          if (prevData[key] !== nextData[key]) return false;
        }
      }
      return true;
    }

    // Default: Check the data for this component type + ID
    const key = `${type}-${id}`;
    if (prevData[key] !== nextData[key]) return false;

    // Also check the generic type key (some components use it as fallback)
    if (prevData[type] !== nextData[type]) return false;
  }

  return true;
});