import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date";
import { UserSelect } from "@/components/ui/user-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FastInput, FastSelect, FastTextarea } from "./shared/OptimizedInputs";
import { BASE_VALUES_SIMPLE } from "./data/exam-constants";
import {
  OPTITECH_GLASSES_FIELDS,
  OPTITECH_GLASSES_NOTES_FIELD,
  OPTITECH_GLASSES_SINGLE_FIELDS,
  formatOptitechClockTime,
  formatOptitechNumber,
  isBareAcuityToken,
  optitechGlassesExtraFields,
  type OptitechFieldRef,
} from "@/lib/optitech-glasses-check";
import { cn } from "@/utils/tailwind";

type ColumnKey = keyof typeof OPTITECH_GLASSES_FIELDS;
type Column = { key: ColumnKey; label: string; kind?: "acuity" | "base"; decimals?: number };

const RX_COLUMNS: Column[] = [
  { key: "fv", label: "FV", kind: "acuity" },
  { key: "sph", label: "Sph.", decimals: 2 },
  { key: "cyl", label: "Cyl.", decimals: 2 },
  { key: "ax", label: "Ax." },
  { key: "pris", label: "Pris", decimals: 2 },
  { key: "base", label: "Base", kind: "base" },
  { key: "va", label: "VA", kind: "acuity" },
  { key: "ph", label: "PH", kind: "acuity" },
];

const NEAR_COLUMNS: Column[] = [
  { key: "read", label: "Read", decimals: 2 },
  { key: "int", label: "Int.", decimals: 2 },
  { key: "bif", label: "Bif.", decimals: 2 },
  { key: "mul", label: "Mul.", decimals: 2 },
  { key: "high", label: "High", decimals: 2 },
  { key: "j", label: "J" },
  { key: "addPris", label: "Pris", decimals: 2 },
  { key: "addBase", label: "Base", kind: "base" },
  { key: "pdDist", label: "Pd-D", decimals: 1 },
  { key: "pdRead", label: "Pd-N", decimals: 1 },
];

/** Exam-level values OptiTech shows on the same screen (date, examiner, dominant eye). */
export interface OptitechExamFields {
  examId?: number;
  clientId?: number;
  examDate?: string;
  onExamDateChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  userId?: number;
  onUserChange: (userId: number) => void;
  dominantEye?: string | null;
  onDominantEyeChange: (value: string) => void;
}

interface Props {
  isEditing: boolean;
  readField: (component: string, field: string) => unknown;
  writeField: (component: string, field: string, value: string) => void;
  readBlock: (component: string) => Record<string, unknown> | undefined;
  exam?: OptitechExamFields;
}

const hasCombinedRow = (columns: Column[]) => columns.some((column) => "C" in OPTITECH_GLASSES_FIELDS[column.key]);

// Cells sit inside a ruled table, so the inputs drop their own frame.
const CELL_INPUT =
  "h-8 min-w-0 rounded-none border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-1 focus-visible:ring-inset disabled:cursor-default disabled:opacity-100";

