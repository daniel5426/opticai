import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ChevronUp, ChevronDown } from "lucide-react"
import { SchirmerTestExam } from "@/lib/db/schema-interface"

interface SchirmerTestTabProps {
  schirmerTestData: SchirmerTestExam
  onSchirmerTestChange: (field: keyof SchirmerTestExam, value: string) => void
  isEditing: boolean
  hideEyeLabels?: boolean
  needsMiddleSpacer?: boolean
}

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
    { key: "but", label: "BUT", step: "0.1" }
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

  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3">
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
            {columns.map(({ key, step }) => (
              <Input
                key={`r-${key}`}
                type="number"
                step={step}
                value={getFieldValue("R", key)}
                onChange={(e) => handleChange("R", key, e.target.value)}
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
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
              <Input
                key={`l-${key}`}
                type="number"
                step={step}
                value={getFieldValue("L", key)}
                onChange={(e) => handleChange("L", key, e.target.value)}
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 