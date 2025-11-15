import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RetinoscopDilationExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"

interface RetinoscopDilationTabProps {
  retinoscopDilationData: RetinoscopDilationExam;
  onRetinoscopDilationChange: (field: keyof RetinoscopDilationExam, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
}

export function RetinoscopDilationTab({
  retinoscopDilationData,
  onRetinoscopDilationChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: RetinoscopDilationTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);
  
  const columns = [
    { key: "sph", label: "SPH", step: "0.25", type: "number" },
    { key: "cyl", label: "CYL", step: "0.25", type: "number" },
    { key: "ax", label: "AX", step: "1", type: "number" },
    { key: "reflex", label: "REFLEX", step: "1", type: "text" },
  ];

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof RetinoscopDilationExam;
    return retinoscopDilationData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof RetinoscopDilationExam;
    onRetinoscopDilationChange(eyeField, value);
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof RetinoscopDilationExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof RetinoscopDilationExam;
      const value = retinoscopDilationData[fromField]?.toString() || "";
      onRetinoscopDilationChange(toField, value);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4 " style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Retinoscopy with dilation</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[1fr_1fr_1fr_2fr]' : 'grid-cols-[20px_1fr_1fr_1fr_2fr]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className={`h-4 flex items-center justify-center ${key === 'reflex' ? 'col-span-1' : ''}`}>
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
            {columns.map(({ key, step, type }) => (
              <Input
                key={`r-${key}`}
                type={type}
                step={type === "number" ? step : undefined}
                value={getFieldValue("R", key)}
                onChange={(e) => handleChange("R", key, e.target.value)}
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${key === 'reflex' ? 'col-span-1' : ''}`}
              />
            ))}
            
            {needsMiddleSpacer && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {columns.map(({ key }) => (
                  <div key={`spacer-${key}`} className={`h-8 ${key === 'reflex' ? 'col-span-1' : ''}`} />
                ))}
              </>
            )}
            
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
            {columns.map(({ key, step, type }) => (
              <Input
                key={`l-${key}`}
                type={type}
                step={type === "number" ? step : undefined}
                value={getFieldValue("L", key)}
                onChange={(e) => handleChange("L", key, e.target.value)}
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${key === 'reflex' ? 'col-span-1' : ''}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 