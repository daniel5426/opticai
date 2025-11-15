import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ChevronUp, ChevronDown } from "lucide-react"
import { UncorrectedVAExam } from "@/lib/db/schema-interface"

interface UncorrectedVATabProps {
  uncorrectedVaData: UncorrectedVAExam
  onUncorrectedVaChange: (field: keyof UncorrectedVAExam, value: string) => void
  isEditing: boolean
  hideEyeLabels?: boolean
  needsMiddleSpacer?: boolean
}

export function UncorrectedVATab({
  uncorrectedVaData,
  onUncorrectedVaChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: UncorrectedVATabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null)

  const columns = [
    { key: "fv", label: "FV", step: "0.1" },
    { key: "iv", label: "IV", step: "0.1" },
    { key: "nv_j", label: "NV/J" }
  ]

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof UncorrectedVAExam
    return uncorrectedVaData[eyeField]?.toString() || ""
  }

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof UncorrectedVAExam
    onUncorrectedVaChange(eyeField, value)
  }

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R"
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof UncorrectedVAExam
      const toField = `${toEye.toLowerCase()}_${key}` as keyof UncorrectedVAExam
      const value = uncorrectedVaData[fromField]?.toString() || ""
      onUncorrectedVaChange(toField, value)
    })
  }

  return (
    <Card className="w-full examcard  pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Uncorrected VA</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(3,1fr)]' : 'grid-cols-[20px_repeat(3,1fr)]'} gap-2 items-center`}>
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
            {columns.map(({ key, step }) => (
              key === "fv" ? (
                <div key={`r-${key}`} className="relative">
                  <Input
                    type="number"
                    step={step}
                    value={getFieldValue("R", key)}
                    onChange={(e) => handleChange("R", key, e.target.value)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs pl-6 disabled:opacity-100 disabled:cursor-default`}
                  />
                  <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                </div>
              ) : (
                <Input
                  key={`r-${key}`}
                  type="number"
                  step={step}
                  value={getFieldValue("R", key)}
                  onChange={(e) => handleChange("R", key, e.target.value)}
                  disabled={!isEditing}
                  className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                />
              )
            ))}

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
            {columns.map(({ key, step }) => (
              key === "fv" ? (
                <div key={`l-${key}`} className="relative">
                  <Input
                    type="number"
                    step={step}
                    value={getFieldValue("L", key)}
                    onChange={(e) => handleChange("L", key, e.target.value)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                  <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                </div>
              ) : (
                <Input
                  key={`l-${key}`}
                  type="number"
                  step={step}
                  value={getFieldValue("L", key)}
                  onChange={(e) => handleChange("L", key, e.target.value)}
                  disabled={!isEditing}
                  className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                />
              )
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 