export function OptitechGlassesCheckCard({ isEditing, readField, writeField, readBlock, exam }: Props) {
  const { t, i18n } = useTranslation();
  const [showExtra, setShowExtra] = React.useState(false);
  const surface = isEditing ? "bg-white dark:bg-background" : "bg-accent/50";
  const fieldClass = cn("h-8 min-w-0 text-xs disabled:cursor-default disabled:opacity-100", surface);

  const read = ({ component, field }: OptitechFieldRef) => {
    const value = readField(component, field);
    return value == null ? "" : String(value);
  };
  const write = ({ component, field }: OptitechFieldRef, value: string) => {
    writeField(component, field, value);
    // OptiTech's single Read column also feeds the prescription's ADD.
    if (component === "addition" && (field === "r_read" || field === "l_read")) {
      writeField("final-prescription", field === "r_read" ? "r_ad" : "l_ad", value);
    }
  };

  const cellInput = (column: Column, target: OptitechFieldRef, key: string) => {
    const value = read(target);
    if (column.kind === "base") {
      return (
        <FastSelect
          key={key}
          value={value}
          onChange={(next) => write(target, next)}
          disabled={!isEditing}
          options={[...BASE_VALUES_SIMPLE]}
          allowImportedValue
          size="xs"
          triggerClassName="h-8 w-full rounded-none border-0 bg-transparent text-xs shadow-none"
        />
      );
    }
    return (
      <FastInput
        key={key}
        type="text"
        dir="ltr"
        aria-label={`${column.label} ${key}`}
        value={displayCellValue(column, value)}
        onChange={(next) => write(target, column.kind === "acuity" ? storedAcuity(value, next) : next)}
        disabled={!isEditing}
        className={CELL_INPUT}
      />
    );
  };

  const displayCellValue = (column: Column, value: string) => {
    if (column.kind === "acuity") return isBareAcuityToken(value) ? `6/${value}` : value;
    return column.decimals == null ? value : formatOptitechNumber(value, column.decimals);
  };
  // OptiTech stores the 6/x denominator only; keep that shape when the user edits the shown "6/x".
  const storedAcuity = (previous: string, next: string) =>
    (previous === "" || isBareAcuityToken(previous)) && /^6\/[^/]+$/.test(next.trim()) ? next.trim().slice(2) : next;

  /** A ruled R/L table; columns with a combined value stack R, combined and L in one tall cell. */
  const renderTable = (columns: Column[]) => {
    const tallRows = hasCombinedRow(columns);
    return (
      <div dir="ltr" className="border-border overflow-hidden rounded-md border">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-7" />
            {columns.map((column) => <col key={column.key} />)}
          </colgroup>
          <thead>
            <tr className="bg-muted/60">
              <th className="border-border border-e" />
              {columns.map((column) => (
                <th key={column.key} className="border-border text-muted-foreground border-e py-1.5 font-semibold last:border-e-0">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={surface}>
            {(["R", "L"] as const).map((eye) => (
              <tr key={eye} className="border-border border-t">
                <th className="border-border bg-muted/60 border-e text-sm font-semibold">{eye}</th>
                {columns.map((column) => {
                  const fields = OPTITECH_GLASSES_FIELDS[column.key] as Record<string, OptitechFieldRef>;
                  if (fields.C) {
                    if (eye === "L") return null;
                    return (
                      <td key={column.key} rowSpan={2} className="border-border border-e p-0 align-middle last:border-e-0">
                        <div className="flex flex-col">
                          {cellInput(column, fields.R, `R-${column.key}`)}
                          {cellInput(column, fields.C, `C-${column.key}`)}
                          {cellInput(column, fields.L, `L-${column.key}`)}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={column.key} className={cn("border-border border-e p-0 last:border-e-0", tallRows && "h-12")}>
                      {cellInput(column, fields[eye], `${eye}-${column.key}`)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const single = (
    key: keyof typeof OPTITECH_GLASSES_SINGLE_FIELDS,
    options: { dir?: "ltr" | "auto"; format?: (value: string) => string } = {},
  ) => {
    const target = resolveSingleTarget(OPTITECH_GLASSES_SINGLE_FIELDS[key]);
    const raw = read(target);
    return (
      <FastInput
        type="text"
        dir={options.dir || "auto"}
        aria-label={t(`optitech.glassesCheck.${key}`)}
        value={options.format ? options.format(raw) : raw}
        onChange={(next) => write(target, next)}
        disabled={!isEditing}
        className={fieldClass}
      />
    );
  };

  // Older imports kept the NPC result under its source name "NPC"; read and edit it there.
  const resolveSingleTarget = (target: OptitechFieldRef): OptitechFieldRef =>
    target.field === "NPCR" && read(target) === "" && read({ ...target, field: "NPC" }) !== ""
      ? { ...target, field: "NPC" }
      : target;

  const framed = (target: OptitechFieldRef, ariaLabel: string) => (
    <FastInput
      type="text"
      dir="ltr"
      aria-label={ariaLabel}
      value={read(target)}
      onChange={(next) => write(target, next)}
      disabled={!isEditing}
      className={cn(fieldClass, "text-center")}
    />
  );

  const label = (key: string) => (
    <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">{t(`optitech.glassesCheck.${key}`)}:</span>
  );
  // Clinical abbreviations read the same in every locale, as on the OptiTech screen.
  const latinLabel = (text: string) => <span className="text-muted-foreground text-xs font-semibold whitespace-nowrap">{text}</span>;

  const extraFields = (["optitech-examination", "optitech-prescription"] as const).flatMap((component) =>
    optitechGlassesExtraFields(component, readBlock(component)).map((field) => ({ component, field })),
  );

  return (
    <Card className="examcard w-full border pt-3 pb-4" dir={i18n.dir()}>
      <CardContent className="@container space-y-3 px-4">
        <h3 className="text-muted-foreground text-center font-medium">{t("optitech.glassesCheck.title")}</h3>

        <div className="grid gap-4 @3xl:grid-cols-[minmax(14rem,1fr)_minmax(0,2.75fr)]">
          {/* Start column: exam details, notes and IOP, as on the OptiTech card's right side. */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
              {label("examDate")}
              <DateInput
                name="exam_date"
                value={exam?.examDate}
                onChange={exam?.onExamDateChange ?? (() => {})}
                disabled={!isEditing || !exam}
                className="h-8 w-full text-xs"
              />
              {label("recheckDate")}
              <DateInput
                name="optitech_recheck_date"
                value={read(OPTITECH_GLASSES_SINGLE_FIELDS.recheckDate) || undefined}
                onChange={(event) => write(OPTITECH_GLASSES_SINGLE_FIELDS.recheckDate, event.target.value)}
                disabled={!isEditing}
                className="h-8 w-full text-xs"
              />
              {label("examiner")}
              <UserSelect value={exam?.userId} disabled={!isEditing || !exam} onValueChange={(userId) => exam?.onUserChange(userId)} />
            </div>

            <div className="flex flex-1 flex-col gap-1">
              {label("notes")}
              <FastTextarea
                value={read(OPTITECH_GLASSES_NOTES_FIELD)}
                onChange={(next) => write(OPTITECH_GLASSES_NOTES_FIELD, next)}
                disabled={!isEditing}
                label={t("optitech.glassesCheck.notes")}
                className={cn("min-h-32 flex-1 resize-none text-sm disabled:cursor-default disabled:opacity-100", surface)}
              />
            </div>

            <fieldset className="border-border space-y-2 rounded-md border px-3 pt-0.5 pb-3">
              <legend className="text-primary px-1 text-xs font-semibold" dir="ltr">IOP</legend>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
                {label("iopDevice")}
                {single("iopDevice")}
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2" dir="ltr">
                {latinLabel("L-")}
                {framed(OPTITECH_GLASSES_FIELDS.iop.L, "IOP L")}
                {latinLabel("R-")}
                {framed(OPTITECH_GLASSES_FIELDS.iop.R, "IOP R")}
                {single("iopTime", { dir: "ltr", format: formatOptitechClockTime })}
                <span dir={i18n.dir()}>{label("iopTime")}</span>
              </div>
            </fieldset>
          </div>

          {/* End column: the prescription tables and the measurements under them. */}
          <div className="flex min-w-0 flex-col gap-3">
            <fieldset className="border-border space-y-2 rounded-md border px-3 pt-0.5 pb-3">
              <legend className="text-primary px-1 text-xs font-semibold">{t("optitech.glassesCheck.prescription")}</legend>
              {renderTable(RX_COLUMNS)}
              {renderTable(NEAR_COLUMNS)}
            </fieldset>

            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
              {label("amslerR")}
              {single("amslerR")}
              {label("amslerL")}
              {single("amslerL")}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                {label("dominantEye")}
                <Select dir={i18n.dir()} disabled={!isEditing || !exam} value={exam?.dominantEye || ""} onValueChange={(value) => exam?.onDominantEyeChange(value)}>
                  <SelectTrigger className="h-8 w-16 text-xs" aria-label={t("optitech.glassesCheck.dominantEye")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R">R</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2" dir="ltr">
                {latinLabel("NPC:")}
                <div className="w-24">{single("npc", { dir: "ltr" })}</div>
                {latinLabel("NPA: L-")}
                <div className="w-16">{single("npaL", { dir: "ltr" })}</div>
                {latinLabel("R-")}
                <div className="w-16">{single("npaR", { dir: "ltr" })}</div>
              </div>
            </div>

            <div className="grid grid-cols-[auto_minmax(0,2fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2" dir="ltr">
              {latinLabel("CT\\FD\\SC:")}
              {single("ctDist")}
              {latinLabel("CC:")}
              {single("ccDist")}
              {latinLabel("CT\\FN\\SC:")}
              {single("ctNear")}
              {latinLabel("CC:")}
              {single("ccNear")}
            </div>
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
                      value={read({ component, field })}
                      onChange={(next) => write({ component, field }, next)}
                      disabled={!isEditing}
                      className={fieldClass}
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

export default OptitechGlassesCheckCard;
