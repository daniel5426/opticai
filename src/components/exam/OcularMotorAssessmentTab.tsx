import React from "react"
import { Card } from "@/components/ui/card"
import { OcularMotorAssessmentExam } from "@/lib/db/schema-interface"
import { FastInput } from "./shared/OptimizedInputs"

interface OcularMotorAssessmentTabProps {
  ocularMotorAssessmentData: OcularMotorAssessmentExam;
  onOcularMotorAssessmentChange: (field: keyof OcularMotorAssessmentExam, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
}

export const OcularMotorAssessmentTab: React.FC<OcularMotorAssessmentTabProps> = ({
  ocularMotorAssessmentData,
  onOcularMotorAssessmentChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}) => {
  return (
    <Card className="w-full p-4 pt-3 examcard">
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 w-full" dir="rtl">
        {/* Ocular Motility Column */}
        <div className="col-span-1 flex flex-col">
          <div className="text-center h-4 flex items-center justify-center">
            <label className="font-medium text-muted-foreground text-xs">Ocular Mot</label>
          </div>
          <div className="h-1"></div>
          <FastInput
            type="text"
            name="ocular_motility"
            value={ocularMotorAssessmentData.ocular_motility || ''}
            onChange={(val) => onOcularMotorAssessmentChange('ocular_motility', val)}
            disabled={!isEditing}
            className={`text-xs pt-1 h-8 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
          />
        </div>

        {/* ACC Column */}
        <div className="col-span-1">
          <div className="flex gap-1 w-full">
            <div className="flex-1 flex flex-col">
              <div className="text-center h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">OD</span>
              </div>
              <div className="h-1"></div>
              <FastInput
                type="number"
                name="acc_od"
                value={String(ocularMotorAssessmentData.acc_od || '')}
                onChange={(val) => onOcularMotorAssessmentChange('acc_od', val)}
                disabled={!isEditing}
                className={`text-xs h-8 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </div>
            <div className="flex items-end pb-2 text-sm text-muted-foreground">/</div>
            <div className="flex-1 flex flex-col">
              <div className="text-center h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">OS</span>
              </div>
              <div className="h-1"></div>
              <FastInput
                type="number"
                name="acc_os"
                value={String(ocularMotorAssessmentData.acc_os || '')}
                onChange={(val) => onOcularMotorAssessmentChange('acc_os', val)}
                disabled={!isEditing}
                className={`text-xs h-8 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </div>
          </div>
        </div>

        {/* NPC Column */}
        <div className="col-span-1">
          <div className="flex gap-1 w-full">
            <div className="flex-1 flex flex-col">
              <div className="text-center h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Break</span>
              </div>
              <div className="h-1"></div>
              <FastInput
                type="number"
                name="npc_break"
                value={String(ocularMotorAssessmentData.npc_break || '')}
                onChange={(val) => onOcularMotorAssessmentChange('npc_break', val)}
                disabled={!isEditing}
                className={`text-xs h-8 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="text-center h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Recovery</span>
              </div>
              <div className="h-1"></div>
              <FastInput
                type="number"
                name="npc_recovery"
                value={String(ocularMotorAssessmentData.npc_recovery || '')}
                onChange={(val) => onOcularMotorAssessmentChange('npc_recovery', val)}
                disabled={!isEditing}
                className={`text-xs h-8 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
