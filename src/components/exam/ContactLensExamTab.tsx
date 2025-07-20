import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ContactLensExam } from "@/lib/db/schema"
import { ChevronUp, ChevronDown } from "lucide-react"

interface ContactLensExamTabProps {
  contactLensExamData: ContactLensExam;
  onContactLensExamChange: (field: keyof ContactLensExam, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
}

export function ContactLensExamTab({
  contactLensExamData,
  onContactLensExamChange,
  isEditing,
  hideEyeLabels = false
}: ContactLensExamTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);
  
  const columns = [
    { key: "bc", label: "BC", step: "0.01" },
    { key: "oz", label: "OZ", step: "0.1" },
    { key: "diam", label: "DIAM", step: "0.1" },
    { key: "sph", label: "SPH", step: "0.25" },
    { key: "cyl", label: "CYL", step: "0.25" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "read_ad", label: "READ AD", step: "0.25" },
    { key: "va", label: "VA", step: "0.1" },
    { key: "j", label: "J", step: "1" }
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof ContactLensExam;
      return contactLensExamData[combField]?.toString() || "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof ContactLensExam;
    return contactLensExamData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof ContactLensExam;
      onContactLensExamChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof ContactLensExam;
      onContactLensExamChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof ContactLensExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof ContactLensExam;
      const value = contactLensExamData[fromField]?.toString() || "";
      onContactLensExamChange(toField, value);
    });
  };

  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Contact Lens Exam</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(9,1fr)]' : 'grid-cols-[20px_repeat(9,1fr)]'} gap-2 items-center`}>
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
              if (key === "va") {
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