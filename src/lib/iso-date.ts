/** "2026-09-02" -> "02/09/2026", the day-first order the date fields use. */
export function formatIsoDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-")
  return day && month && year ? `${day}/${month}/${year}` : value
}
