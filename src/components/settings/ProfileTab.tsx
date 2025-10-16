import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clinic } from "@/lib/db/schema-interface"

interface ProfileTabProps {
  localClinic: Partial<Clinic>
  onClinicChange: (field: keyof Clinic, value: any) => void
}

export function ProfileTab({ localClinic, onClinicChange }: ProfileTabProps) {
  return (
    <div className="space-y-6">
      <Card className="shadow-md border-none">
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

      <Card className="shadow-md border-none">
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


