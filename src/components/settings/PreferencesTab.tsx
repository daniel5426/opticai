import React from "react"
import { Link } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { IconLayoutGrid } from "@tabler/icons-react"
import { Settings } from "@/lib/db/schema-interface"

interface PreferencesTabProps {
  localSettings: Settings
  onInputChange: (field: keyof Settings, value: string | number | boolean) => void
}

export function PreferencesTab({ localSettings, onInputChange }: PreferencesTabProps) {
  return (
    <div className="space-y-6">
      <Card className="shadow-md border-none">
        <CardContent>
          <div className="flex items-center justify-between">
            <Link to="/exam-layouts">
              <Button variant="outline" className="flex items-center gap-2">
                <IconLayoutGrid className="h-4 w-4" />
                נהל פריסות בדיקה
              </Button>
            </Link>
            <div className="text-right">
              <h3 className="font-medium">פריסות בדיקה</h3>
              <p className="text-sm text-muted-foreground">יצירה ועריכה של פריסות בדיקה מותאמות אישית</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md border-none">
        <CardHeader>
          <CardTitle className="text-right">שעות עבודה</CardTitle>
          <p className="text-sm text-muted-foreground text-right">הגדר שעות פעילות והפסקות</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="work_start_time" className="text-right block">התחלה</Label>
              <Input
                id="work_start_time"
                type="time"
                value={localSettings.work_start_time || '08:00'}
                onChange={(e) => onInputChange('work_start_time', e.target.value)}
                className="text-center"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work_end_time" className="text-right block">סיום</Label>
              <Input
                id="work_end_time"
                type="time"
                value={localSettings.work_end_time || '18:00'}
                onChange={(e) => onInputChange('work_end_time', e.target.value)}
                className="text-center"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="break_start_time" className="text-right block">הפסקה מ</Label>
              <Input
                id="break_start_time"
                type="time"
                value={localSettings.break_start_time || ''}
                onChange={(e) => onInputChange('break_start_time', e.target.value)}
                className="text-center"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="break_end_time" className="text-right block">הפסקה עד</Label>
              <Input
                id="break_end_time"
                type="time"
                value={localSettings.break_end_time || ''}
                onChange={(e) => onInputChange('break_end_time', e.target.value)}
                className="text-center"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md border-none">
        <CardHeader>
          <CardTitle className="text-right">תורים</CardTitle>
          <p className="text-sm text-muted-foreground text-right">הגדרות זמנים ומגבלות תורים</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2" dir="rtl">
              <Label htmlFor="appointment_duration" className="text-right block">משך תור (דקות)</Label>
              <Select dir="rtl"
                value={String(localSettings.appointment_duration || 30)}
                onValueChange={(value) => onInputChange('appointment_duration', Number(value))}
              >
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 דקות</SelectItem>
                  <SelectItem value="30">30 דקות</SelectItem>
                  <SelectItem value="45">45 דקות</SelectItem>
                  <SelectItem value="60">60 דקות</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_appointments" className="text-right block">מקסימום תורים ליום</Label>
              <Input
                id="max_appointments"
                type="number"
                value={localSettings.max_appointments_per_day || 20}
                onChange={(e) => onInputChange('max_appointments_per_day', Number(e.target.value))}
                min="1"
                max="50"
                className="text-right"
                dir="rtl"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


