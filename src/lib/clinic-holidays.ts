export type CalendarHoliday = {
  id?: number
  date: string
  name: string
  source: "official" | "clinic"
}

export function holidaysByDate(holidays: CalendarHoliday[]): Record<string, CalendarHoliday> {
  return Object.fromEntries(holidays.map(holiday => [holiday.date, holiday]))
}
