import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LookupSelect } from "@/components/ui/lookup-select"

type ContactLensOrderFields = {
  supply_in_clinic_id?: number
  order_status?: string
  advisor?: string
  deliverer?: string
  delivery_date?: string
  priority?: string
  guaranteed_date?: string
  approval_date?: string
  cleaning_solution?: string
  disinfection_solution?: string
  rinsing_solution?: string
}

interface ContactLensOrderTabProps {
  contactLensOrder: ContactLensOrderFields
  onContactLensOrderChange: (field: keyof ContactLensOrderFields, value: string) => void
  isEditing: boolean
}

export function ContactLensOrderTab({ contactLensOrder, onContactLensOrderChange, isEditing }: ContactLensOrderTabProps) {
  const handleFieldChange = (field: keyof ContactLensOrderFields, value: string) => {
    onContactLensOrderChange(field, value)
  }

  return (
    <Card className="w-full dark:bg-card examcard pt-4 gap-2">
      <CardHeader>
        <CardTitle className="text-center text-muted-foreground">פרטי הזמנת עדשות מגע</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Supply in Clinic (ID) */}
          <div className="space-y-2">
            <Label htmlFor="supply_in_clinic_id" className="text-right block text-muted-foreground ">
              מסופק בסניף
            </Label>
            <Input
              id="supply_in_clinic_id"
              type="number"
              value={contactLensOrder.supply_in_clinic_id ?? ''}
              onChange={(e) => handleFieldChange('supply_in_clinic_id', e.target.value)}
              className="text-right"
              disabled={!isEditing}
              dir="rtl"
            />
          </div>

          {/* Order Status */}
          <div className="space-y-2">
            <Label htmlFor="order_status" className="text-right block text-muted-foreground ">
              סטטוס הזמנה
            </Label>
            <Input
              id="order_status"
              value={contactLensOrder.order_status || ''}
              onChange={(e) => handleFieldChange('order_status', e.target.value)}
              className="text-right"
              dir="rtl"
              disabled={!isEditing}
            />
          </div>

          {/* Advisor - Lookup */}
          <div className="space-y-2">
            <Label htmlFor="advisor" className="text-right block text-muted-foreground ">
              יועץ
            </Label>
            <LookupSelect
              lookupType="advisor"
              value={contactLensOrder.advisor || ''}
              onChange={(value) => handleFieldChange('advisor', value)}
              placeholder="בחר יועץ"
              className="text-right"
              disabled={!isEditing}
            />
          </div>

          {/* Deliverer & Approval Date Combined */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="deliverer" className="text-right block text-muted-foreground ">
                  שליח
                </Label>
                <Input
                  id="deliverer"
                  value={contactLensOrder.deliverer || ''}
                  onChange={(e) => handleFieldChange('deliverer', e.target.value)}
                  className="text-right"
                  dir="rtl"
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approval_date" className="text-right block text-muted-foreground ">
                  תאריך אישור
                </Label>
                <Input
                  id="approval_date"
                  type="date"
                  value={contactLensOrder.approval_date || ''}
                  onChange={(e) => handleFieldChange('approval_date', e.target.value)}
                  className="text-right text-sm"
                  dir="rtl"
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          {/* Delivery Date & Guaranteed Date Combined */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="delivery_date" className="text-right block text-muted-foreground ">
                  תאריך משלוח
                </Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={contactLensOrder.delivery_date || ''}
                  onChange={(e) => handleFieldChange('delivery_date', e.target.value)}
                  className="text-right text-sm"
                  dir="rtl"
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2" >
                <Label htmlFor="guaranteed_date" className="text-right block text-muted-foreground ">
                  תאריך מובטח
                </Label>
                <Input
                  id="guaranteed_date"
                  type="date"
                  value={contactLensOrder.guaranteed_date || ''}
                  onChange={(e) => handleFieldChange('guaranteed_date', e.target.value)}
                  className="text-right text-sm"
                  dir="rtl"
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority" className="text-right block text-muted-foreground ">
              עדיפות
            </Label>
            <Input
              id="priority"
              value={contactLensOrder.priority || ''}
              onChange={(e) => handleFieldChange('priority', e.target.value)}
              className="text-right"
              dir="rtl"
              disabled={!isEditing}
            />
          </div>

          

          {/* Cleaning Solution - Lookup */}
          <div className="space-y-2">
            <Label htmlFor="cleaning_solution" className="text-right block text-muted-foreground ">
              תמיסת ניקוי
            </Label>
            <LookupSelect
              lookupType="cleaningSolution"
              value={contactLensOrder.cleaning_solution || ''}
              onChange={(value) => handleFieldChange('cleaning_solution', value)}
              placeholder="בחר תמיסת ניקוי"
              className="text-right"
              disabled={!isEditing}
            />
          </div>

          {/* Disinfection Solution - Lookup */}
          <div className="space-y-2">
            <Label htmlFor="disinfection_solution" className="text-right block text-muted-foreground ">
              תמיסת חיטוי
            </Label>
            <LookupSelect
              lookupType="disinfectionSolution"
              value={contactLensOrder.disinfection_solution || ''}
              onChange={(value) => handleFieldChange('disinfection_solution', value)}
              placeholder="בחר תמיסת חיטוי"
              className="text-right"
              disabled={!isEditing}
              />
          </div>

          {/* Rinsing Solution - Lookup */}
          <div className="space-y-2">
            <Label htmlFor="rinsing_solution" className="text-right block text-muted-foreground   ">
              תמיסת שטיפה
            </Label>
            <LookupSelect
              lookupType="rinsingSolution"
              value={contactLensOrder.rinsing_solution || ''}
              onChange={(value) => handleFieldChange('rinsing_solution', value)}
              placeholder="בחר תמיסת שטיפה"
              className="text-right"
              disabled={!isEditing}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}