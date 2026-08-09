import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { StereoTestExam } from "@/lib/db/schema-interface"
import { FastInput, FastSelect } from "./shared/OptimizedInputs"
import { EXAM_FIELDS } from "./data/exam-field-definitions"

interface StereoTestTabProps {
  stereoTestData: StereoTestExam
  onStereoTestChange: (field: keyof StereoTestExam, value: string | boolean | number) => void
  isEditing: boolean
  needsMiddleSpacer?: boolean
}

export function StereoTestTab({ stereoTestData, onStereoTestChange, isEditing, needsMiddleSpacer = false }: StereoTestTabProps) {
  const score9 = stereoTestData.circle_9_score ?? stereoTestData.circle_score
  const score3 = stereoTestData.circle_3_score ?? stereoTestData.circle_max

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

            <div className="text-sm text-muted-foreground font-medium text-right">{EXAM_FIELDS.STEREO_FLY.label}</div>
            <FastSelect
              value={stereoTestData.fly_result === true ? "pass" : stereoTestData.fly_result === false ? "fail" : ""}
              onChange={(value) => onStereoTestChange('fly_result', value === 'pass')}
              disabled={!isEditing}
              options={[{ value: "pass", label: "Positive" }, { value: "fail", label: "Negative" }]}
              size="xs"
              triggerClassName={`h-8 pr-4 text-center disabled:opacity-100 disabled:cursor-default`}
            />

            {needsMiddleSpacer && (
              <>
                <div className="h-8" />
                <div className="h-8" />
              </>
            )}

            <div className="text-sm text-muted-foreground font-medium text-right">{EXAM_FIELDS.STEREO_CIRCLE.label}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-1">
              <FastInput
                type="number"
                min={EXAM_FIELDS.STEREO_CIRCLE.min}
                max={9}
                step={EXAM_FIELDS.STEREO_CIRCLE.step}
                value={String(score9 ?? "")}
                onChange={(value) => onStereoTestChange('circle_9_score', Math.min(9, Math.max(0, Number(value))))}
                disabled={!isEditing}
                className={`h-8 text-xs flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground">/ 9</span>
              </div>
              <div className="flex items-center gap-1">
                <FastInput type="number" min={0} max={3} step={1} value={String(score3 ?? "")}
                  onChange={(value) => onStereoTestChange('circle_3_score', Math.min(3, Math.max(0, Number(value))))}
                  disabled={!isEditing} className="h-8 min-w-0 flex-1 text-xs disabled:cursor-default disabled:opacity-100" />
                <span className="text-xs text-muted-foreground">/ 3</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
