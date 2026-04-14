import { ORDER_STATUS_OPTIONS } from "@/lib/order-status"
import { ROLE_LEVELS } from "@/lib/role-levels"

export const ALL_FILTER_VALUE = "all" as const

export type ClientGenderFilter = typeof ALL_FILTER_VALUE | "זכר" | "נקבה"
export type OrderKindFilter = typeof ALL_FILTER_VALUE | "regular" | "contact"
export type AppointmentDateScope = typeof ALL_FILTER_VALUE | "today" | "upcoming" | "past"
export type FileCategoryFilter =
  | typeof ALL_FILTER_VALUE
  | "image"
  | "document"
  | "video"
  | "audio"
  | "archive"
  | "other"
export type ExamLayoutTypeFilter = typeof ALL_FILTER_VALUE | "global" | "glass" | "contact lens"

export const GENDER_FILTER_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "הכל" },
  { value: "זכר", label: "זכר" },
  { value: "נקבה", label: "נקבה" },
] as const

export const ORDER_KIND_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "כל ההזמנות" },
  { value: "regular", label: "הזמנה רגילה" },
  { value: "contact", label: "עדשות מגע" },
] as const

export const ORDER_STATUS_FILTER_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "כל הסטטוסים" },
  ...ORDER_STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
] as const

export const APPOINTMENT_DATE_SCOPE_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "כל התאריכים" },
  { value: "today", label: "היום" },
  { value: "upcoming", label: "עתידיים" },
  { value: "past", label: "עבר" },
] as const

export const REFERRAL_URGENCY_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "כל הדחיפויות" },
  { value: "routine", label: "שגרתי" },
  { value: "urgent", label: "דחוף" },
  { value: "emergency", label: "חירום" },
] as const

export const FILE_CATEGORY_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "כל הקבצים" },
  { value: "image", label: "תמונות" },
  { value: "document", label: "מסמכים" },
  { value: "video", label: "וידאו" },
  { value: "audio", label: "אודיו" },
  { value: "archive", label: "ארכיון" },
  { value: "other", label: "אחר" },
] as const

export const USER_ROLE_FILTER_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "כל התפקידים" },
  { value: String(ROLE_LEVELS.worker), label: "עובד" },
  { value: String(ROLE_LEVELS.manager), label: "מנהל" },
  { value: String(ROLE_LEVELS.ceo), label: "מנכ״ל" },
] as const

export const USER_CLINIC_SCOPE_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "כל המרפאות" },
  { value: "current", label: "מרפאה נוכחית" },
] as const

export const EXAM_LAYOUT_TYPE_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "כל הסוגים" },
  { value: "global", label: "כללי" },
  { value: "glass", label: "משקפיים" },
  { value: "contact lens", label: "עדשות מגע" },
] as const

export function normalizeFileCategory(fileType?: string | null): FileCategoryFilter {
  if (!fileType) return "other"
  if (fileType.startsWith("image/")) return "image"
  if (fileType.startsWith("video/")) return "video"
  if (fileType.startsWith("audio/")) return "audio"
  if (
    fileType.includes("pdf") ||
    fileType.includes("word") ||
    fileType.includes("document") ||
    fileType.includes("excel") ||
    fileType.includes("spreadsheet") ||
    fileType.includes("presentation") ||
    fileType.includes("powerpoint") ||
    fileType.includes("text")
  ) {
    return "document"
  }
  if (fileType.includes("zip") || fileType.includes("rar") || fileType.includes("archive")) {
    return "archive"
  }
  return "other"
}
