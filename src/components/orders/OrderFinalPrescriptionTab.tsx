import React, { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinalPrescriptionExam } from "@/lib/db/schema-interface";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EXAM_FIELDS, PDFieldConfigProvider } from "@/components/exam/data/exam-field-definitions";
import { BASE_VALUES_SIMPLE, PDCalculationUtils } from "@/components/exam/data/exam-constants";
import { FastInput, FastSelect } from "@/components/exam/shared/OptimizedInputs";
import { usePrescriptionLogic } from "@/components/exam/shared/usePrescriptionLogic";
import { CylTitle } from "@/components/exam/shared/CylTitle";
import { useAxisWarning } from "@/components/exam/shared/useAxisWarning";
import { AxisWarningInput } from "@/components/exam/shared/AxisWarningInput";
import { ToggleTextNumberInput } from "@/components/exam/shared/ToggleTextNumberInput";
import { copyEyeRowFields } from "@/components/exam/shared/copyEyeRowFields";
import {
  ADDITION_ADD_TYPE_LABELS,
  ADDITION_ADD_TYPES,
  normalizeAdditionAddType,
  type AdditionAddType,
} from "@/lib/addition-add-sources";

interface OrderFinalPrescriptionTabProps {
  finalPrescriptionData: FinalPrescriptionExam;
  onFinalPrescriptionChange: (
    field: keyof FinalPrescriptionExam,
    value: string,
  ) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  addTypeOptions?: AdditionAddType[];
}

