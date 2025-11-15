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
          <label className="font-medium text-muted-foreground text-base">Ocular Mot</label>
          <div className="h-1"></div>
          {isEditing ? (
            <Input
              type="text"
              name="ocular_motility"
              value={ocularMotorAssessmentData.ocular_motility || ''}
              onChange={(e) => onOcularMotorAssessmentChange('ocular_motility', e.target.value)}
              className="text-sm pt-1 bg-white"
            />
          ) : (
            <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">{ocularMotorAssessmentData.ocular_motility || ''}</div>
          )}
        </div>
        <div className="col-span-1">
          <label className="font-medium text-muted-foreground text-base">ACC</label>
          <div className="h-1"></div>
          <div className="flex gap-1">
            {isEditing ? (
              <>
                <Input
                  type="number"
                  name="acc_od"
                  value={ocularMotorAssessmentData.acc_od || ''}
                  onChange={(e) => onOcularMotorAssessmentChange('acc_od', e.target.value)}
                  className="text-sm bg-white"
                  placeholder="OD"
                />
                <div className="flex items-center text-sm text-muted-foreground">/</div>
                <Input
                  type="number"
                  name="acc_os"
                  value={ocularMotorAssessmentData.acc_os || ''}
                  onChange={(e) => onOcularMotorAssessmentChange('acc_os', e.target.value)}
                  className="text-sm bg-white"
                  placeholder="OS"
                />
              </>
            ) : (
              <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">
                {ocularMotorAssessmentData.acc_od || ''} / {ocularMotorAssessmentData.acc_os || ''}
              </div>
            )}
          </div>
        </div>
        <div className="col-span-1">
          <label className="font-medium text-muted-foreground text-base">NPC</label>
          <div className="h-1"></div>
          <div className="flex gap-1">
            {isEditing ? (
              <>
                <Input
                  type="number"
                  name="npc_break"
                  value={ocularMotorAssessmentData.npc_break || ''}
                  onChange={(e) => onOcularMotorAssessmentChange('npc_break', e.target.value)}
                  className="text-sm bg-white"
                  placeholder="Break"
                />
                <Input
                  type="number"
                  name="npc_recovery"
                  value={ocularMotorAssessmentData.npc_recovery || ''}
                  onChange={(e) => onOcularMotorAssessmentChange('npc_recovery', e.target.value)}
                  className="text-sm bg-white"
                  placeholder="Recovery"
                />
              </>
            ) : (
              <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">
                {ocularMotorAssessmentData.npc_break || ''} {ocularMotorAssessmentData.npc_recovery || ''}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
} 