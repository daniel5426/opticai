import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal"
import { OldRefractionExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"

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

  const columns = [
    { key: "sph", label: "SPH", step: "0.25" },
    { key: "cyl", label: "CYL", step: "0.25" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "pris", label: "PRIS", step: "0.5" },
    { key: "base", label: "BASE", step: "0.1" },
    { key: "va", label: "VA", step: "0.1" },
    { key: "ad", label: "ADD", step: "0.25" },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_va` as keyof OldRefractionExam;
      return oldRefractionData[combField]?.toString() || "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
    return oldRefractionData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye === "C") {
      const combField = `comb_va` as keyof OldRefractionExam;
      onOldRefractionChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
      onOldRefractionChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof OldRefractionExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof OldRefractionExam;
      const value = oldRefractionData[fromField]?.toString() || "";
      onOldRefractionChange(toField, value);
    });
  };

  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Old Refraction</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(7,1fr)]' : 'grid-cols-[20px_repeat(7,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
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
            {columns.map(({ key, step, min, max }) => (
              <div key={`r-${key}`}>
                {key === "va" ? (
                  <div className="relative">
                    <Input
                      type="number"
                      step={step}
                      value={getFieldValue("R", key)}
                      onChange={(e) => handleChange("R", key, e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={getFieldValue("R", key)}
                    onChange={(e) => handleChange("R", key, e.target.value)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}
            
            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {columns.map(({ key, step }) => {
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
              if (key === 'pris') {
                return (
                  <div key="c-vh-calculator" className="flex justify-center">
                    <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
                  </div>
                )
              }
              if (key === 'va') {
                return (
                  <div key="c-va-input" className="relative">
                    <Input
                      type="number"
                      step={step}
                      value={getFieldValue("C", "va")}
                      onChange={(e) => handleChange("C", "va", e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
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
            {columns.map(({ key, step, min, max }) => (
              <div key={`l-${key}`}>
                {key === "va" ? (
                  <div className="relative">
                    <Input
                      type="number"
                      step={step}
                      value={getFieldValue("L", key)}
                      onChange={(e) => handleChange("L", key, e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={getFieldValue("L", key)}
                    onChange={(e) => handleChange("L", key, e.target.value)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 