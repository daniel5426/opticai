import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { OldContactLenses } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { EXAM_FIELDS } from "./data/exam-field-definitions"
import { NVJSelect } from "./shared/NVJSelect"
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { useAxisWarning } from "./shared/useAxisWarning"
import { AxisWarningInput } from "./shared/AxisWarningInput"

interface OldContactLensesTabProps {
  data: OldContactLenses;
  onChange: (field: keyof OldContactLenses, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
}

export function OldContactLensesTab({ data, onChange, isEditing, hideEyeLabels = false }: OldContactLensesTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null)

  const { fieldWarnings, handleAxisChange } = useAxisWarning(
    data,
    onChange,
    isEditing
  );

  const dataRef = useRef(data);
  dataRef.current = data;

  const { handleManualTranspose } = usePrescriptionLogic(
    data,
    onChange,
    isEditing
  );

  const columns = [
    { key: "lens_type", label: "סוג עדשה" },
    { key: "model", label: "מודל" },
    { key: "supplier", label: "ספק" },
    { key: "bc", ...EXAM_FIELDS.BC },
    { key: "diam", ...EXAM_FIELDS.DIAM },
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "va", ...EXAM_FIELDS.VA },
    { key: "j", ...EXAM_FIELDS.J, type: "j" }
  ]
  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof OldContactLenses
      return data[combField]?.toString() || ""
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldContactLenses
    return data[eyeField]?.toString() || ""
  }
  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye !== "C" && (field === "cyl" || field === "ax")) {
      handleAxisChange(eye as "R" | "L", field as "cyl" | "ax", value);
    } else if (eye === "C") {
      const combField = `comb_${field}` as keyof OldContactLenses
      onChange(combField, value)
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldContactLenses
      onChange(eyeField, value)
    }
  }
  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R"
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L", f: string) => {
        const eyeField = `${e.toLowerCase()}_${f}` as keyof OldContactLenses
        return latestData[eyeField]?.toString() || ""
      };
      const value = getLatestVal(fromEye, key);
      onChange(`${toEye.toLowerCase()}_${key}` as keyof OldContactLenses, value)
    })
  }

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Old Contact Lenses</h3>
          </div>
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(10,1fr)]' : 'grid-cols-[20px_repeat(10,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                {key === "cyl" ? (
                  <CylTitle onTranspose={handleManualTranspose} disabled={!isEditing} />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
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
            {columns.map((col) => {
              const { key, ...colProps } = col;
              const type = 'type' in col ? col.type : undefined;
              return (
                <div key={`r-${key}`}>
                  {(key === 'cyl' || key === 'ax') ? (
                    <AxisWarningInput
                      {...colProps}
                      eye="R"
                      field={key as "cyl" | "ax"}
                      value={getFieldValue("R", key)}
                      missingAxis={fieldWarnings.R.missingAxis}
                      missingCyl={fieldWarnings.R.missingCyl}
                      isEditing={isEditing}
                      onValueChange={handleAxisChange}
                      className={isEditing ? 'bg-white' : 'bg-accent/50'}
                    />
                  ) : type === "j" ? (
                    <NVJSelect
                      value={getFieldValue("R", key)}
                      onChange={(val) => handleChange("R", key, val)}
                      disabled={!isEditing}
                    />
                  ) : (
                    <FastInput
                      {...colProps}
                      value={getFieldValue("R", key)}
                      onChange={val => handleChange("R", key, val)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                  )}
                </div>
              );
            })}
            {!hideEyeLabels && <div className="flex items-center justify-center">
            </div>}
            {columns.map((col) => {
              const { key } = col;
              const type = 'type' in col ? col.type : undefined;
              return (
                <div key={`c-${key}`}>
                  {type === "j" ? (
                    <NVJSelect
                      value={getFieldValue("C", key)}
                      onChange={(val) => handleChange("C", key, val)}
                      disabled={!isEditing}
                    />
                  ) : key === "va" ? (
                    <FastInput
                      type="number"
                      value={getFieldValue("C", key)}
                      onChange={(val) => handleChange("C", key, val)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                  ) : (
                    <div></div>
                  )}
                </div>
              );
            })}
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
            {columns.map((col) => {
              const { key, ...colProps } = col;
              const type = 'type' in col ? col.type : undefined;
              return (
                <div key={`l-${key}`}>
                  {(key === 'cyl' || key === 'ax') ? (
                    <AxisWarningInput
                      {...colProps}
                      eye="L"
                      field={key as "cyl" | "ax"}
                      value={getFieldValue("L", key)}
                      missingAxis={fieldWarnings.L.missingAxis}
                      missingCyl={fieldWarnings.L.missingCyl}
                      isEditing={isEditing}
                      onValueChange={handleAxisChange}
                      className={isEditing ? 'bg-white' : 'bg-accent/50'}
                    />
                  ) : type === "j" ? (
                    <NVJSelect
                      value={getFieldValue("L", key)}
                      onChange={(val) => handleChange("L", key, val)}
                      disabled={!isEditing}
                    />
                  ) : (
                    <FastInput
                      {...colProps}
                      value={getFieldValue("L", key)}
                      onChange={val => handleChange("L", key, val)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
