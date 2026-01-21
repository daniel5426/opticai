import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronUp, ChevronDown } from "lucide-react"
import { KeratometerExam } from "@/lib/db/schema-interface"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"

interface KeratometerTabProps {
  keratometerData: KeratometerExam
  onKeratometerChange: (field: keyof KeratometerExam, value: string) => void
  isEditing: boolean
  hideEyeLabels?: boolean
  needsMiddleSpacer?: boolean
}

export function KeratometerTab({
  keratometerData,
  onKeratometerChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: KeratometerTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null)
  const [unit, setUnit] = useState<"mm" | "D">("mm") // mm or Diopter

  const dataRef = useRef(keratometerData);
  dataRef.current = keratometerData;

  const columns = [
    { key: "k1", label: "K1", step: "0.1", min: unit === "mm" ? "3.0" : "40.00", max: unit === "mm" ? "20.0" : "80.00" },
    { key: "k2", label: "K2", labelHe: "K2", step: "0.1", min: unit === "mm" ? "3.0" : "40.00", max: unit === "mm" ? "20.0" : "80.00" },
    { key: "axis", label: "AX", labelHe: "אקסיס", step: "1", min: "0", max: "180" }
  ]

  const convertValue = (val: string, from: "mm" | "D") => {
    const num = parseFloat(val)
    if (isNaN(num)) return ""
    const result = 337.5 / num
    return result.toFixed(2)
  }

  const handleUnitChange = (newUnit: string) => {
    const nextUnit = newUnit as "mm" | "D"
    if (nextUnit === unit) return

    // Convert current values
    const kFields = ["k1", "k2"]
    const eyes = ["r", "l"] as const

    eyes.forEach(eye => {
      kFields.forEach(field => {
        const eyeField = `${eye}_${field}` as keyof KeratometerExam
        const val = keratometerData[eyeField]?.toString() || ""
        if (val) {
          onKeratometerChange(eyeField, convertValue(val, unit))
        }
      })
    })

    setUnit(nextUnit)
  }

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof KeratometerExam
    return keratometerData[eyeField]?.toString() || ""
  }

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof KeratometerExam
    onKeratometerChange(eyeField, value)
  }

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R"
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof KeratometerExam
      const toField = `${toEye.toLowerCase()}_${key}` as keyof KeratometerExam
      const value = latestData[fromField]?.toString() || ""
      onKeratometerChange(toField, value)
    })
  }

  const renderInputRow = (eye: "R" | "L") => (
    columns.map(({ key, step, min, max }) => (
      <FastInput
        key={`${eye}-${key}`}
        type="number"
        step={step}
        min={min}
        max={max}
        value={getFieldValue(eye, key)}
        onChange={(val) => handleChange(eye, key, val)}
        disabled={!isEditing}
        suffix={(key === "k1" || key === "k2") ? unit : undefined}
        className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
      />
    ))
  )


  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex-1">
              <Tabs
                value={unit}
                onValueChange={handleUnitChange}
                className="w-fit"
              >
                <TabsList className="h-7 p-1 bg-muted/50 border">
                  <TabsTrigger
                    value="mm"
                    className="h-5 text-[10px] px-3 data-[state=active]:bg-background"
                  >
                    mm
                  </TabsTrigger>
                  <TabsTrigger
                    value="D"
                    className="h-5 text-[10px] px-3 data-[state=active]:bg-background"
                  >
                    D
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <h3 className="font-medium text-muted-foreground absolute left-1/2 -translate-x-1/2">Keratometer</h3>

            <div className="flex-1" /> {/* Spacer for symmetry */}
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[2fr_1fr_2fr_1fr_2fr]' : 'grid-cols-[20px_2fr_1fr_2fr_1fr_2fr]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ label }) => (
              <React.Fragment key={label}>
                <div className="h-4 flex items-center justify-center"><span className="text-xs font-medium text-muted-foreground">{label}</span></div>
                {label !== 'AX' && <div></div>}
              </React.Fragment>
            ))}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2" onMouseEnter={() => setHoveredEye('R')} onMouseLeave={() => setHoveredEye(null)} onClick={() => copyFromOtherEye('L')}>{hoveredEye === 'L' ? <ChevronDown size={16} /> : 'R'}</span>
              </div>
            )}
            {renderInputRow('R').map((inp, idx) => (
              <React.Fragment key={idx}>
                {inp}
                {idx < 2 && <div className="flex items-center justify-center text-sm font-semibold text-muted-foreground">{idx === 0 ? '/' : '@'}</div>}
              </React.Fragment>
            ))}

            {needsMiddleSpacer && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {Array.from({ length: 5 }).map((_, i) => <div key={`m-${i}`} className="h-8" />)}
              </>
            )}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2" onMouseEnter={() => setHoveredEye('L')} onMouseLeave={() => setHoveredEye(null)} onClick={() => copyFromOtherEye('R')}>{hoveredEye === 'R' ? <ChevronUp size={16} /> : 'L'}</span>
              </div>
            )}
            {renderInputRow('L').map((inp, idx) => (
              <React.Fragment key={`l-${idx}`}>
                {inp}
                {idx < 2 && <div className="flex items-center justify-center text-sm font-semibold text-muted-foreground">{idx === 0 ? '/' : '@'}</div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
