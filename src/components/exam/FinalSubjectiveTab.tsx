import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal"
import { FinalSubjectiveExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { EXAM_FIELDS, PDFieldConfigProvider } from "./data/exam-field-definitions"
import { BASE_VALUES_SIMPLE, PDCalculationUtils } from "./data/exam-constants"
import { VASelect } from "./shared/VASelect"
import { NVJSelect } from "./shared/NVJSelect"
import { FastInput, FastSelect, inputSyncManager } from "./shared/OptimizedInputs"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { useAxisWarning } from "./shared/useAxisWarning"
import { AxisWarningInput } from "./shared/AxisWarningInput"

interface FinalSubjectiveTabProps {
  finalSubjectiveData: FinalSubjectiveExam;
  onFinalSubjectiveChange: (field: keyof FinalSubjectiveExam, value: string) => void;
  isEditing: boolean;
  onVHConfirm: (rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string, leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string) => void;
  hideEyeLabels?: boolean;
}

export function FinalSubjectiveTab({
  finalSubjectiveData,
  onFinalSubjectiveChange,
  isEditing,
  onVHConfirm,
  hideEyeLabels = false
}: FinalSubjectiveTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
    finalSubjectiveData,
    onFinalSubjectiveChange,
    isEditing
  );

  const dataRef = useRef(finalSubjectiveData);
  dataRef.current = finalSubjectiveData;

  const { handleManualTranspose } = usePrescriptionLogic(
    finalSubjectiveData,
    onFinalSubjectiveChange,
    isEditing
  );

  const columns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "pris", ...EXAM_FIELDS.PRISM },
    { key: "base", ...EXAM_FIELDS.BASE, type: "select", options: BASE_VALUES_SIMPLE },
    { key: "va", ...EXAM_FIELDS.VA, type: "va" },
    { key: "j", ...EXAM_FIELDS.J, type: "j" },
    { key: "pd_far", ...EXAM_FIELDS.PD_FAR },
    { key: "pd_close", ...EXAM_FIELDS.PD_NEAR },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", key: string): string => {
    if (eye === "C") {
      const field = `comb_${key}` as keyof FinalSubjectiveExam;
      return finalSubjectiveData[field]?.toString() || "";
    }

    if (key === "pris") {
      const vVal = finalSubjectiveData[`${eye.toLowerCase()}_pr_v` as keyof FinalSubjectiveExam];
      const hVal = finalSubjectiveData[`${eye.toLowerCase()}_pr_h` as keyof FinalSubjectiveExam];
      return (vVal || hVal || "").toString();
    }

    if (key === "base") {
      const vBase = finalSubjectiveData[`${eye.toLowerCase()}_base_v` as keyof FinalSubjectiveExam];
      const hBase = finalSubjectiveData[`${eye.toLowerCase()}_base_h` as keyof FinalSubjectiveExam];
      return (vBase || hBase || "").toString();
    }

    const field = `${eye.toLowerCase()}_${key}` as keyof FinalSubjectiveExam;
    return finalSubjectiveData[field]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", key: string, value: string) => {
    if (key === "pd_far" || key === "pd_close") {
      PDCalculationUtils.handlePDChange({
        eye,
        field: key,
        value,
        data: dataRef.current,
        onChange: onFinalSubjectiveChange,
        getRValue: (data, f) => parseFloat(data[`r_${f}` as keyof FinalSubjectiveExam]?.toString() || "0") || 0,
        getLValue: (data, f) => parseFloat(data[`l_${f}` as keyof FinalSubjectiveExam]?.toString() || "0") || 0
      });
      return;
    }

    if (eye === "C") {
      const field = `comb_${key}` as keyof FinalSubjectiveExam;
      onFinalSubjectiveChange(field, value);
      return;
    }

    if (key === "pris") {
      const currentBase = getFieldValue(eye, "base");
      const isVertical = ["UP", "DOWN"].includes(currentBase);
      const field = `${eye.toLowerCase()}_pr_${isVertical ? 'v' : 'h'}` as keyof FinalSubjectiveExam;
      onFinalSubjectiveChange(field, value);
      return;
    }

    if (key === "base") {
      const isVertical = ["UP", "DOWN"].includes(value);
      const targetPrisKey = `${eye.toLowerCase()}_pr_${isVertical ? 'v' : 'h'}` as keyof FinalSubjectiveExam;
      const otherPrisKey = `${eye.toLowerCase()}_pr_${isVertical ? 'h' : 'v'}` as keyof FinalSubjectiveExam;
      const targetBaseKey = `${eye.toLowerCase()}_base_${isVertical ? 'v' : 'h'}` as keyof FinalSubjectiveExam;
      const otherBaseKey = `${eye.toLowerCase()}_base_${isVertical ? 'h' : 'v'}` as keyof FinalSubjectiveExam;

      const currentPris = getFieldValue(eye, "pris");
      onFinalSubjectiveChange(targetBaseKey, value);
      onFinalSubjectiveChange(targetPrisKey, currentPris);

      onFinalSubjectiveChange(otherBaseKey, "");
      onFinalSubjectiveChange(otherPrisKey, "");
      return;
    }

    if (key === "cyl" || key === "ax") {
      handleAxisChange(eye as "R" | "L", key as "cyl" | "ax", value);
      return;
    }

    const field = `${eye.toLowerCase()}_${key}` as keyof FinalSubjectiveExam;
    onFinalSubjectiveChange(field, value);
  };

  const renderInput = (eye: "R" | "L" | "C", col: any) => {
    const { key, type, options, ...inputProps } = col;
    const value = getFieldValue(eye, key);

    switch (type) {
      case "va":
        return <VASelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
      case "j":
        return <NVJSelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
      case "select":
        return (
          <FastSelect
            value={value}
            onChange={(val) => handleChange(eye, key, val)}
            disabled={!isEditing}
            options={options || []}
            size="xs"
            triggerClassName="h-8 text-xs w-full disabled:opacity-100"
            center={col.center}
          />
        );
      default: {
        const pdProps = (eye === "C" && (key === "pd_far" || key === "pd_close"))
          ? EXAM_FIELDS.PD_COMB
          : inputProps;

        if ((key === 'cyl' || key === 'ax') && eye !== 'C') {
          const eyeWarnings = fieldWarnings[eye as "R" | "L"];
          return (
            <AxisWarningInput
              {...pdProps}
              eye={eye as "R" | "L"}
              field={key as "cyl" | "ax"}
              value={value}
              missingAxis={eyeWarnings.missingAxis}
              missingCyl={eyeWarnings.missingCyl}
              isEditing={isEditing}
              onValueChange={handleAxisChange}
              onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, (pdProps as any).min, (pdProps as any).max)}
            />
          );
        }

        return (
          <FastInput
            {...pdProps}
            max={key === "pd_close" ? PDFieldConfigProvider.getNearConfig(getFieldValue(eye, "pd_far")).max : (pdProps as any).max}
            type="number"
            value={value}
            onChange={(val) => handleChange(eye, key, val)}
            disabled={!isEditing}
            debounceMs={key === "pd_far" || key === "pd_close" ? 0 : undefined}
            className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default`}
          />
        );
      }
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      if (key === "va" || key === "j") return;

      const getLatestVal = (e: "R" | "L" | "C", f: string): string => {
        if (e === "C") {
          const field = `comb_${f}` as keyof FinalSubjectiveExam;
          return latestData[field]?.toString() || "";
        }

        if (f === "pris") {
          const vVal = latestData[`${e.toLowerCase()}_pr_v` as keyof FinalSubjectiveExam];
          const hVal = latestData[`${e.toLowerCase()}_pr_h` as keyof FinalSubjectiveExam];
          return (vVal || hVal || "").toString();
        }

        if (f === "base") {
          const vBase = latestData[`${e.toLowerCase()}_base_v` as keyof FinalSubjectiveExam];
          const hBase = latestData[`${e.toLowerCase()}_base_h` as keyof FinalSubjectiveExam];
          return (vBase || hBase || "").toString();
        }

        const field = `${e.toLowerCase()}_${f}` as keyof FinalSubjectiveExam;
        return latestData[field]?.toString() || "";
      };

      const val = getLatestVal(fromEye, key);
      handleChange(toEye, key, val);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Final Subjective</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(9,1fr)]' : 'grid-cols-[20px_repeat(9,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center text-center">
                {key === "cyl" ? (
                  <CylTitle onTranspose={handleManualTranspose} disabled={!isEditing} />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {label}
                  </span>
                )}
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
            {columns.map(col => <div key={`r-${col.key}`}>{renderInput("R", col)}</div>)}

            {!hideEyeLabels && <div className="flex items-center justify-center h-8"></div>}
            {columns.map((col) => {
              const { key } = col;
              if (key === 'pris') {
                return (
                  <div key="c-vh-calculator" className="flex justify-center">
                    <VHCalculatorModal onConfirm={() => { }} onRawConfirm={onVHConfirm} disabled={!isEditing} />
                  </div>
                );
              }
              if (key === 'va' || key === 'j' || key === 'pd_far' || key === 'pd_close') {
                return (
                  <div key={`c-${key}`}>
                    {renderInput("C", col)}
                  </div>
                );
              }
              return <div key={`c-spacer-${key}`} />;
            })}

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
            {columns.map(col => <div key={`l-${col.key}`}>{renderInput("L", col)}</div>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
