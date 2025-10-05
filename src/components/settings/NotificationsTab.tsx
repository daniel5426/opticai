import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Settings } from "@/lib/db/schema-interface"

interface NotificationsTabProps {
  localSettings: Settings
  onInputChange: (field: keyof Settings, value: string | number | boolean) => void
}

export function NotificationsTab({ localSettings, onInputChange }: NotificationsTabProps) {
  return (
    <div className="space-y-6">
      <Card className="shadow-md border-none">
        <CardHeader>
          <CardTitle className="text-right">התראות אימייל</CardTitle>
          <p className="text-sm text-muted-foreground text-right">הגדרות שליחת הזכרות ללקוחות</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg shadow-sm bg-muted/20">
            <Switch
              id="send_email_reminder"
              checked={localSettings.send_email_before_appointment || false}
              onCheckedChange={(checked) => onInputChange('send_email_before_appointment', checked)}
            />
            <div className="text-right">
              <Label htmlFor="send_email_reminder" dir="rtl" className="font-medium text-right">הזכרות באימייל</Label>
              <p className="text-sm text-muted-foreground">שלח הזכרה ללקוחות לפני התור</p>
            </div>
          </div>
          
          {localSettings.send_email_before_appointment && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg shadow-sm">
                <div className="space-y-2">
                  <Label htmlFor="email_days_before" className="text-right block">כמה ימים מראש</Label>
                  <Select
                    value={String(localSettings.email_days_before || 1)}
                    onValueChange={(value) => onInputChange('email_days_before', Number(value))}
                  >
                    <SelectTrigger className="text-right" dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">יום אחד</SelectItem>
                      <SelectItem value="2">יומיים</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_time" className="text-right block">שעת שליחה</Label>
                  <Input
                    id="email_time"
                    type="time"
                    value={localSettings.email_time || '10:00'}
                    onChange={(e) => onInputChange('email_time', e.target.value)}
                    className="text-center"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 text-right">הגדרת אימייל</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 text-right" dir="rtl">
                  הגדר את פרטי שרת האימייל בלשונית ההגדרות למטה כדי לשלוח תזכורות ללקוחות.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

