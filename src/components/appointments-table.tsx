import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MoreHorizontal,
  ChevronDown,
  UserPlus,
  Users,
  Plus,
  Trash2,
  Edit,
  Loader2,
} from "lucide-react";
import { Appointment, Client, User } from "@/lib/db/schema-interface";
import { toast } from "sonner";
import { ClientSelectModal } from "@/components/ClientSelectModal";
import { cleanupModalArtifacts } from "@/lib/utils";
import { CustomModal } from "@/components/ui/custom-modal";
import { ClientWarningModal } from "@/components/ClientWarningModal";
import { UserSelect } from "@/components/ui/user-select";
import { useUser } from "@/contexts/UserContext";
import { Skeleton } from "@/components/ui/skeleton";
import { DateInput } from "@/components/ui/date";
import {
  getClientById,
  getAllClients,
  createClient,
} from "@/lib/db/clients-db";
import { getAllUsers } from "@/lib/db/users-db";
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from "@/lib/db/appointments-db";
import { useNavigate } from "@tanstack/react-router";
import { TableFiltersBar } from "@/components/table-filters-bar";
import {
  APPOINTMENT_DATE_SCOPE_OPTIONS,
  ALL_FILTER_VALUE,
} from "@/lib/table-filters";

interface AppointmentsTableProps {
  data: Appointment[];
  clientId: number;
  onAppointmentChange: () => void;
  onAppointmentDeleted: (appointmentId: number) => void;
  onAppointmentDeleteFailed: () => void;
  loading: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    setPage: (p: number) => void;
  };
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  examTypeFilter?: string;
  onExamTypeFilterChange?: (value: string) => void;
  dateScopeFilter?: string;
  onDateScopeFilterChange?: (value: string) => void;
}

interface AppointmentTableRowProps {
  appointment: Appointment;
  onEdit: (appointment: Appointment) => void;
  onDelete: (appointment: Appointment) => void;
  onSendEmail: (id: number) => void;
  clientId: number;
}

