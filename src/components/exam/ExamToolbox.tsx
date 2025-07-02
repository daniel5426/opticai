import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Settings, X, ArrowRight, ArrowDown, ArrowLeft } from "lucide-react"
import { ExamFieldMapper, ExamComponentType, ExamDataType } from "@/lib/exam-field-mappings"
import { CardItem } from "./ExamCardRenderer"

interface ExamToolboxProps {
  isEditing: boolean
  mode: 'editor' | 'detail'
  currentCard: CardItem
  allRows: CardItem[][]
  currentRowIndex: number
  currentCardIndex: number
  onClearData: () => void
  onCopyLeft: () => void
  onCopyRight: () => void
  onCopyBelow: () => void
}

export function ExamToolbox({
  isEditing,
  mode,
  currentCard,
  allRows,
  currentRowIndex,
  currentCardIndex,
  onClearData,
  onCopyLeft,
  onCopyRight,
  onCopyBelow
}: ExamToolboxProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!isEditing || mode === 'editor') {
    return null
  }

  const canCopyLeft = () => {
    const currentRow = allRows[currentRowIndex]
    
    // Get all available component types to the left of current card
    const cardsToTheLeft = currentRow.slice(0, currentCardIndex)
    const availableComponentsToTheLeft = cardsToTheLeft
      .filter(card => card.type !== 'exam-details' && card.type !== 'notes')
      .map(card => card.type as ExamComponentType)
    
    // Check if there are any compatible targets
    const compatibleTargets = ExamFieldMapper.getAvailableTargets(currentCard.type as ExamComponentType, availableComponentsToTheLeft)
    return compatibleTargets.length > 0
  }

  const canCopyRight = () => {
    const currentRow = allRows[currentRowIndex]
    
    // Get all available component types to the right of current card
    const cardsToTheRight = currentRow.slice(currentCardIndex + 1)
    const availableComponentsToTheRight = cardsToTheRight
      .filter(card => card.type !== 'exam-details' && card.type !== 'notes')
      .map(card => card.type as ExamComponentType)
    
    // Check if there are any compatible targets
    const compatibleTargets = ExamFieldMapper.getAvailableTargets(currentCard.type as ExamComponentType, availableComponentsToTheRight)
    return compatibleTargets.length > 0
  }

  const canCopyBelow = () => {
    if (currentRowIndex >= allRows.length - 1) return false
    
    const belowRow = allRows[currentRowIndex + 1]
    
    // Get all available component types in the below row
    const availableComponentsInBelowRow = belowRow
      .filter(card => card.type !== 'exam-details' && card.type !== 'notes')
      .map(card => card.type as ExamComponentType)
    
    // Check if there are any compatible targets
    const compatibleTargets = ExamFieldMapper.getAvailableTargets(currentCard.type as ExamComponentType, availableComponentsInBelowRow)
    return compatibleTargets.length > 0
  }

  const hasAnyAction = canCopyLeft() || canCopyRight() || canCopyBelow()

  return (
    <div 
      className="absolute top-2 right-2 z-30"
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className={`flex items-center gap-1 transition-all duration-300 ease-out ${
        isExpanded ? 'bg-white rounded-lg shadow-lg border p-1' : ''
      }`}>
        
        <div className={`transition-all duration-300 ease-out ${
          isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
        }`}>
          <div className="flex items-center gap-1">
            
            {canCopyLeft() && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCopyLeft}
                className="h-7 w-7 p-0 hover:bg-purple-100 text-purple-600 hover:text-purple-800"
                title="העתק לשמאל"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}

            {canCopyBelow() && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCopyBelow}
                className="h-7 w-7 p-0 hover:bg-blue-100 text-blue-600 hover:text-blue-800"
                title="העתק לשורה מתחת"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            )}

            {canCopyRight() && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCopyRight}
                className="h-7 w-7 p-0 hover:bg-green-100 text-green-600 hover:text-green-800"
                title="העתק לימין"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearData}
              className="h-7 w-7 p-0 hover:bg-red-100 text-red-600 hover:text-red-800"
              title="נקה נתונים"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseEnter={() => setIsExpanded(true)}
          className={`h-7 w-7 p-0 transition-all duration-300 ease-out ${
            isExpanded 
              ? 'hover:bg-gray-100 text-gray-600 hover:text-gray-800' 
              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700 opacity-60 hover:opacity-100'
          }`}
          title="כלים"
        >
          <Settings className={`h-3.5 w-3.5 transition-transform duration-300 ease-out ${
            isExpanded ? 'rotate-90' : ''
          }`} />
        </Button>
      </div>
    </div>
  )
}

