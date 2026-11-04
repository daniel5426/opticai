export const OPTITECH_GLASSES_CHECK_TYPE = "optitech-glasses-check" as const
export const OPTITECH_GLASSES_CHECK_CARD_ID = "optitech-glasses-check-1"

export type OptitechFieldRef = { component: string; field: string }

const ref = (component: string, field: string): OptitechFieldRef => ({ component, field })

/** Fields of the OptiTech "משקפיים" screen, in the order the original card shows them. */
export const OPTITECH_GLASSES_FIELDS = {
  fv: { R: ref("uncorrected-va", "r_fv"), L: ref("uncorrected-va", "l_fv") },
  sph: { R: ref("final-prescription", "r_sph"), L: ref("final-prescription", "l_sph") },
  cyl: { R: ref("final-prescription", "r_cyl"), L: ref("final-prescription", "l_cyl") },
  ax: { R: ref("final-prescription", "r_ax"), L: ref("final-prescription", "l_ax") },
  pris: { R: ref("final-prescription", "r_pris"), L: ref("final-prescription", "l_pris") },
  base: { R: ref("final-prescription", "r_base"), L: ref("final-prescription", "l_base") },
  va: { R: ref("final-prescription", "r_va"), L: ref("final-prescription", "l_va"), C: ref("final-prescription", "comb_va") },
  ph: { R: ref("optitech-prescription", "PHR"), L: ref("optitech-prescription", "PHL") },
  read: { R: ref("addition", "r_read"), L: ref("addition", "l_read") },
  int: { R: ref("addition", "r_int"), L: ref("addition", "l_int") },
  bif: { R: ref("addition", "r_bif"), L: ref("addition", "l_bif") },
  mul: { R: ref("addition", "r_mul"), L: ref("addition", "l_mul") },
  high: { R: ref("final-prescription", "r_high"), L: ref("final-prescription", "l_high") },
  j: { R: ref("addition", "r_j"), L: ref("addition", "l_j") },
  addPris: { R: ref("optitech-prescription", "AddPrisR"), L: ref("optitech-prescription", "AddPrisL") },
  addBase: { R: ref("optitech-prescription", "AddBaseR"), L: ref("optitech-prescription", "AddBaseL") },
  pdDist: { R: ref("final-prescription", "r_pd_far"), L: ref("final-prescription", "l_pd_far"), C: ref("final-prescription", "comb_pd_far") },
  pdRead: { R: ref("final-prescription", "r_pd_close"), L: ref("final-prescription", "l_pd_close"), C: ref("final-prescription", "comb_pd_close") },
  iop: { R: ref("addition", "r_iop"), L: ref("addition", "l_iop") },
} satisfies Record<string, { R: OptitechFieldRef; L: OptitechFieldRef; C?: OptitechFieldRef }>

export const OPTITECH_GLASSES_SINGLE_FIELDS = {
  amslerR: ref("optitech-examination", "AmslerR"),
  amslerL: ref("optitech-examination", "AmslerL"),
  npc: ref("optitech-examination", "NPCR"),
  npaL: ref("optitech-examination", "NPAL"),
  npaR: ref("optitech-examination", "NPAR"),
  ctDist: ref("optitech-examination", "CTD"),
  ccDist: ref("optitech-examination", "CCD"),
  ctNear: ref("optitech-examination", "CTN"),
  ccNear: ref("optitech-examination", "CCN"),
  iopDevice: ref("optitech-examination", "IOPInstId"),
  iopTime: ref("optitech-examination", "IOPTime"),
  recheckDate: ref("optitech-examination", "ReCheckDate"),
} satisfies Record<string, OptitechFieldRef>

/** The exam notes; the OptiTech card shows them beside the exam details. */
export const OPTITECH_GLASSES_NOTES_FIELD = ref("notes", "note")

