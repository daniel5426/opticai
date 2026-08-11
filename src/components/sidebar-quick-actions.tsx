import * as React from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { IconDots } from "@tabler/icons-react";
import { Loader2, SquarePen, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { AppointmentFormFields } from "@/components/appointments/appointment-form-fields";
import { flattenActiveExamLayouts } from "@/components/appointments/exam-layouts";
import { NewClientAppointmentModal } from "@/components/appointments/new-client-appointment-modal";
import { ClientSelectModal } from "@/components/ClientSelectModal";
import { ClientWarningModal } from "@/components/ClientWarningModal";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/ui/custom-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuAction } from "@/components/ui/sidebar";
import { useUser } from "@/contexts/UserContext";
import { useSettings } from "@/hooks/useSettings";
import { createAppointment } from "@/lib/db/appointments-db";
import {
  createClient,
  getAllClients,
  getClientById,
} from "@/lib/db/clients-db";
import { getAllExamLayouts } from "@/lib/db/exam-layouts-db";
import { createFile } from "@/lib/db/files-db";
import { getAllUsers } from "@/lib/db/users-db";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";
import {
  Appointment,
  Client,
  ExamLayout,
  User,
} from "@/lib/db/schema-interface";

export type SidebarQuickAction =
  | "appointment"
  | "client"
  | "exam"
  | "order"
  | "inventory"
  | "referral"
  | "file";

type ClientPickerFlow = "appointment" | "exam" | "file" | "order" | "referral";
type OrderType = "contact" | "regular";
type DuplicateWarning = {
  clients: Client[];
  type: "email" | "multiple" | "name" | "phone";
};

type AppointmentDraft = Pick<
  Appointment,
  | "client_id"
  | "date"
  | "duration"
  | "exam_layout_id"
  | "exam_name"
  | "note"
  | "time"
  | "user_id"
>;

type NewClientAppointmentDraft = Omit<AppointmentDraft, "client_id"> & {
  email: string;
  first_name: string;
  last_name: string;
  phone_mobile: string;
};

const createAppointmentDraft = (
  userId: number | undefined,
  duration: number,
): AppointmentDraft => ({
  client_id: 0,
  user_id: userId,
  date: "",
  time: "",
  duration,
  exam_name: "",
  exam_layout_id: null,
  note: "",
});

const createNewClientAppointmentDraft = (
  userId: number | undefined,
  duration: number,
): NewClientAppointmentDraft => ({
  ...createAppointmentDraft(userId, duration),
  first_name: "",
  last_name: "",
  phone_mobile: "",
  email: "",
});

const copyFileList = (files: FileList): FileList => {
  const fileArray = Array.from(files);
  return {
    ...files,
    length: fileArray.length,
    item: (index: number) => fileArray[index] || null,
    [Symbol.iterator]: function* () {
      yield* fileArray;
    },
  } as FileList;
};

const QuickActionButton = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ComponentPropsWithoutRef<"button">, "children"> & {
    action: SidebarQuickAction;
  }
>(({ action, type = "button", ...props }, ref) => {
  const isInventory = action === "inventory";
  const label = isInventory ? "פעולות מלאי" : "פעולה מהירה";

  return (
    <SidebarMenuAction
      ref={ref}
      showOnHover
      type={type}
      aria-label={label}
      title={label}
      {...props}
    >
      {isInventory ? <IconDots /> : <SquarePen />}
    </SidebarMenuAction>
  );
});
QuickActionButton.displayName = "QuickActionButton";

