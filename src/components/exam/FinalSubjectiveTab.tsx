import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal"
import { FinalSubjectiveExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"

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

  const columns = [
    { key: "sph", label: "SPH", step: "0.25", min: "-30", max: "30" },
    { key: "cyl", label: "CYL", step: "0.25", min: "-30", max: "30" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "pr_h", label: "PR.H", step: "0.25", min: "0", max: "50" },
    { key: "base_h", label: "BASE.H", type: "select", options: ["IN", "OUT"] },
    { key: "pr_v", label: "PR.V", step: "0.25", min: "0", max: "50" },
    { key: "base_v", label: "BASE.V", type: "select", options: ["UP", "DOWN"] },
    { key: "va", label: "VA", step: "0.1", type: "va" },
    { key: "j", label: "J", step: "1" },
    { key: "pd_close", label: "PD CLOSE", step: "0.5" },
    { key: "pd_far", label: "PD FAR", step: "0.5" },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof FinalSubjectiveExam;
      return finalSubjectiveData[combField]?.toString() || "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof FinalSubjectiveExam;
    return finalSubjectiveData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof FinalSubjectiveExam;
      onFinalSubjectiveChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof FinalSubjectiveExam;
      onFinalSubjectiveChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof FinalSubjectiveExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof FinalSubjectiveExam;
      const value = finalSubjectiveData[fromField]?.toString() || "";
      onFinalSubjectiveChange(toField, value);
    });
  };

  const renderInput = (eye: "R" | "L", { key, step, min, max, type, options }: (typeof columns)[number]) => {
    switch (type) {
      case "va":
        return (
          <div className="relative">
            <Input
              type="number" step={step} value={getFieldValue(eye, key)}
              onChange={(e) => handleChange(eye, key, e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs pl-6 disabled:opacity-100 disabled:cursor-default`}
            />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        );
      case "select":
        return (
          <Select value={getFieldValue(eye, key)} onValueChange={(value) => handleChange(eye, key, value)} disabled={!isEditing}>
            <SelectTrigger size="xs" className={`h-8 text-xs w-full disabled:opacity-100`} disabled={!isEditing}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      default:
        return (
          <Input
            type="number" step={step} min={min} max={max}
            value={getFieldValue(eye, key)}
            onChange={(e) => handleChange(eye, key, e.target.value)}
            disabled={!isEditing}
            className={`h-8 pr-1 text-xs disabled:opacity-100 disabled:cursor-default`}
          />
        );
    }
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Final Subjective</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(11,1fr)]' : 'grid-cols-[20px_repeat(11,1fr)]'} gap-2 items-center`}>
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
              if (key === 'pr_v') {
                return (
                  <div key="c-vh-calculator" className="flex justify-center">
                    <VHCalculatorModal onConfirm={() => {}} onRawConfirm={onVHConfirm} disabled={!isEditing} />
                  </div>
                );
              }
              if (key === 'va') {
                return (
                  <div key="c-va-input" className="relative">
                    <Input
                      type="number" step={step} value={getFieldValue("C", "va")}
                      onChange={(e) => handleChange("C", "va", e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 text-xs pl-6 disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                  </div>
                );
              }
              if (key === 'pd_close' || key === 'pd_far') {
                 return (
                  <Input
                    key={`c-${key}`} type="number" step={step} value={getFieldValue("C", key)}
                    onChange={(e) => handleChange("C", key, e.target.value)}
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