export function OrderFinalPrescriptionTab({
  finalPrescriptionData,
  onFinalPrescriptionChange,
  isEditing,
  hideEyeLabels = false,
  addTypeOptions,
}: OrderFinalPrescriptionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);
  const selectedAddType = normalizeAdditionAddType(finalPrescriptionData.add_type) || "";
  const visibleAddTypeOptions =
    addTypeOptions && addTypeOptions.length > 0
      ? addTypeOptions
      : [...ADDITION_ADD_TYPES];

  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
    finalPrescriptionData,
    onFinalPrescriptionChange,
    isEditing,
    {
      R: { cyl: "r_cyl", ax: "r_ax" },
      L: { cyl: "l_cyl", ax: "l_ax" },
    },
  );

  const dataRef = useRef(finalPrescriptionData);
  dataRef.current = finalPrescriptionData;

  const { handleManualTranspose } = usePrescriptionLogic(
    finalPrescriptionData,
    onFinalPrescriptionChange,
    isEditing,
  );

  const columns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "pris", ...EXAM_FIELDS.PRISM },
    { key: "base", ...EXAM_FIELDS.BASE, type: "select", options: BASE_VALUES_SIMPLE },
    { key: "ad", ...EXAM_FIELDS.ADD },
    { key: "pd", ...EXAM_FIELDS.PD_FAR },
    { key: "pd_close", ...EXAM_FIELDS.PD_NEAR },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof FinalPrescriptionExam;
      return finalPrescriptionData[combField]?.toString() || "";
    }
    const eyeField =
      `${eye.toLowerCase()}_${field}` as keyof FinalPrescriptionExam;
    return finalPrescriptionData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (field === "pd" || field === "pd_close") {
      PDCalculationUtils.handlePDChange({
        eye,
        field,
        value,
        data: dataRef.current,
        onChange: onFinalPrescriptionChange,
        getRValue: (data, f) =>
          parseFloat(
            data[`r_${f}` as keyof FinalPrescriptionExam]?.toString() || "0",
          ) || 0,
        getLValue: (data, f) =>
          parseFloat(
            data[`l_${f}` as keyof FinalPrescriptionExam]?.toString() || "0",
          ) || 0,
      });
      return;
    }

    if (eye !== "C" && (field === "cyl" || field === "ax")) {
      handleAxisChange(eye, field as "cyl" | "ax", value);
    } else if (eye === "C") {
      const combField = `comb_${field}` as keyof FinalPrescriptionExam;
      onFinalPrescriptionChange(combField, value);
    } else {
      const eyeField =
        `${eye.toLowerCase()}_${field}` as keyof FinalPrescriptionExam;
      onFinalPrescriptionChange(eyeField, value);
    }
  };

  const handleAddTypeChange = (value: string) => {
    onFinalPrescriptionChange("add_type", value);
    const source = finalPrescriptionData.addition_add_sources?.[value];
    if (source?.r_ad !== undefined) {
      onFinalPrescriptionChange("r_ad", String(source.r_ad));
    }
    if (source?.l_ad !== undefined) {
      onFinalPrescriptionChange("l_ad", String(source.l_ad));
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    copyEyeRowFields(dataRef.current, onFinalPrescriptionChange, fromEye);
  };

  const renderInput = (eye: "R" | "L", col: (typeof columns)[number]) => {
    const { key, step, ...colProps } = col;
    const type = (col as any).type as string | undefined;
    const options = (col as any).options as readonly string[] | undefined;
    switch (type) {
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
              step={step}
              eye={eye}
              field={key as "cyl" | "ax"}
              value={getFieldValue(eye, key)}
              missingAxis={fieldWarnings[eye].missingAxis}
              missingCyl={fieldWarnings[eye].missingCyl}
              isEditing={isEditing}
              onValueChange={handleAxisChange}
              onBlur={(eye, field, val) =>
                handleAxisBlur(eye, field, val, colProps.min, colProps.max)
              }
              className={isEditing ? "bg-white" : "bg-accent/50"}
            />
          );
        }
        if (key === "sph") {
          return (
            <ToggleTextNumberInput
              value={getFieldValue(eye, key)}
              onChange={(val) => handleChange(eye, key, val)}
              disabled={!isEditing}
              textOptions={colProps.textOptions}
              textValueAliases={colProps.textValueAliases}
              numericProps={{
                step,
                min: colProps.min,
                max: colProps.max,
                showPlus: colProps.showPlus,
                suffix: colProps.suffix,
                className: `h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:opacity-100 disabled:cursor-default`,
              }}
            />
          );
        }
        return (
          <FastInput
            {...colProps}
            max={
              key === "pd_close"
                ? PDFieldConfigProvider.getNearConfig(getFieldValue(eye, "pd"))
                    .max
                : colProps.max
            }
            type="number"
            step={step}
            value={getFieldValue(eye, key)}
            onChange={(val) => handleChange(eye, key, val)}
            disabled={!isEditing}
            debounceMs={key === "pd" || key === "pd_close" ? 0 : undefined}
            className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:opacity-100 disabled:cursor-default`}
          />
        );
    }
  };

  return (
    <Card className="w-full examcard pb-4 pt-3" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="relative flex items-center" style={{ minHeight: 24 }}>
            <div className="absolute left-0 py-0 flex h-6 items-center justify-start">
              <Select
                value={selectedAddType || undefined}
                onValueChange={handleAddTypeChange}
                disabled={!isEditing}
                clearable={false}
              >
                <SelectTrigger
                  size="xs"
                  centered
                  hideIcon
                  className="h-5 w-[58px] rounded-md px-1 py-0 text-center text-[10px] font-normal leading-none text-muted-foreground shadow-none disabled:cursor-default disabled:opacity-70 *:data-[slot=select-value]:justify-center *:data-[slot=select-value]:leading-none"
                >
                  <SelectValue placeholder="TYPE" />
                </SelectTrigger>
                <SelectContent align="start" sideOffset={4} className="min-w-[72px]">
                  {visibleAddTypeOptions.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      className="justify-center text-xs font-medium"
                    >
                      {ADDITION_ADD_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 text-center">
              <h3 className="font-medium text-muted-foreground">מרשם סופי</h3>
            </div>
          </div>

          <div
            className={`grid ${hideEyeLabels ? "grid-cols-[repeat(8,1fr)]" : "grid-cols-[20px_repeat(8,1fr)]"} items-center gap-2`}
          >
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="flex h-4 items-center justify-center">
                {key === "cyl" ? (
                  <CylTitle onTranspose={handleManualTranspose} disabled={!isEditing} />
                ) : (
                  <span className="text-center text-xs font-medium text-muted-foreground">
                    {key === "ad" && selectedAddType
                      ? `ADD ${ADDITION_ADD_TYPE_LABELS[selectedAddType]}`
                      : label}
                  </span>
                )}
              </div>
            ))}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="cursor-pointer rounded-full px-2 text-base font-medium hover:bg-accent"
                  onMouseEnter={() => setHoveredEye("R")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("L")}
                  title="Click to copy from L eye"
                >
                  {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
                </span>
              </div>
            )}
            {columns.map((col) => (
              <div key={`r-${col.key}`}>{renderInput("R", col)}</div>
            ))}

            {!hideEyeLabels && <div className="flex h-8 items-center justify-center"></div>}
            {columns.map(({ key, step }) => {
              if (key === "pd" || key === "pd_close") {
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
                    max={
                      key === "pd_close"
                        ? PDFieldConfigProvider.getNearConfig(getFieldValue("C", "pd"))
                            .max
                        : pdCombProps.max
                    }
                    debounceMs={0}
                    className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:opacity-100 disabled:cursor-default`}
                  />
                );
              }
              return <div key={`c-spacer-${key}`} />;
            })}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="cursor-pointer rounded-full px-2 text-base font-medium hover:bg-accent"
                  onMouseEnter={() => setHoveredEye("L")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("R")}
                  title="Click to copy from R eye"
                >
                  {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
                </span>
              </div>
            )}
            {columns.map((col) => (
              <div key={`l-${col.key}`}>{renderInput("L", col)}</div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
