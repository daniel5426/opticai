import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal"
import { SubjectiveExam } from "@/lib/db/schema-interface"
import { VASelect } from "./shared/VASelect"
import { ChevronUp, ChevronDown } from "lucide-react"

import { FastInput, FastSelect } from "./shared/OptimizedInputs"
import { PD_MIN } from "./data/exam-constants"

interface SubjectiveTabProps {
  subjectiveData: SubjectiveExam;
  onSubjectiveChange: (field: keyof SubjectiveExam, value: string) => void;
  isEditing: boolean;
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  onMultifocalClick: () => void;
  hideEyeLabels?: boolean;
}

export const SubjectiveTab = React.memo(function SubjectiveTab({
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
    { key: "pd_far", label: "PD FAR", step: "0.5", min: "15" },
    { key: "pd_close", label: "PD CLOSE", step: "0.5", min: "15" }
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
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
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
            {columns.map(({ key, step, min, max, options }) => (
              <div key={`r-${key}`}>
                {key === "base" ? (
                  <FastSelect
                    value={getFieldValue("R", key)}
                    onChange={(value) => handleChange("R", key, value)}
                    disabled={!isEditing}
                    options={options || []}
                    size="xs"
                    triggerClassName="h-8 text-xs w-full"
                  />
                ) : key === "va" ? (
                  <VASelect
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                  />
                ) : (
                  <FastInput
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                    showPlus={true}
                    suffix={key === "pd_far" || key === "pd_close" ? "mm" : undefined}
                    className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}

            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {columns.map(({ key, step, min }) => {
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
                  <div key={`c-${key}`}>
                    <VASelect
                      value={getFieldValue("C", key)}
                      onChange={(val) => handleChange("C", key, val)}
                      disabled={!isEditing}
                    />
                  </div>
                );
              } else if (key === "pd_close" || key === "pd_far") {
                return (
                  <FastInput
                    key={`c-${key}`}
                    type="number"
                    step={step}
                    min={min}
                    value={getFieldValue("C", key)}
                    onChange={(val) => handleChange("C", key, val)}
                    disabled={!isEditing}
                    suffix="mm"
                    className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
            {columns.map(({ key, step, min, max, options }) => (
              <div key={`l-${key}`}>
                {key === "base" ? (
                  <FastSelect
                    value={getFieldValue("L", key)}
                    onChange={(value) => handleChange("L", key, value)}
                    disabled={!isEditing}
                    options={options || []}
                    size="xs"
                    triggerClassName="h-8 text-xs w-full"
                  />
                ) : key === "va" ? (
                  <VASelect
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                  />
                ) : (
                  <FastInput
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                    showPlus={key === "sph" || key === "cyl"}
                    suffix={key === "pd_far" || key === "pd_close" ? "mm" : undefined}
                    className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});