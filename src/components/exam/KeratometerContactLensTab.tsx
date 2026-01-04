import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { KeratometerContactLens } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"

interface KeratometerContactLensTabProps {
  keratometerContactLensData: KeratometerContactLens;
  onKeratometerContactLensChange: (field: keyof KeratometerContactLens, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
}

import { FastInput } from "./shared/OptimizedInputs"

export function KeratometerContactLensTab({
  keratometerContactLensData,
  onKeratometerContactLensChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: KeratometerContactLensTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const columns = [
    { key: "rh", label: "RH", step: "0.01" },
    { key: "rv", label: "RV", step: "0.01" },
    { key: "avg", label: "AVG", step: "0.01" },
    { key: "cyl", label: "CYL", step: "0.01" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "ecc", label: "ECC", step: "0.01" },
  ];

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof KeratometerContactLens;
    return keratometerContactLensData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof KeratometerContactLens;
    onKeratometerContactLensChange(eyeField, value);
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof KeratometerContactLens;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof KeratometerContactLens;
      const value = keratometerContactLensData[fromField]?.toString() || "";
      onKeratometerContactLensChange(toField, value);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Keratometer Contact Lens</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(6,1fr)]' : 'grid-cols-[20px_repeat(6,1fr)]'} gap-2 items-center`}>
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
              <FastInput
                key={`r-${key}`}
                type="number"
                step={step}
                min={min}
                max={max}
                value={getFieldValue("R", key)}
                onChange={(val) => handleChange("R", key, val)}
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            ))}

            {needsMiddleSpacer && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {columns.map(({ key }) => (
                  <div key={`spacer-${key}`} className="h-8" />
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
            {columns.map(({ key, step, min, max }) => (
              <FastInput
                key={`l-${key}`}
                type="number"
                step={step}
                min={min}
                max={max}
                value={getFieldValue("L", key)}
                onChange={(val) => handleChange("L", key, val)}
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}