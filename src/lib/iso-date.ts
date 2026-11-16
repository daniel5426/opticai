/** "2026-09-02" -> "02/09/2026", the day-first order the date fields use. */
export function formatIsoDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-")
  return day && month && year ? `${day}/${month}/${year}` : value
}

/** Today's date in Israel as "2026-09-02"; toISOString() gives yesterday's date before 03:00. */
export function todayIsoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}
