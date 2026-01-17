import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MaddoxRodExam } from "@/lib/db/schema-interface";
import { FastInput } from "./shared/OptimizedInputs"

interface MaddoxRodTabProps {
  maddoxRodData: MaddoxRodExam;
  onMaddoxRodChange: (field: keyof MaddoxRodExam, value: string) => void;
  isEditing: boolean;
  needsMiddleSpacer?: boolean;
}

const columns = [
  { key: "c_r_h", label: "R" },
  { key: "c_l_h", label: "L" },
  { key: "c_r_v", label: "R" },
  { key: "c_l_v", label: "L" },
];

export function MaddoxRodTab({
  maddoxRodData,
  onMaddoxRodChange,
  isEditing,
  needsMiddleSpacer = true,
}: MaddoxRodTabProps) {
  return (
    <Card className="w-full examcard pt-3 pb-4">
      <CardContent
        className="px-4"
        style={{ scrollbarWidth: "none", direction: "ltr" }}
      >
        <div className="space-y-3" >
          <div className="rtl grid grid-cols-[1fr_1fr_4px_1fr_1fr_70px] items-center gap-2">
            <div className="text-muted-foreground text-center pt-3 text-xs font-medium col-span-2">
              Horizon
            </div>
            <div className="text-muted-foreground text-center text-md pb-1 font-medium flex items-center justify-center whitespace-nowrap">
              Maddox Rod
            </div>
            <div className="text-muted-foreground text-center text-xs pt-3 font-medium col-span-2">
              Vertical
            </div>
            <div></div>
            {columns.slice(0, 2).map((col) => (
              <div
                key={col.key}
                className="text-muted-foreground text-center text-xs font-medium"
              >
                {col.label}
              </div>
            ))}
            <div className="bg-transparent w-px h-full my-2"></div>
            {columns.slice(2, 4).map((col) => (
              <div
                key={col.key}
                className="text-muted-foreground text-center text-xs font-medium"
              >
                {col.label}
              </div>
            ))}
            <div></div>
            {columns.slice(0, 2).map((col) => (
              <FastInput
                key={col.key}
                type="number"
                step="0.25"
                value={String(maddoxRodData[col.key as keyof MaddoxRodExam] || "")}
                onChange={(val) =>
                  onMaddoxRodChange(
                    col.key as keyof MaddoxRodExam,
                    val,
                  )
                }
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
              />
            ))}
            <div className="bg-border w-px h-8"></div>
            {columns.slice(2, 4).map((col) => (
              <FastInput
                key={col.key}
                type="number"
                step="0.25"
                value={String(maddoxRodData[col.key as keyof MaddoxRodExam] || "")}
                onChange={(val) =>
                  onMaddoxRodChange(
                    col.key as keyof MaddoxRodExam,
                    val,
                  )
                }
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
              />
            ))}
            <div className="text-right text-sm text-muted-foreground">
              עם תיקון
            </div>
            {needsMiddleSpacer && (
              <>
                {columns.slice(0, 2).map(({ key }) => (
                  <div key={`spacer-${key}`} className="h-8" />
                ))}
                <div className="h-8" />
                {columns.slice(2, 4).map(({ key }) => (
                  <div key={`spacer-${key}`} className="h-8" />
                ))}
                <div className="h-8" />
              </>
            )}

            {columns.slice(0, 2).map((col) => {
              const wcKey = col.key.replace("c_", "wc_") as keyof MaddoxRodExam;
              return (
                <FastInput
                  key={col.key + "-wc"}
                  type="number"
                  step="0.25"
                  value={String(maddoxRodData[wcKey] || "")}
                  onChange={(val) => onMaddoxRodChange(wcKey, val)}
                  disabled={!isEditing}
                  className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                />
              );
            })}
            <div className="bg-border w-px h-8"></div>
            {columns.slice(2, 4).map((col) => {
              const wcKey = col.key.replace("c_", "wc_") as keyof MaddoxRodExam;
              return (
                <FastInput
                  key={col.key + "-wc"}
                  type="number"
                  step="0.25"
                  value={String(maddoxRodData[wcKey] || "")}
                  onChange={(val) => onMaddoxRodChange(wcKey, val)}
                  disabled={!isEditing}
                  className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                />
              );
            })}
            <div className="text-right text-sm text-muted-foreground">
              בלי תיקון
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
