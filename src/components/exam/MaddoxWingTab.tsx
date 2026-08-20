import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { MaddoxWingExam } from "@/lib/db/schema-interface";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { FastInput, FastSelect } from "./shared/OptimizedInputs";

interface MaddoxWingTabProps {
  maddoxWingData: MaddoxWingExam;
  onMaddoxWingChange: (field: keyof MaddoxWingExam, value: string) => void;
  isEditing: boolean;
}

export function MaddoxWingTab({
  maddoxWingData,
  onMaddoxWingChange,
  isEditing,
}: MaddoxWingTabProps) {
  const { t } = useTranslation();

  const renderHorizontalPrismInput = (field: "exo_phoria" | "eso_phoria") => (
    <FastInput
      type="number"
      step={EXAM_FIELDS.MADDOX_WING_PRISM.step}
      min={EXAM_FIELDS.MADDOX_WING_PRISM.min}
      max={EXAM_FIELDS.MADDOX_WING_PRISM.max}
      value={String(maddoxWingData[field] ?? "")}
      onChange={(value) => onMaddoxWingChange(field, value)}
      disabled={!isEditing}
      dir="ltr"
      suffix={EXAM_FIELDS.MADDOX_WING_PRISM.suffix}
      className="h-8 w-full min-w-0 text-xs disabled:cursor-default disabled:opacity-100"
    />
  );

  return (
    <Card className="examcard w-full pt-3 pb-4" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-muted-foreground font-medium">Maddox wing</h3>
          </div>
          <div className="grid grid-cols-[minmax(5.5rem,1.1fr)_minmax(3.75rem,1fr)_minmax(3.75rem,1fr)] items-center gap-2">
            <div className="h-4" />
            <div className="h-4" />
            <div className="h-4" />

            <div className="text-muted-foreground flex h-8 items-center text-sm font-medium">
              {t("maddoxWingExoPhoria")}
            </div>
            {renderHorizontalPrismInput("exo_phoria")}
            <div
              aria-hidden
              className="text-muted-foreground row-span-2 flex h-full w-full min-w-0 items-center justify-center self-stretch text-lg leading-none font-semibold"
            >
              {t("maddoxWingNearVision")}
            </div>

            <div className="text-muted-foreground flex h-8 items-center text-sm font-medium">
              {t("maddoxWingEsoPhoria")}
            </div>
            {renderHorizontalPrismInput("eso_phoria")}

            <div className="text-muted-foreground flex h-8 items-center text-sm font-medium">
              {t("maddoxWingHyperPhoria")}
            </div>
            <FastSelect
              value={String(maddoxWingData.hyper_eye ?? "")}
              onChange={(value) => onMaddoxWingChange("hyper_eye", value)}
              disabled={!isEditing}
              options={EXAM_FIELDS.MADDOX_WING_HYPER_EYE.options || []}
              allowImportedValue
              size="xs"
              center
              triggerClassName={`h-8 w-full min-w-0 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
            />
            <FastInput
              type="number"
              step={EXAM_FIELDS.MADDOX_WING_PRISM.step}
              min={EXAM_FIELDS.MADDOX_WING_PRISM.min}
              max={EXAM_FIELDS.MADDOX_WING_PRISM.max}
              value={String(maddoxWingData.hyper_phoria ?? "")}
              onChange={(value) => onMaddoxWingChange("hyper_phoria", value)}
              disabled={!isEditing}
              dir="ltr"
              suffix={EXAM_FIELDS.MADDOX_WING_PRISM.suffix}
              className="h-8 w-full min-w-0 text-xs disabled:cursor-default disabled:opacity-100"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
