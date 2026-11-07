/**
 * OpticSoft fields that have no place on Prysm's cards (imported SoftOptic exams only).
 * Each card id is one slot; values are stored as imported, because their codes are not documented.
 */

export type SoftopticDetailField = { label: string; field: string }
export type SoftopticDetailEyeRow = { label: string; r: string; l: string; comb?: string }
export type SoftopticDetailSlot = { title: string; eyeRows?: SoftopticDetailEyeRow[]; fields?: SoftopticDetailField[] }

const eyeRow = (label: string, name: string = label, comb?: string): SoftopticDetailEyeRow => ({
  label,
  r: `r_${name}`,
  l: `l_${name}`,
  ...(comb ? { comb } : {}),
})

const FITTING_FIELDS: SoftopticDetailField[] = ["pa", "bvd", "ffa", "df", "dn"].map((field) => ({ label: field, field }))
const OLD_REF_SLOT: SoftopticDetailSlot = {
  title: "oldRef",
  fields: [
    { label: "source", field: "source" },
    { label: "lens", field: "lens" },
    { label: "remark", field: "remark" },
    ...FITTING_FIELDS,
  ],
}

export const SOFTOPTIC_DETAIL_SLOTS: Record<string, SoftopticDetailSlot> = {
  anamnesa: {
    title: "anamnesa",
    fields: [
      { label: "contactLensNotes", field: "contact_lens_notes" },
      { label: "startedBefore", field: "started_before" },
      { label: "startedUnit", field: "started_unit" },
      { label: "stoppedBefore", field: "stopped_before" },
      { label: "stoppedUnit", field: "stopped_unit" },
      { label: "examRemark", field: "exam_remark" },
    ],
  },
  "old-ref-1": OLD_REF_SLOT,
  "old-ref-2": OLD_REF_SLOT,
  "old-ref-3": OLD_REF_SLOT,
  final: {
    title: "final",
    fields: [
      ...FITTING_FIELDS,
      { label: "testBoard", field: "test_board" },
      { label: "cmRead", field: "cm_read" },
      { label: "cmInt", field: "cm_int" },
      { label: "cmBif", field: "cm_bif" },
      { label: "cmMul", field: "cm_mul" },
    ],
  },
  subjective: {
    title: "subjective",
    eyeRows: [eyeRow("fa", "fa", "comb_fa"), eyeRow("faTuning", "fa_tuning", "comb_fa_tuning")],
    fields: [{ label: "remark", field: "remark" }],
  },
  bino: { title: "bino", fields: [{ label: "remark", field: "remark" }] },
  fundus: {
    title: "fundus",
    eyeRows: [eyeRow("macula"), eyeRow("blood"), eyeRow("disc"), eyeRow("pupil"), eyeRow("amsler")],
    fields: [
      { label: "ishiharaTest", field: "ishihara_test" },
      { label: "ishiharaRemark", field: "ishihara_rem" },
      { label: "sightField", field: "sight_field" },
    ],
  },
  bio: {
    title: "bio",
    eyeRows: [
      eyeRow("iop"),
      eyeRow("cornea"),
      eyeRow("lens"),
      eyeRow("tear"),
      eyeRow("limbus"),
      eyeRow("upperLid", "upper_lid"),
      eyeRow("lowerLid", "lower_lid"),
      eyeRow("schirmer"),
    ],
    fields: [
      { label: "eyeColor", field: "eye_color" },
      { label: "eyelidTension", field: "eyelid_tension" },
    ],
  },
}
