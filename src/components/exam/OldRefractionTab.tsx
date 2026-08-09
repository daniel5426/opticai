import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { OldRefractionExam } from "@/lib/db/schema-interface";
import { ChevronUp, ChevronDown } from "lucide-react";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { BASE_VALUES } from "./data/exam-constants";
import { VASelect } from "./shared/VASelect";
import { NVJSelect } from "./shared/NVJSelect";
import { cn } from "@/utils/tailwind";
import {
  FastInput,
  FastSelect,
  inputSyncManager,
} from "./shared/OptimizedInputs";
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic";
import { CylTitle } from "./shared/CylTitle";
import { useAxisWarning } from "./shared/useAxisWarning";
import { AxisWarningInput } from "./shared/AxisWarningInput";
import { ToggleTextNumberInput } from "./shared/ToggleTextNumberInput";
import { copyEyeRowFields } from "./shared/copyEyeRowFields";
import { RefractionTabsHeader } from "./shared/RefractionTabsHeader";

interface OldRefractionTabProps {
  oldRefractionData: OldRefractionExam;
  onOldRefractionChange: (
    field: keyof OldRefractionExam,
    value: string,
  ) => void;
  isEditing: boolean;
  onMultifocalClick: () => void;
  hideEyeLabels?: boolean;
  tabCount: number;
  activeTab: number;
  onTabChange: (tabIdx: number) => void;
  onAddTab: (type: string) => void;
  onDeleteTab?: (tabIdx: number) => void;
  onDuplicateTab?: (tabIdx: number) => void;
  onUpdateType?: (tabIdx: number, newType: string) => void;
  allTabsData?: OldRefractionExam[];
}

