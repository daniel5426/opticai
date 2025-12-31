import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OldRefractionExtensionExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"

import { VASelect } from "./shared/VASelect"

interface OldRefractionExtensionTabProps {
  oldRefractionExtensionData: OldRefractionExtensionExam;
  onOldRefractionExtensionChange: (field: keyof OldRefractionExtensionExam, value: string) => void;
  isEditing: boolean;
  onMultifocalClick: () => void;
  hideEyeLabels?: boolean;
}

export function OldRefractionExtensionTab({
  oldRefractionExtensionData,
  onOldRefractionExtensionChange,
  isEditing,
  onMultifocalClick,
  hideEyeLabels = false
}: OldRefractionExtensionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const columns = [
    { key: "sph", label: "SPH", step: "0.25" },
    { key: "cyl", label: "CYL", step: "0.25" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "pr_h", label: "PR.H", step: "0.5" },
    { key: "base_h", label: "BASE.H", isSelect: true },
    { key: "pr_v", label: "PR.V", step: "0.5" },
    { key: "base_v", label: "BASE.V", isSelect: true },
    { key: "va", label: "VA", step: "0.1" },
    { key: "ad", label: "ADD", step: "0.25" },
    { key: "j", label: "J", step: "1", min: "1", max: "30" },
    { key: "pd_far", label: "PD.FAR", step: "0.5" },
    { key: "pd_close", label: "PD.CLOSE", step: "0.5" },
  ];

  const baseOptions = ["IN", "OUT", "UP", "DOWN"];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      if (field === "va") return oldRefractionExtensionData.comb_va?.toString() || "";
      if (field === "pd_far") return oldRefractionExtensionData.comb_pd_far?.toString() || "";
      if (field === "pd_close") return oldRefractionExtensionData.comb_pd_close?.toString() || "";
      return "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExtensionExam;
    return oldRefractionExtensionData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye === "C") {
      if (field === "va") onOldRefractionExtensionChange("comb_va", value);
      if (field === "pd_far") onOldRefractionExtensionChange("comb_pd_far", value);
      if (field === "pd_close") onOldRefractionExtensionChange("comb_pd_close", value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExtensionExam;
      onOldRefractionExtensionChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      if (key === "va" || key === "pd_far" || key === "pd_close") return;
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof OldRefractionExtensionExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof OldRefractionExtensionExam;
      const value = oldRefractionExtensionData[fromField]?.toString() || "";
      onOldRefractionExtensionChange(toField, value);
    });
  };

  const renderField = (eye: "R" | "L" | "C", column: any) => {
    const { key, step, min, max, isSelect } = column;
    const value = getFieldValue(eye, key);

    if (isSelect && (key === "base_h" || key === "base_v")) {
      return (
        <Select 
          value={value} 
          onValueChange={(newValue) => handleChange(eye, key, newValue)}
          disabled={!isEditing}
        >
          <SelectTrigger size="xs" className={`h-8 text-xs w-full min-w-[60px]`} disabled={!isEditing}>
            <SelectValue placeholder="" />
          </SelectTrigger>
          <SelectContent>
            {baseOptions.map(option => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (key === "va") {
      return <VASelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
    }

    return (
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => handleChange(eye, key, e.target.value)}
        disabled={!isEditing}
        showPlus={key === "sph" || key === "cyl" || key === "ad"}
        className={`h-8 pr-1 text-xs disabled:opacity-100 disabled:cursor-default`}
      />
    );
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Old Refraction E</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(12,1fr)]' : 'grid-cols-[20px_repeat(12,1fr)]'} gap-2 items-center`}>
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
            {columns.map((column) => (
              <div key={`r-${column.key}`}>
                {renderField("R", column)}
              </div>
            ))}
            
            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {columns.map((column) => {
              const { key } = column;
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
              if (key === 'va' || key === 'pd_far' || key === 'pd_close') {
                return (
                  <div key={`c-${key}-input`}>
                    {renderField("C", column)}
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
            {columns.map((column) => (
              <div key={`l-${column.key}`}>
                {renderField("L", column)}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 