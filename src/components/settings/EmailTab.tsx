import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Settings } from "@/lib/db/schema-interface"
import { getEmailProviderConfig } from "@/lib/email/email-providers"
import { useAppLocale } from "@/localization/use-app-locale"

interface EmailTabProps {
  localSettings: Settings
  onInputChange: (field: keyof Settings, value: string | number | boolean) => void
  onTestConnection: () => void
}

export function EmailTab({ localSettings, onInputChange, onTestConnection }: EmailTabProps) {
  const { direction } = useAppLocale()

  return (
    <div className="space-y-6" dir={direction}>
      <Card className="">
        <CardHeader>
          <CardTitle className="text-start">הגדרות שרת אימייל</CardTitle>
          <p className="text-start text-sm text-muted-foreground">הגדר את פרטי שרת האימייל לשליחת תזכורות ללקוחות</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email_provider" className="text-sm font-medium text-right block">
              ספק אימייל
            </Label>
            <Select
              dir={direction}
              value={localSettings.email_provider || "gmail"}
              onValueChange={(value) => {
                onInputChange('email_provider', value);
                if (value !== 'custom') {
                  const provider = getEmailProviderConfig(value);
                  if (provider) {
                    onInputChange('email_smtp_host', provider.host);
                    onInputChange('email_smtp_port', provider.port);
                    onInputChange('email_smtp_secure', provider.secure);
                  }
                }
              }}
            >
              <SelectTrigger className="h-9 text-start" dir={direction}>
                <SelectValue placeholder="בחר ספק אימייל" />
              </SelectTrigger>
              <SelectContent dir={direction}>
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="outlook">Outlook / Hotmail</SelectItem>
                <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                <SelectItem value="custom">הגדרה מותאמת אישית</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email_username" className="text-sm font-medium text-right block">
                כתובת אימייל
              </Label>
              <Input
                id="email_username"
                type="email"
                value={localSettings.email_username || ""}
                onChange={(e) => onInputChange('email_username', e.target.value)}
                className="text-right h-9"
                placeholder="clinic@example.com"
                dir="rtl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_password" className="text-sm font-medium text-right block">
                סיסמה
              </Label>
              <Input
                id="email_password"
                type="password"
                value={localSettings.email_password || ""}
                onChange={(e) => onInputChange('email_password', e.target.value)}
                className="text-right h-9"
                placeholder="••••••••"
                dir="rtl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_from_name" className="text-sm font-medium text-right block">
              שם השולח (אופציונלי)
            </Label>
            <Input
              id="email_from_name"
              value={localSettings.email_from_name || ""}
              onChange={(e) => onInputChange('email_from_name', e.target.value)}
              className="text-right h-9"
              placeholder="מרפאת העיניים שלנו"
              dir="rtl"
            />
          </div>

          {localSettings.email_provider === 'custom' && (
            <>
              <Separator className="my-4" />
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-right">הגדרות SMTP מותאמות</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email_smtp_host" className="text-sm font-medium text-right block">
                      שרת SMTP
                    </Label>
                    <Input
                      id="email_smtp_host"
                      value={localSettings.email_smtp_host || ""}
                      onChange={(e) => onInputChange('email_smtp_host', e.target.value)}
                      className="text-right h-9"
                      placeholder="smtp.example.com"
                      dir="rtl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email_smtp_port" className="text-sm font-medium text-right block">
                      פורט
                    </Label>
                    <Input
                      id="email_smtp_port"
                      type="number"
                      value={localSettings.email_smtp_port || 587}
                      onChange={(e) => onInputChange('email_smtp_port', parseInt(e.target.value))}
                      className="text-center h-9"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-right block mb-2">אבטחה</Label>
                    <div className="flex h-9 items-center justify-between rounded-lg border bg-background px-3">
                      <Label htmlFor="email_smtp_secure" className="cursor-pointer text-sm">
                        SSL/TLS
                      </Label>
                      <Switch
                        id="email_smtp_secure"
                        checked={localSettings.email_smtp_secure || false}
                        onCheckedChange={(checked) => onInputChange('email_smtp_secure', checked)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {localSettings.email_provider && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 text-right">
                הוראות עבור {getEmailProviderConfig(localSettings.email_provider)?.displayName}
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 text-right" dir="rtl">
                {getEmailProviderConfig(localSettings.email_provider)?.instructions}
              </p>
            </div>
          )}

          <div className="flex justify-start pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onTestConnection}
              disabled={!localSettings.email_username || !localSettings.email_password}
              className="px-6"
            >
              בדוק חיבור אימייל
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

