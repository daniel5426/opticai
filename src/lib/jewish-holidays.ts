const HOLIDAYS: Record<string, string> = {
  '2025-03-14': 'פורים (תענית אסתר)',
  '2025-03-15': 'פורים',
  '2025-03-16': 'שושן פורים',
  '2025-04-12': 'פסח א׳',
  '2025-04-13': 'פסח ב׳ (חוה״מ)',
  '2025-04-18': 'שביעי של פסח',
  '2025-04-19': 'איסרו חג פסח',
  '2025-06-02': 'שבועות',
  '2025-10-02': 'ראש השנה א׳',
  '2025-10-03': 'ראש השנה ב׳',
  '2025-10-09': 'יום כיפור',
  '2025-10-10': 'ערב סוכות',
  '2025-10-16': 'שמיני עצרת/שמחת תורה',
  '2025-10-22': 'איסרו חג סוכות'
}

export function isJewishHoliday(dateStr?: string): boolean {
  if (!dateStr) return false
  return Boolean(HOLIDAYS[dateStr])
}

export function addJewishHoliday(dateStr: string) {
  if (!HOLIDAYS[dateStr]) HOLIDAYS[dateStr] = 'חג'
}

export function removeJewishHoliday(dateStr: string) {
  delete HOLIDAYS[dateStr]
}

export function getAllJewishHolidays(): string[] {
  return Object.keys(HOLIDAYS)
}

export function getJewishHolidayName(dateStr?: string): string | null {
  if (!dateStr) return null
  return HOLIDAYS[dateStr] || null
}


