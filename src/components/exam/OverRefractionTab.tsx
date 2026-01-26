import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { OverRefraction } from "@/lib/db/schema-interface";
import { VASelect } from "./shared/VASelect";
import { NVJSelect } from "./shared/NVJSelect";
import { ChevronUp, ChevronDown } from "lucide-react";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { FastInput, inputSyncManager, StretchSelect } from "./shared/OptimizedInputs"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { useAxisWarning } from "./shared/useAxisWarning"
import { AxisWarningInput } from "./shared/AxisWarningInput"
import { cn } from "@/utils/tailwind"

interface OverRefractionTabProps {
  data: OverRefraction;
  onChange: (field: keyof OverRefraction, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
}

export function OverRefractionTab({
  data,
  onChange,
  isEditing,
  hideEyeLabels = false,
}: OverRefractionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
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
    { key: "sph", config: EXAM_FIELDS.SPH },
    { key: "cyl", config: EXAM_FIELDS.CYL },
    { key: "ax", config: EXAM_FIELDS.AXIS },
    { key: "va", config: EXAM_FIELDS.VA, flex: 1.5 },
    { key: "j", config: EXAM_FIELDS.J },
    { key: "add", config: EXAM_FIELDS.ADD },
    { key: "florescent", config: EXAM_FIELDS.FL_TIME },
    { key: "bio_m", config: EXAM_FIELDS.BIO_M, flex: 3 },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      if (field === "va") return data["comb_va"]?.toString() || "";
      if (field === "j") return data["comb_j"]?.toString() || "";
      return "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OverRefraction;
    return data[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye !== "C" && (field === "cyl" || field === "ax")) {
      handleAxisChange(eye as "R" | "L", field as "cyl" | "ax", value);
    } else if (eye === "C") {
      if (field === "va") onChange("comb_va", value);
      if (field === "j") onChange("comb_j", value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof OverRefraction;
      onChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L", f: string) => {
        const eyeField = `${e.toLowerCase()}_${f}` as keyof OverRefraction;
        return latestData[eyeField]?.toString() || "";
      };
      const value = getLatestVal(fromEye, key);
      onChange(`${toEye.toLowerCase()}_${key}` as keyof OverRefraction, value);
    });
    // Also copy comb_va and comb_j
    if (latestData.comb_va !== undefined) onChange("comb_va", latestData.comb_va.toString());
    if (latestData.comb_j !== undefined) onChange("comb_j", latestData.comb_j.toString());
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Over Refraction</h3>
          </div>

