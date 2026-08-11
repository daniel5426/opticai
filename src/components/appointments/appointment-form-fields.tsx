import * as React from "react";

import { DateInput } from "@/components/ui/date";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time";
import { UserSelect } from "@/components/ui/user-select";
import { Appointment, ExamLayout, User } from "@/lib/db/schema-interface";

export type AppointmentFormValues = Pick<
  Appointment,
  "date" | "exam_layout_id" | "exam_name" | "note" | "time" | "user_id"
>;

export function AppointmentFormFields({
  formData,
  users,
  examLayouts,
  onChange,
  autoDefaultToCurrentUser = false,
  idPrefix = "appointment",
}: {
  formData: AppointmentFormValues;
  users: User[];
  examLayouts: ExamLayout[];
  onChange: (
    field: keyof AppointmentFormValues,
    value: string | number | null | undefined,
  ) => void;
  autoDefaultToCurrentUser?: boolean;
  idPrefix?: string;
}) {
  const selectedLayoutId = formData.exam_layout_id
    ? String(formData.exam_layout_id)
    : "";

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label
            htmlFor={`${idPrefix}-exam-layout`}
            className="block text-right"
          >
            סוג בדיקה
          </Label>
          <Select
            value={selectedLayoutId}
            onValueChange={(value) =>
              onChange("exam_layout_id", value ? Number(value) : null)
            }
          >
            <SelectTrigger
              id={`${idPrefix}-exam-layout`}
              className="w-full text-right"
            >
              <SelectValue
                placeholder={formData.exam_name || "בחר סוג בדיקה"}
              />
            </SelectTrigger>
            <SelectContent>
              {formData.exam_name && !formData.exam_layout_id ? (
                <SelectItem value="legacy-exam-name" disabled>
                  {formData.exam_name}
                </SelectItem>
              ) : null}
              {examLayouts.map((layout) => (
                <SelectItem key={layout.id} value={String(layout.id)}>
                  {layout.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-examiner`} className="block text-right">
            בודק
          </Label>
          <UserSelect
            value={formData.user_id}
            onValueChange={(userId) => onChange("user_id", userId)}
            users={users}
            autoDefaultToCurrentUser={autoDefaultToCurrentUser}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-time`} className="block text-right">
            שעה
          </Label>
          <TimeInput
            id={`${idPrefix}-time`}
            name="time"
            value={formData.time || ""}
            onChange={(event) => onChange("time", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-date`} className="block text-right">
            תאריך
          </Label>
          <DateInput
            name="date"
            value={formData.date || ""}
            onChange={(event) => onChange("date", event.target.value)}
            className="justify-end"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-note`} className="block text-right">
          הערות
        </Label>
        <Textarea
          id={`${idPrefix}-note`}
          name="note"
          value={formData.note || ""}
          onChange={(event) => onChange("note", event.target.value)}
          dir="rtl"
        />
      </div>
    </>
  );
}
