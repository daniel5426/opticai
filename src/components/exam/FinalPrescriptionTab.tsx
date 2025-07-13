import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FinalPrescriptionExam } from "@/lib/db/schema"
import { ChevronUp, ChevronDown } from "lucide-react"

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
    { key: "sph", label: "SPH", step: "0.25" },
    { key: "cyl", label: "CYL", step: "0.25" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "pris", label: "PRIS", step: "0.5" },
    { key: "base", label: "BASE", type: "select", options: ["IN", "OUT", "UP", "DOWN"] },
    { key: "va", label: "VA", step: "0.1", type: "va" },
    { key: "ad", label: "ADD", step: "0.25" },
    { key: "pd", label: "PD", step: "0.5" },
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
        return (
          <div className="relative">
            <Input
              type="number" step={step} value={getFieldValue(eye, key)}
              onChange={(e) => handleChange(eye, key, e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
            />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        );
      case "select":
        return (
          <Select value={getFieldValue(eye, key)} onValueChange={(value) => handleChange(eye, key, value)} disabled={!isEditing}>
            <SelectTrigger size="xs" className={`h-8 text-xs w-full `} disabled={!isEditing}>
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
            className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
          />
        );
    }
  };

  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3" dir="ltr">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
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
                  <div key="c-va-input" className="relative">
                    <Input
                      type="number" step={step} value={getFieldValue("C", "va")}
                      onChange={(e) => handleChange("C", "va", e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                  </div>
                );
              }
              if (key === 'pd' || key === 'high') {
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