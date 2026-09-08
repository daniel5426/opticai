import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { SoftOpticFundusExam } from "@/lib/db/schema-interface";
import { FastInput } from "./shared/OptimizedInputs";

interface SoftOpticFundusTabProps {
  data: SoftOpticFundusExam;
  onChange: (field: keyof SoftOpticFundusExam, value: string) => void;
  isEditing: boolean;
}

export function SoftOpticFundusTab({
  data,
  onChange,
  isEditing,
}: SoftOpticFundusTabProps) {
  const { t } = useTranslation();
  const rows = [
    { label: t("fundusMacula"), r: "r_macula", l: "l_macula" },
    { label: t("fundusBlood"), r: "r_blood", l: "l_blood" },
    { label: t("fundusDisc"), r: "r_disc", l: "l_disc" },
    { label: t("fundusPupil"), r: "r_pupil", l: "l_pupil" },
  ] as const;

  return (
    <Card className="examcard w-full pt-3 pb-4">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-muted-foreground font-medium">
              {t("softopticFundus")}
            </h3>
          </div>
          <div className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(4rem,1fr)_minmax(6rem,1.2fr)] items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              {t("ishiharaTest")}
            </span>
            <FastInput
              type="text"
              name="ishihara_test"
              value={String(data.ishihara_test ?? "")}
              onChange={(value) => onChange("ishihara_test", value)}
              disabled={!isEditing}
              className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
            />
            <FastInput
              type="text"
              name="ishihara_rem"
              value={String(data.ishihara_rem ?? "")}
              onChange={(value) => onChange("ishihara_rem", value)}
              disabled={!isEditing}
              className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
            />
          </div>
          <div className="grid grid-cols-[minmax(6rem,0.9fr)_minmax(4.5rem,1fr)_minmax(4.5rem,1fr)] items-center gap-2">
            <div />
            <span className="text-muted-foreground text-center text-xs font-medium">
              {t("softopticRightEye")}
            </span>
            <span className="text-muted-foreground text-center text-xs font-medium">
              {t("softopticLeftEye")}
            </span>
            {rows.map((row) => (
              <React.Fragment key={row.r}>
                <span className="text-muted-foreground text-xs font-medium">
                  {row.label}
                </span>
                <FastInput
                  type="text"
                  name={row.r}
                  value={String(data[row.r] ?? "")}
                  onChange={(value) => onChange(row.r, value)}
                  disabled={!isEditing}
                  dir="ltr"
                  className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                />
                <FastInput
                  type="text"
                  name={row.l}
                  value={String(data[row.l] ?? "")}
                  onChange={(value) => onChange(row.l, value)}
                  disabled={!isEditing}
                  dir="ltr"
                  className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
