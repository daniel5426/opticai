import { optitechGlassesExtraFields } from "./optitech-glasses-check"

export const OPTITECH_VISION_CHECK_TYPE = "optitech-vision-check" as const
export const OPTITECH_VISION_CHECK_CARD_ID = "optitech-vision-check-1"

const ACCOMMODATION = "optitech-accommodation"
const BINOCULAR = "optitech-binocular"

/** How a value is shown: whole diopters ("2D"), two decimals with a unit ("4.00 cpm"), or text with a unit. */
export type VisionFormat = { decimals?: number; unit?: string; compactUnit?: boolean }

export type VisionRow =
  | { kind: "section"; label: string }
  | { kind: "group"; label: string; note?: string }
  | { kind: "test"; label: string; expected?: string; deviation?: string; component: string; field: string; format?: VisionFormat; indent?: boolean }

const DIOPTERS: VisionFormat = { decimals: 2, unit: "D", compactUnit: true }
const WHOLE_DIOPTERS: VisionFormat = { unit: "D", compactUnit: true }
const CPM: VisionFormat = { decimals: 2, unit: "cpm" }
const EXO: VisionFormat = { unit: "exo" }

const test = (
  label: string, expected: string | undefined, deviation: string | undefined, component: string, field: string,
  format?: VisionFormat, indent = true,
): VisionRow => ({ kind: "test", label, expected, deviation, component, field, format, indent })

/**
 * The OptiTech "תפקודי ראייה" flowsheet (tblCrdDisDiags), row for row in its scroll order,
 * with the expected findings and standard deviations OptiTech prints beside each test.
 */
export const OPTITECH_VISION_ROWS: VisionRow[] = [
  { kind: "section", label: "Accommodative Findings" },
  { kind: "group", label: "Amplitude of Accommodation" },
  test("Push Up", "15-1/4 (age)", "2D", ACCOMMODATION, "PushUp", WHOLE_DIOPTERS),
  test("Minus Lens", "2D less than push up", undefined, ACCOMMODATION, "MinusLens", WHOLE_DIOPTERS),
  { kind: "group", label: "Monocular Accom Facility", note: "+/-2.00 calling out letters or numbers" },
  test("6 y.o", "5.5 cpm", "2.5 cpm", ACCOMMODATION, "MonAccFac6", CPM),
  test("7 y.o", "6.5 cpm", "2 cpm", ACCOMMODATION, "MonAccFac7", CPM),
  test("8-12 y.o", "7 cpm", "2.5 cpm", ACCOMMODATION, "MonAccFac8", CPM),
  test("13-30 y.o", "11 cpm", "5 cpm", ACCOMMODATION, "MonAccFac13", CPM),
  { kind: "group", label: "Binocular Accom Facility" },
  test("6 y.o", "3 cpm", "2.5 cpm", ACCOMMODATION, "BinAccFac6", CPM),
  test("7 y.o", "3.5 cpm", "2.5 cpm", ACCOMMODATION, "BinAccFac7", CPM),
  test("8 y.o", "5 cpm", "2.5 cpm", ACCOMMODATION, "BinAccFac8", CPM),
  test("13-40 y.o", "8 cpm", "5 cpm", ACCOMMODATION, "BinAccFac13", CPM),
  test("MEM Retinoscopy", "+0.50", "+0.25D", ACCOMMODATION, "MEMRet", DIOPTERS, false),
  test("Fused X-Cylinder", "+0.50", "+0.50D", ACCOMMODATION, "FusedXCyl", DIOPTERS, false),
  test("NRA", "+2.00", "+0.50", ACCOMMODATION, "NRA", DIOPTERS, false),
  test("PRA", "-2.37", "-1.00", ACCOMMODATION, "PRA", DIOPTERS, false),
  { kind: "section", label: "Binocular Vision Findings" },
  { kind: "group", label: "Cover Test" },
  test("Distance (6M)", "1 exo", "2 pd", BINOCULAR, "CoverDist", EXO),
  test("Near (40 cm)", "3 exo", "3 pd", BINOCULAR, "CoverNear", EXO),
  test("Distance Lateral Phoria", "1 exo", "2 pd", BINOCULAR, "DistLatFor", EXO, false),
  test("Distance Vertical Phoria", "1 pd", undefined, BINOCULAR, "DistVerFor", EXO, false),
  test("Near Lateral Phoria", "3 exo", "3 pd", BINOCULAR, "NearLatFor", EXO, false),
  test("Near Vertical Phoria", "1 pd", undefined, BINOCULAR, "NearVerFor", EXO, false),
  test("AC/A ratio", "4/1", "2 pd", BINOCULAR, "ACARatio", undefined, false),
  { kind: "group", label: "Smooth Vergence", note: "blur/break/recovery" },
  test("BO (6M)", "9/19/10", "4/8/4", BINOCULAR, "SmverBo6M"),
  test("BI (6M)", "x/7/4", "x/3/2", BINOCULAR, "SmverBi6M"),
  test("BO (40cm)", "17/21/11", "5/6/7", BINOCULAR, "SmverBo40CM"),
  test("BI (40cm)", "13/21/13", "4/4/5", BINOCULAR, "SmverBi40CM"),
  { kind: "group", label: "Step Vergence", note: "break/recovery" },
  test("Children 7-12, BO (40cm)", "23/16", "8/6", BINOCULAR, "StverBo7"),
  test("BI (40cm)", "12/7", "5/4", BINOCULAR, "StverBi7"),
  test("Adults BO (6M)", "11/7", "7/2", BINOCULAR, "StverBo6M"),
  test("BI (6M)", "7/4", "3/2", BINOCULAR, "StverBi6M"),
  test("BO (40cm)", "19/14", "9/7", BINOCULAR, "StverBo40CM"),
  test("BI (40cm)", "13/10", "6/5", BINOCULAR, "StverBi40CM"),
  { kind: "group", label: "Jump Vergence", note: "16 BO/ 4 BI" },
  test("Children 5-7 y.o", "2.5 cpm", "1 cpm", BINOCULAR, "JmpVer5", CPM),
  test("8-14 y.o", "6 cpm", "1 cpm", BINOCULAR, "JmpVer8", CPM),
  { kind: "group", label: "Near-Point of Convergence", note: "break/recovery" },
  test("Accommodative target", "2.5/4.5 cm", "2.5/3.0 cm", BINOCULAR, "AccTarget"),
  test("Penlight", "3.0/5.0 cm", "4.0/5.0 cm", BINOCULAR, "Penlight"),
  test("Penlight & Red Green lenses", "3.0/5.0 cm", "4.0/5.0 cm", BINOCULAR, "PenLightRG"),
]

