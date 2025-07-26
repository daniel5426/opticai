import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StereoTestData {
  fly_result?: boolean
  circle_score?: number
  circle_max?: number
}

interface StereoTestTabProps {
  stereoTestData: StereoTestData
  onStereoTestChange: (field: keyof StereoTestData, value: string | boolean | number) => void
  isEditing: boolean
  needsMiddleSpacer?: boolean
}

export function StereoTestTab({ stereoTestData, onStereoTestChange, isEditing, needsMiddleSpacer = false }: StereoTestTabProps) {
  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3" >
      <CardContent className="px-4" style={{ scrollbarWidth: 'none', direction: 'ltr' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Stereo Test</h3>
          </div>
          <div className="grid grid-cols-[50px_1fr] gap-2 items-center rtl">
            <div></div>
            <div className="text-center text-xs h-[16px] font-medium text-muted-foreground"></div>
            
            <div className="text-sm text-muted-foreground font-medium text-right">Fly</div>
            <Select size="xs"
              value={stereoTestData.fly_result === true ? "pass" : stereoTestData.fly_result === false ? "fail" : ""}
              onValueChange={(value) => onStereoTestChange('fly_result', value === 'pass')}
              disabled={!isEditing}
            >
              <SelectTrigger size="xs" className={`h-8 pr-4 text-center ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
                <SelectValue className={`h-8 pr-3 text-center justify-center`} placeholder="בחר" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">עבר</SelectItem>
                <SelectItem value="fail">נכשל</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground font-medium text-right">Circle</div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={stereoTestData.circle_score || ""}
                onChange={e => onStereoTestChange('circle_score', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground">/</span>
              <Input
                type="number"
                value={stereoTestData.circle_max || ""}
                onChange={e => onStereoTestChange('circle_max', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                placeholder="3"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 