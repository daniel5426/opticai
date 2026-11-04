import { optitechGlassesExtraFields, type OptitechFieldRef } from "./optitech-glasses-check"

export const OPTITECH_CONTACT_CHECK_TYPE = "optitech-contact-check" as const
export const OPTITECH_CONTACT_CHECK_CARD_ID = "optitech-contact-check-1"

const MEASUREMENTS = "optitech-contact-measurements"
const ref = (component: string, field: string): OptitechFieldRef => ({ component, field })
const eyes = (component: string, right: string, left: string) => ({ R: [ref(component, right)], L: [ref(component, left)] })

/**
 * A cell reads the first non-empty source; OptiTech values that phase 3 could not
 * resolve into a standard card stay on the measurements card under their source name.
 */
export type OptitechCell = { R: OptitechFieldRef[]; L: OptitechFieldRef[]; C?: OptitechFieldRef[] }

/** Keratometry row of the OptiTech "עדשות מגע" screen. */
export const OPTITECH_KERATOMETRY_FIELDS = {
  rH: eyes(MEASUREMENTS, "rHR", "rHL"),
  rV: eyes(MEASUREMENTS, "rVR", "rVL"),
  axH: eyes(MEASUREMENTS, "AxHR", "AxHL"),
  rT: eyes(MEASUREMENTS, "rTR", "rTL"),
  rN: eyes(MEASUREMENTS, "rNR", "rNL"),
  rI: eyes(MEASUREMENTS, "rIR", "rIL"),
  rS: eyes(MEASUREMENTS, "rSR", "rSL"),
  type: eyes("contact-lens-details", "r_lens_type", "l_lens_type"),
  manufacturer: eyes("contact-lens-details", "r_supplier", "l_supplier"),
  brand: eyes("contact-lens-details", "r_model", "l_model"),
} satisfies Record<string, OptitechCell>

/** Lens row of the same screen. */
export const OPTITECH_LENS_FIELDS = {
  diam: eyes("contact-lens-exam", "r_diam", "l_diam"),
  bc1: eyes("contact-lens-exam", "r_bc", "l_bc"),
  bc2: eyes(MEASUREMENTS, "BC2R", "BC2L"),
  add: eyes("contact-lens-exam", "r_read_ad", "l_read_ad"),
  oz: eyes("contact-lens-exam", "r_oz", "l_oz"),
  prism: eyes(MEASUREMENTS, "PrR", "PrL"),
  sph: eyes("contact-lens-exam", "r_sph", "l_sph"),
  cyl: eyes("contact-lens-exam", "r_cyl", "l_cyl"),
  ax: eyes("contact-lens-exam", "r_ax", "l_ax"),
  material: eyes("contact-lens-details", "r_material", "l_material"),
  tint: {
    R: [ref("contact-lens-details", "r_color"), ref(MEASUREMENTS, "TintR")],
    L: [ref("contact-lens-details", "l_color"), ref(MEASUREMENTS, "TintL")],
  },
  va: { ...eyes("contact-lens-exam", "r_va", "l_va"), C: [ref("contact-lens-exam", "comb_va")] },
  ph: eyes(MEASUREMENTS, "PHR", "PHL"),
} satisfies Record<string, OptitechCell>

export const OPTITECH_CONTACT_SINGLE_FIELDS = {
  pupilDiameter: [ref("contact-lens-diameters", "pupil_diameter")],
  cornealDiameter: [ref("contact-lens-diameters", "corneal_diameter")],
  eyelidAperture: [ref("contact-lens-diameters", "eyelid_aperture"), ref(MEASUREMENTS, "EyeLidKey")],
  schirmerR: [ref("schirmer-test", "r_mm")],
  schirmerL: [ref("schirmer-test", "l_mm")],
  butR: [ref("schirmer-test", "r_but")],
  butL: [ref("schirmer-test", "l_but")],
  eyeColor: [ref(MEASUREMENTS, "Ecolor")],
  blinkQuality: [ref(MEASUREMENTS, "BlinkQual")],
  blinkFrequency: [ref(MEASUREMENTS, "BlinkFreq")],
  mires: [ref(MEASUREMENTS, "Mires")],
  cleaningSolution: [ref("contact-lens-order", "cleaning_solution"), ref(MEASUREMENTS, "ClensSolCleanId")],
  disinfectionSolution: [ref("contact-lens-order", "disinfection_solution"), ref(MEASUREMENTS, "ClensSolDisinfectId")],
  rinsingSolution: [ref("contact-lens-order", "rinsing_solution"), ref(MEASUREMENTS, "ClensSolRinseId")],
  recheckDate: [ref("optitech-examination", "ReCheckDate")],
} satisfies Record<string, OptitechFieldRef[]>

