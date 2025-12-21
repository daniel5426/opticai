import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal"
import { OpticalExam, SubjectiveExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { toast } from "sonner"

interface SubjectiveTabProps {
  subjectiveData: SubjectiveExam;
  onSubjectiveChange: (field: keyof SubjectiveExam, value: string) => void;
  isEditing: boolean;
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  onMultifocalClick: () => void;
  hideEyeLabels?: boolean;
}

export function SubjectiveTab({
  subjectiveData,
  onSubjectiveChange,
  isEditing,
  onVHConfirm,
  onMultifocalClick,
  hideEyeLabels = false
}: SubjectiveTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);
  
  const columns = [
    { key: "sph", label: "SPH", step: "0.25", min: "-30", max: "30" },
    { key: "cyl", label: "CYL", step: "0.25", min: "-30", max: "30" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "pris", label: "PRIS", step: "0.25", min: "0", max: "50" },
    { key: "base", label: "BASE", type: "select", options: ["B.IN", "B.OUT", "B.UP", "B.DOWN"] },
    { key: "va", label: "VA", step: "0.1" },
    { key: "pd_close", label: "PD CLOSE", step: "0.5" },
    { key: "pd_far", label: "PD FAR", step: "0.5" }
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof SubjectiveExam;
      return subjectiveData[combField]?.toString() || "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof SubjectiveExam;
    return subjectiveData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof SubjectiveExam;
      onSubjectiveChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof SubjectiveExam;
      onSubjectiveChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof SubjectiveExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof SubjectiveExam;
      const value = subjectiveData[fromField]?.toString() || "";
      onSubjectiveChange(toField, value);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Subjective</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(8,1fr)]' : 'grid-cols-[20px_repeat(8,1fr)]'} gap-2 items-center`}>
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
            {columns.map(({ key, step, min, max, type, options }) => (
              <div key={`r-${key}`}>
                {key === "base" ? (
                  <Select value={getFieldValue("R", key)} onValueChange={(value) => handleChange("R", key, value)} disabled={!isEditing}>
                    <SelectTrigger size="xs" className="h-8 text-xs w-full" disabled={!isEditing}>
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : key === "va" ? (
                  <div className="relative">
                    <Input
                      type="number"
                      step={step}
                      value={getFieldValue("R", key)}
                      onChange={(e) => handleChange("R", key, e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}
            
            {!hideEyeLabels && <div className="flex items-center justify-center">
            </div>}
            {columns.map(({ key, step }) => {
              if (key === "cyl") {
                return (
                  <div key={`c-${key}`} className="flex justify-center">
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className={`h-8 text-xs px-2 ${!isEditing ? 'bg-accent/50' : 'bg-white'}`}
                      disabled={!isEditing}
                      onClick={onMultifocalClick}
                    >
                      MUL
                    </Button>
                  </div>
                );
              } else if (key === "pris") {
                return (
                  <div key={`c-${key}`} className="flex justify-center">
                    <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
                  </div>
                );
              } else if (key === "va") {
                return (
                  <div key={`c-${key}`} className="relative">
                    <Input
                      type="number"
                      step={step}
                      value={getFieldValue("C", key)}
                      onChange={(e) => handleChange("C", key, e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                  </div>
                );
              } else if (key === "pd_close" || key === "pd_far") {
                return (
                  <Input
                    key={`c-${key}`}
                    type="number"
                    step={step}
                    value={getFieldValue("C", key)}
                    onChange={(e) => handleChange("C", key, e.target.value)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                );
              } else {
                return <div key={`c-${key}`}></div>;
              }
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
            {columns.map(({ key, step, min, max, type, options }) => (
              <div key={`l-${key}`}>
                {key === "base" ? (
                  <Select value={getFieldValue("L", key)} onValueChange={(value) => handleChange("L", key, value)} disabled={!isEditing}>
                    <SelectTrigger size="xs" className="h-8 text-xs w-full" disabled={!isEditing}>
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : key === "va" ? (
                  <div className="relative">
                    <Input
                      type="number"
                      step={step}
                      value={getFieldValue("L", key)}
                      onChange={(e) => handleChange("L", key, e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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