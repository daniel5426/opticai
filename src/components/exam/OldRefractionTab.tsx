import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OldRefractionExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown, AlertCircle } from "lucide-react"
import { EXAM_FIELDS, formatValueWithSign } from "./data/exam-field-definitions"
import { VASelect } from "./shared/VASelect"
import { NVJSelect } from "./shared/NVJSelect"
import { cn } from "@/utils/tailwind"

interface OldRefractionTabProps {
  oldRefractionData: OldRefractionExam;
  onOldRefractionChange: (field: keyof OldRefractionExam, value: string) => void;
  isEditing: boolean;
  onMultifocalClick: () => void;
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  hideEyeLabels?: boolean;
}

export function OldRefractionTab({
  oldRefractionData,
  onOldRefractionChange,
  isEditing,
  onMultifocalClick,
  onVHConfirm,
  hideEyeLabels = false
}: OldRefractionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const glassesTypeOptions = ["רחוק", "קרוב", "מולטיפוקל", "ביפוקל"];

  const mainColumns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "pris", ...EXAM_FIELDS.PRISM },
    { key: "base", label: "BASE", type: "select", options: ["B.IN", "B.OUT", "B.UP", "B.DOWN"] },
    { key: "va", label: "VA", type: "va" },
    { key: "ad", ...EXAM_FIELDS.ADD },
    { key: "j", label: "NV/J", type: "j" },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      if (field === "va") return oldRefractionData.comb_va?.toString() || "";
      if (field === "j") return oldRefractionData.comb_j?.toString() || "";
      return "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
    return oldRefractionData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof OldRefractionExam;
      onOldRefractionChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
      onOldRefractionChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    mainColumns.forEach(({ key }) => {
      if (key === "va" || key === "j") return;
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof OldRefractionExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof OldRefractionExam;
      const value = oldRefractionData[fromField]?.toString() || "";
      onOldRefractionChange(toField, value);
    });
  };

  const checkAxisMissing = (eye: "R" | "L") => {
    const cyl = getFieldValue(eye, "cyl");
    const ax = getFieldValue(eye, "ax");
    return cyl && cyl !== "0" && cyl !== "0.00" && !ax;
  };

  const renderField = (eye: "R" | "L" | "C", col: any) => {
    const { key, step, min, max, type, options, requireSign } = col;
    const value = getFieldValue(eye, key);

    if (type === "select") {
      return (
        <Select value={value} onValueChange={(val) => handleChange(eye, key, val)} disabled={!isEditing}>
          <SelectTrigger size="xs" className="h-8 text-xs w-full disabled:opacity-100" disabled={!isEditing}>
            <SelectValue placeholder="" />
          </SelectTrigger>
          <SelectContent>
            {options?.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    if (type === "va") {
      return <VASelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
    }

    if (type === "j") {
      return <NVJSelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
    }

    const isAxisMissing = (eye === "R" || eye === "L") && key === "ax" && checkAxisMissing(eye);

    return (
      <div className="relative">
        <Input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => handleChange(eye, key, e.target.value)}
          disabled={!isEditing}
          showPlus={requireSign}
          className={cn(
            "h-8 pr-1 text-xs disabled:opacity-100 disabled:cursor-default",
            isAxisMissing && "border-destructive ring-1 ring-destructive"
          )}
        />
        {isAxisMissing && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-[10px] px-1 rounded shadow-sm whitespace-nowrap z-10">
            חסר Axis
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Select
                value={oldRefractionData.r_glasses_type || ""}
                onValueChange={(value) => {
                  onOldRefractionChange("r_glasses_type", value);
                  onOldRefractionChange("l_glasses_type", value);
                }}
                disabled={!isEditing}
              >
                <SelectTrigger size="xs" className="h-6 text-xs w-[90px] disabled:opacity-100" disabled={!isEditing}>
                  <SelectValue placeholder="בחר סוג" />
                </SelectTrigger>
                <SelectContent>
                  {glassesTypeOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span dir="rtl" className="text-xs font-medium text-muted-foreground whitespace-nowrap">סוג:</span>
            </div>
            <h3 className="font-medium text-muted-foreground">Old Refraction</h3>
            <div className="w-[100px]"></div> {/* Spacer */}
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(8,1fr)]' : 'grid-cols-[20px_repeat(8,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {mainColumns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
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
            {mainColumns.map((col) => (
              <div key={`r-${col.key}`}>
                {renderField("R", col)}
              </div>
            ))}
            
            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {mainColumns.map(({ key }) => {
              if (key === 'cyl') {
                return (
                  <div key="c-mul-button" className="flex justify-center">
                    <Button 
                      type="button" variant="outline" size="sm" className="h-8 text-xs px-2"
                      disabled={!isEditing} onClick={onMultifocalClick}
                    >
                      MUL
                    </Button>
                  </div>
                )
              }
              if (key === 'pris') {
                return (
                  <div key="c-vh-calculator" className="flex justify-center">
                    <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
                  </div>
                )
              }
              if (key === 'va' || key === 'j') {
                return (
                  <div key={`c-${key}-input`}>
                    {renderField("C", { key, type: key === 'va' ? 'va' : 'j' })}
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
            {mainColumns.map((col) => (
              <div key={`l-${col.key}`}>
                {renderField("L", col)}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 