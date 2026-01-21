import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OldRefractionExtensionExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"

import { VASelect } from "./shared/VASelect"
import { EXAM_FIELDS } from "./data/exam-field-definitions"
import { BASE_VALUES_SIMPLE, PDCalculationUtils } from "./data/exam-constants"
import { FastInput, FastSelect, inputSyncManager } from "./shared/OptimizedInputs"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { NVJSelect } from "./shared/NVJSelect"

interface OldRefractionExtensionTabProps {
  oldRefractionExtensionData: OldRefractionExtensionExam;
  onOldRefractionExtensionChange: (field: keyof OldRefractionExtensionExam, value: string) => void;
  isEditing: boolean;
  onMultifocalClick: () => void;
  hideEyeLabels?: boolean;
}

export function OldRefractionExtensionTab({
  oldRefractionExtensionData,
  onOldRefractionExtensionChange,
  isEditing,
  onMultifocalClick,
  hideEyeLabels = false
}: OldRefractionExtensionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const dataRef = useRef(oldRefractionExtensionData);
  dataRef.current = oldRefractionExtensionData;

  const { handleManualTranspose } = usePrescriptionLogic(
    oldRefractionExtensionData,
    onOldRefractionExtensionChange,
    isEditing
  );

  const columns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "pr_h", label: "PR.H", ...EXAM_FIELDS.PRISM },
    { key: "base_h", label: "BASE.H", ...EXAM_FIELDS.BASE, isSelect: true },
    { key: "pr_v", label: "PR.V", ...EXAM_FIELDS.PRISM },
    { key: "base_v", label: "BASE.V", ...EXAM_FIELDS.BASE, isSelect: true },
    { key: "va", ...EXAM_FIELDS.VA },
    { key: "ad", ...EXAM_FIELDS.ADD },
    { key: "j", ...EXAM_FIELDS.J },
    { key: "pd_far", ...EXAM_FIELDS.PD_FAR },
    { key: "pd_close", ...EXAM_FIELDS.PD_NEAR },
  ];

  const baseOptions = BASE_VALUES_SIMPLE;

  const getFieldValue = (eye: "R" | "L" | "C", field: string, data = oldRefractionExtensionData) => {
    if (eye === "C") {
      if (field === "va") return data.comb_va?.toString() || "";
      if (field === "pd_far") return data.comb_pd_far?.toString() || "";
      if (field === "pd_close") return data.comb_pd_close?.toString() || "";
      return "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExtensionExam;
    return data[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (field === "pd_far" || field === "pd_close") {
      PDCalculationUtils.handlePDChange({
        eye,
        field,
        value,
        data: oldRefractionExtensionData,
        onChange: onOldRefractionExtensionChange,
        getRValue: (data, f) => parseFloat(data[`r_${f}` as keyof OldRefractionExtensionExam]?.toString() || "0") || 0,
        getLValue: (data, f) => parseFloat(data[`l_${f}` as keyof OldRefractionExtensionExam]?.toString() || "0") || 0
      });
      return;
    }

    if (eye === "C") {
      if (field === "va") onOldRefractionExtensionChange("comb_va", value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExtensionExam;
      onOldRefractionExtensionChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const value = getFieldValue(fromEye, key, latestData);
      handleChange(toEye, key, value);
    });
  };

  const renderField = (eye: "R" | "L" | "C", column: any) => {
    const { key, step, min, max, isSelect, ...colProps } = column;
    const value = getFieldValue(eye, key);

    if (isSelect && (key === "base_h" || key === "base_v")) {
      return (
        <FastSelect
          value={value}
          onChange={(newValue) => handleChange(eye, key, newValue)}
          disabled={!isEditing}
          options={baseOptions}
          size="xs"
          triggerClassName="h-8 text-xs w-full"
          center={column.center}
        />
      );
    }

    if (key === "va") {
      return <VASelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
    }

    const finalProps = (eye === "C" && (key === "pd_far" || key === "pd_close"))
      ? { ...EXAM_FIELDS.PD_COMB }
      : { step, min, max, ...colProps };

    if (key === "j") {
      return (
        <React.Suspense fallback={<FastInput {...finalProps} disabled />}>
          <NVJSelect
            value={value}
            onChange={(val) => handleChange(eye, key, val)}
            disabled={!isEditing}
          />
        </React.Suspense>
      );
    }

    return (
      <FastInput
        {...finalProps}
        type="number"
        value={value}
        onChange={(val) => handleChange(eye, key, val)}
        disabled={!isEditing}
        debounceMs={key === "pd_far" || key === "pd_close" ? 0 : undefined}
        className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
      />
    );
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Old Refraction E</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(12,1fr)]' : 'grid-cols-[20px_repeat(12,1fr)]'} gap-2 items-center`}>
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
            {columns.map((column) => (
              <div key={`r-${column.key}`}>
                {renderField("R", column)}
              </div>
            ))}

            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {columns.map((column) => {
              const { key } = column;
              if (key === 'cyl') {
                return (
                  <div key="c-mul-button" className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`h-8 text-xs px-2`}
                      disabled={!isEditing}
                      onClick={onMultifocalClick}
                    >
                      MUL
                    </Button>
                  </div>
                )
              }
              if (key === 'va' || key === 'pd_far' || key === 'pd_close') {
                return (
                  <div key={`c-${key}-input`}>
                    {renderField("C", column)}
                  </div>
                )
              }
              return <div key={`c-spacer-${key}`} />
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
            {columns.map((column) => (
              <div key={`l-${column.key}`}>
                {renderField("L", column)}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
