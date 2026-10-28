import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date";
import { UserSelect } from "@/components/ui/user-select";
import { FastInput, FastTextarea } from "./shared/OptimizedInputs";
import type { OptitechExamFields } from "./OptitechGlassesCheckCard";
import { formatOptitechNumber, isBareAcuityToken, OPTITECH_GLASSES_NOTES_FIELD, type OptitechFieldRef } from "@/lib/optitech-glasses-check";
import {
  OPTITECH_CONTACT_SINGLE_FIELDS,
  OPTITECH_KERATOMETRY_FIELDS,
  OPTITECH_LENS_FIELDS,
  OPTITECH_NONE_LABEL,
  isOptitechNoneCode,
  keratometryDerived,
  optitechContactExtraFields,
  resolveMiresField,
  type OptitechCell,
} from "@/lib/optitech-contact-check";
import { cn } from "@/utils/tailwind";

type Eye = "R" | "L";
type Column = {
  key: string;
  label: string;
  cell?: OptitechCell;
  decimals?: number;
  kind?: "acuity" | "code" | "text" | "derived" | "bc";
  wide?: boolean;
};

const K = OPTITECH_KERATOMETRY_FIELDS;
const L = OPTITECH_LENS_FIELDS;

const KERATOMETRY_COLUMNS: Column[] = [
  { key: "rH", label: "rH", cell: K.rH, decimals: 2 },
  { key: "rV", label: "rV", cell: K.rV, decimals: 2 },
  { key: "aver", label: "Aver", kind: "derived" },
  { key: "kCyl", label: "Cyl.", kind: "derived" },
  { key: "axH", label: "AxH", cell: K.axH },
  { key: "rT", label: "rT", cell: K.rT, decimals: 2 },
  { key: "rN", label: "rN", cell: K.rN, decimals: 2 },
  { key: "rI", label: "rI", cell: K.rI, decimals: 2 },
  { key: "rS", label: "rS", cell: K.rS, decimals: 2 },
  { key: "type", label: "Type", cell: K.type, kind: "text", wide: true },
  { key: "manufacturer", label: "Manuf/Imp", cell: K.manufacturer, kind: "text", wide: true },
  { key: "brand", label: "Brand", cell: K.brand, kind: "text", wide: true },
];

const LENS_COLUMNS: Column[] = [
  { key: "diam", label: "Diam", cell: L.diam, decimals: 1 },
  { key: "bc", label: "B.C", kind: "bc", wide: true },
  { key: "add", label: "Add.", cell: L.add, decimals: 2 },
  { key: "oz", label: "OZ", cell: L.oz },
  { key: "prism", label: "Pr.", cell: L.prism, kind: "code", wide: true },
  { key: "sph", label: "Sph.", cell: L.sph, decimals: 2 },
  { key: "cyl", label: "Cyl.", cell: L.cyl, decimals: 2 },
  { key: "ax", label: "Ax.", cell: L.ax },
  { key: "material", label: "Material", cell: L.material, kind: "text", wide: true },
  { key: "tint", label: "Tint", cell: L.tint, kind: "code", wide: true },
  { key: "va", label: "VA", cell: L.va, kind: "acuity" },
  { key: "ph", label: "PH", cell: L.ph },
];

interface Props {
  isEditing: boolean;
  readField: (component: string, field: string) => unknown;
  writeField: (component: string, field: string, value: string) => void;
  readBlock: (component: string) => Record<string, unknown> | undefined;
  exam?: OptitechExamFields;
}

const CELL_INPUT =
  "h-8 min-w-0 rounded-none border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-1 focus-visible:ring-inset disabled:cursor-default disabled:opacity-100";

