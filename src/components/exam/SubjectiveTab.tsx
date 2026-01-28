import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal"
import { SubjectiveExam } from "@/lib/db/schema-interface"
import { VASelect } from "./shared/VASelect"
import { ChevronUp, ChevronDown } from "lucide-react"

import { FastInput, FastSelect, inputSyncManager } from "./shared/OptimizedInputs"
import { EXAM_FIELDS, PDFieldConfigProvider } from "./data/exam-field-definitions"
import { BASE_VALUES, PDCalculationUtils } from "./data/exam-constants"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { useAxisWarning } from "./shared/useAxisWarning"
import { AxisWarningInput } from "./shared/AxisWarningInput"

interface SubjectiveTabProps {
  subjectiveData: SubjectiveExam;
  onSubjectiveChange: (field: keyof SubjectiveExam, value: string) => void;
  isEditing: boolean;
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  onMultifocalClick: () => void;
  hideEyeLabels?: boolean;
}

export const SubjectiveTab = React.memo(function SubjectiveTab({
  subjectiveData,
  onSubjectiveChange,
  isEditing,
  onVHConfirm,
  onMultifocalClick,
  hideEyeLabels = false
}: SubjectiveTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
    subjectiveData,
    onSubjectiveChange,
    isEditing
  );

  const dataRef = useRef(subjectiveData);
  dataRef.current = subjectiveData;

  const { handleManualTranspose } = usePrescriptionLogic(
    subjectiveData,
    onSubjectiveChange,
    isEditing
  );

  const columns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "pris", ...EXAM_FIELDS.PRISM },
    { key: "base", ...EXAM_FIELDS.BASE, type: "select", options: BASE_VALUES },
    { key: "va", ...EXAM_FIELDS.VA },
    { key: "pd_far", ...EXAM_FIELDS.PD_FAR },
    { key: "pd_close", ...EXAM_FIELDS.PD_NEAR }
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof SubjectiveExam;
      return subjectiveData[combField]?.toString() || "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof SubjectiveExam;
    return subjectiveData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (field === "pd_far" || field === "pd_close") {
      PDCalculationUtils.handlePDChange({
        eye,
        field,
        value,
        data: dataRef.current,
        onChange: onSubjectiveChange,
        getRValue: (data, f) => parseFloat(data[`r_${f}` as keyof SubjectiveExam]?.toString() || "0") || 0,
        getLValue: (data, f) => parseFloat(data[`l_${f}` as keyof SubjectiveExam]?.toString() || "0") || 0
      });
      return;
    }

    if (eye !== "C" && (field === "cyl" || field === "ax")) {
      handleAxisChange(eye as "R" | "L", field as "cyl" | "ax", value);
    } else if (eye === "C") {
      const combField = `comb_${field}` as keyof SubjectiveExam;
      onSubjectiveChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof SubjectiveExam;
      onSubjectiveChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      // Use getFieldValue with latestData instead of props
      const getLatestVal = (e: "R" | "L" | "C", f: string) => {
        const eyeField = `${e.toLowerCase()}_${f}` as keyof SubjectiveExam;
        return latestData[eyeField]?.toString() || "";
      };

      const value = getLatestVal(fromEye, key);
      handleChange(toEye, key, value);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Subjective</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(8,1fr)]' : 'grid-cols-[20px_repeat(8,1fr)]'} gap-2 items-center`}>
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
            {columns.map(({ key, ...colProps }) => (
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
                    onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, (colProps as any).min, (colProps as any).max)}
                    className={isEditing ? 'bg-white' : 'bg-accent/50'}
                  />
                ) : key === "base" ? (
                  <FastSelect
                    value={getFieldValue("R", key)}
                    onChange={(value) => handleChange("R", key, value)}
                    disabled={!isEditing}
                    options={(colProps as any).options || []}
                    size="xs"
                    triggerClassName="h-8 text-xs w-full"
                    center={(colProps as any).center}
                  />
                ) : key === "va" ? (
                  <VASelect
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                  />
                ) : (
                  <FastInput
                    {...colProps}
                    max={key === "pd_close" ? PDFieldConfigProvider.getNearConfig(getFieldValue("R", "pd_far")).max : colProps.max}
                    type="number"
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                    debounceMs={key === "pd_far" || key === "pd_close" ? 0 : undefined}
                    className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}

            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {columns.map(({ key }) => {
              if (key === "pris") {
                return (
                  <div key={`c-${key}`} className="flex justify-center">
                    <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
                  </div>
                );
              } else if (key === "va") {
                return (
                  <div key={`c-${key}`}>
                    <VASelect
                      value={getFieldValue("C", key)}
                      onChange={(val) => handleChange("C", key, val)}
                      disabled={!isEditing}
                    />
                  </div>
                );
              } else if (key === "pd_close" || key === "pd_far") {
                const pdCombProps = EXAM_FIELDS.PD_COMB;
                return (
                  <FastInput
                    {...pdCombProps}
                    max={key === "pd_close" ? PDFieldConfigProvider.getNearConfig(getFieldValue("C", "pd_far")).max : pdCombProps.max}
                    key={`c-${key}`}
                    type="number"
                    value={getFieldValue("C", key)}
                    onChange={(val) => handleChange("C", key, val)}
                    disabled={!isEditing}
                    debounceMs={0}
                    className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                );
              } else {
                return <div key={`c-${key}`}></div>;
              }
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
            {columns.map(({ key, ...colProps }) => (
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
                    onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, (colProps as any).min, (colProps as any).max)}
                    className={isEditing ? 'bg-white' : 'bg-accent/50'}
                  />
                ) : key === "base" ? (
                  <FastSelect
                    value={getFieldValue("L", key)}
                    onChange={(value) => handleChange("L", key, value)}
                    disabled={!isEditing}
                    options={(colProps as any).options || []}
                    size="xs"
                    triggerClassName="h-8 text-xs w-full"
                    center={(colProps as any).center}
                  />
                ) : key === "va" ? (
                  <VASelect
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                  />
                ) : (
                  <FastInput
                    {...colProps}
                    max={key === "pd_close" ? PDFieldConfigProvider.getNearConfig(getFieldValue("L", "pd_far")).max : colProps.max}
                    type="number"
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                    debounceMs={key === "pd_far" || key === "pd_close" ? 0 : undefined}
                    className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});