import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { OverRefraction } from "@/lib/db/schema-interface";
import { VASelect } from "./shared/VASelect";
import { ChevronUp, ChevronDown } from "lucide-react";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"

interface OverRefractionTabProps {
  data: OverRefraction;
  onChange: (field: keyof OverRefraction, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
}

export function OverRefractionTab({
  data,
  onChange,
  isEditing,
  hideEyeLabels = false,
}: OverRefractionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;

  const columns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "va", ...EXAM_FIELDS.VA, type: "number" },
    { key: "j", ...EXAM_FIELDS.J, type: "number" },
    { key: "add", ...EXAM_FIELDS.ADD },
    { key: "florescent", label: "Fl. Time", type: "text", span: 2 },
    { key: "bio_m", label: "Bio. M.", type: "text", span: 2 },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      if (field === "va") return data["comb_va"]?.toString() || "";
      if (field === "j") return data["comb_j"]?.toString() || "";
      return "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OverRefraction;
    return data[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye === "C") {
      if (field === "va") onChange("comb_va", value);
      if (field === "j") onChange("comb_j", value);
      return;
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OverRefraction;
    onChange(eyeField, value);
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L", f: string) => {
        const eyeField = `${e.toLowerCase()}_${f}` as keyof OverRefraction;
        return latestData[eyeField]?.toString() || "";
      };
      const value = getLatestVal(fromEye, key);
      onChange(`${toEye.toLowerCase()}_${key}` as keyof OverRefraction, value);
    });
    // Also copy comb_va and comb_j
    if (latestData.comb_va !== undefined) onChange("comb_va", latestData.comb_va.toString());
    if (latestData.comb_j !== undefined) onChange("comb_j", latestData.comb_j.toString());
  };

  const gridCols = `${hideEyeLabels ? 'grid-cols-[repeat(10,1fr)]' : 'grid-cols-[20px_repeat(10,1fr)]'}`;

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Over Refraction</h3>
          </div>

          <div className={`grid ${gridCols} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label, span }) => (
              <div
                key={key}
                className={`${span ? `col-span-${span}` : ''
                  } h-4 flex items-center justify-center`}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                  onMouseEnter={() => setHoveredEye("R")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("L")}
                  title="Click to copy from L eye"
                >
                  {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
                </span>
              </div>
            )}
            {columns.map(({ key, type, span, ...colProps }) => (
              <div key={`r-${key}`} className={`${span ? `col-span-${span}` : ''}`}>
                {key === "va" ? (
                  <VASelect
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                  />
                ) : (
                  <FastInput
                    {...colProps}
                    type={type as any}
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}

            {!hideEyeLabels && <div className="flex items-center justify-center"></div>}
            {columns.map(({ key, type, span }) => {
              if (key === "va") {
                return (
                  <div key={`c-${key}`} className={`${span ? `col-span-${span}` : ''}`}>
                    <VASelect
                      value={getFieldValue("C", key)}
                      onChange={(val) => handleChange("C", key, val)}
                      disabled={!isEditing}
                    />
                  </div>
                );
              } else if (key === "j") {
                return (
                  <div key={`c-${key}`} className={`${span ? `col-span-${span}` : ''}`}>
                    <FastInput
                      type={type as any}
                      value={getFieldValue("C", key)}
                      onChange={(val) => handleChange("C", key, val)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                  </div>
                );
              } else {
                return <div key={`c-${key}`} className={`${span ? `col-span-${span}` : ''}`}></div>;
              }
            })}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                  onMouseEnter={() => setHoveredEye("L")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("R")}
                  title="Click to copy from R eye"
                >
                  {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
                </span>
              </div>
            )}
            {columns.map(({ key, type, span, ...colProps }) => (
              <div key={`l-${key}`} className={`${span ? `col-span-${span}` : ''}`}>
                {key === "va" ? (
                  <VASelect
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                  />
                ) : (
                  <FastInput
                    {...colProps}
                    type={type as any}
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
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
