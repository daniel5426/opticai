import React from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { OldRefExam } from "@/lib/db/schema-interface"

interface OldRefTabProps {
  oldRefData: OldRefExam;
  onOldRefChange: (field: keyof OldRefExam, value: string) => void;
  isEditing: boolean;
}

export function OldRefTab({
  oldRefData,
  onOldRefChange,
  isEditing
}: OldRefTabProps) {
  return (
    <Card className="w-full p-4 pt-3 examcard">
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 w-full" dir="rtl">
        <div className="col-span-1">
          <label className="font-medium text-muted-foreground text-base">תפקיד</label>
          <div className="h-1"></div>
          {isEditing ? (
            <Input
              type="text"
              name="role"
              value={oldRefData.role || ''}
              onChange={(e) => onOldRefChange('role', e.target.value)}
              className="text-sm pt-1 bg-white"
            />
          ) : (
            <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">{oldRefData.role || ''}</div>
          )}
        </div>
        <div className="col-span-1">
          <label className="font-medium text-muted-foreground text-base">מקור</label>
          <div className="h-1"></div>
          {isEditing ? (
            <Input
              type="text"
              name="source"
              value={oldRefData.source || ''}
              onChange={(e) => onOldRefChange('source', e.target.value)}
              className="text-sm bg-white"
            />
          ) : (
            <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">{oldRefData.source || ''}</div>
          )}
        </div>
        <div className="col-span-1">
          <label className="font-medium text-muted-foreground text-base">עדשות</label>
          <div className="h-1"></div>
          {isEditing ? (
            <Input
              type="text"
              name="contacts"
              value={oldRefData.contacts || ''}
              onChange={(e) => onOldRefChange('contacts', e.target.value)}
              className="text-sm bg-white"
            />
          ) : (
            <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">{oldRefData.contacts || ''}</div>
          )}
        </div>
      </div>
    </Card>
  )
} 