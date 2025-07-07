import React from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { OldRefractionTab } from "@/components/exam/OldRefractionTab"
import { OldRefractionExtensionTab } from "@/components/exam/OldRefractionExtensionTab"
import { ObjectiveTab } from "@/components/exam/ObjectiveTab"
import { SubjectiveTab } from "@/components/exam/SubjectiveTab"
import { AdditionTab } from "@/components/exam/AdditionTab"
import { FinalSubjectiveTab } from "@/components/exam/FinalSubjectiveTab"
import { RetinoscopTab } from "@/components/exam/RetinoscopTab"
import { RetinoscopDilationTab } from "@/components/exam/RetinoscopDilationTab"
import { UncorrectedVATab } from "@/components/exam/UncorrectedVATab"
import { KeratometerTab } from "@/components/exam/KeratometerTab"
import { CoverTestTab } from "@/components/exam/CoverTestTab"
import { OpticalExam, OldRefractionExam, OldRefractionExtensionExam, ObjectiveExam, SubjectiveExam, AdditionExam, FinalSubjectiveExam, RetinoscopExam, RetinoscopDilationExam, UncorrectedVAExam, KeratometerExam, CoverTestExam } from "@/lib/db/schema"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserSelect } from "@/components/ui/user-select"
import { ExamToolbox, ToolboxActions } from "@/components/exam/ExamToolbox"
import { ExamComponentType } from "@/lib/exam-field-mappings"
import { examComponentRegistry } from "@/lib/exam-component-registry"
import { toast } from "sonner"

// Renaming for consistency within the component props
type Exam = OpticalExam;

const componentsWithMiddleRow: CardItem['type'][] = ['old-refraction', 'old-refraction-extension', 'subjective', 'final-subjective'];
const componentsDontHaveMiddleRow: CardItem['type'][] = ['objective', 'addition', 'retinoscop', 'retinoscop-dilation', 'uncorrected-va', 'keratometer', 'cover-test'];

export interface CardItem {
  id: string
  type: 'exam-details' | 'old-refraction' | 'old-refraction-extension' | 'objective' | 'subjective' | 'final-subjective' | 'addition' | 'retinoscop' | 'retinoscop-dilation' | 'uncorrected-va' | 'keratometer' | 'cover-test' | 'notes'
}

// Simplified DetailProps interface that uses the registry
export interface DetailProps {
  isEditing: boolean;
  isNewMode: boolean;
  exam: Exam | null | undefined;
  formData: Partial<Exam>;
  examFormData: Record<string, any>; // All exam component form data
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
}

// Helper functions to get data and handlers from registry
const getExamFormData = (examFormData: Record<string, any>, componentType: ExamComponentType) => {
  return examFormData[componentType] || {}
}

const getFieldHandler = (fieldHandlers: Record<string, any>, componentType: ExamComponentType) => {
  return fieldHandlers[componentType] || (() => {})
}

// Utility function to create DetailProps from registry data
export const createDetailProps = (
  isEditing: boolean,
  isNewMode: boolean,
  exam: Exam | null | undefined,
  formData: Partial<Exam>,
  examFormData: Record<string, any>,
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
    ...legacyHandlers
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
}

// In ExamDetailPage, `DateInput` was used, but it's not a standard component.
// It was probably a regular input with type="date". Let's handle it here.
const DateInput = (props: React.ComponentProps<typeof Input> & {value: any}) => {
    const { value, ...rest } = props;
    const dateValue = value ? new Date(value).toISOString().split('T')[0] : '';
    return <Input type="date" value={dateValue} {...rest} />;
};

const getColumnCount = (type: CardItem['type']): number => {
  switch (type) {
    case 'exam-details': return 5
    case 'old-refraction': return 7
    case 'old-refraction-extension': return 12
    case 'objective': return 4
    case 'subjective': return 10
    case 'final-subjective': return 11
    case 'addition': return 7
    case 'retinoscop': return 4
    case 'retinoscop-dilation': return 4
    case 'uncorrected-va': return 3
    case 'keratometer': return 3
    case 'cover-test': return 5
    case 'notes': return 2
    default: return 1
  }
}

