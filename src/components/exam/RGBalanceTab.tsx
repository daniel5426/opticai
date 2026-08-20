import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { RGBalanceExam } from "@/lib/db/schema-interface";
import { FastInput } from "./shared/OptimizedInputs";

interface RGBalanceTabProps {
  rgBalanceData: RGBalanceExam;
  onRGBalanceChange: (field: keyof RGBalanceExam, value: string) => void;
  isEditing: boolean;
  needsMiddleSpacer?: boolean;
}

const columns = [
  { key: "green", labelKey: "rgBalanceGreen", className: "text-green-700 underline decoration-green-700" },
  { key: "equal", labelKey: "rgBalanceEqual", className: "underline decoration-foreground" },
  { key: "red", labelKey: "rgBalanceRed", className: "text-red-600 underline decoration-red-600" },
] as const;

const eyes = ["R", "L"] as const;

export function RGBalanceTab({
  rgBalanceData,
  onRGBalanceChange,
  isEditing,
  needsMiddleSpacer = false,
}: RGBalanceTabProps) {
  const { t } = useTranslation();

  const getField = (eye: "R" | "L", column: (typeof columns)[number]["key"]) => {
    const field = `${eye.toLowerCase()}_${column}` as keyof RGBalanceExam;
    return String(rgBalanceData[field] ?? "");
  };

  return (
    <Card className="examcard w-full pt-3 pb-4" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-muted-foreground font-medium">{t("rgBalance")}</h3>
          </div>
          <div className="grid grid-cols-[28px_repeat(3,minmax(0,1fr))] items-center gap-2">
            <div />
            {columns.map((column) => (
              <div
                key={column.key}
                className={`flex h-4 items-center justify-center text-center text-xs font-medium ${column.className}`}
              >
                {t(column.labelKey)}
              </div>
            ))}
            {eyes.map((eye, index) => (
              <React.Fragment key={eye}>
                {index === 1 && needsMiddleSpacer && (
                  <>
                    <div className="h-8" />
                    {columns.map((column) => (
                      <div key={`spacer-${column.key}`} className="h-8" />
                    ))}
                  </>
                )}
                <div className="text-muted-foreground flex h-8 items-center text-sm font-medium">
                  {eye}
                </div>
                {columns.map((column) => {
                  const field = `${eye.toLowerCase()}_${column.key}` as keyof RGBalanceExam;
                  return (
                    <FastInput
                      key={field}
                      type="number"
                      step="0.01"
                      value={getField(eye, column.key)}
                      onChange={(value) => onRGBalanceChange(field, value)}
                      disabled={!isEditing}
                      dir="ltr"
                      className="h-8 text-xs disabled:cursor-default disabled:opacity-100"
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