          <div className="space-y-2">
            {/* Header Row */}
            <div className="flex gap-2 items-center">
              {!hideEyeLabels && <div className="w-[20px]"></div>}
              {columns.map(({ key, config, flex }) => (
                <div
                  key={key}
                  style={{ flex: flex || 1 }}
                  className="h-4 flex items-center justify-center min-w-0"
                >
                  {key === "cyl" ? (
                    <CylTitle onTranspose={handleManualTranspose} disabled={!isEditing} />
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {config.label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Right Eye Row */}
            <div className="flex gap-2 items-center">
              {!hideEyeLabels && (
                <div className="w-[20px] flex items-center justify-center">
                  <span
                    className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                    onMouseEnter={() => setHoveredEye("R")}
                    onMouseLeave={() => setHoveredEye(null)}
                    onClick={() => copyFromOtherEye("L")}
                    title="Click to copy from L eye"
                  >
                    {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
                  </span>
                </div>
              )}
              {columns.map(({ key, config, flex }) => (
                <div key={`r-${key}`} style={{ flex: flex || 1 }} className="min-w-0">
                  {(key === 'cyl' || key === 'ax') ? (
                    <AxisWarningInput
                      step={config.step}
                      min={config.min}
                      max={config.max}
                      eye="R"
                      field={key as "cyl" | "ax"}
                      value={getFieldValue("R", key)}
                      missingAxis={fieldWarnings.R.missingAxis}
                      missingCyl={fieldWarnings.R.missingCyl}
                      isEditing={isEditing}
                      onValueChange={handleAxisChange}
                      onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, config.min, config.max)}
                      className={isEditing ? 'bg-white' : 'bg-accent/50'}
                    />
                  ) : key === "va" ? (
                    <VASelect
                      value={getFieldValue("R", key)}
                      onChange={(val) => handleChange("R", key, val)}
                      disabled={!isEditing}
                    />
                  ) : key === "j" ? (
                    <NVJSelect
                      value={getFieldValue("R", key)}
                      onChange={(val) => handleChange("R", key, val)}
                      disabled={!isEditing}
                    />
                  ) : config.type === "select" ? (
                    <StretchSelect
                      value={getFieldValue("R", key)}
                      onChange={(val) => handleChange("R", key, val)}
                      disabled={!isEditing}
                      options={config.options || []}
                      centered={true}
                    />
                  ) : (
                    <FastInput
                      type={config.type as any}
                      step={config.step}
                      min={config.min}
                      max={config.max}
                      suffix={config.suffix}
                      value={getFieldValue("R", key)}
                      onChange={(val) => handleChange("R", key, val)}
                      disabled={!isEditing}
                      className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Combined Row */}
            <div className="flex gap-2 items-center">
              {!hideEyeLabels && <div className="w-[20px]"></div>}
              {columns.map(({ key, config, flex }) => {
                const content = (() => {
                  if (key === "va") {
                    return (
                      <VASelect
                        value={getFieldValue("C", key)}
                        onChange={(val) => handleChange("C", key, val)}
                        disabled={!isEditing}
                      />
                    );
                  } else if (key === "j") {
                    return (
                      <NVJSelect
                        value={getFieldValue("C", key)}
                        onChange={(val) => handleChange("C", key, val)}
                        disabled={!isEditing}
                      />
                    );
                  } else if (key === "bio_m") {
                    return (
                      <StretchSelect
                        value={getFieldValue("C", key)}
                        onChange={(val) => handleChange("C", key, val)}
                        disabled={!isEditing}
                        options={config.options || []}
                        centered={true}
                      />
                    );
                  }
                  return null;
                })();

                return (
                  <div key={`c-${key}`} style={{ flex: flex || 1 }} className="min-w-0 h-8">
                    {content}
                  </div>
                );
              })}
            </div>

            {/* Left Eye Row */}
            <div className="flex gap-2 items-center">
              {!hideEyeLabels && (
                <div className="w-[20px] flex items-center justify-center">
                  <span
                    className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                    onMouseEnter={() => setHoveredEye("L")}
                    onMouseLeave={() => setHoveredEye(null)}
                    onClick={() => copyFromOtherEye("R")}
                    title="Click to copy from R eye"
                  >
                    {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
                  </span>
                </div>
              )}
              {columns.map(({ key, config, flex }) => (
                <div key={`l-${key}`} style={{ flex: flex || 1 }} className="min-w-0">
                  {(key === 'cyl' || key === 'ax') ? (
                    <AxisWarningInput
                      step={config.step}
                      min={config.min}
                      max={config.max}
                      eye="L"
                      field={key as "cyl" | "ax"}
                      value={getFieldValue("L", key)}
                      missingAxis={fieldWarnings.L.missingAxis}
                      missingCyl={fieldWarnings.L.missingCyl}
                      isEditing={isEditing}
                      onValueChange={handleAxisChange}
                      onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, config.min, config.max)}
                      className={isEditing ? 'bg-white' : 'bg-accent/50'}
                    />
                  ) : key === "va" ? (
                    <VASelect
                      value={getFieldValue("L", key)}
                      onChange={(val) => handleChange("L", key, val)}
                      disabled={!isEditing}
                    />
                  ) : key === "j" ? (
                    <NVJSelect
                      value={getFieldValue("L", key)}
                      onChange={(val) => handleChange("L", key, val)}
                      disabled={!isEditing}
                    />
                  ) : config.type === "select" ? (
                    <StretchSelect
                      value={getFieldValue("L", key)}
                      onChange={(val) => handleChange("L", key, val)}
                      disabled={!isEditing}
                      options={config.options || []}
                      centered={true}
                    />
                  ) : (
                    <FastInput
                      type={config.type as any}
                      step={config.step}
                      min={config.min}
                      max={config.max}
                      value={getFieldValue("L", key)}
                      onChange={(val) => handleChange("L", key, val)}
                      disabled={!isEditing}
                      suffix={config.suffix}
                      className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
