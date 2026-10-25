export const ORDER_STATUS_OPTIONS = [
  "נשלח לייצור",
  "ממתין לעדשות",
  "ממתין למסגור",
  "ממתין למשלוח חזרה לחנות",
  "ממתין לאיסוף לקוח",
  "נמסר ללקוח",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUS_OPTIONS)[number];

export const ORDER_STATUS_LABEL_KEYS: Record<OrderStatusValue, string> = {
  "נשלח לייצור": "orderGroupStatusProduction",
  "ממתין לעדשות": "orderGroupStatusLenses",
  "ממתין למסגור": "orderGroupStatusFrame",
  "ממתין למשלוח חזרה לחנות": "orderGroupStatusShipping",
  "ממתין לאיסוף לקוח": "orderGroupStatusCollection",
  "נמסר ללקוח": "orderGroupStatusDelivered",
};
