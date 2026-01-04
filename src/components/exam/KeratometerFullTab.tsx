import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronUp, ChevronDown } from "lucide-react"
import { KeratometerFullExam } from "@/lib/db/schema-interface"

interface KeratometerFullTabProps {
  keratometerFullData: KeratometerFullExam
  onKeratometerFullChange: (field: keyof KeratometerFullExam, value: string | boolean) => void
  isEditing: boolean
  hideEyeLabels?: boolean
  needsMiddleSpacer?: boolean
}

import { FastInput } from "./shared/OptimizedInputs"

export function KeratometerFullTab({
  keratometerFullData,
  onKeratometerFullChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: KeratometerFullTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null)

  const columns = [
    { key: "dpt_k1", label: "DPT K1", step: "0.01" },
    { key: "dpt_k2", label: "DPT K2", step: "0.01" },
    { key: "mm_k1", label: "MM K1", step: "0.01" },
    { key: "mm_k2", label: "MM K2", step: "0.01" },
    { key: "mer_k1", label: "MER K1", step: "0.01" },
    { key: "mer_k2", label: "MER K2", step: "0.01" },
    { key: "astig", label: "ASTIG", type: "checkbox" }
  ]

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof KeratometerFullExam
    return keratometerFullData[eyeField]?.toString() || ""
  }

  const getCheckboxValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof KeratometerFullExam
    return Boolean(keratometerFullData[eyeField])
  }

  const handleChange = (eye: "R" | "L", field: string, value: string | boolean) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof KeratometerFullExam
    onKeratometerFullChange(eyeField, value)
  }

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R"
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof KeratometerFullExam
      const toField = `${toEye.toLowerCase()}_${key}` as keyof KeratometerFullExam
      const value = keratometerFullData[fromField]
      if (key === "astig") {
        onKeratometerFullChange(toField, Boolean(value))
      } else {
        onKeratometerFullChange(toField, value?.toString() || "")
      }
    })
  }

  const renderInputRow = (eye: "R" | "L") => {
    const components: React.ReactNode[] = []

    columns.forEach(({ key, step, type }, idx) => {
      if (type === "checkbox") {
        components.push(
          <div key={`${eye}-${key}`} className="flex items-center justify-center">
            <Checkbox
              checked={getCheckboxValue(eye, key)}
              onCheckedChange={(checked) => handleChange(eye, key, Boolean(checked))}
              disabled={!isEditing}
              className="h-4 w-4"
            />
          </div>
        )
      } else {
        components.push(
          <FastInput
            key={`${eye}-${key}`}
            type="number"
            step={step}
            value={getFieldValue(eye, key)}
            onChange={(val) => handleChange(eye, key, val)}
            disabled={!isEditing}
            className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
          />
        )
      }

      if (idx === 1) {
        components.push(
          <div key={`${eye}-sep1`} className="flex items-center justify-center text-sm font-semibold text-muted-foreground">/</div>
        )
      } else if (idx === 3) {
        components.push(
          <div key={`${eye}-sep2`} className="flex items-center justify-center text-sm font-semibold text-muted-foreground">@</div>
        )
      }
    })

    return components
  }

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Keratometer Full</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[2fr_2fr_1fr_2fr_2fr_1fr_2fr_2fr_1fr]' : 'grid-cols-[20px_2fr_2fr_1fr_2fr_2fr_1fr_2fr_2fr_1fr]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ label }, idx) => (
              <React.Fragment key={label}>
                <div className="h-4 flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                </div>
                {idx === 1 && <div className="h-4 flex items-center justify-center"><span className="text-xs font-medium text-muted-foreground"></span></div>}
                {idx === 3 && <div className="h-4 flex items-center justify-center"><span className="text-xs font-medium text-muted-foreground"></span></div>}
              </React.Fragment>
            ))}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                  onMouseEnter={() => setHoveredEye('R')}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye('L')}>
                  {hoveredEye === 'L' ? <ChevronDown size={16} /> : 'R'}
                </span>
              </div>
            )}
            {renderInputRow('R')}

            {needsMiddleSpacer && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {Array.from({ length: 9 }).map((_, i) => <div key={`m-${i}`} className="h-8" />)}
              </>
            )}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                  onMouseEnter={() => setHoveredEye('L')}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye('R')}>
                  {hoveredEye === 'R' ? <ChevronUp size={16} /> : 'L'}
                </span>
              </div>
            )}
            {renderInputRow('L')}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
