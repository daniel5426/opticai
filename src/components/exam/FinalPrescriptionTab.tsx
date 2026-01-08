import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FinalPrescriptionExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { VASelect } from "./shared/VASelect"
import { PD_MIN } from "./data/exam-constants"

import { FastInput, FastSelect } from "./shared/OptimizedInputs"

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

  const columns = [
    { key: "sph", label: "SPH", step: "0.25", min: "-30", max: "30" },
    { key: "cyl", label: "CYL", step: "0.25", min: "-30", max: "30" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "pris", label: "PRIS", step: "0.25", min: "0", max: "50" },
    { key: "base", label: "BASE", type: "select", options: ["IN", "OUT", "UP", "DOWN"] },
    { key: "va", label: "VA", step: "0.1", type: "va" },
    { key: "ad", label: "ADD", step: "0.25", min: "0", max: "5" },
    { key: "pd", label: "PD", step: "0.5", min: PD_MIN },
    { key: "high", label: "HIGH", step: "0.5" },
    { key: "diam", label: "DIAM", step: "1" },
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
    if (eye === "C") {
      const combField = `comb_${field}` as keyof FinalPrescriptionExam;
      onFinalPrescriptionChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof FinalPrescriptionExam;
      onFinalPrescriptionChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof FinalPrescriptionExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof FinalPrescriptionExam;
      const value = finalPrescriptionData[fromField]?.toString() || "";
      onFinalPrescriptionChange(toField, value);
    });
  };

  const renderInput = (eye: "R" | "L", { key, step, min, max, type, options }: (typeof columns)[number]) => {
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
          />
        );
      default:
        return (
          <FastInput
            type="number" step={step} min={min} max={max}
            value={getFieldValue(eye, key)}
            onChange={(val) => handleChange(eye, key, val)}
            disabled={!isEditing}
            showPlus={key === "sph" || key === "cyl" || key === "ad"}
            className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(10,1fr)]' : 'grid-cols-[20px_repeat(10,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground text-center">
                  {label}
                </span>
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
            {columns.map(({ key, step }) => {
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
              if (key === 'pd' || key === 'high') {
                return (
                  <FastInput
                    key={`c-${key}`} type="number" step={step} value={getFieldValue("C", key)}
                    onChange={(val) => handleChange("C", key, val)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
