import React, { useEffect, useMemo, useState } from "react";
import { Database, Loader2, Search, ShieldCheck } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/ui/custom-modal";
import { Input } from "@/components/ui/input";

export type ImportedSourceRecordType =
  | "client"
  | "exam"
  | "order"
  | "contact_lens_order";

type SourceRow = {
  source_system: string;
  source_table: string;
  raw_row_ref: string;
  raw_payload: Record<string, unknown>;
  raw_payload_sha256: string | null;
  raw_captured_at: string | null;
};

type ImportedSourceDataDialogProps = {
  recordType: ImportedSourceRecordType;
  recordId?: number | null;
};

function isVisibleValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  return !(typeof value === "string" && value.trim() === "");
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function formatCapturedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ImportedSourceDataDialog({
  recordType,
  recordId,
}: ImportedSourceDataDialogProps) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(Boolean(recordId));
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsAvailable(false);
    setRows([]);
    setIsOpen(false);
    setIsChecking(Boolean(recordId));

    if (!recordId) return () => {
      cancelled = true;
    };

    void apiClient.getMigrationSourceDataSummary(recordType, recordId).then((response) => {
      if (!cancelled) {
        setIsAvailable(Boolean(response.data?.available));
        setIsChecking(false);
      }
    }).catch(() => {
      if (!cancelled) setIsChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [recordId, recordType]);

  const activeRow = rows[activeRowIndex];
  const visibleFields = useMemo(() => {
    if (!activeRow) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return Object.entries(activeRow.raw_payload ?? {}).filter(([field, value]) => {
      if (!isVisibleValue(value)) return false;
      if (!normalizedQuery) return true;
      return `${field} ${formatValue(value)}`.toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [activeRow, query]);

  const handleOpen = async () => {
    if (!recordId) return;
    setIsOpen(true);
    setIsLoadingRows(true);
    setLoadError(null);
    setQuery("");

    const response = await apiClient.getMigrationSourceData(recordType, recordId);
    if (response.error || !response.data) {
      setLoadError("לא ניתן לטעון את נתוני המקור כרגע.");
      setRows([]);
    } else {
      setRows(response.data.rows);
      setActiveRowIndex(0);
    }
    setIsLoadingRows(false);
  };

  if (!recordId || isChecking || !isAvailable) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-2 border-amber-300/70 bg-amber-50/50 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-950/40"
        onClick={() => void handleOpen()}
      >
        <Database className="h-4 w-4" />
        נתוני מקור
      </Button>

      <CustomModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="נתוני מקור מיובאים"
        subtitle="עותק בטיחותי לקריאה בלבד"
        width="max-w-5xl"
      >
        {isLoadingRows ? (
          <div className="flex min-h-56 items-center justify-center text-muted-foreground">
            <Loader2 className="ml-2 h-5 w-5 animate-spin" />
            טוען נתוני מקור…
          </div>
        ) : loadError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {loadError}
          </div>
        ) : activeRow ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-amber-200/80 bg-amber-50/60 p-3 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-50">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>הנתונים מוצגים כפי שנקלטו בקובץ המקור בזמן ההסבה. אי אפשר לערוך אותם כאן.</p>
            </div>

            <div className="flex flex-wrap gap-2 border-b pb-3" role="tablist" aria-label="רשומות מקור">
              {rows.map((row, index) => (
                <Button
                  key={`${row.source_table}:${row.raw_row_ref}`}
                  type="button"
                  size="sm"
                  variant={activeRowIndex === index ? "default" : "outline"}
                  role="tab"
                  aria-selected={activeRowIndex === index}
                  onClick={() => {
                    setActiveRowIndex(index);
                    setQuery("");
                  }}
                >
                  {row.source_table}
                  {rows.filter((item) => item.source_table === row.source_table).length > 1
                    ? ` · ${index + 1}`
                    : ""}
                </Button>
              ))}
            </div>

            <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-xs sm:grid-cols-2">
              <p><span className="text-muted-foreground">מערכת מקור: </span><span dir="ltr">{activeRow.source_system}</span></p>
              <p><span className="text-muted-foreground">נלכד בתאריך: </span>{formatCapturedAt(activeRow.raw_captured_at)}</p>
              <p className="sm:col-span-2 break-all"><span className="text-muted-foreground">מזהה שורת מקור: </span><span dir="ltr">{activeRow.raw_row_ref}</span></p>
              <p className="sm:col-span-2 break-all font-mono text-[11px]"><span className="font-sans text-muted-foreground">בדיקת שלמות (SHA-256): </span>{activeRow.raw_payload_sha256 || "—"}</p>
            </div>

            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pr-9"
                placeholder="חיפוש שדה או ערך מקור"
                aria-label="חיפוש בנתוני המקור"
              />
            </div>

            <div className="overflow-hidden rounded-md border">
              <div className="max-h-[38vh] overflow-auto" role="tabpanel">
                <table className="w-full min-w-[560px] text-right text-sm">
                  <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="w-1/3 px-4 py-2 font-medium">שדה במקור</th>
                      <th className="px-4 py-2 font-medium">ערך מקורי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFields.map(([field, value]) => (
                      <tr key={field} className="border-t align-top">
                        <td className="break-all px-4 py-2 font-mono text-xs text-muted-foreground" dir="ltr">{field}</td>
                        <td className="whitespace-pre-wrap break-words px-4 py-2" dir="auto">{formatValue(value)}</td>
                      </tr>
                    ))}
                    {visibleFields.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          אין שדות עם ערך שתואמים לחיפוש.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <details className="rounded-md border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">JSON מקורי (מתקדם)</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 text-left text-xs" dir="ltr">
                {JSON.stringify(activeRow.raw_payload ?? {}, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">אין נתוני מקור להצגה.</div>
        )}
      </CustomModal>
    </>
  );
}
