import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { FinalPrescriptionExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { EXAM_FIELDS } from "./data/exam-field-definitions"
import { BASE_VALUES_SIMPLE, PDCalculationUtils } from "./data/exam-constants"
import { VASelect } from "./shared/VASelect"
import { FastInput, FastSelect, inputSyncManager } from "./shared/OptimizedInputs"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { useAxisWarning } from "./shared/useAxisWarning"
import { AxisWarningInput } from "./shared/AxisWarningInput"

interface FinalPrescriptionTabProps {
  finalPrescriptionData: FinalPrescriptionExam;
  onFinalPrescriptionChange: (field: keyof FinalPrescriptionExam, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
}

export function FinalPrescriptionTab({
  finalPrescriptionData,
  onFinalPrescriptionChange,
  isEditing,
  hideEyeLabels = false
}: FinalPrescriptionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const { fieldWarnings, handleAxisChange } = useAxisWarning(
    finalPrescriptionData,
    onFinalPrescriptionChange,
    isEditing,
    {
      R: { cyl: "r_cyl", ax: "r_ax" },
      L: { cyl: "l_cyl", ax: "l_ax" },
    }
  );

  const dataRef = useRef(finalPrescriptionData);
  dataRef.current = finalPrescriptionData;

  const { handleManualTranspose } = usePrescriptionLogic(
    finalPrescriptionData,
    onFinalPrescriptionChange,
    isEditing
  );

  const columns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "pris", ...EXAM_FIELDS.PRISM },
    { key: "base", ...EXAM_FIELDS.BASE, type: "select", options: BASE_VALUES_SIMPLE },
    { key: "va", ...EXAM_FIELDS.VA, type: "va" },
    { key: "ad", ...EXAM_FIELDS.ADD },
    { key: "pd", ...EXAM_FIELDS.PD_FAR },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof FinalPrescriptionExam;
      return finalPrescriptionData[combField]?.toString() || "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof FinalPrescriptionExam;
    return finalPrescriptionData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (field === "pd") {
      PDCalculationUtils.handlePDChange({
        eye,
        field,
        value,
        data: finalPrescriptionData,
        onChange: onFinalPrescriptionChange,
        getRValue: (data, f) => parseFloat(data[`r_${f}` as keyof FinalPrescriptionExam]?.toString() || "0") || 0,
        getLValue: (data, f) => parseFloat(data[`l_${f}` as keyof FinalPrescriptionExam]?.toString() || "0") || 0
      });
      return;
    }

    if (eye !== "C" && (field === "cyl" || field === "ax")) {
      handleAxisChange(eye as "R" | "L", field as "cyl" | "ax", value);
    } else if (eye === "C") {
      const combField = `comb_${field}` as keyof FinalPrescriptionExam;
      onFinalPrescriptionChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof FinalPrescriptionExam;
      onFinalPrescriptionChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L" | "C", f: string) => {
        if (e === "C") {
          const combField = `comb_${f}` as keyof FinalPrescriptionExam;
          return latestData[combField]?.toString() || "";
        }
        const eyeField = `${e.toLowerCase()}_${f}` as keyof FinalPrescriptionExam;
        return latestData[eyeField]?.toString() || "";
      };
      const value = getLatestVal(fromEye, key);
      handleChange(toEye, key, value);
    });
  };

  const renderInput = (eye: "R" | "L", col: (typeof columns)[number]) => {
    const { key, step, ...colProps } = col;
    const type = (col as any).type as string | undefined;
    const options = (col as any).options as readonly string[] | undefined;
    switch (type) {
      case "va":
        return <VASelect value={getFieldValue(eye, key)} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
      case "select":
        return (
          <FastSelect
            value={getFieldValue(eye, key)}
            onChange={(value) => handleChange(eye, key, value)}
            disabled={!isEditing}
            options={options || []}
            size="xs"
            triggerClassName="h-8 text-xs w-full"
            center={col.center}
          />
        );
      default:
        if (key === "cyl" || key === "ax") {
          return (
            <AxisWarningInput
              {...colProps}
              eye={eye as "R" | "L"}
              field={key as "cyl" | "ax"}
              value={getFieldValue(eye as "R" | "L", key)}
              missingAxis={fieldWarnings[eye as "R" | "L"].missingAxis}
              missingCyl={fieldWarnings[eye as "R" | "L"].missingCyl}
              isEditing={isEditing}
              onValueChange={handleAxisChange}
              className={isEditing ? 'bg-white' : 'bg-accent/50'}
            />
          );
        }
        return (
          <FastInput
            {...colProps}
            type="number" step={step}
            value={getFieldValue(eye, key)}
            onChange={(val) => handleChange(eye, key, val)}
            disabled={!isEditing}
            debounceMs={key === "pd" ? 0 : undefined}
            className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
          />
        );
    }
  };

  return (
    <Card className="w-full examcard pb-4 pt-3" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">מרשם סופי</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(8,1fr)]' : 'grid-cols-[20px_repeat(8,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                {key === "cyl" ? (
                  <CylTitle onTranspose={handleManualTranspose} disabled={!isEditing} />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground text-center">
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
            {columns.map(col => <div key={`r-${col.key}`}>{renderInput("R", col)}</div>)}

            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {columns.map(({ key, step, ...colProps }) => {
              if (key === 'va') {
                return (
                  <div key="c-va-input">
                    <VASelect
                      value={getFieldValue("C", "va")}
                      onChange={(val) => handleChange("C", "va", val)}
                      disabled={!isEditing}
                    />
                  </div>
                );
              }
              if (key === 'pd') {
                const pdCombProps = EXAM_FIELDS.PD_COMB;
                return (
                  <FastInput
                    {...pdCombProps}
                    key={`c-${key}`}
                    type="number"
                    step={step}
                    value={getFieldValue("C", key)}
                    onChange={(val) => handleChange("C", key, val)}
                    disabled={!isEditing}
                    debounceMs={0}
                    className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                );
              }
              return <div key={`c-spacer-${key}`} />;
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
            {columns.map(col => <div key={`l-${col.key}`}>{renderInput("L", col)}</div>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
