import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { NPCExam } from "@/lib/db/schema-interface";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { FastInput, FastSelect } from "./shared/OptimizedInputs";

interface NPCTabProps {
  npcData: NPCExam;
  onNPCChange: (field: keyof NPCExam, value: string) => void;
  isEditing: boolean;
  needsMiddleSpacer?: boolean;
}

export function NPCTab({
  npcData,
  onNPCChange,
  isEditing,
  needsMiddleSpacer = false,
}: NPCTabProps) {
  return (
    <Card className="examcard w-full p-4 pt-3">
      <CardContent className="p-0">
        <div
          className="grid w-full grid-cols-[1.5fr_1fr_1fr] gap-x-3 gap-y-2"
          dir="rtl"
        >
          <div className="col-span-1 flex flex-col">
            <div className="flex h-4 items-center justify-center">
              <label className="text-muted-foreground text-xs font-medium">
                Ocular Mot
              </label>
            </div>
            <div className="h-1" />
            <FastInput
              type="text"
              name="ocular_motility"
              value={npcData.ocular_motility || ""}
              onChange={(value) => onNPCChange("ocular_motility", value)}
              disabled={!isEditing}
              className={`h-8 pt-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
            />
          </div>

          <div className="col-span-1 flex flex-col">
            <div className="flex h-4 items-center justify-center text-center">
              <label className="text-muted-foreground text-xs font-medium">
                {EXAM_FIELDS.NPC_RESULT.label}
              </label>
            </div>
            <div className="h-1" />
            <FastSelect
              value={npcData.eye_out_at_break || ""}
              onChange={(value) => onNPCChange("eye_out_at_break", value)}
              disabled={!isEditing}
              options={EXAM_FIELDS.NPC_RESULT.options || []}
              placeholder="Select"
              size="xs"
              center
              triggerClassName={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
            />
          </div>

          <div className="col-span-1">
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ["npc_break", "Break"],
                  ["npc_recovery", "Recovery"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="flex min-w-0 flex-col">
                  <div className="flex h-4 items-center justify-center">
                    <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
                      {label}
                    </span>
                  </div>
                  <div className="h-1" />
                  <FastInput
                    type="number"
                    name={field}
                    value={String(npcData[field] ?? "")}
                    onChange={(value) => onNPCChange(field, value)}
                    disabled={!isEditing}
                    min={EXAM_FIELDS.NPC_DISTANCE.min}
                    max={EXAM_FIELDS.NPC_DISTANCE.max}
                    step={EXAM_FIELDS.NPC_DISTANCE.step}
                    suffix={EXAM_FIELDS.NPC_DISTANCE.suffix}
                    className={`h-8 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                  />
                </div>
              ))}
            </div>
          </div>

          {needsMiddleSpacer && (
            <>
              <div className="col-span-3 h-8" />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
