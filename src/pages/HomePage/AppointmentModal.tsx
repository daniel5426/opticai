import React from "react";
import { useTranslation } from "react-i18next";
import { AppointmentFormFields } from "@/components/appointments/appointment-form-fields";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/ui/custom-modal";
import { Trash2, Loader2, Play, IdCard, Phone, type LucideIcon } from "lucide-react";
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

function ClientInfoChip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <span className="border-border/60 bg-background inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
      <Icon className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium tabular-nums select-all" dir="ltr">
        {value.trim()}
      </span>
    </span>
  );
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
  const { t } = useTranslation();
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
          <div className="border-border/60 bg-muted/40 rounded-lg border p-3">
            <div className="text-muted-foreground text-xs font-medium">פרטי לקוח:</div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              {selectedClient.id ? (
                <GuardedRouterLink
                  to="/clients/$clientId"
                  params={{ clientId: String(selectedClient.id) }}
                  search={{ tab: "details" }}
                  className="text-primary text-base font-semibold hover:underline"
                >
                  {selectedClient.first_name} {selectedClient.last_name}
                </GuardedRouterLink>
              ) : (
                <span className="text-base font-semibold">
                  {selectedClient.first_name} {selectedClient.last_name}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <ClientInfoChip icon={IdCard} label={t("appointmentClientId")} value={selectedClient.national_id} />
                <ClientInfoChip icon={Phone} label={t("appointmentClientPhone")} value={selectedClient.phone_mobile} />
              </div>
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
