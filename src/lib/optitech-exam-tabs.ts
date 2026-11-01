import type { OpticalExam } from "@/lib/db/schema-interface"

/** The OptiTech client-card tabs, in their original order, and the exam each migrated table became. */
export const OPTITECH_EXAM_KINDS = [
  { key: "glasses", testName: "OptiTech Glasses Exam" }, // tblCrdGlassChecks
  { key: "contact", testName: "OptiTech Contact Lens Exam" }, // tblCrdClensChecks
  { key: "review", testName: "OptiTech review" }, // tblCrdOverViews
  { key: "diagnosis", testName: "OptiTech clinical-health" }, // tblCrdClinicChecks
  { key: "vision", testName: "OptiTech vision" }, // tblCrdDisDiags
] as const

export type OptitechExamKind = (typeof OPTITECH_EXAM_KINDS)[number]["key"]

export const optitechExamKind = (exam?: Pick<OpticalExam, "test_name"> | null): OptitechExamKind | null =>
  OPTITECH_EXAM_KINDS.find((kind) => kind.testName === exam?.test_name)?.key ?? null

const byDateThenId = (a: OpticalExam, b: OpticalExam) =>
  String(a.exam_date || "").localeCompare(String(b.exam_date || "")) || (a.id || 0) - (b.id || 0)

/** The client's imported exams of each kind, oldest first, as OptiTech pages through them. */
export function groupOptitechExams(exams: OpticalExam[]) {
  const groups = Object.fromEntries(OPTITECH_EXAM_KINDS.map((kind) => [kind.key, [] as OpticalExam[]])) as Record<OptitechExamKind, OpticalExam[]>
  for (const exam of exams) {
    const kind = optitechExamKind(exam)
    if (kind) groups[kind].push(exam)
  }
  for (const kind of OPTITECH_EXAM_KINDS) groups[kind.key].sort(byDateThenId)
  return groups
}

/** Opening another tab lands on that kind's exam from the same visit, else its latest one. */
export function pickExamForTab(candidates: OpticalExam[], currentDate?: string | null) {
  if (candidates.length === 0) return undefined
  const sameVisit = candidates.filter((exam) => exam.exam_date && exam.exam_date === currentDate)
  return (sameVisit.length ? sameVisit : candidates).at(-1)
}
