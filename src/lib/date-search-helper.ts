export class DateSearchHelper {
  static normalizeDateString(dateStr: string): string {
    return dateStr.replace(/[-/\.]/g, '').replace(/^0+/, '')
  }

  private static normalizeYear(year: number): number {
    if (year < 100) return year <= 69 ? 2000 + year : 1900 + year
    return year
  }

  private static makeDate(year: number, month: number, day: number): Date | null {
    const normalizedYear = this.normalizeYear(year)
    if (normalizedYear < 1000 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null
    }

    const date = new Date(normalizedYear, month - 1, day)
    if (
      date.getFullYear() !== normalizedYear ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null
    }

    return date
  }

  private static getDateParts(dateValue: string | Date): { year: number; month: number; day: number } | null {
    if (dateValue instanceof Date) {
      if (Number.isNaN(dateValue.getTime())) return null
      return {
        year: dateValue.getFullYear(),
        month: dateValue.getMonth() + 1,
        day: dateValue.getDate(),
      }
    }

    const isoMatch = dateValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (isoMatch) {
      return {
        year: Number(isoMatch[1]),
        month: Number(isoMatch[2]),
        day: Number(isoMatch[3]),
      }
    }

    const parsed = new Date(dateValue)
    if (Number.isNaN(parsed.getTime())) return null
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
    }
  }

  static tryParseDates(str: string): Array<{ date: Date; precision: "day" | "month" }> {
    const search = str.trim()
    const results: Array<{ date: Date; precision: "day" | "month" }> = []
    const addDate = (date: Date | null, precision: "day" | "month") => {
      if (!date) return
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${precision}`
      if (!results.some((item) => `${item.date.getFullYear()}-${item.date.getMonth()}-${item.date.getDate()}-${item.precision}` === key)) {
        results.push({ date, precision })
      }
    }

    const yearFirst = search.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/)
    if (yearFirst) {
      const year = Number(yearFirst[1])
      const month = Number(yearFirst[2])
      const day = yearFirst[3] ? Number(yearFirst[3]) : 1
      addDate(this.makeDate(year, month, day), yearFirst[3] ? "day" : "month")
      return results
    }

    const localOrUs = search.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/)
    if (localOrUs?.[3]) {
      const first = Number(localOrUs[1])
      const second = Number(localOrUs[2])
      const year = Number(localOrUs[3])
      addDate(this.makeDate(year, second, first), "day") // Israeli: DD/MM/YYYY
      addDate(this.makeDate(year, first, second), "day") // English US: MM/DD/YYYY
      return results
    }

    const monthYear = search.match(/^(\d{1,2})[-/.](\d{4})$/)
    if (monthYear) {
      addDate(this.makeDate(Number(monthYear[2]), Number(monthYear[1]), 1), "month")
    }

    return results
  }

  static tryParseDate(str: string): Date | null {
    return this.tryParseDates(str)[0]?.date ?? null
  }

  static matchesDate(searchQuery: string, orderDate: string | Date | null | undefined): boolean {
    if (!orderDate) return false

    const searchLower = searchQuery.toLowerCase().trim()
    if (!searchLower) return false

    const parts = this.getDateParts(orderDate)
    if (!parts) return false

    const { year, month, day } = parts
    const paddedMonth = String(month).padStart(2, '0')
    const paddedDay = String(day).padStart(2, '0')
    const isoDate = `${year}-${paddedMonth}-${paddedDay}`
    const israeliDate = `${day}/${month}/${year}`
    const israeliDatePadded = `${paddedDay}/${paddedMonth}/${year}`
    const englishDate = `${month}/${day}/${year}`
    const englishDatePadded = `${paddedMonth}/${paddedDay}/${year}`

    const dateStrings = [
      isoDate,
      `${year}/${month}/${day}`,
      `${year}.${month}.${day}`,
      israeliDate,
      israeliDatePadded,
      israeliDate.replace(/\//g, '-'),
      israeliDate.replace(/\//g, '.'),
      israeliDatePadded.replace(/\//g, '-'),
      israeliDatePadded.replace(/\//g, '.'),
      englishDate,
      englishDatePadded,
      englishDate.replace(/\//g, '-'),
      englishDatePadded.replace(/\//g, '-'),
      this.normalizeDateString(isoDate),
      this.normalizeDateString(israeliDate),
      this.normalizeDateString(englishDate),
    ]

    const normalizedSearch = this.normalizeDateString(searchLower)

    for (const dateStr of dateStrings) {
      if (dateStr.toLowerCase().includes(searchLower) || 
          this.normalizeDateString(dateStr).includes(normalizedSearch)) {
        return true
      }
    }

    const searchDates = this.tryParseDates(searchLower)
    for (const { date: searchDate, precision } of searchDates) {
      if (year === searchDate.getFullYear() && month === searchDate.getMonth() + 1) {
        if (precision === "month" || day === searchDate.getDate()) return true
      }
    }

    return false
  }
}
