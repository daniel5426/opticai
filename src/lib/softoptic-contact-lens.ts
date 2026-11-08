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
    if (typeof va === "string" && bareVa.test(va)) shown[`${eye}_va`] = `6/${va}`
    const j = shown[`${eye}_j`]
    if (typeof j === "string" && /^\d+\+?$/.test(j)) shown[`${eye}_j`] = `J${j}`
  }
  if (typeof shown.comb_va === "string" && bareVa.test(shown.comb_va)) shown.comb_va = `6/${shown.comb_va}`
  return shown as ContactLensExam
}
