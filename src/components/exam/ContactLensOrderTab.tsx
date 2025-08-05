import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ContactLensOrder } from "@/lib/db/schema-interface"
import { examComponentRegistry } from "@/lib/exam-component-registry"
import { LookupSelect } from "@/components/ui/lookup-select"

interface ContactLensOrderTabProps {
  data: ContactLensOrder
  onChange: (field: keyof ContactLensOrder, value: string) => void
  layoutInstanceId: number
  isEditing: boolean
}

export function ContactLensOrderTab({ data, onChange, layoutInstanceId, isEditing }: ContactLensOrderTabProps) {
  const handleFieldChange = examComponentRegistry.createFieldChangeHandler<ContactLensOrder>(
    'contact-lens-order',
    (updater) => {
      const newData = updater(data)
      Object.keys(newData).forEach(key => {
        const field = key as keyof ContactLensOrder
        if (newData[field] !== data[field]) {
          onChange(field, String(newData[field] || ''))
        }
      })
    }
  )

  return (
    <Card className="w-full dark:bg-card shadow-md">
      <CardHeader>
        <CardTitle className="text-right">הזמנת עדשות מגע</CardTitle>
        <CardDescription className="text-right">
          מידע על הזמנת עדשות מגע, סטטוס הזמנה ופתרונות ניקוי
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Contact Lens ID */}
          <div className="space-y-2">
            <Label htmlFor="layout_instance_id" className="text-right block text-muted-foreground  ">
              מזהה עדשת מגע
            </Label>
            <Input
              id="layout_instance_id"
              type="number"
              value={data.layout_instance_id || ''}
              onChange={(e) => handleFieldChange('layout_instance_id', e.target.value)}
              disabled={!isEditing}
              className="text-right"
              dir="rtl"
            />
          </div>

          {/* Branch */}
          <div className="space-y-2">
            <Label htmlFor="branch" className="text-right block text-muted-foreground ">
              סניף
            </Label>
            <Input
              id="branch"
              value={data.branch || ''}
              onChange={(e) => handleFieldChange('branch', e.target.value)}
              className="text-right"
              disabled={!isEditing}
              dir="rtl"
            />
          </div>

          {/* Supply in Branch */}
          <div className="space-y-2">
            <Label htmlFor="supply_in_branch" className="text-right block text-muted-foreground ">
              אספקה בסניף
            </Label>
            <Input
              id="supply_in_branch"
              value={data.supply_in_branch || ''}
              onChange={(e) => handleFieldChange('supply_in_branch', e.target.value)}
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
              value={data.order_status || ''}
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
              value={data.advisor || ''}
              onChange={(value) => handleFieldChange('advisor', value)}
              placeholder="בחר יועץ"
              className="text-right"
              disabled={!isEditing}
            />
          </div>

          {/* Deliverer */}
          <div className="space-y-2">
            <Label htmlFor="deliverer" className="text-right block text-muted-foreground ">
              משלח
            </Label>
            <Input
              id="deliverer"
              value={data.deliverer || ''}
              onChange={(e) => handleFieldChange('deliverer', e.target.value)}
              className="text-right"
              dir="rtl"
              disabled={!isEditing}
            />
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
                  value={data.delivery_date || ''}
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
                  value={data.guaranteed_date || ''}
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
              value={data.priority || ''}
              onChange={(e) => handleFieldChange('priority', e.target.value)}
              className="text-right"
              dir="rtl"
              disabled={!isEditing}
            />
          </div>

          {/* Approval Date */}
          <div className="space-y-2">
            <Label htmlFor="approval_date" className="text-right block text-muted-foreground ">
              תאריך אישור
            </Label>
            <Input
              id="approval_date"
              type="date"
              value={data.approval_date || ''}
              onChange={(e) => handleFieldChange('approval_date', e.target.value)}
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
              value={data.cleaning_solution || ''}
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
              value={data.disinfection_solution || ''}
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
              value={data.rinsing_solution || ''}
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