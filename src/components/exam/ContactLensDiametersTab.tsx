import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { ContactLensDiameters } from "@/lib/db/schema-interface";
import { EXAM_FIELDS } from "./data/exam-field-definitions";

interface ContactLensDiametersTabProps {
  contactLensDiametersData: ContactLensDiameters;
  onContactLensDiametersChange: (
    field: keyof ContactLensDiameters,
    value: string,
  ) => void;
  isEditing: boolean;
}

import { FastInput } from "./shared/OptimizedInputs";

export function ContactLensDiametersTab({
  contactLensDiametersData,
  onContactLensDiametersChange,
  isEditing,
}: ContactLensDiametersTabProps) {
  const { t } = useTranslation();
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
            <h3 className="text-muted-foreground font-medium">{t("contactLensDiameters.title")}</h3>
          </div>

          <div className="grid grid-cols-[minmax(4.25rem,1fr)_auto] items-center gap-2">
            {fields.map((field) => (
              <React.Fragment key={field.key}>
                <FastInput
                  type="number"
                  aria-label={t(`contactLensDiameters.${field.key}.full`)}
                  suffix={field.unit}
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  value={getFieldValue(field.key)}
                  onChange={(val) => handleChange(field.key, val)}
                  disabled={!isEditing}
                  className="h-8 text-xs disabled:cursor-default disabled:opacity-100"
                />
                <div className="flex items-center justify-end">
                  <span className="text-muted-foreground whitespace-nowrap text-xs font-medium" title={t(`contactLensDiameters.${field.key}.full`)}>
                    {t(`contactLensDiameters.${field.key}.short`)}
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