/** Cards whose content the OptiTech glasses card shows in full, so the all-data view drops them. */
const ABSORBED_CARDS = new Set([
  "uncorrected-va:uncorrected-va-1",
  "final-prescription:final-prescription-1",
  "addition:addition-1",
  "optitech-examination:optitech-examination-1",
  "optitech-prescription:optitech-prescription-1",
  "notes:notes-1",
])

/** OptiTech glasses checks carry the migration cards next to the standard prescription cards. */
export function isOptitechGlassesExamData(data: Record<string, unknown>) {
  const keys = Object.keys(data)
  const hasOptitech = keys.some((key) => key === "optitech-examination" || key === "optitech-prescription")
  const hasGlasses = keys.some((key) => key === "final-prescription" || key === "addition" || key === "uncorrected-va")
  const hasContactLens = keys.some((key) => key.startsWith("contact-lens-"))
  return hasOptitech && hasGlasses && !hasContactLens
}

/** Replaces the generic imported cards with the single OptiTech-style card, keeping every other card. */
export function applyOptitechGlassesCheckView<T extends { id: string; type: string }>(
  cardDefs: T[],
  data: Record<string, unknown>,
): T[] {
  if (!isOptitechGlassesExamData(data)) return cardDefs
  const kept = cardDefs.filter((card) => {
    if (ABSORBED_CARDS.has(`${card.type}:${card.id}`)) return false
    // Previous-refraction leftovers often hold only "no base" codes; they carry no information.
    if (card.type !== "optitech-prescription") return true
    const block = (data[`${card.type}-${card.id}`] ?? data[card.type]) as Record<string, unknown> | undefined
    return optitechGlassesExtraFields(card.type, block).length > 0
  })
  return [{ id: OPTITECH_GLASSES_CHECK_CARD_ID, type: OPTITECH_GLASSES_CHECK_TYPE } as T, ...kept]
}

const BOUND_FIELDS = new Set(
  [
    ...Object.values(OPTITECH_GLASSES_FIELDS).flatMap((eyes) => Object.values(eyes)),
    ...Object.values(OPTITECH_GLASSES_SINGLE_FIELDS),
    ref("optitech-examination", "NPC"),
    ref("optitech-examination", "IOPR"),
    ref("optitech-examination", "IOPL"),
    ref("optitech-prescription", "VAR"),
    ref("optitech-prescription", "VAL"),
    ref("optitech-prescription", "VA"),
    ref("optitech-prescription", "HighR"),
    ref("optitech-prescription", "HighL"),
  ].map(({ component, field }) => `${component}:${field}`),
)
const METADATA_FIELDS = new Set(["id", "tab_index", "layout_instance_id", "source_layout_instance_id", "card_instance_id", "card_id", "bindings", "source_section", "source_table", "source_provenance", "source_labels", "title"])

/** Imported fields the card has no dedicated cell for; empty "no base" codes are dropped as noise. */
export function optitechGlassesExtraFields(component: string, block: Record<string, unknown> | undefined) {
  if (!block) return []
  return Object.entries(block)
    .filter(([field, value]) => {
      if (METADATA_FIELDS.has(field) || field.startsWith("__") || BOUND_FIELDS.has(`${component}:${field}`)) return false
      if (typeof value !== "string" && typeof value !== "number") return false
      const text = String(value).trim()
      return text !== "" && !(text === "0" && /Base|RetTypeId|RetDistId/.test(field))
    })
    .map(([field]) => field)
}

/** OptiTech shows powers with two decimals and PD with one; text tokens stay as typed. */
export function formatOptitechNumber(value: string, decimals: number) {
  const text = value.trim()
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(text)) return value
  return Number(text).toFixed(decimals)
}

/** OptiTech keeps VA/FV/PH as the denominator of a 6/x value. */
export function isBareAcuityToken(value: unknown) {
  const text = String(value ?? "").trim()
  return text !== "" && /^\d/.test(text) && !text.includes("/")
}

/** Access time-only values arrive as "12/30/99 23:33:00"; the clock time is what OptiTech shows. */
export function formatOptitechClockTime(value: unknown) {
  const text = String(value ?? "")
  const match = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*$/)
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : text
}
