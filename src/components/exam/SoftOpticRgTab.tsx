import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SoftOpticRgExam } from "@/lib/db/schema-interface";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { BASE_VALUES } from "./data/exam-constants";
import { FastInput, FastSelect } from "./shared/OptimizedInputs";

interface SoftOpticRgTabProps {
  data: SoftOpticRgExam;
  onChange: (field: keyof SoftOpticRgExam, value: string) => void;
  isEditing: boolean;
}

const STATUSES = ["suppression", "fusion", "diplopia"] as const;

export function SoftOpticRgTab({
  data,
  onChange,
  isEditing,
}: SoftOpticRgTabProps) {
  const { t } = useTranslation();
  const statusLabels: Record<(typeof STATUSES)[number], string> = {
    suppression: t("rgSuppression"),
    fusion: t("rgFusion"),
    diplopia: t("rgDiplopia"),
  };

  const handleStatusChange = (
    status: (typeof STATUSES)[number],
    checked: boolean,
  ) => {
    if (checked) {
      onChange("rg_status", status);
      return;
    }
    if (data.rg_status === status) {
      onChange("rg_status", "");
    }
  };

  return (
    <Card className="examcard w-full pt-3 pb-4">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-muted-foreground font-medium">
              {t("softopticRg")}
            </h3>
          </div>
          <div className="grid grid-cols-[minmax(8.5rem,0.85fr)_minmax(0,1.4fr)] items-start gap-4">
            <div className="space-y-2">
              {STATUSES.map((status) => (
                <div
                  key={status}
                  className={`flex h-8 items-center justify-between gap-2 rounded-md border px-2 ${isEditing ? "bg-white" : "bg-accent/50"}`}
                >
                  <Checkbox
                    id={`softoptic-rg-${status}`}
                    checked={data.rg_status === status}
                    onCheckedChange={(checked) =>
                      handleStatusChange(status, Boolean(checked))
                    }
                    disabled={!isEditing}
                  />
                  <label
                    htmlFor={`softoptic-rg-${status}`}
                    className="text-muted-foreground text-xs font-medium"
                  >
                    {statusLabels[status]}
                  </label>
                </div>
              ))}
              {data.rg_status === "suppression" && (
                <FastSelect
                  value={String(data.suppressed_eye ?? "")}
                  onChange={(value) => onChange("suppressed_eye", value)}
                  disabled={!isEditing}
                  options={["R", "L"]}
                  allowImportedValue
                  size="xs"
                  center
                  triggerClassName={`h-8 w-full min-w-0 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground text-center text-xs font-medium">
                {t("softopticRgFusionWith")}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <span className="text-muted-foreground text-center text-xs font-medium">
                  {t("examPrismHorizontal")}
                </span>
                <span className="text-muted-foreground text-center text-xs font-medium">
                  {t("examBase")}
                </span>
                <span className="text-muted-foreground text-center text-xs font-medium">
                  {t("examPrismVertical")}
                </span>
                <span className="text-muted-foreground text-center text-xs font-medium">
                  {t("examBase")}
                </span>
                <FastInput
                  type="number"
                  step={EXAM_FIELDS.PRISM.step}
                  min={EXAM_FIELDS.PRISM.min}
                  max={EXAM_FIELDS.PRISM.max}
                  value={String(data.pr_h ?? "")}
                  onChange={(value) => onChange("pr_h", value)}
                  disabled={!isEditing}
                  dir="ltr"
                  className="h-8 w-full min-w-0 text-xs disabled:cursor-default disabled:opacity-100"
                />
                <FastSelect
                  value={String(data.base_h ?? "")}
                  onChange={(value) => onChange("base_h", value)}
                  disabled={!isEditing}
                  options={[...BASE_VALUES]}
                  allowImportedValue
                  size="xs"
                  center
                  triggerClassName={`h-8 w-full min-w-0 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                />
                <FastInput
                  type="number"
                  step={EXAM_FIELDS.PRISM.step}
                  min={EXAM_FIELDS.PRISM.min}
                  max={EXAM_FIELDS.PRISM.max}
                  value={String(data.pr_v ?? "")}
                  onChange={(value) => onChange("pr_v", value)}
                  disabled={!isEditing}
                  dir="ltr"
                  className="h-8 w-full min-w-0 text-xs disabled:cursor-default disabled:opacity-100"
                />
                <FastSelect
                  value={String(data.base_v ?? "")}
                  onChange={(value) => onChange("base_v", value)}
                  disabled={!isEditing}
                  options={[...BASE_VALUES]}
                  allowImportedValue
                  size="xs"
                  center
                  triggerClassName={`h-8 w-full min-w-0 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
