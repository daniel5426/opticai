import i18n from "@/localization/i18n";
import type { ContactOrderPrintModel, OrderExportKind, RegularOrderPrintModel } from "./types";

/**
 * The printed order: a light one-page form with hairlines instead of boxes, showing only what the order holds.
 * One description drives both the print (HTML) and the Word export, so the two always match.
 */
export type FormValue = string | string[] | undefined | null;
export type FormPair = [string, FormValue];

export type FormBlock =
  /** Label/value pairs, three to a row; optionally headed by the client's name. */
  | { type: "info"; name?: string; pairs: FormPair[] }
  /**
   * A titled table; with `eyes`, one row each for R and L, laid out left to right as prescriptions are read.
   * `defaults` are columns holding a default value (frame supplied by, lens quantity) that alone don't make the table worth printing.
   * Columns without a value are left out, unless `allColumns` (prescriptions keep their fixed order).
   */
  | { type: "grid"; title: string; labels: string[]; rows: FormValue[][]; eyes?: boolean; widths?: number[]; defaults?: number[]; allColumns?: boolean }
  | { type: "notes"; notes: FormPair[] }
  /** The totals, on one line. */
  | { type: "charges"; pairs: FormPair[] };

export interface OrderForm {
  title: string;
  number: string;
  clinic: string;
  printDate: string;
  blocks: FormBlock[];
}

type OrderData = RegularOrderPrintModel | ContactOrderPrintModel;

