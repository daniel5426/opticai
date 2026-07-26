import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CoverTestV2Exam } from "@/lib/db/schema-interface";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { FastInput, FastSelect } from "./shared/OptimizedInputs";

type CorrectionMode = "cc" | "sc";
type Orientation = "horizontal" | "vertical";
type Distance = "far" | "near";

interface CoverTestV2TabProps {
  coverTestData: CoverTestV2Exam;
  onCoverTestChange: (field: keyof CoverTestV2Exam, value: string) => void;
  isEditing: boolean;
}

const rows: ReadonlyArray<{ orientation: Orientation; label: string }> = [
  { orientation: "horizontal", label: "Horizontal" },
  { orientation: "vertical", label: "Vertical" },
];

const isNeutralDeviation = (value: string | undefined) =>
  value === "Ortho" || value === "Iso";

export function CoverTestV2Tab({
  coverTestData,
  onCoverTestChange,
  isEditing,
}: CoverTestV2TabProps) {
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>("cc");

  const getKey = (
    distance: Distance,
    orientation: Orientation,
    kind: "prism" | "deviation",
  ) =>
    `${correctionMode}_${distance}_${orientation}_${kind}` as keyof CoverTestV2Exam;

  const handleDeviationChange = (
    distance: Distance,
    orientation: Orientation,
    value: string,
  ) => {
    onCoverTestChange(getKey(distance, orientation, "deviation"), value);
    if (isNeutralDeviation(value)) {
      onCoverTestChange(getKey(distance, orientation, "prism"), "0");
    }
  };

  return (
    <Card className="examcard w-full pt-3 pb-4" dir="ltr">
      <CardContent className="px-4">
        <div className="space-y-3">
          <div className="relative flex min-h-7 items-center">
            <div className="bg-accent/40 absolute left-0 inline-flex rounded-md border p-0.5">
              {(
                [
                  ["cc", "CC", "With correction"],
                  ["sc", "SC", "Without correction"],
                ] as const
              ).map(([mode, label, title]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCorrectionMode(mode)}
                  aria-pressed={correctionMode === mode}
                  aria-label={title}
                  title={title}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    correctionMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 pl-20 text-center">
              <h3 className="text-muted-foreground font-medium">Cover Test</h3>
            </div>
          </div>

          <div className="grid grid-cols-[94px_minmax(0,0.5fr)_minmax(0,1fr)_minmax(0,0.5fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
            <div />
            <div className="text-muted-foreground col-span-2 text-center text-xs font-medium">
              Far
            </div>
            <div className="text-muted-foreground col-span-2 text-center text-xs font-medium">
              Near
            </div>

            <div />
            {(["far", "near"] as const).flatMap((distance) => [
              <div
                key={`${distance}-prism`}
                className="text-muted-foreground text-center text-xs font-medium"
              >
                Prism (Δ)
              </div>,
              <div
                key={`${distance}-deviation`}
                className="text-muted-foreground text-center text-xs font-medium"
              >
                Deviation
              </div>,
            ])}

            {rows.map(({ orientation, label }) => {
              const deviationConfig =
                orientation === "horizontal"
                  ? EXAM_FIELDS.COVER_TEST_HORIZONTAL_DEVIATION
                  : EXAM_FIELDS.COVER_TEST_VERTICAL_DEVIATION;

              return (
                <React.Fragment key={orientation}>
                  <div className="text-muted-foreground text-sm font-medium">
                    {label}
                  </div>
                  {(["far", "near"] as const).flatMap((distance) => {
                    const prismKey = getKey(distance, orientation, "prism");
                    const deviationKey = getKey(
                      distance,
                      orientation,
                      "deviation",
                    );
                    const deviation = coverTestData[deviationKey] as
                      | string
                      | undefined;
                    return [
                      <FastInput
                        key={String(prismKey)}
                        type="number"
                        value={String(coverTestData[prismKey] ?? "")}
                        onChange={(value) => onCoverTestChange(prismKey, value)}
                        disabled={!isEditing || isNeutralDeviation(deviation)}
                        min={EXAM_FIELDS.COVER_TEST_PRISM.min}
                        max={EXAM_FIELDS.COVER_TEST_PRISM.max}
                        step={EXAM_FIELDS.COVER_TEST_PRISM.step}
                        suffix={EXAM_FIELDS.COVER_TEST_PRISM.suffix}
                        className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                      />,
                      <FastSelect
                        key={String(deviationKey)}
                        value={deviation || ""}
                        onChange={(value) =>
                          handleDeviationChange(distance, orientation, value)
                        }
                        disabled={!isEditing}
                        options={deviationConfig.options || []}
                        placeholder="Select"
                        size="xs"
                        center
                        triggerClassName={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                      />,
                    ];
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
