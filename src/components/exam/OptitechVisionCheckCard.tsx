import React from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserSelect } from "@/components/ui/user-select";
import { FastInput, FastTextarea } from "./shared/OptimizedInputs";
import type { OptitechExamFields } from "./OptitechGlassesCheckCard";
import { getExamPageData, getExamsByClientId } from "@/lib/db/exams-db";
import { clientQueryKeys } from "@/hooks/client/useClientTabQueries";
import { groupOptitechExams } from "@/lib/optitech-exam-tabs";
import { formatIsoDate } from "@/lib/iso-date";
import {
  OPTITECH_VISION_COMPONENTS,
  OPTITECH_VISION_ROWS,
  OPTITECH_VISION_SUMMARY,
  formatVisionValue,
  optitechVisionExtraFields,
  readVisionField,
  visionBlocksFromPageData,
  type VisionFormat,
} from "@/lib/optitech-vision-check";
import { cn } from "@/utils/tailwind";

type Blocks = Record<string, Record<string, unknown> | undefined>;
type DateColumn = { id: number | string; date?: string | null; current: boolean; blocks: Blocks };

interface Props {
  isEditing: boolean;
  writeField: (component: string, field: string, value: string) => void;
  readBlock: (component: string) => Record<string, unknown> | undefined;
  exam?: OptitechExamFields;
}

const CELL_INPUT =
  "h-7 min-w-0 rounded-none border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-1 focus-visible:ring-inset disabled:cursor-default disabled:opacity-100";

const shortDate = (date?: string | null) => (date ? formatIsoDate(date).replace(/\/(\d{2})(\d{2})$/, "/$2") : "—");

/** The client's other OptiTech vision exams, shown as read-only date columns like OptiTech's flowsheet. */
function useVisionHistory(clientId?: number, examId?: number) {
  const { data: exams = [] } = useQuery({
    queryKey: clientQueryKeys.exams(clientId ?? 0),
    queryFn: () => getExamsByClientId(clientId!),
    enabled: Boolean(clientId),
  });
  const others = groupOptitechExams(exams).vision.filter((exam) => exam.id && exam.id !== examId);
  const results = useQueries({
    queries: others.map((exam) => ({
      queryKey: ["optitech-vision-history", exam.id],
      queryFn: async () => visionBlocksFromPageData(await getExamPageData(exam.id!)),
      staleTime: 60_000,
    })),
  });
  return others.map((exam, index) => ({ id: exam.id!, date: exam.exam_date, current: false, blocks: results[index]?.data ?? {} }));
}

