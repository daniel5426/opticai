import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { KeratometerContactLens } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { EXAM_FIELDS } from "./data/exam-field-definitions"
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { useAxisWarning } from "./shared/useAxisWarning"
import { AxisWarningInput } from "./shared/AxisWarningInput"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface KeratometerContactLensTabProps {
  keratometerContactLensData: KeratometerContactLens;
  onKeratometerContactLensChange: (field: keyof KeratometerContactLens, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
}

export function KeratometerContactLensTab({
  keratometerContactLensData,
  onKeratometerContactLensChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: KeratometerContactLensTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);
  const [unit, setUnit] = useState<"mm" | "D">("mm")

  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
    keratometerContactLensData,
    onKeratometerContactLensChange,
    isEditing
  );

  const dataRef = useRef(keratometerContactLensData);
  dataRef.current = keratometerContactLensData;

  const { handleManualTranspose } = usePrescriptionLogic(
    keratometerContactLensData,
    onKeratometerContactLensChange,
    isEditing
  );

  const convertValue = (val: string, from: "mm" | "D") => {
    const num = parseFloat(val)
    if (isNaN(num)) return ""
    const result = 337.5 / num
    return result.toFixed(2)
  }

  const handleUnitChange = (newUnit: string) => {
    const nextUnit = newUnit as "mm" | "D"
    if (nextUnit === unit) return

    // Convert current values for rv and rh
    const fieldsToConvert = ["rh", "rv"]
    const eyes = ["r", "l"] as const

    eyes.forEach(eye => {
      fieldsToConvert.forEach(field => {
        const eyeField = `${eye}_${field}` as keyof KeratometerContactLens
        const val = keratometerContactLensData[eyeField]?.toString() || ""
        if (val) {
          onKeratometerContactLensChange(eyeField, convertValue(val, unit))
        }
      })
    })

    setUnit(nextUnit)
  }

  const columns = [
    {
      key: "rh",
      label: "RH",
      step: "0.01",
      min: unit === "mm" ? "3.0" : "40.00",
      max: unit === "mm" ? "20.0" : "80.00"
    },
    {
      key: "rv",
      label: "RV",
      step: "0.01",
      min: unit === "mm" ? "3.0" : "40.00",
      max: unit === "mm" ? "20.0" : "80.00"
    },
    { key: "avg", label: "AVG", step: "0.01" },
    { key: "cyl", label: "CYL", step: "0.01" },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "ecc", label: "ECC", step: "0.01" },
  ];

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof KeratometerContactLens;
    return keratometerContactLensData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    if (field === "cyl" || field === "ax") {
      handleAxisChange(eye, field, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof KeratometerContactLens;
      onKeratometerContactLensChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L", f: string) => {
        const eyeField = `${e.toLowerCase()}_${f}` as keyof KeratometerContactLens;
        return latestData[eyeField]?.toString() || "";
      };
      const value = getLatestVal(fromEye, key);
      onKeratometerContactLensChange(`${toEye.toLowerCase()}_${key}` as keyof KeratometerContactLens, value);
    });
  };

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

            <h3 className="font-medium text-muted-foreground absolute left-1/2 -translate-x-1/2">
              Keratometer Contact Lens
            </h3>

            <div className="flex-1" /> {/* Spacer for symmetry */}
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(6,1fr)]' : 'grid-cols-[20px_repeat(6,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                {key === "cyl" ? (
                  <CylTitle onTranspose={handleManualTranspose} disabled={!isEditing} />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {label}
                  </span>
                )}
              </div>
            ))}

            {!hideEyeLabels && <div className="flex items-center justify-center">
              <span
                className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                onMouseEnter={() => setHoveredEye("R")}
                onMouseLeave={() => setHoveredEye(null)}
                onClick={() => copyFromOtherEye("L")}
                title="Click to copy from L eye"
              >
                {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
              </span>
            </div>}
            {columns.map(({ key, step, min, max, ...colProps }) => {
              if (key === 'cyl' || key === 'ax') {
                return (
                  <AxisWarningInput
                    {...colProps}
                    key={`r-${key}`}
                    eye="R"
                    field={key as "cyl" | "ax"}
                    value={getFieldValue("R", key)}
                    missingAxis={fieldWarnings.R.missingAxis}
                    missingCyl={fieldWarnings.R.missingCyl}
                    isEditing={isEditing}
                    onValueChange={handleAxisChange}
                    onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, (colProps as any).min, (colProps as any).max)}
                    className={isEditing ? 'bg-white' : 'bg-accent/50'}
                  />
                );
              }
              return (
                <FastInput
                  {...colProps}
                  key={`r-${key}`}
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={getFieldValue("R", key)}
                  onChange={(val) => handleChange("R", key, val)}
                  disabled={!isEditing}
                  suffix={(key === "rh" || key === "rv") ? unit : undefined}
                  className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                />
              );
            })}

            {needsMiddleSpacer && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {columns.map(({ key }) => (
                  <div key={`spacer-${key}`} className="h-8" />
                ))}
              </>
            )}

            {!hideEyeLabels && <div className="flex items-center justify-center">
              <span
                className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                onMouseEnter={() => setHoveredEye("L")}
                onMouseLeave={() => setHoveredEye(null)}
                onClick={() => copyFromOtherEye("R")}
                title="Click to copy from R eye"
              >
                {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
              </span>
            </div>}
            {columns.map(({ key, step, min, max, ...colProps }) => {
              if (key === 'cyl' || key === 'ax') {
                return (
                  <AxisWarningInput
                    {...colProps}
                    key={`l-${key}`}
                    eye="L"
                    field={key as "cyl" | "ax"}
                    value={getFieldValue("L", key)}
                    missingAxis={fieldWarnings.L.missingAxis}
                    missingCyl={fieldWarnings.L.missingCyl}
                    isEditing={isEditing}
                    onValueChange={handleAxisChange}
                    onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, (colProps as any).min, (colProps as any).max)}
                    className={isEditing ? 'bg-white' : 'bg-accent/50'}
                  />
                );
              }
              return (
                <FastInput
                  {...colProps}
                  key={`l-${key}`}
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={getFieldValue("L", key)}
                  onChange={(val) => handleChange("L", key, val)}
                  disabled={!isEditing}
                  suffix={(key === "rh" || key === "rv") ? unit : undefined}
                  className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}