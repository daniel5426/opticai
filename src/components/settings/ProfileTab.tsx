import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clinic } from "@/lib/db/schema-interface"
import { Eye, EyeOff } from "lucide-react"

interface ProfileTabProps {
  localClinic: Partial<Clinic>
  onClinicChange: (field: keyof Clinic, value: any) => void
}

export function ProfileTab({ localClinic, onClinicChange }: ProfileTabProps) {
  const [showPin, setShowPin] = useState(false)

  return (
    <div className="space-y-6">
      <Card className="">
        <CardHeader>
          <CardTitle className="text-right">פרטים בסיסיים</CardTitle>
          <p className="text-sm text-muted-foreground text-right">מידע כללי על המרפאה והמנהל</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clinic_name" className="text-right block text-sm">שם המרפאה למסמכים</Label>
              <Input
                id="clinic_name"
                value={localClinic.clinic_name || ''}
                onChange={(e) => onClinicChange('clinic_name', e.target.value)}
                placeholder="הזן שם המרפאה"
                className="text-right h-9"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager_name" className="text-right block text-sm">שם המנהל</Label>
              <Input
                id="manager_name"
                value={localClinic.manager_name || ''}
                onChange={(e) => onClinicChange('manager_name', e.target.value)}
                placeholder="הזן שם המנהל"
                className="text-right h-9"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic_website" className="text-right block text-sm">אתר אינטרנט</Label>
              <Input
                id="clinic_website"
                value={localClinic.clinic_website || ''}
                onChange={(e) => onClinicChange('clinic_website', e.target.value)}
                placeholder="https://www.clinic.com"
                className="text-right h-9"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic_position" className="text-right block text-sm">מיקום נוסף</Label>
              <Input
                id="clinic_position"
                value={localClinic.clinic_position || ''}
                onChange={(e) => onClinicChange('clinic_position', e.target.value)}
                placeholder="קומה, חדר וכו'"
                className="text-right h-9"
                dir="rtl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card dir="rtl">
        <CardContent className="px-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(340px,520px)_minmax(260px,1fr)] md:items-stretch">

            <div className="order-1 flex flex-col justify-center rounded-md border bg-muted/25 p-4 text-right md:order-2">
              <p className="text-sm font-medium">מה הקוד עושה?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                הקוד מאשר את המכשיר לכניסה למרפאה. אחרי שינוי הקוד, מכשירים קיימים יצטרכו אימות מחדש.
              </p>
            </div>
            <div className="order-2 space-y-4 text-right md:order-1">
              <div>
                <CardTitle className="text-right text-lg">אבטחת כניסה למרפאה</CardTitle>
                <p className="mt-1 text-right text-sm text-muted-foreground">
                  שינוי הקוד יבטל אישורי מכשירים קיימים.
                </p>
              </div>

              <div className="w-full max-w-sm space-y-2">
                <Label htmlFor="clinic_entry_pin" className="block text-right text-sm">
                  {localClinic.has_entry_pin ? "קוד PIN חדש" : "קוד PIN למרפאה"}
                </Label>
                <div className="relative">
                  <Input
                    id="clinic_entry_pin"
                    type={showPin ? "text" : "password"}
                    autoComplete="new-password"
                    maxLength={32}
                    value={localClinic.entry_pin || ''}
                    onChange={(e) => onClinicChange('entry_pin', e.target.value)}
                    placeholder={localClinic.has_entry_pin ? "השאר ריק כדי לא לשנות" : "לפחות 4 תווים"}
                    className="h-9 pl-10 text-right"
                    dir="rtl"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPin((value) => !value)}
                    className="absolute left-1 top-0.5 h-8 w-8 p-0"
                    aria-label={showPin ? "הסתר PIN" : "הצג PIN"}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      <Card className="">
        <CardHeader>
          <CardTitle className="text-right">פרטי קשר וכתובת</CardTitle>
          <p className="text-sm text-muted-foreground text-right">דרכי יצירת קשר ומיקום המרפאה</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-right text-muted-foreground">פרטי קשר</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="clinic_email" className="text-right block text-sm">אימייל</Label>
                  <Input
                    id="clinic_email"
                    type="email"
                    value={localClinic.email || ''}
                    onChange={(e) => onClinicChange('email', e.target.value)}
                    placeholder="clinic@example.com"
                    className="text-right h-9"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic_phone" className="text-right block text-sm">טלפון</Label>
                  <Input
                    id="clinic_phone"
                    value={localClinic.phone_number || ''}
                    onChange={(e) => onClinicChange('phone_number', e.target.value)}
                    placeholder="050-1234567"
                    className="text-right h-9"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-right text-muted-foreground">כתובת</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="clinic_address" className="text-right block text-sm">רחוב ומספר</Label>
                  <Input
                    id="clinic_address"
                    value={localClinic.clinic_address || ''}
                    onChange={(e) => onClinicChange('clinic_address', e.target.value)}
                    placeholder="רחוב הרצל 123"
                    className="text-right h-9"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic_city" className="text-right block text-sm">עיר</Label>
                  <Input
                    id="clinic_city"
                    value={localClinic.clinic_city || ''}
                    onChange={(e) => onClinicChange('clinic_city', e.target.value)}
                    placeholder="תל אביב"
                    className="text-right h-9"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-right text-muted-foreground">נוסף</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="clinic_postal_code" className="text-right block text-sm">מיקוד</Label>
                  <Input
                    id="clinic_postal_code"
                    value={localClinic.clinic_postal_code || ''}
                    onChange={(e) => onClinicChange('clinic_postal_code', e.target.value)}
                    placeholder="12345"
                    className="text-right h-9"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic_directions" className="text-right block text-sm">הוראות הגעה</Label>
                  <Input
                    id="clinic_directions"
                    value={localClinic.clinic_directions || ''}
                    onChange={(e) => onClinicChange('clinic_directions', e.target.value)}
                    placeholder="ליד הפארק, קומה 2"
                    className="text-right h-9"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
