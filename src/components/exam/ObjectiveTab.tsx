import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ObjectiveExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"

import { EXAM_FIELDS } from "./data/exam-field-definitions"
import { SECalculationUtils } from "./data/exam-constants"
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { calculateSE } from "@/utils/optometry-utils"
import { useAxisWarning } from "./shared/useAxisWarning"
import { AxisWarningInput } from "./shared/AxisWarningInput"

interface ObjectiveTabProps {
  objectiveData: ObjectiveExam;
  onObjectiveChange: (field: keyof ObjectiveExam, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
}

export function ObjectiveTab({
  objectiveData,
  onObjectiveChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: ObjectiveTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
    objectiveData,
    onObjectiveChange,
    isEditing
  );

  const dataRef = useRef(objectiveData);
  dataRef.current = objectiveData;

  const { handleManualTranspose } = usePrescriptionLogic(
    objectiveData,
    onObjectiveChange,
    isEditing
  );

  const columns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "se", ...EXAM_FIELDS.SE },
  ];

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof ObjectiveExam;
    return objectiveData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    if (field === "cyl" || field === "ax") {
      handleAxisChange(eye, field, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof ObjectiveExam;
      onObjectiveChange(eyeField, value);
    }

    // Auto-calculate SE
    if (field === "sph" || field === "cyl") {
      SECalculationUtils.handleSEChange({
        eye,
        field,
        value,
        data: objectiveData,
        onChange: onObjectiveChange,
        calculateSE
      });
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof ObjectiveExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof ObjectiveExam;
      const value = latestData[fromField]?.toString() || "";
      onObjectiveChange(toField, value);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Objective</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(4,1fr)]' : 'grid-cols-[20px_repeat(4,1fr)]'} gap-2 items-center`}>
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
            {columns.map(({ key, ...inputProps }) => {
              if (key === 'cyl' || key === 'ax') {
                const eyeWarnings = fieldWarnings.R;
                return (
                  <AxisWarningInput
                    {...inputProps}
                    key={`r-${key}`}
                    eye="R"
                    field={key}
                    value={getFieldValue("R", key)}
                    missingAxis={eyeWarnings.missingAxis}
                    missingCyl={eyeWarnings.missingCyl}
                    isEditing={isEditing}
                    onValueChange={handleAxisChange}
                    onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, (inputProps as any).min, (inputProps as any).max)}
                    className={isEditing ? 'bg-white' : 'bg-accent/50'}
                  />
                );
              }
              return (
                <FastInput
                  {...inputProps}
                  key={`r-${key}`}
                  type="number"
                  value={getFieldValue("R", key)}
                  onChange={(val) => handleChange("R", key, val)}
                  disabled={!isEditing}
                  debounceMs={key === "sph" || key === "cyl" ? 0 : undefined}
                  className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
            {columns.map(({ key, ...inputProps }) => {
              if (key === 'cyl' || key === 'ax') {
                const eyeWarnings = fieldWarnings.L;
                return (
                  <AxisWarningInput
                    {...inputProps}
                    key={`l-${key}`}
                    eye="L"
                    field={key}
                    value={getFieldValue("L", key)}
                    missingAxis={eyeWarnings.missingAxis}
                    missingCyl={eyeWarnings.missingCyl}
                    isEditing={isEditing}
                    onValueChange={handleAxisChange}
                    onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, (inputProps as any).min, (inputProps as any).max)}
                    className={isEditing ? 'bg-white' : 'bg-accent/50'}
                  />
                );
              }
              return (
                <FastInput
                  {...inputProps}
                  key={`l-${key}`}
                  type="number"
                  value={getFieldValue("L", key)}
                  onChange={(val) => handleChange("L", key, val)}
                  disabled={!isEditing}
                  debounceMs={key === "sph" || key === "cyl" ? 0 : undefined}
                  className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
