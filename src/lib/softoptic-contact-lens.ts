import type { ContactLensExam, ContactLensOrderEntity } from "@/lib/db/schema-interface"

const CONTACT_LENS_SCREEN_BLOCKS = ["contact-lens-exam", "keratometer-contact-lens", "contact-lens-details"]

/** The client's contact lens orders from the exam's day that carry OpticSoft's prescription screen. */
export function sameDayContactLensOrders(orders: ContactLensOrderEntity[], examDate?: string | null) {
  const day = examDate?.slice(0, 10)
  if (!day) return []
  return orders.filter(
    (order) =>
      order.order_date?.slice(0, 10) === day &&
      CONTACT_LENS_SCREEN_BLOCKS.some((block) => order.order_data?.[block]),
  )
}

const bareVa = /^\d+(?:\.\d+)?(?:[+-]{1,2}\d*)?$/

function displayedVa(value: unknown) {
  if (typeof value !== "string" || !bareVa.test(value)) return value
  const number = value.match(/^\d+(?:\.\d+)?/)![0]
  const denominator = Number(number)
  // Match the importer: decimal VA (e.g. 0.5 or 1.0+2) is already a display value.
  if (number.includes(".") ? denominator < 3 || denominator > 190 : denominator < 1) return value
  return `6/${value}`
}

/**
 * Older SoftOptic imports stored the screen's values as OpticSoft keeps them: BC without its point (84 is 8.4),
 * VA without its "6/" and J without its "J". Shown as OpticSoft shows them; the stored order is unchanged.
 */
export function softopticContactLensExam(exam: Record<string, any> | undefined): ContactLensExam {
  if (!exam) return {} as ContactLensExam
  const shown: Record<string, any> = { ...exam }
  for (const eye of ["r", "l"]) {
    for (const field of ["bc", "bc_2"]) {
      const value = shown[`${eye}_${field}`]
      if (typeof value === "number" && value >= 20) shown[`${eye}_${field}`] = value / 10
    }
    const va = shown[`${eye}_va`]
    shown[`${eye}_va`] = displayedVa(va)
    const j = shown[`${eye}_j`]
    if (typeof j === "string" && /^\d+\+?$/.test(j)) shown[`${eye}_j`] = `J${j}`
  }
  shown.comb_va = displayedVa(shown.comb_va)
  return shown as ContactLensExam
}