export function OptitechVisionCheckCard({ isEditing, writeField, readBlock, exam }: Props) {
  const { t, i18n } = useTranslation();
  const [showExtra, setShowExtra] = React.useState(false);
  const surface = isEditing ? "bg-white dark:bg-background" : "bg-accent/50";
  const history = useVisionHistory(exam?.clientId, exam?.examId);

  const currentBlocks: Blocks = Object.fromEntries(OPTITECH_VISION_COMPONENTS.map((component) => [component, readBlock(component)]));
  // Newest visit first, as OptiTech orders its date columns.
  const columns: DateColumn[] = [{ id: "current", date: exam?.examDate, current: true, blocks: currentBlocks }, ...history]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  const unit = (format?: VisionFormat) =>
    format?.unit ? <span className={cn("text-muted-foreground shrink-0 text-[0.7rem]", !format.compactUnit && "ms-1")}>{format.unit}</span> : null;

  const valueCell = (column: DateColumn, component: string, field: string, format?: VisionFormat) => {
    const { field: sourceField, value } = readVisionField(column.blocks[component], field);
    const shown = formatVisionValue(value, format);
    if (!column.current) {
      return (
        <div className="flex h-7 items-center justify-center px-1 text-xs tabular-nums">
          {shown}
          {shown && unit(format)}
        </div>
      );
    }
    // The unit sits inside the field, like "mm" on the system's PD inputs, so narrow columns keep it.
    return (
      <FastInput
        type="text"
        dir="ltr"
        aria-label={`${field} ${column.date ?? ""}`.trim()}
        value={shown}
        suffix={format?.unit}
        onChange={(next) => writeField(component, sourceField, next)}
        disabled={!isEditing}
        className={CELL_INPUT}
      />
    );
  };

  const valueColumns = columns.length;
  const extraFields = OPTITECH_VISION_COMPONENTS.flatMap((component) =>
    optitechVisionExtraFields(component, currentBlocks[component]).map((field) => ({ component, field })),
  );
  const summary = readVisionField(currentBlocks[OPTITECH_VISION_SUMMARY.component], OPTITECH_VISION_SUMMARY.field);

  return (
    <Card className="examcard w-full border pt-3 pb-4" dir={i18n.dir()}>
      <CardContent className="@container space-y-3 px-4">
        <h3 className="text-muted-foreground text-center font-medium">{t("optitech.visionCheck.title")}</h3>

        <div className="grid gap-4 @3xl:grid-cols-[minmax(13rem,1fr)_minmax(0,3.4fr)]">
          {/* Start column: examiner and exam summary, as on the OptiTech screen's right side. */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium">{t("optitech.visionCheck.examiner")}:</span>
              <UserSelect value={exam?.userId} disabled={!isEditing || !exam} onValueChange={(userId) => exam?.onUserChange(userId)} />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium">{t("optitech.visionCheck.summary")}:</span>
              <FastTextarea
                value={summary.value}
                onChange={(next) => writeField(OPTITECH_VISION_SUMMARY.component, summary.field, next)}
                disabled={!isEditing}
                label={t("optitech.visionCheck.summary")}
                className={cn("min-h-40 flex-1 resize-none text-sm disabled:cursor-default disabled:opacity-100", surface)}
              />
            </div>
          </div>

          {/* The flowsheet: test, expected finding, standard deviation, then one column per visit. */}
          <div dir="ltr" className="border-border min-w-0 overflow-x-auto rounded-md border">
            <table className="w-full min-w-[34rem] border-collapse text-xs">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[17%]" />
                <col className="w-[17%]" />
                {columns.map((column) => <col key={column.id} />)}
              </colgroup>
              <thead>
                <tr className="bg-muted/60 text-muted-foreground">
                  <th className="border-border border-e px-2 py-1.5 text-start font-semibold">Test</th>
                  <th className="border-border border-e px-2 py-1.5 font-semibold">Expected Findings</th>
                  <th className="border-border border-e px-2 py-1.5 font-semibold">Standard deviation</th>
                  {columns.map((column) => (
                    <th key={column.id} className="border-border border-e px-1 py-1 last:border-e-0">
                      <span className={cn(
                        "inline-block rounded px-2 py-0.5 font-semibold tabular-nums",
                        column.current ? "bg-primary text-primary-foreground" : "bg-card text-foreground border-border border",
                      )}>
                        {shortDate(column.date)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OPTITECH_VISION_ROWS.map((row, index) => {
                  if (row.kind === "section") {
                    return (
                      <tr key={index} className="border-border border-t">
                        <td colSpan={3 + valueColumns} className="bg-primary/10 text-primary py-1.5 text-center text-[0.8rem] font-semibold">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  if (row.kind === "group") {
                    return (
                      <tr key={index} className="border-border bg-muted/30 border-t">
                        <td className="border-border border-e px-2 py-1.5 font-semibold">{row.label}</td>
                        <td colSpan={2} className="border-border text-muted-foreground border-e px-2 py-1.5 text-center">{row.note}</td>
                        {columns.map((column) => <td key={column.id} className="border-border border-e last:border-e-0" />)}
                      </tr>
                    );
                  }
                  return (
                    <tr key={index} className="border-border border-t">
                      <td className={cn("border-border border-e px-2 py-1", row.indent ? "ps-5" : "font-semibold")}>{row.label}</td>
                      <td className="border-border text-muted-foreground border-e px-2 py-1 text-center tabular-nums">{row.expected}</td>
                      <td className="border-border text-muted-foreground border-e px-2 py-1 text-center tabular-nums">{row.deviation}</td>
                      {columns.map((column) => (
                        <td key={column.id} className={cn("border-border border-e p-0 last:border-e-0", column.current ? surface : "bg-muted/20")}>
                          {valueCell(column, row.component, row.field, row.format)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {extraFields.length > 0 && (
          <div className="border-border/60 border-t pt-2">
            <button
              type="button"
              onClick={() => setShowExtra((value) => !value)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium"
              aria-expanded={showExtra}
            >
              <ChevronDown className={cn("size-3.5 transition-transform", showExtra && "rotate-180")} aria-hidden />
              {t("optitech.glassesCheck.moreFields", { count: extraFields.length })}
            </button>
            {showExtra && (
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(6rem,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[repeat(2,minmax(0,1fr)_minmax(6rem,1fr))]">
                {extraFields.map(({ component, field }) => (
                  <React.Fragment key={`${component}:${field}`}>
                    <span className="text-muted-foreground min-w-0 text-xs" title={field}>
                      {t(`optitech.fields.${field}`, { defaultValue: field })}
                    </span>
                    <FastInput
                      type="text"
                      dir="auto"
                      aria-label={field}
                      value={readVisionField(currentBlocks[component], field).value}
                      onChange={(next) => writeField(component, field, next)}
                      disabled={!isEditing}
                      className={cn("h-8 min-w-0 text-xs disabled:cursor-default disabled:opacity-100", surface)}
                    />
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OptitechVisionCheckCard;
