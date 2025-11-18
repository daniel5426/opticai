export class DateSearchHelper {
  static normalizeDateString(dateStr: string): string {
    return dateStr.replace(/[-/\.]/g, '').replace(/^0+/, '')
  }

  static tryParseDate(str: string): Date | null {
    const formats = [
      { regex: /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/, isYearFirst: true },
      { regex: /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/, isYearFirst: false },
      { regex: /^(\d{4})[-/](\d{1,2})$/, isYearFirst: true, isPartial: true },
      { regex: /^(\d{1,2})[-/](\d{4})$/, isYearFirst: false, isPartial: true },
    ]
    
    for (const { regex, isYearFirst, isPartial } of formats) {
      const match = str.match(regex)
      if (match && match.length >= 3) {
        try {
          if (isPartial) {
            const year = isYearFirst ? parseInt(match[1]) : parseInt(match[2])
            const month = isYearFirst ? parseInt(match[2]) : parseInt(match[1])
            if (year > 1000 && month >= 1 && month <= 12) {
              return new Date(year, month - 1, 1)
            }
          } else {
            const year = isYearFirst ? parseInt(match[1]) : parseInt(match[3])
            const month = isYearFirst ? parseInt(match[2]) : parseInt(match[1])
            const day = isYearFirst ? parseInt(match[3]) : parseInt(match[2])
            if (year > 1000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              return new Date(year, month - 1, day)
            }
          }
        } catch {
          continue
        }
      }
    }
    return null
  }

  static matchesDate(searchQuery: string, orderDate: string | Date | null | undefined): boolean {
    if (!orderDate) return false

    const searchLower = searchQuery.toLowerCase().trim()
    if (!searchLower) return false

    const date = new Date(orderDate)
    const isoDate = date.toISOString().split('T')[0]
    const hebrewDate = date.toLocaleDateString('he-IL')
    const hebrewDateNoSlash = hebrewDate.replace(/\//g, '-')
    const hebrewDateDots = hebrewDate.replace(/\//g, '.')

    const dateStrings = [
      isoDate,
      hebrewDate,
      hebrewDateNoSlash,
      hebrewDateDots,
      this.normalizeDateString(isoDate),
      this.normalizeDateString(hebrewDate),
    ]

    const normalizedSearch = this.normalizeDateString(searchLower)

    for (const dateStr of dateStrings) {
      if (dateStr.toLowerCase().includes(searchLower) || 
          this.normalizeDateString(dateStr).includes(normalizedSearch)) {
        return true
      }
    }

    const searchDate = this.tryParseDate(searchLower)
    if (searchDate) {
      const orderDateObj = new Date(orderDate)
      if (orderDateObj.getFullYear() === searchDate.getFullYear() &&
          orderDateObj.getMonth() === searchDate.getMonth()) {
        const searchDay = searchDate.getDate()
        if (searchDay === 1 && searchDate.getHours() === 0) {
          return true
        }
        if (orderDateObj.getDate() === searchDay) {
          return true
        }
      }
    }

    return false
  }
}

