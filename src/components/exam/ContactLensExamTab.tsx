import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ContactLensExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { EXAM_FIELDS } from "./data/exam-field-definitions"
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { useAxisWarning } from "./shared/useAxisWarning"
import { AxisWarningInput } from "./shared/AxisWarningInput"
import { ToggleTextNumberInput } from "./shared/ToggleTextNumberInput"

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

  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
    contactLensExamData,
    onContactLensExamChange,
    isEditing
  );

  const dataRef = useRef(contactLensExamData);
  dataRef.current = contactLensExamData;

  const { handleManualTranspose } = usePrescriptionLogic(
    contactLensExamData,
    onContactLensExamChange,
    isEditing
  );

  const columns = [
    { key: "bc", ...EXAM_FIELDS.CONTACT_LENS_BC },
    { key: "oz", ...EXAM_FIELDS.CONTACT_LENS_OZ },
    { key: "diam", ...EXAM_FIELDS.CONTACT_LENS_DIAM },
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "read_ad", ...EXAM_FIELDS.READ_AD }
  ];

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof ContactLensExam;
    return contactLensExamData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    if (field === "cyl" || field === "ax") {
      handleAxisChange(eye as "R" | "L", field as "cyl" | "ax", value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof ContactLensExam;
      onContactLensExamChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L", f: string) => {
        const eyeField = `${e.toLowerCase()}_${f}` as keyof ContactLensExam;
        return latestData[eyeField]?.toString() || "";
      };
      const value = getLatestVal(fromEye, key);
      onContactLensExamChange(`${toEye.toLowerCase()}_${key}` as keyof ContactLensExam, value);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">מרשם עדשות מגע</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(7,1fr)]' : 'grid-cols-[20px_repeat(7,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                {key === "cyl" ? (
                  <CylTitle onTranspose={handleManualTranspose} disabled={!isEditing} />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {label}
                  </span>
                )}
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
            {columns.map(({ key, step, min, max, ...colProps }) => (
              <div key={`r-${key}`}>
                {(key === 'cyl' || key === 'ax') ? (
                  <AxisWarningInput
                    {...colProps}
                    step={step}
                    min={min}
                    max={max}
                    eye="R"
                    field={key as "cyl" | "ax"}
                    value={getFieldValue("R", key)}
                    missingAxis={fieldWarnings.R.missingAxis}
                    missingCyl={fieldWarnings.R.missingCyl}
                    isEditing={isEditing}
                    onValueChange={handleAxisChange}
                    onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, min, max)}
                    className={isEditing ? 'bg-white' : 'bg-accent/50'}
                  />
                ) : key === "sph" ? (
                  <ToggleTextNumberInput
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                    textOptions={colProps.textOptions}
                    textValueAliases={colProps.textValueAliases}
                    numericProps={{
                      step,
                      min,
                      max,
                      showPlus: colProps.showPlus,
                      suffix: colProps.suffix,
                      className: `h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`
                    }}
                  />
                ) : key === "bc" ? (
                  <ToggleTextNumberInput
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                    textOptions={colProps.textOptions}
                    textValueAliases={colProps.textValueAliases}
                    numericProps={{
                      step,
                      min,
                      max,
                      showPlus: colProps.showPlus,
                      suffix: colProps.suffix,
                      className: `h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`
                    }}
                  />
                ) : (
                  <FastInput
                    {...colProps}
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                    suffix={colProps.suffix}
                    className={`h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}

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
            {columns.map(({ key, step, min, max, ...colProps }) => (
              <div key={`l-${key}`}>
                {(key === 'cyl' || key === 'ax') ? (
                  <AxisWarningInput
                    {...colProps}
                    step={step}
                    min={min}
                    max={max}
                    eye="L"
                    field={key as "cyl" | "ax"}
                    value={getFieldValue("L", key)}
                    missingAxis={fieldWarnings.L.missingAxis}
                    missingCyl={fieldWarnings.L.missingCyl}
                    isEditing={isEditing}
                    onValueChange={handleAxisChange}
                    onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, min, max)}
                    className={isEditing ? 'bg-white' : 'bg-accent/50'}
                  />
                ) : key === "sph" ? (
                  <ToggleTextNumberInput
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                    textOptions={colProps.textOptions}
                    textValueAliases={colProps.textValueAliases}
                    numericProps={{
                      step,
                      min,
                      max,
                      showPlus: colProps.showPlus,
                      suffix: colProps.suffix,
                      className: `h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`
                    }}
                  />
                ) : key === "bc" ? (
                  <ToggleTextNumberInput
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                    textOptions={colProps.textOptions}
                    textValueAliases={colProps.textValueAliases}
                    numericProps={{
                      step,
                      min,
                      max,
                      showPlus: colProps.showPlus,
                      suffix: colProps.suffix,
                      className: `h-8 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`
                    }}
                  />
                ) : (
                  <FastInput
                    {...colProps}
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                    suffix={colProps.suffix}
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
}