export interface ToolboxActions {
  clearData: (componentType: ExamComponentType) => void
  copyToLeft: (sourceType: ExamComponentType, targetType: ExamComponentType) => void
  copyToRight: (sourceType: ExamComponentType, targetType: ExamComponentType) => void
  copyToBelow: (sourceType: ExamComponentType, targetType: ExamComponentType) => void
}

export function createToolboxActions(
  oldRefractionData: any,
  objectiveData: any,
  subjectiveData: any,
  finalSubjectiveData: any,
  additionData: any,
  onOldRefractionChange: (field: string, value: string) => void,
  onObjectiveChange: (field: string, value: string) => void,
  onSubjectiveChange: (field: string, value: string) => void,
  onFinalSubjectiveChange: (field: string, value: string) => void,
  onAdditionChange: (field: string, value: string) => void
): ToolboxActions {
  
  const getDataByType = (componentType: ExamComponentType) => {
    switch (componentType) {
      case 'old-refraction': return oldRefractionData
      case 'objective': return objectiveData
      case 'subjective': return subjectiveData
      case 'final-subjective': return finalSubjectiveData
      case 'addition': return additionData
      default: return null
    }
  }

  const getChangeHandlerByType = (componentType: ExamComponentType) => {
    switch (componentType) {
      case 'old-refraction': return onOldRefractionChange
      case 'objective': return onObjectiveChange
      case 'subjective': return onSubjectiveChange
      case 'final-subjective': return onFinalSubjectiveChange
      case 'addition': return onAdditionChange
      default: return null
    }
  }

  const clearData = (componentType: ExamComponentType) => {
    const data = getDataByType(componentType)
    const changeHandler = getChangeHandlerByType(componentType)
    
    if (!data || !changeHandler) return

    const clearedData = ExamFieldMapper.clearData(data)
    
    Object.keys(clearedData).forEach(key => {
      if (key !== 'id' && key !== 'layout_instance_id') {
        changeHandler(key, '')
      }
    })
  }

  const copyToLeft = (sourceType: ExamComponentType, targetType: ExamComponentType) => {
    const sourceData = getDataByType(sourceType)
    const targetData = getDataByType(targetType)
    const targetChangeHandler = getChangeHandlerByType(targetType)
    
    if (!sourceData || !targetData || !targetChangeHandler) return

    const copiedData = ExamFieldMapper.copyData(sourceData, targetData, sourceType, targetType)
    
    Object.entries(copiedData).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'layout_instance_id' && value !== undefined) {
        targetChangeHandler(key, String(value))
      }
    })
  }

  const copyToRight = (sourceType: ExamComponentType, targetType: ExamComponentType) => {
    const sourceData = getDataByType(sourceType)
    const targetData = getDataByType(targetType)
    const targetChangeHandler = getChangeHandlerByType(targetType)
    
    if (!sourceData || !targetData || !targetChangeHandler) return

    const copiedData = ExamFieldMapper.copyData(sourceData, targetData, sourceType, targetType)
    
    Object.entries(copiedData).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'layout_instance_id' && value !== undefined) {
        targetChangeHandler(key, String(value))
      }
    })
  }

  const copyToBelow = (sourceType: ExamComponentType, targetType: ExamComponentType) => {
    copyToLeft(sourceType, targetType)
  }

  return {
    clearData,
    copyToLeft,
    copyToRight,
    copyToBelow
  }
} 