import React from "react";
import { AppointmentFormFields } from "@/components/appointments/appointment-form-fields";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/ui/custom-modal";
import { Trash2, Loader2, Play } from "lucide-react";
import {
  Appointment,
  Client,
  ExamLayout,
  User,
} from "@/lib/db/schema-interface";
import { GuardedRouterLink } from "@/components/GuardedRouterLink";

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAppointment: Appointment | null;
  selectedClient: Client | null;
  formData: Omit<Appointment, "id">;
  users: User[];
  examLayouts: ExamLayout[];
  saving: boolean;
  onFieldChange: (
    field:
      | "date"
      | "exam_layout_id"
      | "exam_name"
      | "note"
      | "time"
      | "user_id",
    value: string | number | null | undefined,
  ) => void;
  onSave: () => void;
  onDelete: (appointmentId: number) => void;
  onStartExam: () => void;
}

export function AppointmentModal({
  isOpen,
  onClose,
  editingAppointment,
  selectedClient,
  formData,
  users,
  examLayouts,
  saving,
  onFieldChange,
  onSave,
  onDelete,
  onStartExam,
}: AppointmentModalProps) {
  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingAppointment
          ? "עריכת תור"
          : selectedClient
            ? `תור חדש - ${selectedClient.first_name} ${selectedClient.last_name}`
            : "תור חדש"
      }
      className="border-none sm:max-w-[600px]"
    >
      <div className="grid gap-4">
        {selectedClient && (
          <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800">
            <div className="text-sm font-medium">פרטי לקוח:</div>
            <div className="text-muted-foreground text-sm">
              {selectedClient.id ? (
                <GuardedRouterLink
                  to="/clients/$clientId"
                  params={{ clientId: String(selectedClient.id) }}
                  search={{ tab: "details" }}
                  className="text-blue-600 hover:underline"
                >
                  {selectedClient.first_name} {selectedClient.last_name}
                </GuardedRouterLink>
              ) : (
                <>
                  {selectedClient.first_name} {selectedClient.last_name}
                </>
              )}{" "}
              • {selectedClient.phone_mobile}
            </div>
          </div>
        )}

        <AppointmentFormFields
          formData={formData}
          users={users}
          examLayouts={examLayouts}
          onChange={onFieldChange}
          autoDefaultToCurrentUser={!editingAppointment}
          idPrefix="calendar-appointment"
        />
      </div>
      <div className="mt-4 flex justify-center gap-2">
        {editingAppointment && (
          <Button
            variant="secondary"
            onClick={onStartExam}
            disabled={!formData.exam_layout_id}
            title={
              !formData.exam_layout_id ? "יש לבחור סוג בדיקה" : "התחל בדיקה"
            }
          >
            התחל בדיקה
            <Play className="h-4 w-4 -scale-x-100" />
          </Button>
        )}
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={() => {
            if (editingAppointment) {
              onDelete(editingAppointment.id!);
            }
            onClose();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </CustomModal>
  );
}
