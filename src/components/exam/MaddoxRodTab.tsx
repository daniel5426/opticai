import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { MaddoxRodExam } from "@/lib/db/schema-interface";
import { normalizeMaddoxRodExam } from "@/lib/maddox-compatibility";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { FastInput, FastSelect } from "./shared/OptimizedInputs";

interface MaddoxRodTabProps {
  maddoxRodData: MaddoxRodExam;
  onMaddoxRodChange: (field: keyof MaddoxRodExam, value: string) => void;
  isEditing: boolean;
  needsMiddleSpacer?: boolean;
}

export function MaddoxRodTab({
  maddoxRodData,
  onMaddoxRodChange,
  isEditing,
  needsMiddleSpacer = false,
}: MaddoxRodTabProps) {
  const { t } = useTranslation();
  const data = normalizeMaddoxRodExam(maddoxRodData as Record<string, unknown>) as MaddoxRodExam;
  const rows = [
    { prefix: "with", label: t("maddoxWithCorrection") },
    { prefix: "without", label: t("maddoxWithoutCorrection") },
  ] as const;

  const measurement = (
    prefix: "with" | "without",
    axis: "horizontal" | "vertical",
  ) => {
    const prismKey = `${prefix}_${axis}_prism` as keyof MaddoxRodExam;
    const directionKey = `${prefix}_${axis}_direction` as keyof MaddoxRodExam;
    const directionOptions =
      axis === "horizontal"
        ? EXAM_FIELDS.MADDOX_HORIZONTAL_DIRECTION.options
        : EXAM_FIELDS.MADDOX_VERTICAL_DIRECTION.options;

    return (
      <div className="grid min-w-0 grid-cols-[minmax(4.5rem,0.9fr)_minmax(4.75rem,1.1fr)] items-center gap-2">
        <FastInput
          type="number"
          step="0.25"
          value={String(data[prismKey] ?? "")}
          onChange={(value) => onMaddoxRodChange(prismKey, value)}
          disabled={!isEditing}
          dir="ltr"
          suffix={EXAM_FIELDS.COVER_TEST_PRISM.suffix}
          className="h-8 min-w-0 text-xs disabled:cursor-default disabled:opacity-100"
        />
        <FastSelect
          value={String(data[directionKey] ?? "")}
          onChange={(value) => onMaddoxRodChange(directionKey, value)}
          disabled={!isEditing}
          options={directionOptions || []}
          allowImportedValue
          size="xs"
          center
          triggerClassName={`h-8 min-w-[4.75rem] text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
        />
      </div>
    );
  };

  return (
    <Card className="examcard w-full pt-3 pb-4" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-muted-foreground font-medium">Maddox rod</h3>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
            <div className="text-muted-foreground text-center text-xs font-medium">
              {t("maddoxHorizontal")}
            </div>
            <div className="text-muted-foreground text-center text-xs font-medium">
              {t("maddoxVertical")}
            </div>
            <div />
            {rows.map(({ prefix, label }, index) => (
              <React.Fragment key={prefix}>
                {index === 1 && needsMiddleSpacer && (
                  <>
                    <div className="h-8" />
                    <div className="h-8" />
                    <div className="h-8" />
                  </>
                )}
                {measurement(prefix, "horizontal")}
                {measurement(prefix, "vertical")}
                <div className="text-muted-foreground px-1 text-end text-sm whitespace-nowrap" dir="auto">
                  {label}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
