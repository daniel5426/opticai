import React from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { OldRefractionTab, ObjectiveTab } from "@/components/exam/OldRefractionObjectiveTab"
import { SubjectiveTab } from "@/components/exam/SubjectiveTab"
import { AdditionTab } from "@/components/exam/AdditionTab"
import { FinalSubjectiveTab } from "@/components/exam/FinalSubjectiveTab"
import { OpticalExam, OldRefractionExam, ObjectiveExam, SubjectiveExam, AdditionExam, FinalSubjectiveExam } from "@/lib/db/schema"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserSelect } from "@/components/ui/user-select"

// Renaming for consistency within the component props
type Exam = OpticalExam;

const componentsWithMiddleRow: CardItem['type'][] = ['old-refraction', 'subjective', 'final-subjective'];
const componentsDontHaveMiddleRow: CardItem['type'][] = ['objective', 'addition'];

export interface CardItem {
  id: string
  type: 'exam-details' | 'old-refraction' | 'objective' | 'subjective' | 'final-subjective' | 'addition' | 'notes'
}

export interface DetailProps {
  isEditing: boolean;
  isNewMode: boolean;
  exam: Exam | null | undefined;
  formData: Partial<Exam>;
  oldRefractionFormData: OldRefractionExam;
  objectiveFormData: ObjectiveExam;
  subjectiveFormData: SubjectiveExam;
  finalSubjectiveFormData: FinalSubjectiveExam;
  additionFormData: AdditionExam;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (value: string, name: string) => void;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Exam>>>;
  handleOldRefractionFieldChange: (field: keyof OldRefractionExam, value: string) => void;
  handleObjectiveFieldChange: (field: keyof ObjectiveExam, value: string) => void;
  handleSubjectiveFieldChange: (field: keyof SubjectiveExam, value: string) => void;
  handleFinalSubjectiveChange: (field: keyof FinalSubjectiveExam, value: string) => void;
  handleAdditionFieldChange: (field: keyof AdditionExam, value: string) => void;
  handleMultifocalOldRefraction: () => void;
  handleVHConfirmOldRefraction: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  handleVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  handleMultifocalSubjective: () => void;
  handleFinalSubjectiveVHConfirm: (rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string, leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string) => void;
}

interface RenderCardProps {
  item: CardItem;
  rowCards: CardItem[];
  mode: 'editor' | 'detail';
  hideEyeLabels?: boolean;
  matchHeight?: boolean;
  detailProps?: DetailProps;
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
    case 'old-refraction': return 15
    case 'objective': return 15
    case 'subjective': return 22
    case 'final-subjective': return 22
    case 'addition': return 7
    case 'notes': return 1
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
    
