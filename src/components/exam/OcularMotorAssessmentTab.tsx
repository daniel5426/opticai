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
          <Input
            type="text"
            name="ocular_motility"
            value={ocularMotorAssessmentData.ocular_motility || ''}
            onChange={(e) => onOcularMotorAssessmentChange('ocular_motility', e.target.value)}
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
            <Input
              type="number"
              name="acc_od"
              value={ocularMotorAssessmentData.acc_od || ''}
              onChange={(e) => onOcularMotorAssessmentChange('acc_od', e.target.value)}
              disabled={!isEditing}
              className={`text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              placeholder="OD"
            />
            <div className="flex items-center text-sm text-muted-foreground">/</div>
            <Input
              type="number"
              name="acc_os"
              value={ocularMotorAssessmentData.acc_os || ''}
              onChange={(e) => onOcularMotorAssessmentChange('acc_os', e.target.value)}
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
            <Input
              type="number"
              name="npc_break"
              value={ocularMotorAssessmentData.npc_break || ''}
              onChange={(e) => onOcularMotorAssessmentChange('npc_break', e.target.value)}
              disabled={!isEditing}
              className={`text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              placeholder="Break"
            />
            <Input
              type="number"
              name="npc_recovery"
              value={ocularMotorAssessmentData.npc_recovery || ''}
              onChange={(e) => onOcularMotorAssessmentChange('npc_recovery', e.target.value)}
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