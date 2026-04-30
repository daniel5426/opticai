import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ContactLensDiameters } from "@/lib/db/schema-interface";
import { EXAM_FIELDS } from "./data/exam-field-definitions";

interface ContactLensDiametersTabProps {
  contactLensDiametersData: ContactLensDiameters;
  onContactLensDiametersChange: (
    field: keyof ContactLensDiameters,
    value: string,
  ) => void;
  isEditing: boolean;
  needsMiddleSpacer?: boolean;
}

import { FastInput } from "./shared/OptimizedInputs";

export function ContactLensDiametersTab({
  contactLensDiametersData,
  onContactLensDiametersChange,
  isEditing,
  needsMiddleSpacer = false,
}: ContactLensDiametersTabProps) {
  const fields = [
    { key: "pupil_diameter" as const, ...EXAM_FIELDS.PUPIL_DIAMETER },
    { key: "corneal_diameter" as const, ...EXAM_FIELDS.CORNEAL_DIAMETER },
    { key: "eyelid_aperture" as const, ...EXAM_FIELDS.EYELID_APERTURE },
  ];

  const getFieldValue = (field: keyof ContactLensDiameters) => {
    return contactLensDiametersData[field]?.toString() || "";
  };

  const handleChange = (field: keyof ContactLensDiameters, value: string) => {
    onContactLensDiametersChange(field, value);
  };

  return (
    <Card className="examcard w-full pt-3 pb-4">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-muted-foreground font-medium">Diameters</h3>
          </div>

          <div className="grid grid-cols-[2fr_auto] items-center gap-2 gap-x-4">
            {/* Header row */}
            <div className="flex h-4 items-center justify-center">
              <span className="text-muted-foreground text-xs font-medium">
                Value (mm)
              </span>
            </div>
            <div className="flex h-4 items-center justify-center"></div>

            {fields.map((field, index) => (
              <React.Fragment key={field.key}>
                <FastInput
                  type="number"
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  value={getFieldValue(field.key)}
                  onChange={(val) => handleChange(field.key, val)}
                  disabled={!isEditing}
                  className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                />
                <div className="flex items-center justify-end">
                  <span className="text-muted-foreground text-xs font-medium">
                    {field.label}
                  </span>
                </div>
                {needsMiddleSpacer && index === 0 && (
                  <>
                    <div className="h-8" />
                    <div className="h-8" />
                  </>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
