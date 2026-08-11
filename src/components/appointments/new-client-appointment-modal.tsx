import * as React from "react";
import { Loader2 } from "lucide-react";

import {
  AppointmentFormFields,
  AppointmentFormValues,
} from "@/components/appointments/appointment-form-fields";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/ui/custom-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Appointment, ExamLayout, User } from "@/lib/db/schema-interface";

export type NewClientAppointmentFormValues = AppointmentFormValues &
  Pick<Appointment, "duration"> & {
    email: string;
    first_name: string;
    last_name: string;
    phone_mobile: string;
  };

export function NewClientAppointmentModal({
  isOpen,
  onClose,
  formData,
  users,
  examLayouts,
  saving,
  onChange,
  onSave,
  idPrefix = "new-client-appointment",
}: {
  isOpen: boolean;
  onClose: () => void;
  formData: NewClientAppointmentFormValues;
  users: User[];
  examLayouts: ExamLayout[];
  saving: boolean;
  onChange: (
    field: keyof NewClientAppointmentFormValues,
    value: string | number | null | undefined,
  ) => void;
  onSave: () => void;
  idPrefix?: string;
}) {
  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="לקוח חדש ותור"
      className="sm:max-w-[500px]"
    >
      <div className="grid max-h-[60vh] gap-4 overflow-auto p-1" dir="rtl">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor={`${idPrefix}-first-name`}
              className="block text-right"
            >
              שם פרטי *
            </Label>
            <Input
              id={`${idPrefix}-first-name`}
              value={formData.first_name}
              onChange={(event) => onChange("first_name", event.target.value)}
              dir="rtl"
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor={`${idPrefix}-last-name`}
              className="block text-right"
            >
              שם משפחה *
            </Label>
            <Input
              id={`${idPrefix}-last-name`}
              value={formData.last_name}
              onChange={(event) => onChange("last_name", event.target.value)}
              dir="rtl"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-email`} className="block text-right">
              אימייל
            </Label>
            <Input
              id={`${idPrefix}-email`}
              type="email"
              value={formData.email}
              onChange={(event) => onChange("email", event.target.value)}
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-phone`} className="block text-right">
              טלפון נייד
            </Label>
            <Input
              id={`${idPrefix}-phone`}
              value={formData.phone_mobile}
              onChange={(event) => onChange("phone_mobile", event.target.value)}
              dir="rtl"
            />
          </div>
        </div>

        <AppointmentFormFields
          formData={formData}
          users={users}
          examLayouts={examLayouts}
          onChange={onChange}
          autoDefaultToCurrentUser
          idPrefix={idPrefix}
        />
      </div>
      <div className="mt-4 flex justify-start gap-2" dir="rtl">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          ביטול
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
        </Button>
      </div>
    </CustomModal>
  );
}
