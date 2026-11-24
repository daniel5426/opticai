import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { SoftOpticDetailsExam } from "@/lib/db/schema-interface";
import { SOFTOPTIC_DETAIL_SLOTS, type SoftopticDetailField } from "@/lib/softoptic-details";
import { useAppLocale } from "@/localization/use-app-locale";
import { FastInput, FastTextarea } from "./shared/OptimizedInputs";

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
  const { locale, direction } = useAppLocale();
  const fieldId = React.useId();
  const slot = SOFTOPTIC_DETAIL_SLOTS[cardId];
  if (!slot) return null;

  const eyeRows = (slot.eyeRows ?? []).filter(
    (row) => isEditing || [row.r, row.l, row.comb].some((field) => field && hasValue(data[field])),
  );
  const fields = (slot.fields ?? []).filter((item) => isEditing || hasValue(data[item.field]));
  const showComb = eyeRows.some((row) => row.comb);

  const input = (field: string, id?: string, compact = false) => (
    <FastInput
      type="text"
      id={id}
      name={field}
      value={String(data[field] ?? "")}
      onChange={(value) => onChange(field, value)}
      disabled={!isEditing}
      className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100 ${compact ? "[field-sizing:content]" : ""}`}
    />
  );

  const fieldInput = (item: SoftopticDetailField) => {
    const id = `${fieldId}-${item.field}`;
    const value = String(data[item.field] ?? "");
    const inputClass = `text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`;
    if (item.date) {
      const date = new Date(`${value}T00:00:00`);
      return <span className="text-foreground font-medium">{Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale)}</span>;
    }
    if (item.multiline) {
      return (
        <FastTextarea
          id={id}
          name={item.field}
          value={value}
          onChange={(next) => onChange(item.field, next)}
          disabled={!isEditing}
          dir={direction}
          className={`min-h-8 text-start ${inputClass}`}
        />
      );
    }
    if (item.options) {
      return (
        <select
          id={id}
          name={item.field}
          value={value}
          onChange={(event) => onChange(item.field, event.target.value)}
          disabled={!isEditing}
          className={`border-input h-8 w-full rounded-md border px-2 ${inputClass} ${slot.compactFields ? "[field-sizing:content]" : ""}`}
        >
          <option value="" />
          {/* An imported value OpticSoft did not document is kept as is. */}
          {[...new Set([...item.options, ...(value ? [value] : [])])].map((option) => (
            <option key={option} value={option}>
              {t(`softoptic.details.options.${option}`, { defaultValue: option })}
            </option>
          ))}
        </select>
      );
    }
    return input(item.field, id, slot.compactFields);
  };

  if (slot.caption) {
    return (
      <p dir={direction} className="text-muted-foreground w-full px-2 text-center text-xs">
        {fields.map((item) => (
          <span key={item.field}>
            {t(`softoptic.details.labels.${item.label}`)} {fieldInput(item)}
          </span>
        ))}
      </p>
    );
  }

  const fieldGrid = fields.length > 0 && (
    <div
      className={slot.compactFields
        ? "flex flex-wrap items-end gap-2"
        : "grid grid-cols-[minmax(5rem,auto)_minmax(0,1fr)] items-center gap-2"}
    >
      {fields.map((item) => (
        <div key={item.field} className={slot.compactFields
          ? `grid max-w-full gap-1 ${item.multiline ? "w-full min-w-0" : "min-w-16"}`
          : "contents"}>
          <label
            htmlFor={`${fieldId}-${item.field}`}
            className="text-muted-foreground text-xs font-medium"
          >
            {t(`softoptic.details.labels.${item.label}`)}
          </label>
          {fieldInput(item)}
        </div>
      ))}
    </div>
  );

  return (
    <Card className={`examcard pt-3 pb-4 ${slot.compactFields ? "w-fit max-w-full" : "w-full"}`}>
      <CardContent className="space-y-3 px-4" style={{ scrollbarWidth: "none" }}>
        <h3 className="text-muted-foreground text-center font-medium">
          {t(`softoptic.details.titles.${slot.title}`)}
        </h3>
        {slot.fieldsFirst && fieldGrid}
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
        {!slot.fieldsFirst && fieldGrid}
      </CardContent>
    </Card>
  );
}