export const OldRefractionTab = React.memo(function OldRefractionTab({
  oldRefractionData,
  onOldRefractionChange,
  isEditing,
  onMultifocalClick,
  hideEyeLabels = false,
  tabCount,
  activeTab,
  onTabChange,
  onAddTab,
  onDeleteTab,
  onDuplicateTab,
  onUpdateType,
  allTabsData = [],
}: OldRefractionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);
  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
    oldRefractionData,
    onOldRefractionChange,
    isEditing,
  );

  const dataRef = useRef(oldRefractionData);
  dataRef.current = oldRefractionData;

  const { handleManualTranspose, getPowerWarningMessage } = usePrescriptionLogic(
    oldRefractionData,
    onOldRefractionChange,
    isEditing,
  );

  const handleTranspose = React.useCallback(() => {
    inputSyncManager.flush();
    handleManualTranspose();
  }, [handleManualTranspose]);

  const mainColumns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "pris", ...EXAM_FIELDS.PRISM },
    { key: "base", ...EXAM_FIELDS.BASE, type: "select", options: BASE_VALUES },
    { key: "va", ...EXAM_FIELDS.VA, type: "va" },
    { key: "ad", ...EXAM_FIELDS.ADD },
    { key: "j", ...EXAM_FIELDS.J, type: "j" },
  ];

  const getStorageFieldKey = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      if (field === "va" || field === "j") return `comb_${field}`;
      return "";
    }
    return `${eye.toLowerCase()}_${field}`;
  };

  const getFieldValue = (
    eye: "R" | "L" | "C",
    field: string,
    data = oldRefractionData,
  ) => {
    const storageKey = getStorageFieldKey(eye, field);
    if (!storageKey) return "";

    return (data as any)[storageKey]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye !== "C" && (field === "cyl" || field === "ax")) {
      handleAxisChange(eye as "R" | "L", field as "cyl" | "ax", value);
      return;
    }

    if (eye === "C") {
      const combField = `comb_${field}` as keyof OldRefractionExam;
      onOldRefractionChange(combField, value);
    } else {
      const eyeField =
        `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
      onOldRefractionChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    copyEyeRowFields(dataRef.current, onOldRefractionChange, fromEye);
  };

  const renderField = (eye: "R" | "L" | "C", col: any) => {
    const { key, type, options, ...inputProps } = col;
    const value = getFieldValue(eye, key);

    if (type === "select") {
      return (
        <FastSelect
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
          options={options || []}
          allowImportedValue
          size="xs"
          triggerClassName="h-8 text-xs w-full disabled:opacity-100"
          center={col.center}
        />
      );
    }

    if (type === "va") {
      return (
        <VASelect
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
        />
      );
    }

    if (type === "j") {
      return (
        <NVJSelect
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
        />
      );
    }

    // For CYL and AXIS, use AxisWarningInput
    if ((key === "cyl" || key === "ax") && eye !== "C") {
      const eyeWarnings = fieldWarnings[eye as "R" | "L"];
      return (
        <AxisWarningInput
          {...inputProps}
          eye={eye as "R" | "L"}
          field={key as "cyl" | "ax"}
          value={value}
          missingAxis={eyeWarnings.missingAxis}
          missingCyl={eyeWarnings.missingCyl}
          isEditing={isEditing}
          onValueChange={handleAxisChange}
          onBlur={(eye, field, val) =>
            handleAxisBlur(
              eye,
              field,
              val,
              (inputProps as any).min,
              (inputProps as any).max,
            )
          }
          aria-invalid={key === "cyl" && getPowerWarningMessage(eye) ? true : undefined}
          warningMessage={key === "cyl" ? getPowerWarningMessage(eye) : null}
        />
      );
    }

    if (key === "sph" && eye !== "C") {
      return (
        <ToggleTextNumberInput
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
          textOptions={(inputProps as any).textOptions}
          textValueAliases={(inputProps as any).textValueAliases}
          textDisplayAliases={(inputProps as any).displayAliases}
          numericProps={{
            step: (inputProps as any).step,
            min: (inputProps as any).min,
            max: (inputProps as any).max,
            showPlus: (inputProps as any).showPlus,
            suffix: (inputProps as any).suffix,
            debounceMs: 0,
            "aria-invalid": getPowerWarningMessage(eye) ? true : undefined,
            warningMessage: getPowerWarningMessage(eye),
            className:
              "h-8 text-xs disabled:opacity-100 disabled:cursor-default",
          }}
        />
      );
    }

    // For other fields, keep FastInput for performance
    return (
      <div className="relative">
        <FastInput
          {...inputProps}
          type="number"
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
          className="h-8 text-xs disabled:cursor-default disabled:opacity-100"
        />
      </div>
    );
  };

  return (
    <Card className="examcard w-full pt-3 pb-4">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <RefractionTabsHeader
            title="Old Refraction"
            tabCount={tabCount}
            activeTab={activeTab}
            tabTypes={allTabsData.map(
              (tab) => tab.r_glasses_type || tab.l_glasses_type,
            )}
            isEditing={isEditing}
            onTabChange={onTabChange}
            onAddTab={onAddTab}
            onDeleteTab={onDeleteTab}
            onDuplicateTab={onDuplicateTab}
            onUpdateType={onUpdateType}
          />

          <div
            className={`grid ${hideEyeLabels ? "grid-cols-[repeat(8,1fr)]" : "grid-cols-[20px_repeat(8,1fr)]"} items-center gap-2`}
          >
            {!hideEyeLabels && <div></div>}
            {mainColumns.map(({ key, label }) => (
              <div key={key} className="flex h-4 items-center justify-center">
                {key === "cyl" ? (
                  <CylTitle
                    onTranspose={handleTranspose}
                    disabled={!isEditing}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs font-medium">
                    {label}
                  </span>
                )}
              </div>
            ))}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="hover:bg-accent cursor-pointer rounded-full px-2 text-base font-medium"
                  onMouseEnter={() => setHoveredEye("R")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("L")}
                  title="Click to copy from L eye"
                >
                  {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
                </span>
              </div>
            )}
            {mainColumns.map((col) => (
              <div key={`r-${col.key}`}>{renderField("R", col)}</div>
            ))}

            {!hideEyeLabels && (
              <div className="flex h-8 items-center justify-center"></div>
            )}
            {mainColumns.map(({ key }) => {
              if (key === "va" || key === "j") {
                return (
                  <div key={`c-${key}-input`}>
                    {renderField("C", { key, type: key === "va" ? "va" : "j" })}
                  </div>
                );
              }
              return <div key={`c-spacer-${key}`} />;
            })}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="hover:bg-accent cursor-pointer rounded-full px-2 text-base font-medium"
                  onMouseEnter={() => setHoveredEye("L")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("R")}
                  title="Click to copy from R eye"
                >
                  {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
                </span>
              </div>
            )}
            {mainColumns.map((col) => (
              <div key={`l-${col.key}`}>{renderField("L", col)}</div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
