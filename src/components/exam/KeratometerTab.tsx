import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronUp, ChevronDown } from "lucide-react"
import { KeratometerExam } from "@/lib/db/schema-interface"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppLocale } from "@/localization/use-app-locale"
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"
import { convertKeratometerValue, getKeratometerRange, getKeratometerStep, KeratometerUnit } from "@/utils/keratometer-utils"

const convertStored = (value: unknown, unit: KeratometerUnit) =>
  value == null || value === "" ? "" : convertKeratometerValue(String(value), unit)

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
  const { direction } = useAppLocale();
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null)
  const [unit, setUnit] = useState<KeratometerUnit>("mm")

  const dataRef = useRef(keratometerData);
  dataRef.current = keratometerData;
  const kRange = getKeratometerRange(unit);

  const columns = [
    { key: "k1", label: "K1", step: getKeratometerStep(unit), min: kRange.min, max: kRange.max },
    { key: "k2", label: "K2", labelHe: "K2", step: getKeratometerStep(unit), min: kRange.min, max: kRange.max },
    { key: "axis", label: "AX", labelHe: "אקסיס", step: "1", min: "0", max: "180" }
  ]

  // The unit only changes the view: mm lives in r_k1, diopters in r_k1_d. A reading stored in only
  // one unit is shown converted in the other, without rewriting the stored value.
  const handleUnitChange = (newUnit: string) => {
    const nextUnit = newUnit as KeratometerUnit
    if (nextUnit === unit) return
    inputSyncManager.flush()
    setUnit(nextUnit)
  }

  const isK = (field: string) => field === "k1" || field === "k2"
  const mmField = (eye: "R" | "L", field: string) => `${eye.toLowerCase()}_${field}` as keyof KeratometerExam
  const dptField = (eye: "R" | "L", field: string) => `${eye.toLowerCase()}_${field}_d` as keyof KeratometerExam

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const mm = keratometerData[mmField(eye, field)]?.toString() || ""
    if (!isK(field) || unit === "mm") return mm || (isK(field) ? convertStored(keratometerData[dptField(eye, field)], "mm") : "")
    return keratometerData[dptField(eye, field)]?.toString() || convertStored(mm, "D")
  }

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    if (!isK(field)) {
      onKeratometerChange(mmField(eye, field), value)
      return
    }
    // An edit replaces the reading in both units, so the two never disagree.
    const [edited, other] = unit === "mm" ? [mmField(eye, field), dptField(eye, field)] : [dptField(eye, field), mmField(eye, field)]
    onKeratometerChange(edited, value)
    onKeratometerChange(other, value ? convertKeratometerValue(value, unit === "mm" ? "D" : "mm") : "")
  }

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R"
    columns.forEach(({ key }) => {
      const fields = isK(key) ? [mmField(fromEye, key), dptField(fromEye, key)] : [mmField(fromEye, key)]
      fields.forEach((fromField) => {
        const toField = `${toEye.toLowerCase()}${String(fromField).slice(1)}` as keyof KeratometerExam
        onKeratometerChange(toField, latestData[fromField]?.toString() || "")
      })
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
                className="w-fit -translate-y-1"
                dir={direction}
              >
                <TabsList className="grid h-8 w-auto grid-cols-2">
                  <TabsTrigger
                    value="mm"
                    className="py-0.5"
                  >
                    mm
                  </TabsTrigger>
                  <TabsTrigger
                    value="D"
                    className="py-0.5"
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
