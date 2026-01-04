import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ChevronUp, ChevronDown } from "lucide-react"
import { SchirmerTestExam } from "@/lib/db/schema-interface"
import { EXAM_FIELDS } from "./data/exam-field-definitions"

interface SchirmerTestTabProps {
  schirmerTestData: SchirmerTestExam
  onSchirmerTestChange: (field: keyof SchirmerTestExam, value: string) => void
  isEditing: boolean
  hideEyeLabels?: boolean
  needsMiddleSpacer?: boolean
}

import { FastInput } from "./shared/OptimizedInputs"

export function SchirmerTestTab({
  schirmerTestData,
  onSchirmerTestChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: SchirmerTestTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null)

  const columns = [
    { key: "mm", label: "mm", step: "0.1" },
    { key: "but", ...EXAM_FIELDS.BUT }
  ]

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof SchirmerTestExam
    return schirmerTestData[eyeField]?.toString() || ""
  }

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof SchirmerTestExam
    onSchirmerTestChange(eyeField, value)
  }

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R"
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof SchirmerTestExam
      const toField = `${toEye.toLowerCase()}_${key}` as keyof SchirmerTestExam
      const value = schirmerTestData[fromField]?.toString() || ""
      onSchirmerTestChange(toField, value)
    })
  }

  const renderInput = (eye: "R" | "L", col: any) => {
    const { key, step, min, unit } = col;
    const value = getFieldValue(eye, key);

    return (
      <div className="relative">
        <FastInput
          type="number"
          step={step}
          min={min}
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
          className={`h-8 pr-1 text-xs ${unit ? "pr-8" : ""} ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
        />
        {unit && value && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    );
  };


  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Schirmer Test</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(2,1fr)]' : 'grid-cols-[20px_repeat(2,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
            ))}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                  onMouseEnter={() => setHoveredEye("R")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("L")}
                >
                  {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
                </span>
              </div>
            )}
            {columns.map(col => <React.Fragment key={`r-${col.key}`}>{renderInput("R", col)}</React.Fragment>)}

            {needsMiddleSpacer && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {columns.map(({ key }) => (
                  <div key={`spacer-${key}`} className="h-8" />
                ))}
              </>
            )}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                  onMouseEnter={() => setHoveredEye("L")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("R")}
                >
                  {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
                </span>
              </div>
            )}
            {columns.map(col => <React.Fragment key={`l-${col.key}`}>{renderInput("L", col)}</React.Fragment>)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 