    // Handle custom widths for any number of cards
    if (rowCustomWidths) {
      const widths: Record<string, number> = {}
      let totalCustomWidth = 0
      let cardsWithCustomWidth = 0
      
      // First pass: assign custom widths and calculate total
      cards.forEach(card => {
        if (rowCustomWidths[card.id] !== undefined) {
          widths[card.id] = rowCustomWidths[card.id]
          totalCustomWidth += rowCustomWidths[card.id]
          cardsWithCustomWidth++
        }
      })
      
      // If we have custom widths, handle the remaining cards
      if (cardsWithCustomWidth > 0) {
        const remainingWidth = 100 - totalCustomWidth
        const cardsWithoutCustomWidth = cards.length - cardsWithCustomWidth
        
        if (cardsWithoutCustomWidth > 0) {
          const defaultWidthPerCard = remainingWidth / cardsWithoutCustomWidth
          cards.forEach(card => {
            if (rowCustomWidths[card.id] === undefined) {
              widths[card.id] = defaultWidthPerCard
            }
          })
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

export const ExamCardRenderer: React.FC<RenderCardProps> = ({ item, rowCards, mode, hideEyeLabels = false, matchHeight = false, detailProps }) => {
  if (mode === 'detail' && !detailProps) {
    console.error("detailProps are required for 'detail' mode.")
    return null
  }

  const hasSiblingWithMiddleRow = rowCards.some(c => componentsWithMiddleRow.includes(c.type));
  const isComponentWithoutMiddleRow = componentsDontHaveMiddleRow.includes(item.type);
  const needsMiddleSpacer = isComponentWithoutMiddleRow && hasSiblingWithMiddleRow && rowCards.length > 1;

  const emptyOldRefractionData: OldRefractionExam = { layout_id: 0 }
  const emptyObjectiveData: ObjectiveExam = { layout_id: 0 }
  const emptySubjectiveData: SubjectiveExam = { layout_id: 0 }
  const emptyAdditionData: AdditionExam = { layout_id: 0 }
  const emptyFinalSubjectiveData: FinalSubjectiveExam = { layout_id: 0 }

  switch (item.type) {
    case 'exam-details':
     return (
          <Card className="w-full p-4  shadow-md border-[1px] ">
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
        <OldRefractionTab
          oldRefractionData={mode === 'editor' ? emptyOldRefractionData : detailProps!.oldRefractionFormData}
          onOldRefractionChange={mode === 'editor' ? () => {} : detailProps!.handleOldRefractionFieldChange}
          isEditing={mode === 'editor' ? false : detailProps!.isEditing}
          onMultifocalClick={mode === 'editor' ? () => {} : detailProps!.handleMultifocalOldRefraction}
          onVHConfirm={mode === 'editor' ? () => {} : detailProps!.handleVHConfirmOldRefraction}
          hideEyeLabels={hideEyeLabels}
        />
      )

    case 'objective':
      return (
        <ObjectiveTab
          objectiveData={mode === 'editor' ? emptyObjectiveData : detailProps!.objectiveFormData}
          onObjectiveChange={mode === 'editor' ? () => {} : detailProps!.handleObjectiveFieldChange}
          isEditing={mode === 'editor' ? false : detailProps!.isEditing}
          hideEyeLabels={hideEyeLabels}
          needsMiddleSpacer={needsMiddleSpacer}
        />
      )

    case 'subjective':
      return (
        <SubjectiveTab
          subjectiveData={mode === 'editor' ? emptySubjectiveData : detailProps!.subjectiveFormData}
          onSubjectiveChange={mode === 'editor' ? () => {} : detailProps!.handleSubjectiveFieldChange}
          isEditing={mode === 'editor' ? false : detailProps!.isEditing}
          onVHConfirm={mode === 'editor' ? () => {} : detailProps!.handleVHConfirm}
          onMultifocalClick={mode === 'editor' ? () => {} : detailProps!.handleMultifocalSubjective}
          hideEyeLabels={hideEyeLabels}
        />
      )

    case 'final-subjective':
      return (
        <FinalSubjectiveTab
          finalSubjectiveData={mode === 'editor' ? emptyFinalSubjectiveData : detailProps!.finalSubjectiveFormData}
          onFinalSubjectiveChange={mode === 'editor' ? () => {} : detailProps!.handleFinalSubjectiveChange}
          isEditing={mode === 'editor' ? false : detailProps!.isEditing}
          onVHConfirm={mode === 'editor' ? () => {} : detailProps!.handleFinalSubjectiveVHConfirm}
          hideEyeLabels={hideEyeLabels}
        />
      )

    case 'addition':
      return (
        <AdditionTab
          additionData={mode === 'editor' ? emptyAdditionData : detailProps!.additionFormData}
          onAdditionChange={mode === 'editor' ? () => {} : detailProps!.handleAdditionFieldChange}
          isEditing={mode === 'editor' ? false : detailProps!.isEditing}
          hideEyeLabels={hideEyeLabels}
          needsMiddleSpacer={needsMiddleSpacer}
        />
      )

    case 'notes':
      if (mode === 'editor') {
        return (
          <Card className={`w-full p-5 shadow-md border-[1px] ${matchHeight ? 'h-full flex flex-col' : ''}`} dir="rtl">
            <label className="block text-base font-semibold mb-[-10px]">הערות</label>
            <div className={`text-sm w-full p-3 border rounded-xl bg-gray-50 text-gray-500 ${matchHeight ? 'flex-1' : 'min-h-[90px]'}`}>
              תצוגה מקדימה של שדה הערות
            </div>
          </Card>
        )
      } else if (detailProps) {
        return (
          <Card className={`w-full p-5 shadow-md border-[1px] ${matchHeight ? 'h-full flex flex-col' : ''}`} dir="rtl">
            <label className="block text-base font-semibold mb-[-10px]">הערות</label>
            <textarea
              name="notes"
              disabled={!detailProps.isEditing}
              value={detailProps.formData.notes || ''}
              onChange={detailProps.handleInputChange}
              className={`text-sm w-full p-3 border rounded-xl ${detailProps.isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${matchHeight ? 'flex-1' : 'min-h-[90px]'}`}
              rows={matchHeight ? undefined : 4}
            />
          </Card>
        )
      }
      return null

    default:
      return null
  }
} 