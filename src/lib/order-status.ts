export const ORDER_STATUS_OPTIONS = [
  "נשלח לייצור",
  "ממתין לעדשות",
  "ממתין למסגור",
  "ממתין למשלוח חזרה לחנות",
  "ממתין לאיסוף לקוח",
  "נמסר ללקוח",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUS_OPTIONS)[number];
