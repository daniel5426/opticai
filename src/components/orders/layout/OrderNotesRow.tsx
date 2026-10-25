import React from "react";
import { useTranslation } from "react-i18next";
import { FastTextarea } from "@/components/exam/shared/OptimizedInputs";
import { useAppLocale } from "@/localization/use-app-locale";
import { OrderField, OrderSection } from "./OrderSheet";

export interface OrderNoteEntry {
  key: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
}

interface OrderNotesRowProps {
  notes: OrderNoteEntry[];
  disabled: boolean;
}

export function OrderNotesRow({ notes, disabled }: OrderNotesRowProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const summary = notes
    .filter((note) => note.value.trim())
    .map((note) => `${note.title}: ${note.value.trim().split("\n")[0]}`)
    .join(" · ");

  return (
    <OrderSection
      collapsible
      defaultOpen={false}
      storageKey="order-notes-open"
      title={t("orderWorkspace.notes")}
      summary={summary}
      bodyClassName="grid gap-3 md:grid-cols-2"
    >
      {notes.map((note) => (
        <OrderField key={note.key} label={note.title}>
          <FastTextarea
            dir={direction}
            aria-label={note.title}
            label={note.title}
            value={note.value}
            onChange={note.onChange}
            disabled={disabled}
            showMaximize
            autoResize={false}
            className="min-h-24 resize-none text-sm"
          />
        </OrderField>
      ))}
    </OrderSection>
  );
}
