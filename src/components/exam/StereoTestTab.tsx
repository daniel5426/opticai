import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { StereoTestExam } from "@/lib/db/schema-interface"
import { FastInput, FastSelect } from "./shared/OptimizedInputs"

interface StereoTestTabProps {
  stereoTestData: StereoTestExam
  onStereoTestChange: (field: keyof StereoTestExam, value: string | boolean | number) => void
  isEditing: boolean
  needsMiddleSpacer?: boolean
}

export function StereoTestTab({ stereoTestData, onStereoTestChange, isEditing, needsMiddleSpacer = false }: StereoTestTabProps) {
  return (
    <Card className="w-full examcard pb-4 pt-3" >
      <CardContent className="px-4" style={{ scrollbarWidth: 'none', direction: 'ltr' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Stereo Test</h3>
          </div>
          <div className="grid grid-cols-[50px_1fr] gap-2 items-center rtl">
            <div></div>
            <div className="text-center text-xs h-[16px] font-medium text-muted-foreground"></div>

            <div className="text-sm text-muted-foreground font-medium text-right">Fly</div>
            <FastSelect
              value={stereoTestData.fly_result === true ? "pass" : stereoTestData.fly_result === false ? "fail" : ""}
              onChange={(value) => onStereoTestChange('fly_result', value === 'pass')}
              disabled={!isEditing}
              options={["pass", "fail"]}
              size="xs"
              triggerClassName={`h-8 pr-4 text-center disabled:opacity-100 disabled:cursor-default`}
            />

            {needsMiddleSpacer && (
              <>
                <div className="h-8" />
                <div className="h-8" />
              </>
            )}

            <div className="text-sm text-muted-foreground font-medium text-right">Circle</div>
            <div className="flex items-center gap-1">
              <FastInput
                type="number"
                value={String(stereoTestData.circle_score || "")}
                onChange={val => onStereoTestChange('circle_score', parseInt(val) || 0)}
                disabled={!isEditing}
                className={`h-8 text-xs flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground">/</span>
              <FastInput
                type="number"
                value={String(stereoTestData.circle_max || "")}
                onChange={val => onStereoTestChange('circle_max', parseInt(val) || 0)}
                disabled={!isEditing}
                className={`h-8 text-xs flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                placeholder="3"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
