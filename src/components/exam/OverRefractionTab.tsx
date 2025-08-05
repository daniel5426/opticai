import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OverRefraction } from "@/lib/db/schema-interface";
import { ChevronUp, ChevronDown } from "lucide-react";

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

  const columns = [
    { key: "sph", label: "SPH", step: "0.25", type: "number" },
    { key: "cyl", label: "CYL", step: "0.25", type: "number" },
    { key: "ax", label: "AXIS", step: "1", type: "number", min: "0", max: "180" },
    { key: "va", label: "VA", step: "0.1", type: "number" },
    { key: "j", label: "J", step: "0.1", type: "number" },
    { key: "add", label: "ADD", step: "0.25", type: "number" },
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
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof OverRefraction;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof OverRefraction;
      const value = data[fromField]?.toString() || "";
      onChange(toField, value);
    });
    // Also copy comb_va and comb_j
    if (data.comb_va !== undefined) onChange("comb_va", data.comb_va.toString());
    if (data.comb_j !== undefined) onChange("comb_j", data.comb_j.toString());
  };

  const gridCols = `${hideEyeLabels ? 'grid-cols-[repeat(10,1fr)]' : 'grid-cols-[20px_repeat(10,1fr)]'}`;

  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3">
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
                className={`${
                  span ? `col-span-${span}` : ''
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
            {columns.map(({ key, step, type, min, max, span }) => (
              <div key={`r-${key}`} className={`${span ? `col-span-${span}` : ''}`}>
                {key === "va" ? (
                  <div className="relative">
                    <Input
                      type={type}
                      step={step}
                      value={getFieldValue("R", key)}
                      onChange={(e) => handleChange("R", key, e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">
                      6/
                    </span>
                  </div>
                ) : (
                  <Input
                    type={type}
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

            {!hideEyeLabels && <div className="flex items-center justify-center"></div>}
            {columns.map(({ key, step, type, span }) => {
              if (key === "va") {
                return (
                  <div key={`c-${key}`} className={`${span ? `col-span-${span}` : ''}`}>
                    <div className="relative">
                      <Input
                        type={type}
                        step={step}
                        value={getFieldValue("C", key)}
                        onChange={(e) => handleChange("C", key, e.target.value)}
                        disabled={!isEditing}
                        className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                      />
                      <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">
                        6/
                      </span>
                    </div>
                  </div>
                );
              } else if (key === "j") {
                return (
                  <div key={`c-${key}`} className={`${span ? `col-span-${span}` : ''}`}>
                  <Input
                    type={type}
                    step={step}
                    value={getFieldValue("C", key)}
                    onChange={(e) => handleChange("C", key, e.target.value)}
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
            {columns.map(({ key, step, type, min, max, span }) => (
              <div key={`l-${key}`} className={`${span ? `col-span-${span}` : ''}`}>
                {key === "va" ? (
                  <div className="relative">
                    <Input
                      type={type}
                      step={step}
                      value={getFieldValue("L", key)}
                      onChange={(e) => handleChange("L", key, e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">
                      6/
                    </span>
                  </div>
                ) : (
                  <Input
                    type={type}
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