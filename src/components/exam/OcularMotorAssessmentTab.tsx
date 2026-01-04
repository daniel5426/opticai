import React from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { OcularMotorAssessmentExam } from "@/lib/db/schema-interface"

interface OcularMotorAssessmentTabProps {
  ocularMotorAssessmentData: OcularMotorAssessmentExam;
  onOcularMotorAssessmentChange: (field: keyof OcularMotorAssessmentExam, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
}

import { FastInput } from "./shared/OptimizedInputs"

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
        <div className="col-span-1">
          <div className="text-center">
            <label className="font-medium text-muted-foreground text-base">Ocular Mot</label>
          </div>
          <div className="h-1"></div>
          <FastInput
            type="text"
            name="ocular_motility"
            value={ocularMotorAssessmentData.ocular_motility || ''}
            onChange={(val) => onOcularMotorAssessmentChange('ocular_motility', val)}
            disabled={!isEditing}
            className={`text-sm pt-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
          />
        </div>
        <div className="col-span-1">
          <div className="text-center">
            <label className="font-medium text-muted-foreground text-base">ACC</label>
          </div>
          <div className="h-1"></div>
          <div className="flex gap-1 w-full">
            <FastInput
              type="number"
              name="acc_od"
              value={String(ocularMotorAssessmentData.acc_od || '')}
              onChange={(val) => onOcularMotorAssessmentChange('acc_od', val)}
              disabled={!isEditing}
              className={`text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              placeholder="OD"
            />
            <div className="flex items-center text-sm text-muted-foreground">/</div>
            <FastInput
              type="number"
              name="acc_os"
              value={String(ocularMotorAssessmentData.acc_os || '')}
              onChange={(val) => onOcularMotorAssessmentChange('acc_os', val)}
              disabled={!isEditing}
              className={`text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              placeholder="OS"
            />
          </div>
        </div>
        <div className="col-span-1">
          <div className="text-center">
            <label className="font-medium text-muted-foreground text-base">NPC</label>
          </div>
          <div className="h-1"></div>
          <div className="flex gap-1 w-full">
            <FastInput
              type="number"
              name="npc_break"
              value={String(ocularMotorAssessmentData.npc_break || '')}
              onChange={(val) => onOcularMotorAssessmentChange('npc_break', val)}
              disabled={!isEditing}
              className={`text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              placeholder="Break"
            />
            <FastInput
              type="number"
              name="npc_recovery"
              value={String(ocularMotorAssessmentData.npc_recovery || '')}
              onChange={(val) => onOcularMotorAssessmentChange('npc_recovery', val)}
              disabled={!isEditing}
              className={`text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              placeholder="Recovery"
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
