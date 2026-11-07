import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { SoftOpticDetailsExam } from "@/lib/db/schema-interface";
import { SOFTOPTIC_DETAIL_SLOTS } from "@/lib/softoptic-details";
import { FastInput } from "./shared/OptimizedInputs";

interface SoftOpticDetailsTabProps {
  data: SoftOpticDetailsExam;
  cardId: string;
  onChange: (field: string, value: string) => void;
  isEditing: boolean;
}

const hasValue = (value: unknown) => value != null && String(value).trim() !== "";

export function SoftOpticDetailsTab({
  data,
  cardId,
  onChange,
  isEditing,
}: SoftOpticDetailsTabProps) {
  const { t } = useTranslation();
  const slot = SOFTOPTIC_DETAIL_SLOTS[cardId];
  if (!slot) return null;

  const eyeRows = (slot.eyeRows ?? []).filter(
    (row) => isEditing || [row.r, row.l, row.comb].some((field) => field && hasValue(data[field])),
  );
  const fields = (slot.fields ?? []).filter((item) => isEditing || hasValue(data[item.field]));
  const showComb = eyeRows.some((row) => row.comb);

  const input = (field: string) => (
    <FastInput
      type="text"
      name={field}
      value={String(data[field] ?? "")}
      onChange={(value) => onChange(field, value)}
      disabled={!isEditing}
      className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
    />
  );

  return (
    <Card className="examcard w-full pt-3 pb-4">
      <CardContent className="space-y-3 px-4" style={{ scrollbarWidth: "none" }}>
        <h3 className="text-muted-foreground text-center font-medium">
          {t(`softoptic.details.titles.${slot.title}`)}
        </h3>
        {eyeRows.length > 0 && (
          <div
            className={`grid items-center gap-2 ${showComb ? "grid-cols-[minmax(5rem,0.8fr)_1fr_1fr_1fr]" : "grid-cols-[minmax(5rem,0.8fr)_1fr_1fr]"}`}
          >
            <div />
            <span className="text-muted-foreground text-center text-xs font-medium">R</span>
            <span className="text-muted-foreground text-center text-xs font-medium">L</span>
            {showComb && <span className="text-muted-foreground text-center text-xs font-medium">B</span>}
            {eyeRows.map((row) => (
              <React.Fragment key={row.label}>
                <span className="text-muted-foreground text-xs font-medium">
                  {t(`softoptic.details.labels.${row.label}`)}
                </span>
                {input(row.r)}
                {input(row.l)}
                {showComb && (row.comb ? input(row.comb) : <div />)}
              </React.Fragment>
            ))}
          </div>
        )}
        {fields.length > 0 && (
          <div className="grid grid-cols-[minmax(5rem,0.8fr)_2fr] items-center gap-2">
            {fields.map((item) => (
              <React.Fragment key={item.field}>
                <span className="text-muted-foreground text-xs font-medium">
                  {t(`softoptic.details.labels.${item.label}`)}
                </span>
                {input(item.field)}
              </React.Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