export function SidebarQuickActions({
  children,
}: {
  children: (
    renderQuickAction: (action: SidebarQuickAction) => React.ReactNode,
  ) => React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentClinic, currentUser } = useUser();
  const { settings } = useSettings();
  const appointmentDuration = settings?.appointment_duration || 30;
  const canWriteInventory = isRoleAtLeast(
    currentUser?.role_level,
    ROLE_LEVELS.worker,
  );

  const [clientPickerFlow, setClientPickerFlow] =
    React.useState<ClientPickerFlow | null>(null);
  const [isClientPickerOpen, setIsClientPickerOpen] = React.useState(false);
  const [examLayouts, setExamLayouts] = React.useState<ExamLayout[]>([]);
  const [isExamLayoutsLoading, setIsExamLayoutsLoading] = React.useState(false);
  const [selectedExamLayoutId, setSelectedExamLayoutId] = React.useState<
    number | null
  >(null);
  const [selectedOrderType, setSelectedOrderType] =
    React.useState<OrderType | null>(null);
  const [pendingFiles, setPendingFiles] = React.useState<FileList | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [appointmentUsers, setAppointmentUsers] = React.useState<User[]>([]);
  const [isExistingAppointmentOpen, setIsExistingAppointmentOpen] =
    React.useState(false);
  const [isNewClientAppointmentOpen, setIsNewClientAppointmentOpen] =
    React.useState(false);
  const [selectedAppointmentClient, setSelectedAppointmentClient] =
    React.useState<Client | null>(null);
  const [appointmentDraft, setAppointmentDraft] =
    React.useState<AppointmentDraft>(() =>
      createAppointmentDraft(currentUser?.id, appointmentDuration),
    );
  const [newClientAppointmentDraft, setNewClientAppointmentDraft] =
    React.useState<NewClientAppointmentDraft>(() =>
      createNewClientAppointmentDraft(currentUser?.id, appointmentDuration),
    );
  const [isSavingAppointment, setIsSavingAppointment] = React.useState(false);
  const [isSavingNewClientAppointment, setIsSavingNewClientAppointment] =
    React.useState(false);
  const [duplicateWarning, setDuplicateWarning] =
    React.useState<DuplicateWarning | null>(null);

  const resetAppointmentDrafts = React.useCallback(() => {
    setSelectedAppointmentClient(null);
    setAppointmentDraft(
      createAppointmentDraft(currentUser?.id, appointmentDuration),
    );
    setNewClientAppointmentDraft(
      createNewClientAppointmentDraft(currentUser?.id, appointmentDuration),
    );
  }, [appointmentDuration, currentUser?.id]);

  React.useEffect(() => {
    if (!isExistingAppointmentOpen && !isNewClientAppointmentOpen) return;
    void getAllUsers(currentClinic?.id).then(setAppointmentUsers);
  }, [
    currentClinic?.id,
    isExistingAppointmentOpen,
    isNewClientAppointmentOpen,
  ]);

  const openClientPicker = React.useCallback((flow: ClientPickerFlow) => {
    setClientPickerFlow(flow);
    setIsClientPickerOpen(true);
  }, []);

  const closeClientPicker = React.useCallback(() => {
    if (clientPickerFlow === "file") {
      setPendingFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setIsClientPickerOpen(false);
    setClientPickerFlow(null);
  }, [clientPickerFlow]);

  const loadExamLayouts = React.useCallback(async () => {
    if (!currentClinic?.id || isExamLayoutsLoading) return;
    setIsExamLayoutsLoading(true);
    try {
      const layouts = await getAllExamLayouts(currentClinic.id);
      setExamLayouts(flattenActiveExamLayouts(layouts));
    } catch (error) {
      console.error("Error loading sidebar exam layouts:", error);
      toast.error("שגיאה בטעינת סוגי הבדיקות");
    } finally {
      setIsExamLayoutsLoading(false);
    }
  }, [currentClinic?.id, isExamLayoutsLoading]);

  const isUserOnVacation = React.useCallback(
    (userId: number | undefined, date: string | undefined) => {
      if (!userId || !date) return false;
      const user = appointmentUsers.find(
        (candidate) => candidate.id === userId,
      );
      if (!user) return false;
      return [
        ...(user.system_vacation_dates || []),
        ...(user.added_vacation_dates || []),
      ].includes(date);
    },
    [appointmentUsers],
  );

  const createSidebarAppointment = React.useCallback(
    async (draft: AppointmentDraft, successMessage: string) => {
      if (!draft.client_id || draft.client_id <= 0) {
        toast.error("יש לבחור לקוח");
        return false;
      }
      if (isUserOnVacation(draft.user_id, draft.date)) {
        toast.error("לא ניתן לקבוע תור ביום חופשה של המשתמש");
        return false;
      }
      const appointment = await createAppointment({
        ...draft,
        clinic_id: currentClinic?.id,
      });
      if (!appointment) {
        toast.error("שגיאה ביצירת התור");
        return false;
      }
      window.dispatchEvent(
        new CustomEvent("appointmentsChanged", { detail: { appointment } }),
      );
      toast.success(successMessage);
      return true;
    },
    [currentClinic?.id, isUserOnVacation],
  );

  const saveExistingAppointment = React.useCallback(async () => {
    if (isSavingAppointment) return;
    setIsSavingAppointment(true);
    try {
      if (
        await createSidebarAppointment(appointmentDraft, "התור נוצר בהצלחה")
      ) {
        setIsExistingAppointmentOpen(false);
        resetAppointmentDrafts();
      }
    } catch (error) {
      console.error("Error saving sidebar appointment:", error);
      toast.error("שגיאה בשמירת התור");
    } finally {
      setIsSavingAppointment(false);
    }
  }, [
    appointmentDraft,
    createSidebarAppointment,
    isSavingAppointment,
    resetAppointmentDrafts,
  ]);

  const findDuplicateClients =
    React.useCallback(async (): Promise<DuplicateWarning | null> => {
      const firstName = newClientAppointmentDraft.first_name.trim();
      const lastName = newClientAppointmentDraft.last_name.trim();
      if (!firstName || !lastName) {
        toast.error("שם פרטי ושם משפחה הם שדות חובה");
        return null;
      }
      const clients = await getAllClients(currentClinic?.id);
      const matches: Client[] = [];
      const types: DuplicateWarning["type"][] = [];
      const nameMatches = clients.filter(
        (client) =>
          client.first_name?.toLowerCase().trim() === firstName.toLowerCase() &&
          client.last_name?.toLowerCase().trim() === lastName.toLowerCase(),
      );
      if (nameMatches.length) {
        matches.push(...nameMatches);
        types.push("name");
      }
      const phone = newClientAppointmentDraft.phone_mobile.trim();
      if (phone) {
        const phoneMatches = clients.filter(
          (client) => client.phone_mobile?.trim() === phone,
        );
        if (phoneMatches.length) {
          matches.push(...phoneMatches);
          types.push("phone");
        }
      }
      const email = newClientAppointmentDraft.email.trim().toLowerCase();
      if (email) {
        const emailMatches = clients.filter(
          (client) => client.email?.toLowerCase().trim() === email,
        );
        if (emailMatches.length) {
          matches.push(...emailMatches);
          types.push("email");
        }
      }
      if (!matches.length) return null;
      return {
        clients: matches.filter(
          (client, index, list) =>
            index === list.findIndex((candidate) => candidate.id === client.id),
        ),
        type: types.length > 1 ? "multiple" : types[0] || "name",
      };
    }, [currentClinic?.id, newClientAppointmentDraft]);

  const saveNewClientAppointment = React.useCallback(
    async (forceCreate = false) => {
      if (isSavingNewClientAppointment) return;
      setIsSavingNewClientAppointment(true);
      try {
        if (!forceCreate) {
          const warning = await findDuplicateClients();
          if (warning) {
            setDuplicateWarning(warning);
            return;
          }
          if (
            !newClientAppointmentDraft.first_name.trim() ||
            !newClientAppointmentDraft.last_name.trim()
          )
            return;
        }
        if (
          isUserOnVacation(
            newClientAppointmentDraft.user_id,
            newClientAppointmentDraft.date,
          )
        ) {
          toast.error("לא ניתן לקבוע תור ביום חופשה של המשתמש");
          return;
        }
        const client = await createClient({
          first_name: newClientAppointmentDraft.first_name,
          last_name: newClientAppointmentDraft.last_name,
          phone_mobile: newClientAppointmentDraft.phone_mobile,
          email: newClientAppointmentDraft.email,
          clinic_id: currentClinic?.id,
        });
        if (!client?.id) {
          toast.error("שגיאה ביצירת הלקוח");
          return;
        }
        if (
          await createSidebarAppointment(
            { ...newClientAppointmentDraft, client_id: client.id },
            "לקוח חדש ותור נוצרו בהצלחה",
          )
        ) {
          setDuplicateWarning(null);
          setIsNewClientAppointmentOpen(false);
          resetAppointmentDrafts();
        }
      } catch (error) {
        console.error("Error creating sidebar client appointment:", error);
        toast.error("שגיאה ביצירת לקוח ותור");
      } finally {
        setIsSavingNewClientAppointment(false);
      }
    },
    [
      createSidebarAppointment,
      currentClinic?.id,
      findDuplicateClients,
      isSavingNewClientAppointment,
      isUserOnVacation,
      newClientAppointmentDraft,
      resetAppointmentDrafts,
    ],
  );

  const uploadFiles = React.useCallback(
    async (files: FileList, clientId: number) => {
      try {
        for (const file of Array.from(files)) {
          if (file.size > 25 * 1024 * 1024) {
            toast.error(`קובץ "${file.name}" גדול מדי (מעל 25MB)`);
            continue;
          }
          const form = new FormData();
          form.append("client_id", String(clientId));
          form.append("notes", "");
          form.append("upload", file, file.name);
          const uploaded = await createFile(form);
          if (uploaded) {
            window.dispatchEvent(
              new CustomEvent("filesChanged", { detail: { file: uploaded } }),
            );
            toast.success(`קובץ "${file.name}" הועלה בהצלחה`);
          } else {
            toast.error(`שגיאה בהעלאת קובץ "${file.name}"`);
          }
        }
      } catch (error) {
        console.error("Error uploading sidebar files:", error);
        toast.error("שגיאה בהעלאת המסמך");
      }
    },
    [],
  );

  const handleClientSelect = React.useCallback(
    async (clientId: number) => {
      const flow = clientPickerFlow;
      if (!flow) return;
      if (flow === "exam" && selectedExamLayoutId) {
        navigate({
          to: "/clients/$clientId/exams/new",
          params: { clientId: String(clientId) },
          search: { layoutId: String(selectedExamLayoutId) },
        });
      } else if (flow === "order" && selectedOrderType) {
        navigate({
          to: "/clients/$clientId/orders/new",
          params: { clientId: String(clientId) },
          search: selectedOrderType === "contact" ? { type: "contact" } : {},
        });
      } else if (flow === "referral") {
        navigate({
          to: "/clients/$clientId/referrals/new",
          params: { clientId: String(clientId) },
        });
      } else if (flow === "file") {
        const files = pendingFiles;
        if (files) void uploadFiles(files, clientId);
      } else if (flow === "appointment") {
        try {
          const client = await getClientById(clientId);
          if (!client) {
            toast.error("שגיאה בטעינת פרטי הלקוח");
            return;
          }
          setSelectedAppointmentClient(client);
          setAppointmentDraft((current) => ({
            ...current,
            client_id: clientId,
          }));
          setIsExistingAppointmentOpen(true);
        } catch (error) {
          console.error("Error loading selected appointment client:", error);
          toast.error("שגיאה בטעינת פרטי הלקוח");
        }
      }
      setSelectedExamLayoutId(null);
      setSelectedOrderType(null);
      setPendingFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsClientPickerOpen(false);
      setClientPickerFlow(null);
    },
    [
      clientPickerFlow,
      navigate,
      pendingFiles,
      selectedExamLayoutId,
      selectedOrderType,
      uploadFiles,
    ],
  );

  const triggerInventoryAction = React.useCallback(
    (action: "count" | "discovery" | "export" | "import") => {
      if (location.pathname === "/inventory") {
        window.dispatchEvent(
          new CustomEvent("inventoryQuickAction", { detail: { action } }),
        );
        return;
      }
      try {
        sessionStorage.setItem("sidebar-inventory-quick-action", action);
      } catch (error) {
        console.error("Unable to save inventory quick action:", error);
      }
      navigate({ to: "/inventory" });
    },
    [location.pathname, navigate],
  );

  const renderQuickAction = React.useCallback(
    (action: SidebarQuickAction) => {
      if (action === "client") {
        return (
          <QuickActionButton
            action={action}
            onClick={() => navigate({ to: "/clients/new" })}
          />
        );
      }
      if (action === "referral") {
        return (
          <QuickActionButton
            action={action}
            onClick={() => openClientPicker("referral")}
          />
        );
      }
      if (action === "file") {
        return (
          <QuickActionButton
            action={action}
            onClick={() => fileInputRef.current?.click()}
          />
        );
      }
      if (action === "appointment") {
        return (
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <QuickActionButton action={action} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" align="start" sideOffset={8}>
              <DropdownMenuItem
                onClick={() => {
                  resetAppointmentDrafts();
                  void loadExamLayouts();
                  setIsNewClientAppointmentOpen(true);
                }}
              >
                <UserPlus className="ml-2 h-4 w-4" />
                לקוח חדש
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  resetAppointmentDrafts();
                  void loadExamLayouts();
                  openClientPicker("appointment");
                }}
              >
                <Users className="ml-2 h-4 w-4" />
                לקוח קיים
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
      if (action === "exam") {
        return (
          <DropdownMenu
            dir="rtl"
            onOpenChange={(open) => open && void loadExamLayouts()}
          >
            <DropdownMenuTrigger asChild>
              <QuickActionButton action={action} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" align="start" sideOffset={8}>
              {isExamLayoutsLoading ? (
                <DropdownMenuItem disabled>
                  טוען סוגי בדיקות...
                </DropdownMenuItem>
              ) : null}
              {!isExamLayoutsLoading && examLayouts.length === 0 ? (
                <DropdownMenuItem disabled>
                  אין סוגי בדיקות פעילים
                </DropdownMenuItem>
              ) : null}
              {examLayouts.map((layout) => (
                <DropdownMenuItem
                  key={layout.id}
                  onClick={() => {
                    if (!layout.id) return;
                    setSelectedExamLayoutId(layout.id);
                    openClientPicker("exam");
                  }}
                >
                  {layout.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
      if (action === "order") {
        return (
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <QuickActionButton action={action} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" align="start" sideOffset={8}>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedOrderType("regular");
                  openClientPicker("order");
                }}
              >
                משקפיים
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedOrderType("contact");
                  openClientPicker("order");
                }}
              >
                עדשות מגע
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
      if (action === "inventory") {
        return (
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <QuickActionButton action={action} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" align="start" sideOffset={8}>
              {canWriteInventory ? (
                <>
                  <DropdownMenuItem
                    onClick={() => triggerInventoryAction("count")}
                  >
                    ספירת מלאי
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => triggerInventoryAction("discovery")}
                  >
                    גילוי מהזמנות
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => triggerInventoryAction("import")}
                  >
                    ייבוא CSV
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem
                onClick={() => triggerInventoryAction("export")}
              >
                ייצוא CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
      return null;
    },
    [
      canWriteInventory,
      examLayouts,
      isExamLayoutsLoading,
      loadExamLayouts,
      navigate,
      openClientPicker,
      resetAppointmentDrafts,
      triggerInventoryAction,
    ],
  );

  return (
    <>
      {children(renderQuickAction)}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = event.target.files;
          if (!files?.length) return;
          setPendingFiles(copyFileList(files));
          openClientPicker("file");
        }}
      />

      <ClientSelectModal
        triggerText=""
        isOpen={isClientPickerOpen}
        onClose={closeClientPicker}
        onClientSelect={handleClientSelect}
      />

      <CustomModal
        isOpen={isExistingAppointmentOpen}
        onClose={() => {
          if (isSavingAppointment) return;
          setIsExistingAppointmentOpen(false);
          resetAppointmentDrafts();
        }}
        title={
          selectedAppointmentClient
            ? `תור חדש - ${selectedAppointmentClient.first_name} ${selectedAppointmentClient.last_name}`
            : "תור חדש"
        }
        className="w-md"
      >
        <div className="grid gap-4" dir="rtl">
          {selectedAppointmentClient ? (
            <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800">
              <div className="text-sm font-medium">פרטי לקוח:</div>
              <div className="text-muted-foreground text-sm">
                {selectedAppointmentClient.first_name}{" "}
                {selectedAppointmentClient.last_name} •{" "}
                {selectedAppointmentClient.phone_mobile}
              </div>
            </div>
          ) : null}
          <AppointmentFormFields
            formData={appointmentDraft}
            users={appointmentUsers}
            examLayouts={examLayouts}
            onChange={(field, value) => {
              if (field === "exam_layout_id") {
                const layout = examLayouts.find((item) => item.id === value);
                setAppointmentDraft((current) => ({
                  ...current,
                  exam_layout_id: layout?.id || null,
                  exam_name: layout?.name || current.exam_name || "",
                }));
                return;
              }
              setAppointmentDraft((current) => ({
                ...current,
                [field]: value,
              }));
            }}
            autoDefaultToCurrentUser
            idPrefix="sidebar-existing-appointment"
          />
        </div>
        <div className="mt-4 flex justify-start gap-2" dir="rtl">
          <Button
            variant="outline"
            onClick={() => {
              setIsExistingAppointmentOpen(false);
              resetAppointmentDrafts();
            }}
            disabled={isSavingAppointment}
          >
            ביטול
          </Button>
          <Button
            onClick={() => void saveExistingAppointment()}
            disabled={isSavingAppointment}
          >
            {isSavingAppointment ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "שמור"
            )}
          </Button>
        </div>
      </CustomModal>

      <NewClientAppointmentModal
        isOpen={isNewClientAppointmentOpen}
        onClose={() => {
          if (isSavingNewClientAppointment) return;
          setIsNewClientAppointmentOpen(false);
          resetAppointmentDrafts();
        }}
        formData={newClientAppointmentDraft}
        users={appointmentUsers}
        examLayouts={examLayouts}
        saving={isSavingNewClientAppointment}
        onChange={(field, value) => {
          if (field === "exam_layout_id") {
            const layout = examLayouts.find((item) => item.id === value);
            setNewClientAppointmentDraft((current) => ({
              ...current,
              exam_layout_id: layout?.id || null,
              exam_name: layout?.name || current.exam_name || "",
            }));
            return;
          }
          setNewClientAppointmentDraft((current) => ({
            ...current,
            [field]: value,
          }));
        }}
        onSave={() => void saveNewClientAppointment()}
        idPrefix="sidebar-new-client-appointment"
      />

      <ClientWarningModal
        isOpen={Boolean(duplicateWarning)}
        onClose={() => setDuplicateWarning(null)}
        clients={duplicateWarning?.clients || []}
        warningType={duplicateWarning?.type || "name"}
        onUseExistingClient={(client) => {
          void createSidebarAppointment(
            { ...newClientAppointmentDraft, client_id: client.id || 0 },
            "תור נוצר עם לקוח קיים בהצלחה",
          ).then((created) => {
            if (!created) return;
            setDuplicateWarning(null);
            setIsNewClientAppointmentOpen(false);
            resetAppointmentDrafts();
          });
        }}
        onCreateNewAnyway={() => void saveNewClientAppointment(true)}
      />
    </>
  );
}