export const OPTITECH_VISION_SUMMARY = { component: BINOCULAR, field: "Summary" }
export const OPTITECH_VISION_COMPONENTS = [ACCOMMODATION, BINOCULAR] as const

/** Phase 3 matched accommodation fields case-insensitively (e.g. MEMRet); read them the same way. */
export function readVisionField(block: Record<string, unknown> | undefined, field: string) {
  if (!block) return { field, value: "" }
  const key = field in block ? field : Object.keys(block).find((name) => name.toLowerCase() === field.toLowerCase()) ?? field
  const value = block[key]
  return { field: key, value: value == null ? "" : String(value) }
}

export function formatVisionValue(value: string, format?: VisionFormat) {
  const text = value.trim()
  if (!text || !format) return text
  const numeric = /^[-+]?\d+(?:\.\d+)?$/.test(text)
  return numeric && format.decimals != null ? Number(text).toFixed(format.decimals) : text
}

const ABSORBED_CARDS = new Set([`${ACCOMMODATION}:${ACCOMMODATION}-1`, `${BINOCULAR}:${BINOCULAR}-1`])

export function isOptitechVisionExamData(data: Record<string, unknown>) {
  return (ACCOMMODATION in data || BINOCULAR in data) &&
    !Object.keys(data).some((key) => key === "final-prescription" || key.startsWith("contact-lens-"))
}

/** Replaces the generic accommodation/binocular cards with the single OptiTech flowsheet card. */
export function applyOptitechVisionCheckView<T extends { id: string; type: string }>(
  cardDefs: T[],
  data: Record<string, unknown>,
): T[] {
  if (!isOptitechVisionExamData(data)) return cardDefs
  const kept = cardDefs.filter((card) => !ABSORBED_CARDS.has(`${card.type}:${card.id}`))
  return [{ id: OPTITECH_VISION_CHECK_CARD_ID, type: OPTITECH_VISION_CHECK_TYPE } as T, ...kept]
}

const BOUND = new Set(
  OPTITECH_VISION_ROWS.flatMap((row) => (row.kind === "test" ? [`${row.component}:${row.field.toLowerCase()}`] : []))
    .concat(`${BINOCULAR}:summary`),
)

/** Source fields without a row (e.g. a column from a newer OptiTech), kept visible so nothing is lost. */
export function optitechVisionExtraFields(component: string, block: Record<string, unknown> | undefined) {
  return optitechGlassesExtraFields(component, block).filter((field) => !BOUND.has(`${component}:${field.toLowerCase()}`))
}

/** The vision blocks of an exam's page data, wherever its layout instances keep them. */
export function visionBlocksFromPageData(pageData: any): Record<string, Record<string, unknown>> {
  const blocks: Record<string, Record<string, unknown>> = {}
  for (const entry of pageData?.instances || []) {
    for (const component of OPTITECH_VISION_COMPONENTS) {
      const block = entry?.exam_data?.[component]
      if (block && typeof block === "object" && !blocks[component]) blocks[component] = block
    }
  }
  return blocks
}
