import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { SoftOpticOcularMotExam } from "@/lib/db/schema-interface";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { FastInput, FastSelect } from "./shared/OptimizedInputs";

interface SoftOpticOcularMotTabProps {
  data: SoftOpticOcularMotExam;
  onChange: (field: keyof SoftOpticOcularMotExam, value: string) => void;
  isEditing: boolean;
}

export function SoftOpticOcularMotTab({
  data,
  onChange,
  isEditing,
}: SoftOpticOcularMotTabProps) {
  const { t } = useTranslation();

  return (
    <Card className="examcard w-full p-4 pt-3">
      <CardContent className="p-0" style={{ scrollbarWidth: "none" }}>
        <div className="grid w-full grid-cols-[1.4fr_1fr_1fr] gap-x-3 gap-y-1">
          <div className="flex flex-col">
            <div className="flex h-4 items-center justify-center">
              <label className="text-muted-foreground text-xs font-medium">
                {t("softopticOcularMot")}
              </label>
            </div>
            <div className="h-1" />
            <FastInput
              type="text"
              name="ocular_motility"
              value={data.ocular_motility || ""}
              onChange={(value) => onChange("ocular_motility", value)}
              disabled={!isEditing}
              className={`h-8 pt-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
            />
          </div>
          <div className="flex flex-col">
            <div className="flex h-4 items-center justify-center">
              <label className="text-muted-foreground text-xs font-medium">
                {t("softopticAcc")}
              </label>
            </div>
            <div className="h-1" />
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
              <FastInput
                type="number"
                name="acc_r"
                value={String(data.acc_r ?? "")}
                onChange={(value) => onChange("acc_r", value)}
                disabled={!isEditing}
                dir="ltr"
                className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
              />
              <span className="text-muted-foreground text-sm">/</span>
              <FastInput
                type="number"
                name="acc_l"
                value={String(data.acc_l ?? "")}
                onChange={(value) => onChange("acc_l", value)}
                disabled={!isEditing}
                dir="ltr"
                className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
              />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex h-4 items-center justify-center">
              <label className="text-muted-foreground text-xs font-medium">
                {t("softopticCnp")}
              </label>
            </div>
            <div className="h-1" />
            <div className="grid grid-cols-2 gap-1">
              <FastInput
                type="number"
                name="cnp_cm"
                value={String(data.cnp_cm ?? "")}
                onChange={(value) => onChange("cnp_cm", value)}
                disabled={!isEditing}
                min={EXAM_FIELDS.NPC_DISTANCE.min}
                max={EXAM_FIELDS.NPC_DISTANCE.max}
                step={EXAM_FIELDS.NPC_DISTANCE.step}
                suffix={EXAM_FIELDS.NPC_DISTANCE.suffix}
                dir="ltr"
                className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
              />
              <FastSelect
                value={String(data.cnp_eye ?? "")}
                onChange={(value) => onChange("cnp_eye", value)}
                disabled={!isEditing}
                options={["R", "L"]}
                allowImportedValue
                size="xs"
                center
                triggerClassName={`h-8 w-full min-w-0 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