export function OptitechContactCheckCard({ isEditing, readField, writeField, readBlock, exam }: Props) {
  const { t, i18n } = useTranslation();
  const [showExtra, setShowExtra] = React.useState(false);
  const surface = isEditing ? "bg-white dark:bg-background" : "bg-accent/50";
  const fieldClass = cn("h-8 min-w-0 text-xs disabled:cursor-default disabled:opacity-100", surface);

  const readRef = ({ component, field }: OptitechFieldRef) => {
    const value = readField(component, field);
    return value == null ? "" : String(value);
  };
  /** The first source that holds a value; edits go back to it, or to the canonical one when all are empty. */
  const resolve = (refs: OptitechFieldRef[]) => refs.find((target) => readRef(target) !== "") ?? refs[0];
  const read = (refs: OptitechFieldRef[]) => readRef(resolve(refs));
  const write = (refs: OptitechFieldRef[], value: string) => {
    const target = resolve(refs);
    writeField(target.component, target.field, value);
  };

  const display = (column: Column, value: string) => {
    if (column.kind === "acuity") return isBareAcuityToken(value) ? `6/${value}` : value;
    if (column.kind === "code") return isOptitechNoneCode(value) ? OPTITECH_NONE_LABEL : value;
    return column.decimals == null ? value : formatOptitechNumber(value, column.decimals);
  };
  const stored = (column: Column, previous: string, next: string) => {
    const text = next.trim();
    if (column.kind === "code" && text === OPTITECH_NONE_LABEL) return "0";
    // OptiTech keeps the 6/x denominator only; keep that shape when the shown "6/x" is edited.
    if (column.kind === "acuity" && (previous === "" || isBareAcuityToken(previous)) && /^6\/[^/]+$/.test(text)) return text.slice(2);
    return next;
  };

  const input = (column: Column, refs: OptitechFieldRef[], key: string, className = CELL_INPUT) => {
    const value = read(refs);
    return (
      <FastInput
        key={key}
        type="text"
        dir={column.kind === "text" || column.kind === "code" ? "auto" : "ltr"}
        aria-label={`${column.label} ${key}`}
        value={display(column, value)}
        onChange={(next) => write(refs, stored(column, value, next))}
        disabled={!isEditing}
        className={className}
      />
    );
  };

  const derivedValue = (column: Column, eye: Eye) => {
    const derived = keratometryDerived(read(K.rH[eye]), read(K.rV[eye]));
    return column.key === "aver" ? derived.average : derived.cylinder;
  };

  const cellContent = (column: Column, eye: Eye) => {
    if (column.kind === "derived") {
      // Calculated from rH/rV like OptiTech; never stored.
      return (
        <div className="text-muted-foreground flex h-8 items-center justify-center text-xs tabular-nums" aria-label={`${column.label} ${eye}`}>
          {derivedValue(column, eye)}
        </div>
      );
    }
    if (column.kind === "bc") {
      return (
        <div className="flex items-center" dir="ltr">
          {input({ ...column, decimals: 2 }, L.bc1[eye], `${eye}-bc1`)}
          <span className="text-muted-foreground text-xs">/</span>
          {input({ ...column, decimals: 2 }, L.bc2[eye], `${eye}-bc2`)}
        </div>
      );
    }
    return input(column, column.cell![eye], `${eye}-${column.key}`);
  };

  const renderTable = (columns: Column[]) => {
    const tallRows = columns.some((column) => column.cell?.C);
    return (
      <div dir="ltr" className="border-border overflow-hidden rounded-md border">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-7" />
            {columns.map((column) => <col key={column.key} className={column.wide ? "w-[11%]" : undefined} />)}
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
                  if (column.cell?.C) {
                    if (eye === "L") return null;
                    return (
                      <td key={column.key} rowSpan={2} className="border-border border-e p-0 align-middle last:border-e-0">
                        <div className="flex flex-col">
                          {input(column, column.cell.R, `R-${column.key}`)}
                          {input(column, column.cell.C, `C-${column.key}`)}
                          {input(column, column.cell.L, `L-${column.key}`)}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={column.key} className={cn("border-border border-e p-0 last:border-e-0", tallRows && "h-12", column.kind === "derived" && "bg-muted/30")}>
                      {cellContent(column, eye)}
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

  const field = (key: keyof typeof OPTITECH_CONTACT_SINGLE_FIELDS, options: { dir?: "ltr" | "auto"; code?: boolean; refs?: OptitechFieldRef[] } = {}) =>
    input(
      { key, label: t(`optitech.contactCheck.${key}`), kind: options.code ? "code" : options.dir === "ltr" ? undefined : "text" },
      options.refs ?? OPTITECH_CONTACT_SINGLE_FIELDS[key],
      key,
      cn(fieldClass, options.dir === "ltr" && "text-center"),
    );
  const label = (key: string) => (
    <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">{t(`optitech.contactCheck.${key}`)}:</span>
  );
  const latinLabel = (text: string) => <span className="text-muted-foreground text-xs font-semibold whitespace-nowrap">{text}</span>;
  // OptiTech lays these pairs out left to right as "L- … R- …".
  const eyePair = (right: keyof typeof OPTITECH_CONTACT_SINGLE_FIELDS, left: keyof typeof OPTITECH_CONTACT_SINGLE_FIELDS) => (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2" dir="ltr">
      {latinLabel("L-")}
      {field(left, { dir: "ltr" })}
      {latinLabel("R-")}
      {field(right, { dir: "ltr" })}
    </div>
  );

  const measurements = readBlock("optitech-contact-measurements");
  const miresRefs: OptitechFieldRef[] = [{ component: "optitech-contact-measurements", field: resolveMiresField(measurements) }];
  const extraFields = ([
    "optitech-contact-measurements", "optitech-examination", "contact-lens-exam", "contact-lens-details",
    "contact-lens-order", "contact-lens-diameters", "schirmer-test",
  ] as const).flatMap((component) =>
    optitechContactExtraFields(component, readBlock(component)).map((name) => ({ component, field: name })),
  );
  const recheck = OPTITECH_CONTACT_SINGLE_FIELDS.recheckDate;

  return (
    <Card className="examcard w-full border pt-3 pb-4" dir={i18n.dir()}>
      <CardContent className="@container space-y-3 px-4">
        <h3 className="text-muted-foreground text-center font-medium">{t("optitech.contactCheck.title")}</h3>

        {/* Header line: exam date, recheck date and examiner, as on the OptiTech screen. */}
        <div className="grid items-center gap-x-6 gap-y-2 @2xl:grid-cols-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            {label("examDate")}
            <DateInput name="exam_date" value={exam?.examDate} onChange={exam?.onExamDateChange ?? (() => {})} disabled={!isEditing || !exam} className="h-8 w-full text-xs" />
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            {label("recheckDate")}
            <DateInput
              name="optitech_contact_recheck_date"
              value={read(recheck) || undefined}
              onChange={(event) => write(recheck, event.target.value)}
              disabled={!isEditing}
              className="h-8 w-full text-xs"
            />
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            {label("examiner")}
            <UserSelect value={exam?.userId} disabled={!isEditing || !exam} onValueChange={(userId) => exam?.onUserChange(userId)} />
          </div>
        </div>

        <fieldset className="border-border space-y-2 rounded-md border px-3 pt-0.5 pb-3">
          <legend className="text-primary px-1 text-xs font-semibold">{t("optitech.contactCheck.lensExam")}</legend>
          <div className="space-y-1" dir="ltr">
            <span className="text-primary text-xs font-semibold" dir={i18n.dir()}>{t("optitech.contactCheck.keratometry")}</span>
            {renderTable(KERATOMETRY_COLUMNS)}
          </div>
          {renderTable(LENS_COLUMNS)}
        </fieldset>

        {/* Measurements in the OptiTech column order (right to left in Hebrew). */}
        <div className="grid gap-x-6 gap-y-2 @3xl:grid-cols-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] content-start items-center gap-x-3 gap-y-2">
            {label("pupilDiameter")}
            {field("pupilDiameter", { dir: "ltr" })}
            {label("cornealDiameter")}
            {field("cornealDiameter", { dir: "ltr" })}
            {label("eyelidAperture")}
            {field("eyelidAperture", { dir: "ltr" })}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] content-start items-center gap-x-3 gap-y-2">
            {label("schirmer")}
            {eyePair("schirmerR", "schirmerL")}
            {latinLabel("BUT:")}
            {eyePair("butR", "butL")}
            {label("eyeColor")}
            {field("eyeColor")}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] content-start items-center gap-x-3 gap-y-2">
            {label("blinkQuality")}
            {field("blinkQuality", { dir: "ltr" })}
            {label("blinkFrequency")}
            {field("blinkFrequency", { dir: "ltr" })}
            {label("mires")}
            {field("mires", { dir: "ltr", refs: miresRefs })}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] content-start items-center gap-x-3 gap-y-2">
            {label("cleaningSolution")}
            {field("cleaningSolution", { code: true })}
            {label("disinfectionSolution")}
            {field("disinfectionSolution", { code: true })}
            {label("rinsingSolution")}
            {field("rinsingSolution", { code: true })}
          </div>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3">
          <span className="pt-2">{label("notes")}</span>
          <FastTextarea
            value={readRef(OPTITECH_GLASSES_NOTES_FIELD)}
            onChange={(next) => writeField(OPTITECH_GLASSES_NOTES_FIELD.component, OPTITECH_GLASSES_NOTES_FIELD.field, next)}
            disabled={!isEditing}
            label={t("optitech.contactCheck.notes")}
            className={cn("min-h-20 resize-none text-sm disabled:cursor-default disabled:opacity-100", surface)}
          />
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
                {extraFields.map(({ component, field: name }) => (
                  <React.Fragment key={`${component}:${name}`}>
                    <span className="text-muted-foreground min-w-0 text-xs" title={name}>
                      {t(`optitech.fields.${name}`, { defaultValue: name })}
                    </span>
                    <FastInput
                      type="text"
                      dir="auto"
                      aria-label={name}
                      value={readRef({ component, field: name })}
                      onChange={(next) => writeField(component, name, next)}
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

export default OptitechContactCheckCard;
