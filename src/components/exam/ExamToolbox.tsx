import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Settings, X, ArrowRight, ArrowDown, ArrowLeft, Copy, ClipboardPaste, History } from "lucide-react"
import { ExamFieldMapper, ExamComponentType, ExamDataType } from "@/lib/exam-field-mappings"
import { CardItem } from "./ExamCardRenderer"
import { inputSyncManager } from "./shared/OptimizedInputs"

interface ExamToolboxProps {
  isEditing: boolean
  mode: 'editor' | 'detail'
  currentCard: CardItem
  allRows: CardItem[][]
  currentRowIndex: number
  currentCardIndex: number
  clipboardSourceType: ExamComponentType | null
  onClearData: () => void
  onCopy: () => void
  onPaste: () => void
  onCopyLeft: () => void
  onCopyRight: () => void
  onCopyBelow: () => void
  showClear?: boolean
  onShowOrdersHistory?: () => void
}

export function ExamToolbox({
  isEditing,
  mode,
  currentCard,
  allRows,
  currentRowIndex,
  currentCardIndex,
  clipboardSourceType,
  onClearData,
  onCopy,
  onPaste,
  onCopyLeft,
  onCopyRight,
  onCopyBelow,
  showClear,
  onShowOrdersHistory
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
      .filter(card => card.type !== 'notes')
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
      .filter(card => card.type !== 'notes')
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
      .filter(card => card.type !== 'notes')
      .map(card => card.type as ExamComponentType)

    // Check if there are any compatible targets
    const compatibleTargets = ExamFieldMapper.getAvailableTargets(currentCard.type as ExamComponentType, availableComponentsInBelowRow)
    return compatibleTargets.length > 0
  }

  const canPaste = () => {
    if (!clipboardSourceType) return false
    const currentCardType = currentCard.type as ExamComponentType
    if (clipboardSourceType === currentCardType) {
      return true
    }
    const compatibleTargets = ExamFieldMapper.getAvailableTargets(clipboardSourceType, [currentCardType])
    return compatibleTargets.includes(currentCardType)
  }

  const hasAnyAction = canCopyLeft() || canCopyRight() || canCopyBelow() || canPaste()

  return (
    <div className="absolute top-2 right-2 z-30 pointer-events-none" dir="ltr">
      <div
        className={`flex items-center transition-all duration-300 ease-out pointer-events-auto ${isExpanded ? 'bg-white rounded-lg shadow-lg border p-1 gap-1' : 'gap-0'
          }`}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className={`transition-all duration-300 ease-out overflow-hidden ${isExpanded ? 'opacity-100 translate-x-0 max-w-xs' : 'opacity-0 translate-x-2 pointer-events-none max-w-0'
          }`}>
          <div className="flex items-center gap-1">

            {onShowOrdersHistory && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onShowOrdersHistory}
                className="h-7 w-7 p-0 hover:bg-orange-100 text-orange-600 hover:text-orange-800"
                title="היסטוריית הזמנות"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            )}

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

            {canPaste() && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onPaste}
                className="h-7 w-7 p-0 hover:bg-yellow-100 text-yellow-600 hover:text-yellow-800"
                title="הדבק"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCopy}
              className="h-7 w-7 p-0 hover:bg-cyan-100 text-cyan-600 hover:text-cyan-800"
              title="העתק"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>

            {showClear !== false && (
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
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseEnter={() => setIsExpanded(true)}
          className={`h-7 w-7 p-0 transition-all duration-300 ease-out ${isExpanded
            ? 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
            : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700 opacity-60 hover:opacity-100'
            }`}
          title="כלים"
        >
          <Settings className={`h-3.5 w-3.5 transition-transform duration-300 ease-out ${isExpanded ? 'rotate-90' : ''
            }`} />
        </Button>
      </div>
    </div>
  )
}

export interface ToolboxActions {
  clearData: (componentType: ExamComponentType, key?: string) => void
  copyToLeft: (sourceType: ExamComponentType, targetType: ExamComponentType, sourceKey?: string, targetKey?: string) => void
  copyToRight: (sourceType: ExamComponentType, targetType: ExamComponentType, sourceKey?: string, targetKey?: string) => void
  copyToBelow: (sourceType: ExamComponentType, targetType: ExamComponentType, sourceKey?: string, targetKey?: string) => void
}

export function createToolboxActions(
  getExamFormData: () => Record<string, any>,
  fieldHandlers: Record<string, (field: string, value: any) => void>
): ToolboxActions {

  const getDataByType = (componentType: ExamComponentType, key?: string) => {
    const examFormData = getExamFormData()
    if (key && examFormData[key]) return examFormData[key]
    return examFormData[componentType] || null
  }

  const getChangeHandlerByType = (componentType: ExamComponentType, key?: string) => {
    if (key && fieldHandlers[key]) return fieldHandlers[key]
    return fieldHandlers[componentType] || null
  }

  const clearData = (componentType: ExamComponentType, key?: string) => {
    inputSyncManager.flush();
    const data = getDataByType(componentType, key)
    const changeHandler = getChangeHandlerByType(componentType, key)
    if (!data || !changeHandler) return
    const clearedData = ExamFieldMapper.clearData(data, componentType)
    Object.entries(clearedData).forEach(([field, value]) => {
      if (field !== 'id' && field !== 'layout_instance_id') {
        changeHandler(field, value)
      }
    })
  }

  const copyToLeft = (sourceType: ExamComponentType, targetType: ExamComponentType, sourceKey?: string, targetKey?: string) => {
    inputSyncManager.flush();
    const sourceData = getDataByType(sourceType, sourceKey)
    const targetData = getDataByType(targetType, targetKey) || { layout_instance_id: 0 }
    const targetChangeHandler = getChangeHandlerByType(targetType, targetKey)
    if (!sourceData || !targetChangeHandler) return
    const copiedData = ExamFieldMapper.copyData(sourceData, targetData, sourceType, targetType)
    Object.entries(copiedData).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'layout_instance_id' && value !== undefined) {
        targetChangeHandler(key, String(value))
      }
    })
  }

  const copyToRight = (sourceType: ExamComponentType, targetType: ExamComponentType, sourceKey?: string, targetKey?: string) => {
    inputSyncManager.flush();
    const sourceData = getDataByType(sourceType, sourceKey)
    const targetData = getDataByType(targetType, targetKey)
    const targetChangeHandler = getChangeHandlerByType(targetType, targetKey)
    if (!sourceData || !targetData || !targetChangeHandler) return
    const copiedData = ExamFieldMapper.copyData(sourceData, targetData, sourceType, targetType)
    Object.entries(copiedData).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'layout_instance_id' && value !== undefined) {
        targetChangeHandler(key, String(value))
      }
    })
  }

  const copyToBelow = (sourceType: ExamComponentType, targetType: ExamComponentType, sourceKey?: string, targetKey?: string) => {
    copyToLeft(sourceType, targetType, sourceKey, targetKey)
  }

  return {
    clearData,
    copyToLeft,
    copyToRight,
    copyToBelow
  }
} 