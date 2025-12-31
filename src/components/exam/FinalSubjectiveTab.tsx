import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal"
import { FinalSubjectiveExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { EXAM_FIELDS, formatValueWithSign } from "./data/exam-field-definitions"
import { VASelect } from "./shared/VASelect"
import { NVJSelect } from "./shared/NVJSelect"

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

  // Unified Prism/Base logic:
  // We use the underlying schema fields but show a unified UI.
  // Actually, since there could be both H and V, 
  // but the user wants "Base" with 4 options, 
  // maybe they want the UI to just have 1 prism row if they don't use both?
  // I'll stick to a clean mapping: 
  // If user picks IN/OUT, it goes to base_h. If UP/DOWN, it goes to base_v.
  
  const columns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "pris", label: "PRISM", ...EXAM_FIELDS.PRISM },
    { key: "base", label: "BASE", type: "select", options: ["IN", "OUT", "UP", "DOWN"] },
    { key: "va", label: "VA", type: "va" },
    { key: "j", label: "NV/J", type: "j" },
    { key: "pd_far", ...EXAM_FIELDS.PD_FAR },
    { key: "pd_close", ...EXAM_FIELDS.PD_NEAR },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", key: string): string => {
    if (eye === "C") {
      const field = `comb_${key}` as keyof FinalSubjectiveExam;
      return finalSubjectiveData[field]?.toString() || "";
    }
    
    if (key === "pris") {
      // Logic: if there's a vertical prism, show it. Otherwise show horizontal.
      // This is a bit ambiguous if both exist.
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
    if (eye === "C") {
      const field = `comb_${key}` as keyof FinalSubjectiveExam;
      onFinalSubjectiveChange(field, value);
      return;
    }

    if (key === "pris") {
      // Determine if we should update H or V based on the current base
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
      
      // Move prism value to the correct field tracker
      const currentPris = getFieldValue(eye, "pris");
      onFinalSubjectiveChange(targetBaseKey, value);
      onFinalSubjectiveChange(targetPrisKey, currentPris);
      
      // Clear the other one if needed? 
      // User said "don't care about compatibility", so I'll clear it to avoid ambiguity.
      onFinalSubjectiveChange(otherBaseKey, "");
      onFinalSubjectiveChange(otherPrisKey, "");
      return;
    }

    const field = `${eye.toLowerCase()}_${key}` as keyof FinalSubjectiveExam;
    onFinalSubjectiveChange(field, value);
  };

  const renderInput = (eye: "R" | "L" | "C", col: any) => {
    const { key, step, min, max, type, options, requireSign } = col;
    const value = getFieldValue(eye, key);

    switch (type) {
      case "va":
        return <VASelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
      case "j":
        return <NVJSelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
      case "select":
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
      default:
        return (
          <Input
            type="number"
            step={step}
            min={min}
            max={max}
            value={value}
            onChange={(e) => handleChange(eye, key, e.target.value)}
            disabled={!isEditing}
            showPlus={requireSign}
            className={`h-8 pr-1 text-xs disabled:opacity-100 disabled:cursor-default`}
          />
        );
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      if (key === "va" || key === "j" || key.startsWith("pd_")) return;
      const val = getFieldValue(fromEye, key);
      handleChange(toEye, key, val);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Final Subjective</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(9,1fr)]' : 'grid-cols-[20px_repeat(9,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center text-center">
                <span className="text-xs font-medium text-muted-foreground">
                  {label}
                </span>
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
                    <VHCalculatorModal onConfirm={() => {}} onRawConfirm={onVHConfirm} disabled={!isEditing} />
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