export const hasNoteCard = (cards: CardItem[]): boolean => {
  return cards.some(card => card.type === 'notes')
}

export const calculateCardWidth = (cards: CardItem[], rowId: string, customWidths: Record<string, Record<string, number>>): Record<string, number> => {
    if (cards.length === 1) {
      return { [cards[0].id]: 100 }
    }
  
    const rowCustomWidths = customWidths[rowId]
    
    // Check if custom widths are valid for the current set of cards
    if (rowCustomWidths) {
      const customWidthKeys = Object.keys(rowCustomWidths);
      const cardIds = cards.map(c => c.id);
      
      const areKeysIdentical = customWidthKeys.length === cardIds.length && customWidthKeys.every(key => cardIds.includes(key));
      
      if (areKeysIdentical) {
        // Custom widths are valid, use them
        const widths: Record<string, number> = {}
        let totalCustomWidth = 0
        
        cards.forEach(card => {
          widths[card.id] = rowCustomWidths[card.id]
          totalCustomWidth += rowCustomWidths[card.id]
        })

        // Normalize widths to sum to 100% in case of minor floating point errors
        if (Math.abs(100 - totalCustomWidth) > 0.1) {
            const scale = 100 / totalCustomWidth;
            Object.keys(widths).forEach(key => {
                widths[key] *= scale;
            });
        }
        
        return widths
      }
    }
  
    // Default behavior: distribute based on column count
    const totalColumns = cards.reduce((sum, card) => sum + getColumnCount(card.type), 0)
    const widths: Record<string, number> = {}
  
    cards.forEach(card => {
      const cardColumns = getColumnCount(card.type)
      widths[card.id] = (cardColumns / totalColumns) * 100
    })
  
    return widths
  }

