import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RGExam } from "@/lib/db/schema-interface"

interface RGTabProps {
  rgData: RGExam;
  onRGChange: (field: keyof RGExam, value: string | null) => void;
  isEditing: boolean;
  needsMiddleSpacer?: boolean;
}

export function RGTab({ rgData, onRGChange, isEditing, needsMiddleSpacer = false }: RGTabProps) {
  const handleStatusChange = (status: "suppression" | "fusion" | "diplopia" | null) => {
    onRGChange('rg_status', status);
  };

  const handleSuppressedEyeChange = (eye: "R" | "G" | null) => {
    onRGChange('suppressed_eye', eye);
  };

  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">R/G</h3>
          </div>
          <div className="text-center text-xs h-[12px] font-medium text-muted-foreground"></div>

          <div className="grid grid-cols-2 gap-2 items-center">
            <div className={`h-8 flex items-center justify-between space-x-2 px-3 rounded-md border ${isEditing ? 'bg-white' : 'bg-accent/50'}`}>
              <Checkbox
                id="suppression"
                checked={rgData.rg_status === "suppression"}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleStatusChange("suppression");
                  } else if (rgData.rg_status === "suppression") {
                    handleStatusChange(null);
                  }
                }}
                disabled={!isEditing}
                className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              />
              <label htmlFor="suppression" className="text-sm font-medium text-muted-foreground">
                דיכוי
              </label>
            </div>
            
            <Select
              value={rgData.suppressed_eye || ""}
              onValueChange={(value) => handleSuppressedEyeChange(value as "R" | "G" | null)}
              disabled={!isEditing || rgData.rg_status !== "suppression"}
            >
              <SelectTrigger size="xs" className={`h-8 pr-4 text-center ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
                <SelectValue className="h-8 pr-3 text-center justify-center" placeholder="בחר" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="R">R</SelectItem>
                <SelectItem value="G">G</SelectItem>
              </SelectContent>
            </Select>

            {needsMiddleSpacer && (
              <>
                <div className="h-8" />
                <div className="h-8" />
              </>
            )}

            <div className={`h-8 flex items-center justify-between space-x-2 px-3 rounded-md border ${isEditing ? 'bg-white' : 'bg-accent/50'}`}>
              <Checkbox
                id="fusion"
                checked={rgData.rg_status === "fusion"}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleStatusChange("fusion");
                  } else if (rgData.rg_status === "fusion") {
                    handleStatusChange(null);
                  }
                }}
                disabled={!isEditing}
                className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              />
              <label htmlFor="fusion" className="text-sm font-medium text-muted-foreground">
                מיזוג
              </label>
            </div>

            <div className={`h-8 flex items-center justify-between space-x-2 px-3 rounded-md border ${isEditing ? 'bg-white' : 'bg-accent/50'}`}>
              <Checkbox
                id="diplopia"
                checked={rgData.rg_status === "diplopia"}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleStatusChange("diplopia");
                  } else if (rgData.rg_status === "diplopia") {
                    handleStatusChange(null);
                  }
                }}
                disabled={!isEditing}
                className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              />
              <label htmlFor="diplopia" className="text-sm font-medium text-muted-foreground">
                כפל ראייה
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 