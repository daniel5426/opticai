import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { RetinoscopDilationExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EXAM_FIELDS } from "./data/exam-field-definitions"
import { PDCalculationUtils } from "./data/exam-constants"
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"

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

  const dataRef = useRef(retinoscopDilationData);
  dataRef.current = retinoscopDilationData;

  const columns = [
    { key: "sph", ...EXAM_FIELDS.SPH, type: "number" },
    { key: "cyl", ...EXAM_FIELDS.CYL, type: "number" },
    { key: "ax", ...EXAM_FIELDS.AXIS, label: "AX", type: "number" },
    { key: "reflex", label: "REFLEX", step: "1", type: "text" },
    { key: "pd_far", ...EXAM_FIELDS.PD_FAR, type: "number" },
    { key: "pd_close", ...EXAM_FIELDS.PD_NEAR, label: "PD CLOSE", type: "number" },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof RetinoscopDilationExam;
      return retinoscopDilationData[combField]?.toString() || "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof RetinoscopDilationExam;
    return retinoscopDilationData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (field === "pd_far" || field === "pd_close") {
      PDCalculationUtils.handlePDChange({
        eye,
        field,
        value,
        data: retinoscopDilationData,
        onChange: onRetinoscopDilationChange,
        getRValue: (data, f) => parseFloat(data[`r_${f}` as keyof RetinoscopDilationExam]?.toString() || "0") || 0,
        getLValue: (data, f) => parseFloat(data[`l_${f}` as keyof RetinoscopDilationExam]?.toString() || "0") || 0
      });
      return;
    }

    if (eye === "C") {
      const combField = `comb_${field}` as keyof RetinoscopDilationExam;
      onRetinoscopDilationChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof RetinoscopDilationExam;
      onRetinoscopDilationChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L" | "C", f: string) => {
        if (e === "C") {
          const combField = `comb_${f}` as keyof RetinoscopDilationExam;
          return latestData[combField]?.toString() || "";
        }
        const eyeField = `${e.toLowerCase()}_${f}` as keyof RetinoscopDilationExam;
        return latestData[eyeField]?.toString() || "";
      };

      const value = getLatestVal(fromEye, key);
      handleChange(toEye, key, value);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4 " style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="flex justify-center mb-1">
            <Tabs
              value={retinoscopDilationData.method || "retinoscopy"}
              onValueChange={(val) => onRetinoscopDilationChange("method", val)}
              className="w-fit"
            >
              <TabsList className="h-8 p-1 bg-muted/50 border">
                <TabsTrigger
                  value="retinoscopy"
                  disabled={!isEditing}
                  className="h-6 text-[11px] px-4 whitespace-nowrap data-[state=active]:bg-background"
                >
                  Retinoscopy + Dil
                </TabsTrigger>
                <TabsTrigger
                  value="auto_refractor"
                  disabled={!isEditing}
                  className="h-6 text-[11px] px-4 whitespace-nowrap data-[state=active]:bg-background"
                >
                  Auto Refractor
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[1fr_1fr_1fr_2fr_1fr_1fr]' : 'grid-cols-[20px_1fr_1fr_1fr_2fr_1fr_1fr]'} gap-2 items-center`}>
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
            {columns.map(({ key, step, type, ...colProps }) => (
              <FastInput
                {...colProps}
                key={`r-${key}`}
                type={type as any}
                step={type === "number" ? step : undefined}
                value={getFieldValue("R", key)}
                onChange={(val) => handleChange("R", key, val)}
                disabled={!isEditing}
                debounceMs={key === "pd_far" || key === "pd_close" ? 0 : undefined}
                className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${key === 'reflex' ? 'col-span-1' : ''}`}
              />
            ))}

            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {columns.map(({ key, step, type, ...colProps }) => {
              if (key === "pd_far" || key === "pd_close") {
                const pdCombProps = EXAM_FIELDS.PD_COMB;
                return (
                  <FastInput
                    {...pdCombProps}
                    key={`c-${key}`}
                    type={type as any}
                    step={step}
                    value={getFieldValue("C", key)}
                    onChange={(val) => handleChange("C", key, val)}
                    disabled={!isEditing}
                    debounceMs={0}
                    className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                );
              } else {
                return <div key={`c-${key}`} className={`h-8 ${key === 'reflex' ? 'col-span-1' : ''}`} />;
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
            {columns.map(({ key, step, type, ...colProps }) => (
              <FastInput
                {...colProps}
                key={`l-${key}`}
                type={type as any}
                step={type === "number" ? step : undefined}
                value={getFieldValue("L", key)}
                onChange={(val) => handleChange("L", key, val)}
                disabled={!isEditing}
                debounceMs={key === "pd_far" || key === "pd_close" ? 0 : undefined}
                className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${key === 'reflex' ? 'col-span-1' : ''}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
