import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { CalendarHoliday } from "@/lib/clinic-holidays"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

function dateForYear(year: number) {
  return `${year}-01-01`
}

export function ClinicHolidaysTab({ clinicId }: { clinicId?: number }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [holidayDate, setHolidayDate] = useState(dateForYear(new Date().getFullYear()))
  const [holidayName, setHolidayName] = useState("")

  const customHolidayIds = useMemo(
    () => new Set(holidays.filter(holiday => holiday.source === "clinic" && holiday.id).map(holiday => holiday.id)),
    [holidays],
  )

  const loadHolidays = async () => {
    if (!clinicId) return
    setLoading(true)
    const response = await apiClient.getClinicHolidays(clinicId, year)
    setLoading(false)
    if (response.error) {
      toast.error(response.error)
      return
    }
    setHolidays(response.data || [])
  }

  useEffect(() => {
    void loadHolidays()
  }, [clinicId, year])

  const changeYear = (nextYear: number) => {
    if (!Number.isInteger(nextYear) || nextYear < 1900 || nextYear > 2200) return
    setYear(nextYear)
    setHolidayDate(dateForYear(nextYear))
  }

  const saveHoliday = async () => {
    if (!clinicId || !holidayName.trim() || !holidayDate) return
    setSaving(true)
    const response = await apiClient.saveClinicHoliday(clinicId, {
      holiday_date: holidayDate,
      name: holidayName.trim(),
    })
    setSaving(false)
    if (response.error) {
      toast.error(response.error)
      return
    }
    setHolidayName("")
    await loadHolidays()
    toast.success("החג נשמר")
  }

  const deleteHoliday = async (holiday: CalendarHoliday) => {
    if (!holiday.id || !customHolidayIds.has(holiday.id)) return
    const response = await apiClient.deleteClinicHoliday(holiday.id)
    if (response.error) {
      toast.error(response.error)
      return
    }
    await loadHolidays()
    toast.success("החג המותאם נמחק")
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <CalendarDays className="h-5 w-5" />
            חגים בלוח השנה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-right">
          <p className="text-sm text-muted-foreground">
            חגים ישראליים מוצגים אוטומטית בכל שנה. אפשר להוסיף חג או יום סגור מותאם למרפאה, או להחליף את השם של חג קיים.
          </p>
          <div className="grid gap-3 md:grid-cols-[140px_1fr_1fr_auto]">
            <Input
              type="number"
              min={1900}
              max={2200}
              value={year}
              onChange={(event) => changeYear(Number(event.target.value))}
              aria-label="שנה"
            />
            <Input
              type="date"
              value={holidayDate}
              onChange={(event) => setHolidayDate(event.target.value)}
              aria-label="תאריך חג"
            />
            <Input
              value={holidayName}
              onChange={(event) => setHolidayName(event.target.value)}
              placeholder="שם חג או יום סגור"
              aria-label="שם חג או יום סגור"
            />
            <Button onClick={saveHoliday} disabled={!clinicId || saving || !holidayDate || !holidayName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="mr-2">הוספה</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{year}</CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent>
          <div className="max-h-[440px] divide-y overflow-y-auto rounded-md border">
            {holidays.map(holiday => (
              <div key={`${holiday.date}-${holiday.id || "official"}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums" dir="ltr">{holiday.date}</span>
                <span className="flex-1">{holiday.name}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {holiday.source === "clinic" ? "מרפאה" : "רשמי"}
                </span>
                {holiday.source === "clinic" && holiday.id && (
                  <Button variant="ghost" size="icon" onClick={() => void deleteHoliday(holiday)} aria-label={`מחיקת ${holiday.name}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {!loading && holidays.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">לא נמצאו חגים לשנה זו</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
