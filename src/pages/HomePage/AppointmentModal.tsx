import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomModal } from "@/components/ui/custom-modal";
import { UserSelect } from "@/components/ui/user-select";
import { DateInput } from "@/components/ui/date";
import { TimeInput } from "@/components/ui/time";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Loader2, Play } from "lucide-react";
import { Appointment, Client, ExamLayout, User } from "@/lib/db/schema-interface";
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
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSave: () => void;
  onDelete: (appointmentId: number) => void;
  onUserChange: (userId: number) => void;
  onExamLayoutChange: (layoutId: number | null) => void;
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
  onInputChange,
  onSave,
  onDelete,
  onUserChange,
  onExamLayoutChange,
  onStartExam,
}: AppointmentModalProps) {
  const selectedLayoutId = formData.exam_layout_id
    ? String(formData.exam_layout_id)
    : "";

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
              •{" "}
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
            <Select
              value={selectedLayoutId || undefined}
              onValueChange={(value) => onExamLayoutChange(Number(value))}
            >
              <SelectTrigger id="exam_name" className="w-full text-right" dir="rtl">
                <SelectValue placeholder={formData.exam_name || "בחר סוג בדיקה"} />
              </SelectTrigger>
              <SelectContent>
                {formData.exam_name && !formData.exam_layout_id && (
                  <SelectItem value="legacy-exam-name" disabled>
                    {formData.exam_name}
                  </SelectItem>
                )}
                {examLayouts.map((layout) => (
                  <SelectItem key={layout.id} value={String(layout.id)}>
                    {layout.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <TimeInput
              id="time"
              name="time"
              value={formData.time || ""}
              onChange={onInputChange}
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
        {editingAppointment && (
          <Button
            variant="secondary"
            onClick={onStartExam}
            disabled={!formData.exam_layout_id}
            title={!formData.exam_layout_id ? "יש לבחור סוג בדיקה" : "התחל בדיקה"}
          >
            <Play className="h-4 w-4" />
            התחל בדיקה
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
