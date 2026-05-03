export const ORDER_STATUS_OPTIONS = [
  "נשלח לייצור",
  "ממתין לאיסוף לקוח",
  "נמסר ללקוח",
  "ממתין לעדשות",
  "ממתין למסגור",
  "ממתין למשלוח חזרה לחנות",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUS_OPTIONS)[number];
