import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ChevronUp, ChevronDown, Edit3 } from "lucide-react"
import { CornealTopographyExam } from "@/lib/db/schema-interface"

interface CornealTopographyTabProps {
  cornealTopographyData: CornealTopographyExam
  onCornealTopographyChange: (field: keyof CornealTopographyExam, value: string) => void
  isEditing: boolean
  hideEyeLabels?: boolean
  needsMiddleSpacer?: boolean
  isEditorMode?: boolean
  onTitleChange?: (title: string) => void
}

import { FastTextarea, FastInput } from "./shared/OptimizedInputs"

export function CornealTopographyTab({
  cornealTopographyData,
  onCornealTopographyChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false,
  isEditorMode = false,
  onTitleChange
}: CornealTopographyTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isHoveringTitle, setIsHoveringTitle] = useState(false)

  const handleChange = (eye: "R" | "L", value: string) => {
    const field = `${eye.toLowerCase()}_note` as keyof CornealTopographyExam
    onCornealTopographyChange(field, value)
  }

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R"
    const fromField = `${fromEye.toLowerCase()}_note` as keyof CornealTopographyExam
    const toField = `${toEye.toLowerCase()}_note` as keyof CornealTopographyExam
    const value = cornealTopographyData[fromField]?.toString() || ""
    onCornealTopographyChange(toField, value)
  }

  const handleTitleChange = (value: string) => {
    if (isEditorMode && onTitleChange) {
      onTitleChange(value)
    } else {
      onCornealTopographyChange('title', value)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setIsEditingTitle(false)
    }
  }

  const renderNoteField = (eye: "R" | "L") => {
    const fieldValue = cornealTopographyData[`${eye.toLowerCase()}_note` as keyof CornealTopographyExam]?.toString() || ""

    return (
      <FastTextarea
        value={fieldValue}
        onChange={(val) => handleChange(eye, val)}
        disabled={!isEditing}
        className={`min-h-[64px] text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default resize-none`}
        placeholder={isEditing ? "הערות..." : ""}
      />
    )
  }

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center relative">
            {isEditingTitle && isEditorMode ? (
              <Input
                value={cornealTopographyData.title || "Corneal Topography"}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={handleTitleKeyDown}
                className="text-center h-6 text-sm font-medium text-muted-foreground border-none bg-transparent px-1 w-48 mx-auto"
                autoFocus
              />
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h3
                  className="font-medium text-muted-foreground cursor-pointer"
                  onMouseEnter={() => setIsHoveringTitle(true)}
                  onMouseLeave={() => setIsHoveringTitle(false)}
                  onClick={() => isEditorMode && setIsEditingTitle(true)}
                >
                  {cornealTopographyData.title || "Corneal Topography"}
                </h3>
                {isHoveringTitle && isEditorMode && (
                  <Edit3
                    size={14}
                    className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  />
                )}
              </div>
            )}
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-1' : 'grid-cols-[20px_1fr]'} gap-2 items-start`}>
            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2" onMouseEnter={() => setHoveredEye('R')} onMouseLeave={() => setHoveredEye(null)} onClick={() => copyFromOtherEye('L')}>{hoveredEye === 'L' ? <ChevronDown size={16} /> : 'R'}</span>
              </div>
            )}
            {renderNoteField('R')}


            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2" onMouseEnter={() => setHoveredEye('L')} onMouseLeave={() => setHoveredEye(null)} onClick={() => copyFromOtherEye('R')}>{hoveredEye === 'R' ? <ChevronUp size={16} /> : 'L'}</span>
              </div>
            )}
            {renderNoteField('L')}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