function printDate() {
  const today = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(today.getDate())}.${pad(today.getMonth() + 1)}.${today.getFullYear()}`;
}

const phones = (data: OrderData) => [data.phone_home, data.phone_work, data.phone_mobile].filter(Boolean);

const clientBox = (data: OrderData): FormBlock => ({
  type: "info",
  name: data.client_name,
  pairs: [["ת.ז", data.client_id], ["טלפונים", phones(data)], ["כתובת", data.client_address]],
});

function itemsGrid(data: OrderData): FormBlock[] {
  const rows = data.line_items_rows?.filter((row) => row.line_index);
  if (!rows?.length) return [];
  return [{
    type: "grid",
    title: i18n.t("orderGroupBillingItems"),
    labels: [i18n.t("orderGroupDescription"), "כמות", "מחיר", i18n.t("orderGroupAmount")],
    rows: rows.map((row) => [row.line_description, row.line_quantity, row.line_price, row.line_total]),
    widths: [55, 15, 15, 15],
    allColumns: true,
  }];
}

function bottom(data: OrderData, includeBilling: boolean): FormBlock[] {
  return [
    ...(includeBilling ? [...itemsGrid(data), {
      type: "charges" as const,
      pairs: [['סה"כ', data.total_price], ["התקבל", data.amount_paid], ["יתרה", data.balance_due], ["סטטוס תשלום", data.payment_status]] as FormPair[],
    }] : []),
    { type: "notes", notes: [["הערות קליניות", data.clinic_notes], ["הערות לספק", data.supplier_notes]] },
  ];
}

function regularForm(data: RegularOrderPrintModel, includeBilling: boolean): FormBlock[] {
  // Size is lens width and bridge; the temple length is left out of the form.
  const frameSize = [data.frame_width, data.frame_bridge].filter(Boolean).join("-");
  return [
    clientBox(data),
    {
      type: "info",
      pairs: [
        ["תאריך", data.order_date], ["שם הבודק", data.optician_name],
        ["סוג", data.lens_tab_type], ["יועץ", data.advisor_name],
        ["מס' שקית", data.bag_number], ["אספקה בסניף", data.delivery_clinic_name],
        ["תאריך אישור", data.approval_date],
      ],
    },
    {
      type: "grid",
      title: "מרשם",
      allColumns: true,
      eyes: true,
      labels: [data.sph_with_add ? "SPH +ADD" : "SPH", "CYL", "AX", "PRISM", "BASE", "ADD", "PD FAR", "PD NEAR", "גובה"],
      rows: [
        [data.r_sph, data.r_cyl, data.r_ax, data.r_pris, data.r_base, data.r_add, data.r_pd, data.r_pd_close, data.r_high],
        [data.l_sph, data.l_cyl, data.l_ax, data.l_pris, data.l_base, data.l_add, data.l_pd, data.l_pd_close, data.l_high],
      ],
    },
    {
      type: "grid",
      title: "עדשות",
      eyes: true,
      labels: ["דגם", "ספק", "חומר", "ציפוי", "צבע", "קוטר"],
      rows: [
        [data.r_lens_model, data.r_lens_supplier, data.r_lens_material, data.r_lens_coating, data.r_lens_color, data.r_lens_diameter],
        [data.l_lens_model, data.l_lens_supplier, data.l_lens_material, data.l_lens_coating, data.l_lens_color, data.l_lens_diameter],
      ],
    },
    {
      type: "grid",
      title: "מסגרת",
      labels: ["ספק", "מותג", "דגם", "צבע", "גודל", "גובה", 'סופק ע"י'],
      defaults: [6],
      rows: [[data.frame_supplier, data.frame_brand, data.frame_model, data.frame_color, frameSize, data.frame_height, data.frame_supplied_by]],
    },
    ...bottom(data, includeBilling),
  ];
}

function contactForm(data: ContactOrderPrintModel, includeBilling: boolean): FormBlock[] {
  return [
    clientBox(data),
    {
      type: "info",
      pairs: [
        ["תאריך", data.order_date], ["שם הבודק", data.optician_name],
        ["יועץ", data.advisor_name], ["אספקה בסניף", data.supply_clinic_name],
        ["תאריך אישור", data.approval_date],
      ],
    },
    {
      type: "grid",
      title: "עדשות",
      eyes: true,
      labels: ["סוג", "דגם", "ספק", "חומר", "צבע", "כמות"],
      defaults: [5],
      rows: [
        [data.r_lens_type, data.r_model, data.r_supplier, data.r_material, data.r_color, data.r_quantity],
        [data.l_lens_type, data.l_model, data.l_supplier, data.l_material, data.l_color, data.l_quantity],
      ],
    },
    {
      type: "grid",
      title: "מרשם",
      allColumns: true,
      eyes: true,
      labels: ["BC", "OZ", "DIAM", "SPH", "CYL", "AX", "READ", "VA", "J"],
      rows: [
        [data.r_bc, data.r_oz, data.r_diam, data.r_sph, data.r_cyl, data.r_ax, data.r_read_add, data.r_va, data.r_j],
        [data.l_bc, data.l_oz, data.l_diam, data.l_sph, data.l_cyl, data.l_ax, data.l_read_add, data.l_va, data.l_j],
      ],
    },
    {
      type: "info",
      pairs: [
        ["תמיסת ניקוי", data.cleaning_solution], ["תמיסת חיטוי", data.disinfection_solution],
        ["תמיסת שטיפה", data.rinsing_solution],
      ],
    },
    ...bottom(data, includeBilling),
  ];
}

const hasValue = (value: FormValue): boolean =>
  Array.isArray(value) ? value.some(hasValue) : String(value ?? "").replace(/[\u200e\u200f]/g, "").trim() !== "";

/** A block without its empty pairs and columns; null when nothing is left to show. */
function trimmed(block: FormBlock): FormBlock | null {
  if (block.type === "notes") {
    const notes = block.notes.filter(([, value]) => hasValue(value));
    return notes.length ? { ...block, notes } : null;
  }
  if (block.type === "charges") return block;
  if (block.type === "info") {
    const pairs = block.pairs.filter(([, value]) => hasValue(value));
    return block.name || pairs.length ? { ...block, pairs } : null;
  }
  const filled = block.labels.map((_, index) => block.rows.some((row) => hasValue(row[index])));
  if (!filled.some((value, index) => value && !block.defaults?.includes(index))) return null;
  if (block.allColumns) return block;
  const keep = <T,>(items: T[]) => items.filter((_, index) => filled[index]);
  return { ...block, labels: keep(block.labels), rows: block.rows.map(keep) };
}

export function buildOrderForm(kind: OrderExportKind, data: OrderData, includeBilling = true): OrderForm {
  const blocks = kind === "contact"
    ? contactForm(data as ContactOrderPrintModel, includeBilling)
    : regularForm(data as RegularOrderPrintModel, includeBilling);
  return {
    title: kind === "contact" ? "הזמנת עדשות מגע" : "הזמנת משקפיים",
    number: data.order_number,
    clinic: data.clinic_info || data.clinic_name,
    printDate: printDate(),
    blocks: blocks.flatMap((block) => trimmed(block) ?? []),
  };
}