export const ExamCardRenderer: React.FC<RenderCardProps> = ({ 
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
  onCopyBelow
}) => {
  if (mode === 'detail' && !detailProps) {
    console.error("detailProps are required for 'detail' mode.")
    return null
  }

  const toolbox = mode === 'detail' && detailProps?.isEditing ? (
    <ExamToolbox
      isEditing={detailProps.isEditing}
      mode='detail'
      currentCard={item}
      allRows={detailProps.allRows || []}
      currentRowIndex={currentRowIndex}
      currentCardIndex={currentCardIndex}
      clipboardSourceType={clipboardSourceType || null}
      onClearData={onClearData || (() => {})}
      onCopy={onCopy || (() => {})}
      onPaste={onPaste || (() => {})}
      onCopyLeft={onCopyLeft || (() => {})}
      onCopyRight={onCopyRight || (() => {})}
      onCopyBelow={onCopyBelow || (() => {})}
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
  const emptyRetinoscopData: RetinoscopExam = { layout_instance_id: 0 }
  const emptyRetinoscopDilationData: RetinoscopDilationExam = { layout_instance_id: 0 }
  const emptyUncorrectedVaData: UncorrectedVAExam = { layout_instance_id: 0 }
  const emptyKeratometerData: KeratometerExam = { layout_instance_id: 0 }
  const emptyCoverTestData: CoverTestExam = { layout_instance_id: 0 }

  const legacyHandlers = mode === 'detail' ? {
    handleMultifocalOldRefraction: detailProps!.handleMultifocalOldRefraction,
    handleVHConfirmOldRefraction: detailProps!.handleVHConfirmOldRefraction,
    handleVHConfirm: detailProps!.handleVHConfirm,
    handleMultifocalSubjective: detailProps!.handleMultifocalSubjective,
    handleFinalSubjectiveVHConfirm: detailProps!.handleFinalSubjectiveVHConfirm,
    handleMultifocalOldRefractionExtension: detailProps!.handleMultifocalOldRefractionExtension
  } : {}

  const getExamData = (type: ExamComponentType) => {
    if (mode === 'detail' && detailProps) {
      return getExamFormData(detailProps.examFormData, type)
    }
    // Return empty/default data for editor mode
    switch (type) {
      case 'old-refraction': return emptyOldRefractionData
      case 'old-refraction-extension': return emptyOldRefractionExtensionData
      case 'objective': return emptyObjectiveData
      case 'subjective': return emptySubjectiveData
      case 'addition': return emptyAdditionData
      case 'final-subjective': return emptyFinalSubjectiveData
      case 'retinoscop': return emptyRetinoscopData
      case 'retinoscop-dilation': return emptyRetinoscopDilationData
      case 'uncorrected-va': return emptyUncorrectedVaData
      case 'keratometer': return emptyKeratometerData
      case 'cover-test': return emptyCoverTestData
      default: return {}
    }
  }

  const getChangeHandler = (type: ExamComponentType) => {
    if (mode === 'detail' && detailProps) {
      return getFieldHandler(detailProps.fieldHandlers, type)
    }
    return () => {}
  }

  switch (item.type) {
    case 'exam-details':
     return (
          <Card className="w-full p-4  shadow-md border-none ">
            <div className="grid grid-cols-5 gap-x-3 gap-y-2 w-full" dir="rtl">
              <div className="col-span-1">
                <label className="font-semibold text-base">תאריך בדיקה</label>
                <div className="h-1"></div>
                <DateInput
                  name="exam_date"
                  dir="rtl"
                  className={`px-14 h-9 ${mode === 'editor' ? 'bg-accent/50' : detailProps?.isNewMode ? 'bg-white' : detailProps?.isEditing ? 'bg-white' : 'bg-accent/50'}`}
                  value={mode === 'editor' ? new Date().toISOString().split('T')[0] : detailProps?.formData.exam_date}
                  onChange={mode === 'editor' ? () => {} : detailProps?.handleInputChange}
                  disabled={mode === 'editor' ? true : !detailProps?.isEditing}
                />
              </div>
              <div className="col-span-1">
                <label className="font-semibold text-base">שם הבדיקה</label>
                <div className="h-1"></div>
                {mode === 'editor' ? (
                  <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">דוגמה</div>
                ) : detailProps?.isEditing ? (
                  <Input
                    type="text"
                    name="test_name"
                    value={detailProps.formData.test_name || ''}
                    onChange={detailProps.handleInputChange}
                    className="text-sm pt-1 bg-white"
                  />
                ) : (
                  <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">{detailProps?.isNewMode ? detailProps.formData.test_name : detailProps?.exam?.test_name}</div>
                )}
              </div>
              <div className="col-span-1">
                <label className="font-semibold text-base">סניף</label>
                <div className="h-1"></div>
                {mode === 'editor' ? (
                  <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">דוגמה</div>
                ) : detailProps?.isEditing ? (
                  <Input
                    type="text"
                    name="clinic"
                    value={detailProps.formData.clinic || ''}
                    onChange={detailProps.handleInputChange}
                    className="text-sm bg-white"
                  />
                ) : (
                  <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">{detailProps?.isNewMode ? detailProps?.formData.clinic : detailProps?.exam?.clinic}</div>
                )}
              </div>
              <div className="col-span-1">
                <label className="font-semibold text-base">בודק</label>
                <div className="h-1"></div>
                <UserSelect
                  value={mode === 'editor' ? 0 : detailProps?.formData.user_id}
                  disabled={mode === 'editor' ? false : !detailProps?.isEditing}
                  onValueChange={(userId) => mode === 'editor' ? () => {} : detailProps?.setFormData((prev: Partial<Exam>) => ({ ...prev, user_id: userId }))}
                />
              </div>
              <div className="col-span-1">
                <label className="font-semibold text-base">עין דומיננטית</label>
                <div className="h-1 w-full"></div>
                <Select dir="rtl"
                  disabled={mode === 'editor' ? false : !detailProps?.isEditing}
                  value={ mode === 'editor' ? 'R' : detailProps?.formData.dominant_eye || ''}
                  onValueChange={(value) => mode === 'editor' ? () => {} : detailProps?.handleSelectChange(value, 'dominant_eye')}
                >
                  <SelectTrigger className={`h-6 text-sm w-full ${mode === 'editor' ? 'bg-white' : detailProps?.isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
                    <SelectValue placeholder="בחר עין" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R" className="text-sm">ימין</SelectItem>
                    <SelectItem value="L" className="text-sm">שמאל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )

    case 'old-refraction':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <OldRefractionTab
            oldRefractionData={getExamData('old-refraction')}
            onOldRefractionChange={getChangeHandler('old-refraction')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            onMultifocalClick={legacyHandlers.handleMultifocalOldRefraction || (() => {})}
            onVHConfirm={legacyHandlers.handleVHConfirmOldRefraction || (() => {})}
            hideEyeLabels={hideEyeLabels}
          />
        </div>
      )

    case 'old-refraction-extension':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <OldRefractionExtensionTab
            oldRefractionExtensionData={getExamData('old-refraction-extension')}
            onOldRefractionExtensionChange={getChangeHandler('old-refraction-extension')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            onMultifocalClick={legacyHandlers.handleMultifocalOldRefractionExtension || (() => {})}
            hideEyeLabels={hideEyeLabels}
          />
        </div>
      )

    case 'objective':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <ObjectiveTab
            objectiveData={getExamData('objective')}
            onObjectiveChange={getChangeHandler('objective')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={hideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'subjective':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <SubjectiveTab
            subjectiveData={getExamData('subjective')}
            onSubjectiveChange={getChangeHandler('subjective')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            onVHConfirm={(legacyHandlers as any).handleVHConfirm || (() => {})}
            onMultifocalClick={legacyHandlers.handleMultifocalSubjective || (() => {})}
            hideEyeLabels={hideEyeLabels}
          />
        </div>
      )

    case 'final-subjective':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <FinalSubjectiveTab
            finalSubjectiveData={getExamData('final-subjective')}
            onFinalSubjectiveChange={getChangeHandler('final-subjective')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            onVHConfirm={legacyHandlers.handleFinalSubjectiveVHConfirm || (() => {})}
            hideEyeLabels={hideEyeLabels}
          />
        </div>
      )

    case 'addition':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <AdditionTab
            additionData={getExamData('addition')}
            onAdditionChange={getChangeHandler('addition')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={hideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'retinoscop':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <RetinoscopTab
            retinoscopData={getExamData('retinoscop')}
            onRetinoscopChange={getChangeHandler('retinoscop')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={hideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'retinoscop-dilation':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <RetinoscopDilationTab
            retinoscopDilationData={getExamData('retinoscop-dilation')}
            onRetinoscopDilationChange={getChangeHandler('retinoscop-dilation')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={hideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'uncorrected-va':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <UncorrectedVATab
            uncorrectedVaData={getExamData('uncorrected-va')}
            onUncorrectedVaChange={getChangeHandler('uncorrected-va')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={hideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'keratometer':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <KeratometerTab
            keratometerData={getExamData('keratometer')}
            onKeratometerChange={getChangeHandler('keratometer')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            hideEyeLabels={hideEyeLabels}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'cover-test':
      return (
        <div className={`relative h-full ${matchHeight ? 'flex flex-col' : ''}`}>
          {toolbox}
          <CoverTestTab
            coverTestData={getExamData('cover-test')}
            onCoverTestChange={getChangeHandler('cover-test')}
            isEditing={mode === 'detail' ? detailProps!.isEditing : false}
            needsMiddleSpacer={hasSiblingWithMiddleRow && componentsDontHaveMiddleRow.includes(item.type)}
          />
        </div>
      )

    case 'notes':
      return (
        <Card className={`w-full p-5 shadow-md border-none ${matchHeight ? 'h-full flex flex-col' : ''}`} dir="rtl">
          <label className="block text-base font-semibold mb-[-10px]">הערות</label>
          <textarea
            name="notes"
            disabled={!detailProps?.isEditing}
            value={detailProps?.formData.notes || ''}
            onChange={detailProps?.handleInputChange}
            className={`text-sm w-full p-3 border rounded-xl ${detailProps?.isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${matchHeight ? 'flex-1' : 'min-h-[90px]'}`}
            rows={matchHeight ? undefined : 4}
          />
        </Card>
      )
    default:
      return null
  }
} 