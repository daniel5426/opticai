import { User } from "@/lib/db/schema-interface"

// Color conversion helpers
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }

  return [h * 360, s * 100, l * 100]
}

export function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Time conversion helpers
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export function getAppointmentEndTime(startTime: string, duration: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const startMinutes = hours * 60 + minutes
  const endMinutes = startMinutes + duration
  const endHours = Math.floor(endMinutes / 60)
  const endMins = endMinutes % 60
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
}

export function getAppointmentTimeRange(startTime: string, duration: number) {
  const [hours, minutes] = startTime.split(':').map(Number)
  const startMinutes = hours * 60 + minutes
  const endMinutes = startMinutes + duration
  const endHours = Math.floor(endMinutes / 60)
  const endMins = endMinutes % 60

  return `${startTime} - ${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
}

// User color mapping with conflict resolution
export function createUserColorMap(users: User[]): Map<number, string> {
  if (!users.length) return new Map<number, string>()
  
  const colorMap = new Map<number, string>()
  const colorGroups = new Map<string, number[]>()
  
  // Group users by color
  users.forEach(user => {
    if (user.id && user.primary_theme_color) {
      const color = user.primary_theme_color
      if (!colorGroups.has(color)) {
        colorGroups.set(color, [])
      }
      colorGroups.get(color)!.push(user.id)
    }
  })
  
  // Assign colors with conflict resolution
  colorGroups.forEach((userIds, baseColor) => {
    if (userIds.length === 1) {
      colorMap.set(userIds[0], baseColor)
    } else {
      userIds.forEach((userId, index) => {
        if (index === 0) {
          colorMap.set(userId, baseColor)
        } else {
          const hsl = hexToHsl(baseColor)
          const adjustedHue = (hsl[0] + (index * 60)) % 360
          colorMap.set(userId, hslToHex(adjustedHue, hsl[1], hsl[2]))
        }
      })
    }
  })
  
  return colorMap
}

// Vacation helpers
export function isUserOnVacation(users: User[], userId?: number, dateStr?: string): boolean {
  if (!userId || !dateStr) return false
  const user = users.find(u => u.id === userId)
  if (!user) return false
  const allVacations: string[] = [
    ...(user.system_vacation_dates || []),
    ...(user.added_vacation_dates || [])
  ]
  return allVacations.some(d => d === dateStr)
}