const AppointmentTableRow = React.memo(function AppointmentTableRow({
  appointment,
  onEdit,
  onDelete,
  onSendEmail,
  clientId,
}: AppointmentTableRowProps) {
  const navigate = useNavigate();

  return (
    <TableRow>
      <TableCell onClick={() => onEdit(appointment)} className="cursor-pointer">
        {appointment.date
          ? new Date(appointment.date).toLocaleDateString("he-IL")
          : ""}
      </TableCell>
      <TableCell onClick={() => onEdit(appointment)} className="cursor-pointer">
        {appointment.time}
      </TableCell>
      {clientId === 0 && (
        <TableCell
          className="cursor-pointer text-blue-600 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate({
              to: "/clients/$clientId",
              params: { clientId: String(appointment.client_id) },
              search: { tab: "appointments" },
            });
          }}
        >
          {appointment.client_full_name || ""}
        </TableCell>
      )}
      <TableCell onClick={() => onEdit(appointment)} className="cursor-pointer">
        {appointment.exam_name}
      </TableCell>
      <TableCell onClick={() => onEdit(appointment)} className="cursor-pointer">
        {appointment.examiner_name || ""}
      </TableCell>
      <TableCell onClick={() => onEdit(appointment)} className="cursor-pointer">
        {appointment.note}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(appointment);
            }}
            title="עריכה"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(appointment);
            }}
            title="מחיקה"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export function AppointmentsTable({
  data,
  clientId,
  onAppointmentChange,
  onAppointmentDeleted,
  onAppointmentDeleteFailed,
  loading,
  pagination,
  searchQuery: externalSearch,
  onSearchChange,
  examTypeFilter: externalExamTypeFilter,
  onExamTypeFilterChange,
  dateScopeFilter: externalDateScopeFilter,
  onDateScopeFilterChange,
}: AppointmentsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchValue =
    externalSearch !== undefined ? externalSearch : searchQuery;
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { currentUser, currentClinic } = useUser();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] =
    useState<Appointment | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [optimisticAppointments, setOptimisticAppointments] = useState<
    Appointment[]
  >([]);
  const [selectedExamType, setSelectedExamType] =
    useState<string>(ALL_FILTER_VALUE);
  const [selectedDateScope, setSelectedDateScope] =
    useState<string>(ALL_FILTER_VALUE);
  const [isSavingNewClientAppointment, setIsSavingNewClientAppointment] =
    useState(false);
  const examTypeFilter = externalExamTypeFilter ?? selectedExamType;
  const dateScopeFilter = externalDateScopeFilter ?? selectedDateScope;

  const handleExamTypeFilterChange = (value: string) => {
    if (onExamTypeFilterChange) {
      onExamTypeFilterChange(value);
      return;
    }
    setSelectedExamType(value);
  };

  const handleDateScopeFilterChange = (value: string) => {
    if (onDateScopeFilterChange) {
      onDateScopeFilterChange(value);
      return;
    }
    setSelectedDateScope(value);
  };

  const [appointmentFormData, setAppointmentFormData] = useState<
    Omit<Appointment, "id">
  >({
    client_id: clientId,
    user_id: currentUser?.id,
    date: "",
    time: "",
    duration: 30,
    exam_name: "",
    note: "",
  });

  const [newClientFormData, setNewClientFormData] = useState<{
    first_name: string;
    last_name: string;
    phone_mobile: string;
    email: string;
    user_id?: number;
    date: string;
    time: string;
    duration: number;
    exam_name: string;
    note: string;
  }>({
    first_name: "",
    last_name: "",
    phone_mobile: "",
    email: "",
    user_id: currentUser?.id,
    date: "",
    time: "",
    duration: 30,
    exam_name: "",
    note: "",
  });

  const [existingClientWarning, setExistingClientWarning] = useState<{
    show: boolean;
    clients: Client[];
    type: "name" | "phone" | "email" | "multiple";
  }>({
    show: false,
    clients: [],
    type: "name",
  });

  const allAppointments = React.useMemo(() => {
    const combined = [...optimisticAppointments, ...data];
    const seen = new Set<number>();
    const deduped: Appointment[] = [];
    for (const appt of combined) {
      if (typeof appt.id === "number") {
        if (seen.has(appt.id)) continue;
        seen.add(appt.id);
      }
      deduped.push(appt);
    }
    return deduped;
  }, [optimisticAppointments, data]);
  const finalFilteredData = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allAppointments.filter((appointment) => {
      if (
        examTypeFilter !== ALL_FILTER_VALUE &&
        appointment.exam_name !== examTypeFilter
      ) {
        return false;
      }

      if (dateScopeFilter !== ALL_FILTER_VALUE && appointment.date) {
        const appointmentDate = new Date(appointment.date);
        appointmentDate.setHours(0, 0, 0, 0);

        if (
          dateScopeFilter === "today" &&
          appointmentDate.getTime() !== today.getTime()
        ) {
          return false;
        }
        if (dateScopeFilter === "upcoming" && appointmentDate <= today) {
          return false;
        }
        if (dateScopeFilter === "past" && appointmentDate >= today) {
          return false;
        }
      }

      const searchLower = searchValue.toLowerCase().trim();
      if (!searchLower) {
        return true;
      }

      const searchableFields = [
        appointment.date || "",
        appointment.time || "",
        appointment.exam_name || "",
        appointment.note || "",
        appointment.client_full_name || "",
        appointment.examiner_name || "",
      ];

      return searchableFields.some((field) =>
        field.toLowerCase().includes(searchLower),
      );
    });
  }, [allAppointments, dateScopeFilter, examTypeFilter, searchValue]);

  const uniqueExamTypes = React.useMemo(() => {
    const types = new Set(
      allAppointments.map((a) => a.exam_name).filter(Boolean),
    );
    return Array.from(types);
  }, [allAppointments]);

  const dataToRender = finalFilteredData;

  const resetAllForms = () => {
    setAppointmentFormData({
      client_id: clientId,
      user_id: currentUser?.id,
      date: "",
      time: "",
      duration: 30,
      exam_name: "",
      note: "",
    });
    setNewClientFormData({
      first_name: "",
      last_name: "",
      phone_mobile: "",
      email: "",
      user_id: currentUser?.id,
      date: "",
      time: "",
      duration: 30,
      exam_name: "",
      note: "",
    });
    setSelectedClient(null);
    setEditingAppointment(null);
    setExistingClientWarning({ show: false, clients: [], type: "name" });
  };

  const closeAllDialogs = () => {
    setIsAppointmentDialogOpen(false);
    setIsNewClientDialogOpen(false);
    setIsClientSelectOpen(false);
    resetAllForms();
    setTimeout(() => {
      cleanupModalArtifacts();
    }, 100);
  };

  const handleAppointmentInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setAppointmentFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewClientInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setNewClientFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openDirectAppointmentDialog = () => {
    resetAllForms();
    setIsAppointmentDialogOpen(true);
  };

  React.useEffect(() => {
    const loadUsersOnce = async () => {
      try {
        const data = await getAllUsers();
        setUsers(data || []);
      } catch {}
    };
    loadUsersOnce();
  }, []);

  React.useEffect(() => {
    const handleOpenAppointmentModal = (e: CustomEvent) => {
      const appointmentId = e.detail?.appointmentId;
      if (appointmentId) {
        const appointment =
          dataToRender.find((a) => a.id === appointmentId) ||
          data.find((a) => a.id === appointmentId);
        if (appointment) {
          openEditDialog(appointment);
        }
      }
    };

    window.addEventListener(
      "openAppointmentModal",
      handleOpenAppointmentModal as EventListener,
    );
    return () =>
      window.removeEventListener(
        "openAppointmentModal",
        handleOpenAppointmentModal as EventListener,
      );
  }, [data]);

  const isVacation = (userId?: number, dateStr?: string) => {
    console.log("isVacation", userId, dateStr);
    if (!userId || !dateStr) return false;
    const u = users.find((x) => x.id === userId);
    if (!u) return false;
    const vacations = [
      ...(u.system_vacation_dates || []),
      ...(u.added_vacation_dates || []),
    ];
    console.log("vacations", vacations, vacations.includes(dateStr));
    return vacations.includes(dateStr);
  };

  const openNewClientDialog = () => {
    resetAllForms();
    setIsNewClientDialogOpen(true);
  };

  const openOldClientFlow = () => {
    resetAllForms();
    setIsClientSelectOpen(true);
  };

  const openEditDialog = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setAppointmentFormData({
      client_id: appointment.client_id,
      user_id: appointment.user_id || currentUser?.id,
      date: appointment.date || "",
      time: appointment.time || "",
      duration: appointment.duration || 30,
      exam_name: appointment.exam_name || "",
      note: appointment.note || "",
    });
    setIsAppointmentDialogOpen(true);
  };

  const handleClientSelect = async (selectedClientId: number) => {
    try {
      const client = await getClientById(selectedClientId);
      if (client) {
        setSelectedClient(client);
        setAppointmentFormData((prev) => ({
          ...prev,
          client_id: selectedClientId,
          duration: 30,
        }));
        setIsClientSelectOpen(false);
        setIsAppointmentDialogOpen(true);
      }
    } catch (error) {
      console.error("Error loading client:", error);
      toast.error("שגיאה בטעינת פרטי הלקוח");
    }
  };

  const handleSaveAppointment = async () => {
    console.log("handleSaveAppointment", appointmentFormData);
    try {
      const dateStr = appointmentFormData.date;
      const userId = appointmentFormData.user_id;
      if (isVacation(userId, dateStr)) {
        toast.error("לא ניתן לקבוע תור ביום חופשה של המשתמש");
        return;
      }
      if (editingAppointment) {
        const result = await updateAppointment({
          ...appointmentFormData,
          id: editingAppointment.id,
          client_id: appointmentFormData.client_id,
        });
        if (result) {
          toast.success("התור עודכן בהצלחה");
        } else {
          toast.error("שגיאה בעדכון התור");
        }
      } else {
        const examinerName = (() => {
          if (!appointmentFormData.user_id) return "";
          const u = users.find((x) => x.id === appointmentFormData.user_id);
          return (u?.full_name || u?.username || "").trim();
        })();

        const clientFullName = (() => {
          if (selectedClient?.first_name || selectedClient?.last_name) {
            const first = selectedClient?.first_name?.trim() || "";
            const last = selectedClient?.last_name?.trim() || "";
            return `${first} ${last}`.trim();
          }
          return "";
        })();

        // Optimistic create: add temporary appointment to the table immediately
        const tempId = -Date.now();
        const tempAppointment: Appointment = {
          id: tempId,
          client_id: appointmentFormData.client_id,
          clinic_id: currentClinic?.id,
          user_id: appointmentFormData.user_id,
          date: appointmentFormData.date,
          time: appointmentFormData.time,
          duration: appointmentFormData.duration,
          exam_name: appointmentFormData.exam_name,
          note: appointmentFormData.note,
          examiner_name: examinerName,
          client_full_name: clientFullName,
        } as Appointment;
        setOptimisticAppointments((prev) => [tempAppointment, ...prev]);

        if (!clientFullName && appointmentFormData.client_id) {
          (async () => {
            try {
              const client = await getClientById(appointmentFormData.client_id);
              if (client) {
                const first = client.first_name?.trim() || "";
                const last = client.last_name?.trim() || "";
                const fullName = `${first} ${last}`.trim();
                if (fullName) {
                  setOptimisticAppointments((prev) =>
                    prev.map((a) =>
                      a.id === tempId
                        ? { ...a, client_full_name: fullName }
                        : a,
                    ),
                  );
                }
              }
            } catch {}
          })();
        }

        // Fire-and-forget the actual creation, then reconcile
        (async () => {
          try {
            const result = await createAppointment({
              ...appointmentFormData,
              clinic_id: currentClinic?.id,
            });
            if (result) {
              toast.success("התור נוצר בהצלחה");
              const merged: Appointment = {
                ...(result as Appointment),
                examiner_name:
                  (result as Appointment).examiner_name || examinerName,
                client_full_name:
                  (result as Appointment).client_full_name || clientFullName,
              };
              setOptimisticAppointments((prev) =>
                prev.map((a) => (a.id === tempId ? merged : a)),
              );
            } else {
              setOptimisticAppointments((prev) =>
                prev.filter((a) => a.id !== tempId),
              );
              toast.error("שגיאה ביצירת התור");
            }
          } catch (error) {
            setOptimisticAppointments((prev) =>
              prev.filter((a) => a.id !== tempId),
            );
            toast.error("שגיאה ביצירת התור");
          }
        })();
      }
      closeAllDialogs();
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast.error("שגיאה בשמירת התור");
    }
  };

  const checkForExistingClients = async () => {
    if (
      !newClientFormData.first_name.trim() ||
      !newClientFormData.last_name.trim()
    ) {
      toast.error("שם פרטי ושם משפחה הם שדות חובה");
      return false;
    }

    try {
      const allClients = await getAllClients(currentClinic?.id);
      const existingClients: Client[] = [];
      let warningType: "name" | "phone" | "email" | "multiple" = "name";

      const nameMatches = allClients.filter(
        (client) =>
          client.first_name?.toLowerCase().trim() ===
            newClientFormData.first_name.toLowerCase().trim() &&
          client.last_name?.toLowerCase().trim() ===
            newClientFormData.last_name.toLowerCase().trim(),
      );

      const phoneMatches = newClientFormData.phone_mobile.trim()
        ? allClients.filter(
            (client) =>
              client.phone_mobile?.trim() ===
              newClientFormData.phone_mobile.trim(),
          )
        : [];

      const emailMatches = newClientFormData.email.trim()
        ? allClients.filter(
            (client) =>
              client.email?.toLowerCase().trim() ===
              newClientFormData.email.toLowerCase().trim(),
          )
        : [];

      const matchTypes = [];
      if (nameMatches.length > 0) {
        existingClients.push(...nameMatches);
        matchTypes.push("name");
      }
      if (phoneMatches.length > 0) {
        existingClients.push(...phoneMatches);
        matchTypes.push("phone");
      }
      if (emailMatches.length > 0) {
        existingClients.push(...emailMatches);
        matchTypes.push("email");
      }

      if (matchTypes.length > 1) {
        warningType = "multiple";
      } else if (matchTypes.length === 1) {
        warningType = matchTypes[0] as "name" | "phone" | "email";
      }

      if (existingClients.length > 0) {
        const uniqueClients = existingClients.filter(
          (client, index, self) =>
            index === self.findIndex((c) => c.id === client.id),
        );
        setExistingClientWarning({
          show: true,
          clients: uniqueClients,
          type: warningType,
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error checking for existing clients:", error);
      toast.error("שגיאה בבדיקת לקוחות קיימים");
      return false;
    }
  };

  const handleSaveNewClientAndAppointment = async (forceCreate = false) => {
    try {
      setIsSavingNewClientAppointment(true);
      if (!forceCreate) {
        const canProceed = await checkForExistingClients();
        if (!canProceed) {
          setIsSavingNewClientAppointment(false);
          return;
        }
      }

      if (isVacation(newClientFormData.user_id, newClientFormData.date)) {
        toast.error("לא ניתן לקבוע תור ביום חופשה של המשתמש");
        setIsSavingNewClientAppointment(false);
        return;
      }

      const newClient = await createClient({
        first_name: newClientFormData.first_name,
        last_name: newClientFormData.last_name,
        phone_mobile: newClientFormData.phone_mobile,
        email: newClientFormData.email,
        clinic_id: currentClinic?.id,
      });

      if (newClient && newClient.id) {
        const appointmentData = {
          client_id: newClient.id,
          clinic_id: currentClinic?.id,
          user_id: newClientFormData.user_id,
          date: newClientFormData.date,
          time: newClientFormData.time,
          duration: newClientFormData.duration,
          exam_name: newClientFormData.exam_name,
          note: newClientFormData.note,
        };

        const result = await createAppointment(appointmentData);
        if (result) {
          toast.success("לקוח חדש ותור נוצרו בהצלחה");
          closeAllDialogs();
          onAppointmentChange();
        } else {
          toast.error("שגיאה ביצירת התור");
        }
      } else {
        toast.error("שגיאה ביצירת הלקוח");
      }
    } catch (error) {
      console.error("Error creating client and appointment:", error);
      toast.error("שגיאה ביצירת לקוח ותור");
    } finally {
      setIsSavingNewClientAppointment(false);
    }
  };

  const handleUseExistingClient = async (existingClient: Client) => {
    try {
      if (isVacation(newClientFormData.user_id, newClientFormData.date)) {
        toast.error("לא ניתן לקבוע תור ביום חופשה של המשתמש");
        return;
      }
      const appointmentData = {
        client_id: existingClient.id!,
        clinic_id: currentClinic?.id,
        user_id: newClientFormData.user_id,
        date: newClientFormData.date,
        time: newClientFormData.time,
        duration: newClientFormData.duration,
        exam_name: newClientFormData.exam_name,
        note: newClientFormData.note,
      };

      const result = await createAppointment(appointmentData);
      if (result) {
        toast.success("תור נוצר עם לקוח קיים בהצלחה");
        closeAllDialogs();
        onAppointmentChange();
      } else {
        toast.error("שגיאה ביצירת התור");
      }
    } catch (error) {
      console.error("Error creating appointment with existing client:", error);
      toast.error("שגיאה ביצירת תור עם לקוח קיים");
    }
  };

  const handleDelete = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (appointmentToDelete && appointmentToDelete.id !== undefined) {
      try {
        const deletedAppointmentId = appointmentToDelete.id;
        onAppointmentDeleted(deletedAppointmentId);
        toast.success("התור נמחק בהצלחה");

        const result = await deleteAppointment(deletedAppointmentId);
        if (result) {
          toast.success("התור נמחק בהצלחה");
          onAppointmentDeleted(deletedAppointmentId);
        } else {
          toast.error("שגיאה במחיקת התור");
          onAppointmentDeleteFailed();
        }
      } catch (error) {
        toast.error("שגיאה במחיקת התור");
        onAppointmentDeleteFailed();
      } finally {
        setAppointmentToDelete(null);
      }
    }
    setIsDeleteModalOpen(false);
  };

  const handleSendTestEmail = async (appointmentId: number) => {
    try {
      toast.info("שולח תזכורת...");
      const result =
        await window.electronAPI.emailSendTestReminder(appointmentId);
      if (result) {
        toast.success("תזכורת נשלחה בהצלחה");
      } else {
        toast.error("שגיאה בשליחת התזכורת");
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("שגיאה בשליחת התזכורת");
    }
  };

  return (
    <div className="mb-10 space-y-2.5" style={{ scrollbarWidth: "none" }}>
      <TableFiltersBar
        searchValue={searchValue}
        onSearchChange={(value) =>
          onSearchChange ? onSearchChange(value) : setSearchQuery(value)
        }
        searchPlaceholder="חיפוש תורים…"
        filters={[
          {
            key: "date-scope",
            value: dateScopeFilter,
            onChange: handleDateScopeFilterChange,
            placeholder: "טווח תאריכים",
            options: APPOINTMENT_DATE_SCOPE_OPTIONS,
            widthClassName: "w-[160px]",
          },
          {
            key: "exam-type",
            value: examTypeFilter,
            onChange: handleExamTypeFilterChange,
            placeholder: "סוג בדיקה",
            options: [
              { value: ALL_FILTER_VALUE, label: "כל הבדיקות" },
              ...uniqueExamTypes.map((type) => ({
                value: type || "unknown",
                label: type || "unknown",
              })),
            ],
            widthClassName: "w-[190px]",
          },
        ]}
        hasActiveFilters={
          Boolean(searchValue.trim()) ||
          examTypeFilter !== ALL_FILTER_VALUE ||
          dateScopeFilter !== ALL_FILTER_VALUE
        }
        onReset={() => {
          if (onSearchChange) onSearchChange("");
          else setSearchQuery("");
          handleExamTypeFilterChange(ALL_FILTER_VALUE);
          handleDateScopeFilterChange(ALL_FILTER_VALUE);
        }}
        actions={
          clientId > 0 ? (
            <Button onClick={openDirectAppointmentDialog}>
              תור חדש
              <Plus className="mr-2 h-4 w-4" />
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  תור חדש <ChevronDown className="mr-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openNewClientDialog}>
                  <UserPlus className="ml-2 h-4 w-4" />
                  לקוח חדש
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openOldClientFlow}>
                  <Users className="ml-2 h-4 w-4" />
                  לקוח קיים
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      {/* Client Select Modal */}
      <ClientSelectModal
        isOpen={isClientSelectOpen}
        onClientSelect={handleClientSelect}
        onClose={() => setIsClientSelectOpen(false)}
      />

      {/* New Client Modal */}
      <CustomModal
        isOpen={isNewClientDialogOpen}
        onClose={closeAllDialogs}
        title="לקוח חדש ותור"
        className="sm:max-w-[500px]"
      >
        <div
          className="grid max-h-[60vh] gap-4 overflow-auto p-1"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-first-name" className="block text-right">
                שם פרטי *
              </Label>
              <Input
                id="new-first-name"
                name="first_name"
                value={newClientFormData.first_name}
                onChange={handleNewClientInputChange}
                dir="rtl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-last-name" className="block text-right">
                שם משפחה *
              </Label>
              <Input
                id="new-last-name"
                name="last_name"
                value={newClientFormData.last_name}
                onChange={handleNewClientInputChange}
                dir="rtl"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-email" className="block text-right">
                אימייל
              </Label>
              <Input
                id="new-email"
                name="email"
                type="email"
                value={newClientFormData.email}
                onChange={handleNewClientInputChange}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone" className="block text-right">
                טלפון נייד
              </Label>
              <Input
                id="new-phone"
                name="phone_mobile"
                value={newClientFormData.phone_mobile}
                onChange={handleNewClientInputChange}
                dir="rtl"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-date" className="block text-right">
                תאריך
              </Label>
              <DateInput
                name="date"
                value={newClientFormData.date}
                onChange={handleNewClientInputChange}
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-time" className="block text-right">
                שעה
              </Label>
              <Input
                id="new-time"
                name="time"
                type="time"
                value={newClientFormData.time}
                onChange={handleNewClientInputChange}
                style={{
                  textAlign: "right",
                  direction: "rtl",
                  paddingLeft: "55%",
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-exam-name" className="block text-right">
                סוג בדיקה
              </Label>
              <Input
                id="new-exam-name"
                name="exam_name"
                value={newClientFormData.exam_name}
                onChange={handleNewClientInputChange}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-examiner" className="block text-right">
                בודק
              </Label>
              <UserSelect
                value={newClientFormData.user_id}
                onValueChange={(userId) =>
                  setNewClientFormData((prev) => ({ ...prev, user_id: userId }))
                }
                users={users}
              />
            </div>
          </div>
          <div className="space-y-2 pb-2">
            <Label htmlFor="new-note" className="block text-right">
              הערות
            </Label>
            <Textarea
              id="new-note"
              name="note"
              value={newClientFormData.note}
              onChange={handleNewClientInputChange}
              dir="rtl"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-start gap-2">
          <Button
            onClick={() => handleSaveNewClientAndAppointment(false)}
            disabled={isSavingNewClientAppointment}
          >
            {isSavingNewClientAppointment && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            שמור
          </Button>
          <Button variant="outline" onClick={closeAllDialogs}>
            ביטול
          </Button>
        </div>
      </CustomModal>

      {/* Appointment Modal */}
      <CustomModal
        isOpen={isAppointmentDialogOpen}
        onClose={closeAllDialogs}
        title={
          editingAppointment
            ? "עריכת תור"
            : selectedClient
              ? `תור חדש - ${selectedClient.first_name} ${selectedClient.last_name}`
              : "תור חדש"
        }
        className="w-md"
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time" className="block text-right">
                שעה
              </Label>
              <Input
                id="time"
                name="time"
                type="time"
                value={appointmentFormData.time}
                onChange={handleAppointmentInputChange}
                style={{
                  textAlign: "right",
                  direction: "rtl",
                  paddingLeft: "55%",
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date" className="block text-right">
                תאריך
              </Label>
              <DateInput
                name="date"
                value={appointmentFormData.date}
                onChange={handleAppointmentInputChange}
                className="text-right"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exam_name" className="block text-right">
                סוג בדיקה
              </Label>
              <Input
                id="exam_name"
                name="exam_name"
                value={appointmentFormData.exam_name}
                onChange={handleAppointmentInputChange}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="examiner" className="block text-right">
                בודק
              </Label>
              <UserSelect
                value={appointmentFormData.user_id}
                onValueChange={(userId) =>
                  setAppointmentFormData((prev) => ({
                    ...prev,
                    user_id: userId,
                  }))
                }
                users={users}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note" className="block text-right">
              הערות
            </Label>
            <Textarea
              id="note"
              name="note"
              value={appointmentFormData.note}
              onChange={handleAppointmentInputChange}
              dir="rtl"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-start gap-2">
          <Button onClick={handleSaveAppointment}>שמור</Button>
          <Button variant="outline" onClick={closeAllDialogs}>
            ביטול
          </Button>
        </div>
      </CustomModal>

      {/* Client Warning Modal */}
      <ClientWarningModal
        isOpen={existingClientWarning.show}
        onClose={() =>
          setExistingClientWarning({ show: false, clients: [], type: "name" })
        }
        clients={existingClientWarning.clients}
        warningType={existingClientWarning.type}
        onUseExistingClient={handleUseExistingClient}
        onCreateNewAnyway={() => handleSaveNewClientAndAppointment(true)}
      />

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת תור"
        description={
          appointmentToDelete
            ? `האם אתה בטוח שברצונך למחוק את התור בתאריך ${appointmentToDelete.date ? new Date(appointmentToDelete.date).toLocaleDateString("he-IL") : ""}?`
            : "האם אתה בטוח שברצונך למחוק את התור?"
        }
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        cancelText="בטל"
      />

      <div className="bg-card rounded-md">
        <Table
          dir="rtl"
          containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain"
          containerStyle={{ scrollbarWidth: "none" }}
        >
          <TableHeader className="bg-card sticky top-0">
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">שעה</TableHead>
              {clientId === 0 && (
                <TableHead className="text-right">לקוח</TableHead>
              )}
              <TableHead className="text-right">סוג בדיקה</TableHead>
              <TableHead className="text-right">בודק</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="w-[50px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 14 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                  {clientId === 0 && (
                    <TableCell>
                      <Skeleton className="my-2 h-4 w-[70%]" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                </TableRow>
              ))
            ) : dataToRender.length > 0 ? (
              dataToRender.map((appointment) => (
                <AppointmentTableRow
                  key={appointment.id}
                  appointment={appointment}
                  onEdit={openEditDialog}
                  onDelete={handleDelete}
                  onSendEmail={handleSendTestEmail}
                  clientId={clientId}
                />
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-24 text-center"
                >
                  לא נמצאו תורים
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            עמוד {pagination.page} מתוך{" "}
            {Math.max(
              1,
              Math.ceil((pagination.total || 0) / (pagination.pageSize || 1)),
            )}{" "}
            · סה"כ {pagination.total || 0}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pagination.page <= 1}
              onClick={() =>
                pagination.setPage(Math.max(1, pagination.page - 1))
              }
            >
              הקודם
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                loading ||
                pagination.page >=
                  Math.ceil(
                    (pagination.total || 0) / (pagination.pageSize || 1),
                  )
              }
              onClick={() => pagination.setPage(pagination.page + 1)}
            >
              הבא
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
