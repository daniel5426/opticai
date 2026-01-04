import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ContactLensDiameters } from "@/lib/db/schema-interface"
import { EXAM_FIELDS } from "./data/exam-field-definitions"

interface ContactLensDiametersTabProps {
  contactLensDiametersData: ContactLensDiameters;
  onContactLensDiametersChange: (field: keyof ContactLensDiameters, value: string) => void;
  isEditing: boolean;
}

import { FastInput } from "./shared/OptimizedInputs"

export function ContactLensDiametersTab({
  contactLensDiametersData,
  onContactLensDiametersChange,
  isEditing
}: ContactLensDiametersTabProps) {

  const fields = [
    { key: "pupil_diameter" as const, ...EXAM_FIELDS.PUPIL_DIAMETER },
    { key: "corneal_diameter" as const, ...EXAM_FIELDS.CORNEAL_DIAMETER },
    { key: "eyelid_aperture" as const, ...EXAM_FIELDS.EYELID_APERTURE }
  ];

  const getFieldValue = (field: keyof ContactLensDiameters) => {
    return contactLensDiametersData[field]?.toString() || "";
  };

  const handleChange = (field: keyof ContactLensDiameters, value: string) => {
    onContactLensDiametersChange(field, value);
  };

  return (
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Diameters</h3>
          </div>

          <div className="grid grid-cols-[2fr_auto] gap-2 gap-x-4 items-center">
            {/* Header row */}
            <div className="h-4 flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">
                Value (mm)
              </span>
            </div>
            <div className="h-4 flex items-center justify-center">
            </div>

            {fields.map(field => (
              <React.Fragment key={field.key}>
                <FastInput
                  type="number"
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  value={getFieldValue(field.key)}
                  onChange={(val) => handleChange(field.key, val)}
                  disabled={!isEditing}
                  className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                />
                <div className="flex items-center justify-end">
                  <span className="text-xs font-medium text-muted-foreground">
                    {field.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}