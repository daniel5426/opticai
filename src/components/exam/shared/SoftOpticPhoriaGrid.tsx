import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { EXAM_FIELDS } from "@/components/exam/data/exam-field-definitions";
import { FastInput, FastSelect } from "@/components/exam/shared/OptimizedInputs";

export type SoftOpticPhoriaGridValues = Record<string, string | number | undefined>;

interface SoftOpticPhoriaDistanceFields {
  prism: string;
  eye?: string;
}

interface SoftOpticPhoriaRow {
  labelKey: string;
  far: SoftOpticPhoriaDistanceFields;
  near: SoftOpticPhoriaDistanceFields;
}

interface SoftOpticPhoriaGridProps {
  title: string;
  data: SoftOpticPhoriaGridValues;
  rows: SoftOpticPhoriaRow[];
  isEditing: boolean;
  onChange: (field: string, value: string) => void;
}

export class SoftOpticPhoriaGridLayout {
  static coverTestRows(): SoftOpticPhoriaRow[] {
    return [
      {
        labelKey: "maddoxWingExoPhoria",
        far: { prism: "fv_exo_phoria" },
        near: { prism: "nv_exo_phoria" },
      },
      {
        labelKey: "maddoxWingEsoPhoria",
        far: { prism: "fv_eso_phoria" },
        near: { prism: "nv_eso_phoria" },
      },
      {
        labelKey: "softopticExoTropia",
        far: { eye: "fv_exo_tropia_eye", prism: "fv_exo_tropia" },
        near: { eye: "nv_exo_tropia_eye", prism: "nv_exo_tropia" },
      },
      {
        labelKey: "softopticEsoTropia",
        far: { eye: "fv_eso_tropia_eye", prism: "fv_eso_tropia" },
        near: { eye: "nv_eso_tropia_eye", prism: "nv_eso_tropia" },
      },
      {
        labelKey: "maddoxWingHyperPhoria",
        far: { eye: "fv_hyper_phoria_eye", prism: "fv_hyper_phoria" },
        near: { eye: "nv_hyper_phoria_eye", prism: "nv_hyper_phoria" },
      },
      {
        labelKey: "softopticHyperTropia",
        far: { eye: "fv_hyper_tropia_eye", prism: "fv_hyper_tropia" },
        near: { eye: "nv_hyper_tropia_eye", prism: "nv_hyper_tropia" },
      },
    ];
  }

  static maddoxGridRows(): SoftOpticPhoriaRow[] {
    return this.coverTestRows().slice(0, 5);
  }
}

export function SoftOpticPhoriaGrid({
  title,
  data,
  rows,
  isEditing,
  onChange,
}: SoftOpticPhoriaGridProps) {
  const { t } = useTranslation();

  const renderEye = (field?: string) => {
    if (!field) {
      return <div />;
    }
    return (
      <FastSelect
        value={String(data[field] ?? "")}
        onChange={(value) => onChange(field, value)}
        disabled={!isEditing}
        options={EXAM_FIELDS.MADDOX_WING_HYPER_EYE.options || []}
        allowImportedValue
        size="xs"
        center
        triggerClassName={`h-8 min-w-0 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
      />
    );
  };

  const renderPrism = (field: string) => (
    <FastInput
      type="number"
      step={EXAM_FIELDS.COVER_TEST_PRISM.step}
      min={EXAM_FIELDS.COVER_TEST_PRISM.min}
      max={EXAM_FIELDS.COVER_TEST_PRISM.max}
      value={String(data[field] ?? "")}
      onChange={(value) => onChange(field, value)}
      disabled={!isEditing}
      dir="ltr"
      suffix={EXAM_FIELDS.COVER_TEST_PRISM.suffix}
      className="h-8 min-w-0 text-xs disabled:cursor-default disabled:opacity-100"
    />
  );

  return (
    <Card className="examcard w-full pt-3 pb-4" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-muted-foreground font-medium">{title}</h3>
          </div>
          <div className="grid grid-cols-[minmax(7rem,1.3fr)_minmax(2.75rem,0.7fr)_minmax(4.25rem,1fr)_minmax(2.75rem,0.7fr)_minmax(4.25rem,1fr)] items-center gap-2">
            <div />
            <div className="text-muted-foreground col-span-2 text-center text-xs font-medium">
              {t("softopticFarVision")}
            </div>
            <div className="text-muted-foreground col-span-2 text-center text-xs font-medium">
              {t("softopticNearVision")}
            </div>
            {rows.map((row) => (
              <React.Fragment key={row.labelKey}>
                <div className="text-muted-foreground text-sm font-medium">
                  {t(row.labelKey)}
                </div>
                {renderEye(row.far.eye)}
                {renderPrism(row.far.prism)}
                {renderEye(row.near.eye)}
                {renderPrism(row.near.prism)}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
