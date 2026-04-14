import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomModal } from "@/components/ui/custom-modal";
import { UserSelect } from "@/components/ui/user-select";
import { DateInput } from "@/components/ui/date";
import { Trash2, Loader2 } from "lucide-react";
import { Appointment, Client, User } from "@/lib/db/schema-interface";

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAppointment: Appointment | null;
  selectedClient: Client | null;
  formData: Omit<Appointment, "id">;
  users: User[];
  saving: boolean;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSave: () => void;
  onDelete: (appointmentId: number) => void;
  onUserChange: (userId: number) => void;
}

export function AppointmentModal({
  isOpen,
  onClose,
  editingAppointment,
  selectedClient,
  formData,
  users,
  saving,
  onInputChange,
  onSave,
  onDelete,
  onUserChange,
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
              {selectedClient.first_name} {selectedClient.last_name} •{" "}
              {selectedClient.phone_mobile}
            </div>
          </div>
        )}

        {/* First row - two columns */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="exam_name" className="block text-right">
              סוג בדיקה
            </Label>
            <Input
              id="exam_name"
              name="exam_name"
              value={formData.exam_name || ""}
              onChange={onInputChange}
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="examiner" className="block text-right">
              בודק
            </Label>
            <UserSelect
              value={formData.user_id}
              onValueChange={onUserChange}
              users={users}
              autoDefaultToCurrentUser={!editingAppointment}
            />
          </div>
        </div>

        {/* Second row - two columns */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="time" className="block text-right">
              שעה
            </Label>
            <Input
              id="time"
              name="time"
              type="time"
              value={formData.time || ""}
              onChange={onInputChange}
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date" className="block text-right">
              תאריך
            </Label>
            <DateInput
              name="date"
              value={formData.date || ""}
              onChange={onInputChange}
              className="justify-end"
            />
          </div>
        </div>

        {/* Third row - full width */}
        <div className="space-y-2">
          <Label htmlFor="note" className="block text-right">
            הערות
          </Label>
          <Textarea
            id="note"
            name="note"
            value={formData.note || ""}
            onChange={onInputChange}
            dir="rtl"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-2">
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