/** Newer OptiTech versions add a mires column; its exact name varies, so match it by prefix. */
export function resolveMiresField(block: Record<string, unknown> | undefined) {
  return Object.keys(block || {}).find((field) => /^mire/i.test(field)) || "Mires"
}

const ABSORBED_CARDS = new Set([
  "schirmer-test:schirmer-test-1",
  "contact-lens-diameters:contact-lens-diameters-1",
  "contact-lens-details:contact-lens-details-1",
  "contact-lens-exam:contact-lens-exam-1",
  "contact-lens-order:contact-lens-order-1",
  "optitech-examination:optitech-examination-1",
  `${MEASUREMENTS}:${MEASUREMENTS}-1`,
  "notes:notes-1",
])

export function isOptitechContactExamData(data: Record<string, unknown>) {
  return MEASUREMENTS in data || ("optitech-examination" in data && "contact-lens-exam" in data)
}

/** Replaces the generic imported contact-lens cards with the single OptiTech-style card. */
export function applyOptitechContactCheckView<T extends { id: string; type: string }>(
  cardDefs: T[],
  data: Record<string, unknown>,
): T[] {
  if (!isOptitechContactExamData(data)) return cardDefs
  const kept = cardDefs.filter((card) => !ABSORBED_CARDS.has(`${card.type}:${card.id}`))
  return [{ id: OPTITECH_CONTACT_CHECK_CARD_ID, type: OPTITECH_CONTACT_CHECK_TYPE } as T, ...kept]
}

const BOUND = new Set(
  [
    ...Object.values(OPTITECH_KERATOMETRY_FIELDS).flatMap((cell) => [...cell.R, ...cell.L]),
    ...Object.values(OPTITECH_LENS_FIELDS).flatMap((cell: OptitechCell) => [...cell.R, ...cell.L, ...(cell.C || [])]),
    ...Object.values(OPTITECH_CONTACT_SINGLE_FIELDS).flat(),
  ].map(({ component, field }) => `${component}:${field}`),
)

/** Imported fields without a cell on the card, kept visible so nothing is lost. */
export function optitechContactExtraFields(component: string, block: Record<string, unknown> | undefined) {
  return optitechGlassesExtraFields(component, block).filter((field) =>
    !BOUND.has(`${component}:${field}`) && !(component === MEASUREMENTS && /^mire/i.test(field)) &&
    !(/(Tint|Pr|ClensSol\w*Id)$|^(Tint|Pr)[RL]$/.test(field) && String(block?.[field]).trim() === "0"),
  )
}

/** OptiTech stores "no selection" lookups as code 0 and shows them as [ללא]. */
export const OPTITECH_NONE_LABEL = "[ללא]"
export const isOptitechNoneCode = (value: string) => value.trim() === "0"

/** Average radius and corneal cylinder, derived like OptiTech (337.5 keratometric index). */
export function keratometryDerived(horizontal: string, vertical: string) {
  const h = Number(horizontal), v = Number(vertical)
  if (!horizontal.trim() || !vertical.trim() || !Number.isFinite(h) || !Number.isFinite(v) || h <= 0 || v <= 0) {
    return { average: "", cylinder: "" }
  }
  const cylinder = 337.5 / h - 337.5 / v
  return {
    average: ((h + v) / 2).toFixed(2),
    cylinder: `${cylinder > 0 ? "+" : ""}${cylinder.toFixed(2)}`,
  }
}
