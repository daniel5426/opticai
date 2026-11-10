import { campaignsEnabled } from "@/lib/feature-flags";
import { MessagingTab } from "@/components/settings/MessagingTab";
import { getAppearanceStore } from "@/lib/appearance";
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings, User, Clinic } from "@/lib/db/schema-interface";
import { getUsersByClinic, updateUser, deleteUser } from "@/lib/db/users-db";
import {
  applyCompanyThemeColors,
  cacheCompanyThemeColors,
} from "@/helpers/theme_helpers";
import { lookupTables } from "@/lib/db/lookup-db";
import { UserModal } from "@/components/UserModal";
import { useSettings } from "@/hooks/useSettings";
import { useUser } from "@/contexts/UserContext";
import { apiClient } from "@/lib/api-client";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { PreferencesTab } from "@/components/settings/PreferencesTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { EmailTab } from "@/components/settings/EmailTab";
import { DateRange } from "react-day-picker";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";
import { useQueryClient } from "@tanstack/react-query";

import { UsersTab } from "@/components/settings/UsersTab";
import { FieldDataTab } from "@/components/settings/FieldDataTab";
import { PersonalProfileTab } from "@/components/settings/PersonalProfileTab";
import { DiscountsTab } from "@/components/settings/DiscountsTab";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import { AboutTab } from "@/components/settings/AboutTab";
import { MigrationTab } from "@/components/settings/MigrationTab";
import { ClinicHolidaysTab } from "@/components/settings/ClinicHolidaysTab";
import { ClinicDataPruneTab } from "@/components/settings/ClinicDataPruneTab";
import { TrashTab } from "@/components/settings/TrashTab";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useUnsavedChanges } from "@/hooks/shared/useUnsavedChanges";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";

const SETTINGS_SNAPSHOT_FIELDS: (keyof Settings)[] = [
  "id",
  "clinic_id",
  "clinic_logo_path",
  "primary_theme_color",
  "secondary_theme_color",
  "work_start_time",
  "work_end_time",
  "appointment_duration",
  "send_email_before_appointment",
  "email_days_before",
  "email_time",
  "working_days",
  "break_start_time",
  "break_end_time",
  "max_appointments_per_day",
  "va_test_distance",
  "email_provider",
  "email_smtp_host",
  "email_smtp_port",
  "email_smtp_secure",
  "email_username",
  "email_password",
  "email_from_name",
];

const CLINIC_SNAPSHOT_FIELDS: (keyof Clinic)[] = [
  "id",
  "clinic_position",
  "email",
  "phone_number",
  "clinic_name",
  "clinic_address",
  "clinic_city",
  "clinic_postal_code",
  "clinic_directions",
  "clinic_website",
  "manager_name",
  "license_number",
  "has_entry_pin",
  "entry_pin",
];

const PROFILE_SNAPSHOT_FIELDS: (keyof User)[] = [
  "full_name",
  "email",
  "phone",
  "profile_picture",
  "primary_theme_color",
  "secondary_theme_color",
  "theme_preference",
  "system_vacation_dates",
  "added_vacation_dates",
  "va_format",
  "cyl_format",
  "sync_subjective_to_final_subjective",
  "import_order_to_old_refraction_default",
  "clinical_auto_advance_enabled",
];

function pickSnapshotFields<T extends object>(
  source: Partial<T>,
  fields: (keyof T)[],
): Partial<T> {
  return fields.reduce<Partial<T>>((acc, field) => {
    if (field in source) {
      acc[field] = source[field];
    }
    return acc;
  }, {});
}

function createSettingsUnsavedSnapshot(
  localSettings: Settings,
  localClinic: Partial<Clinic>,
  personalProfile: Partial<User>,
) {
  const clinicSnapshot = pickSnapshotFields(
    localClinic,
    CLINIC_SNAPSHOT_FIELDS,
  );
  clinicSnapshot.remove_entry_pin = localClinic.remove_entry_pin
    ? true
    : undefined;

  return sortSettingsValue({
    settings: pickSnapshotFields(localSettings, SETTINGS_SNAPSHOT_FIELDS),
    clinic: clinicSnapshot,
    personalProfile: pickSnapshotFields(
      personalProfile,
      PROFILE_SNAPSHOT_FIELDS,
    ),
  });
}

function sortSettingsValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortSettingsValue).filter((item) => item !== undefined);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const child = sortSettingsValue(
          (value as Record<string, unknown>)[key],
        );
        if (child !== undefined) acc[key] = child;
        return acc;
      }, {});
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  return value;
}

export default function SettingsPage() {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const { settings, updateSettings: updateBaseSettings } = useSettings();
  const { currentUser, currentClinic, setCurrentUser } = useUser();
  const queryClient = useQueryClient();
  const isWindowsElectron = window.electronAPI?.platform === "win32";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [colorUpdateTimeout, setColorUpdateTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Field data management state
  const [currentLookupTable, setCurrentLookupTable] = useState<string | null>(
    null,
  );
  const [lookupData, setLookupData] = useState<{ [key: string]: any[] }>({});
  const [loadingLookup, setLoadingLookup] = useState(false);

  const loadLookupData = async (tableName: string) => {
    const tableKey = tableName as keyof typeof lookupTables;
    if (!lookupTables[tableKey] || !currentClinic?.id) return;

    try {
      setLoadingLookup(true);
      const data = await lookupTables[tableKey].getAll(currentClinic.id);
      setLookupData((prev) => ({ ...prev, [tableName]: data }));
    } catch (error) {
      console.error(`Error loading ${tableName} data:`, error);
      toast.error(`שגיאה בטעינת נתוני ${lookupTables[tableKey].displayName}`);
    } finally {
      setLoadingLookup(false);
    }
  };

  const refreshLookupData = () => {
    if (currentLookupTable) {
      if (currentClinic?.id) {
        void queryClient.invalidateQueries({
          queryKey: ["lookup", currentClinic.id, currentLookupTable],
        });
      }
      loadLookupData(currentLookupTable);
    }
  };

  const selectLookupTable = (tableName: string) => {
    setCurrentLookupTable(tableName);
    if (!lookupData[tableName]) {
      loadLookupData(tableName);
    }
  };

  useEffect(() => {
    setLookupData({});
    if (currentLookupTable && currentClinic?.id) {
      loadLookupData(currentLookupTable);
    }
  }, [currentClinic?.id]);

  const [localSettings, setLocalSettings] = useState<Settings>({
    clinic_logo_path: "",
    work_start_time: "08:00",
    work_end_time: "18:00",
    appointment_duration: 30,
    send_email_before_appointment: false,
    email_days_before: 1,
    email_time: "10:00",
    working_days: '["sunday","monday","tuesday","wednesday","thursday"]',
    break_start_time: "",
    break_end_time: "",
    max_appointments_per_day: 20,
    va_test_distance: 6,
  });

  const [localClinic, setLocalClinic] = useState<Partial<Clinic>>({});

  // Personal profile state
  const [personalProfile, setPersonalProfile] = useState<Partial<User>>({
    full_name: "",
    email: "",
    phone: "",
    profile_picture: "",
    primary_theme_color: "#3f3f46",
    secondary_theme_color: "#f4f4f5",
    theme_preference: "system", //8b5cf6, 3b82f6
    system_vacation_dates: [],
    added_vacation_dates: [],
    va_format: "meter",
    cyl_format: "minus",
    sync_subjective_to_final_subjective: false,
    import_order_to_old_refraction_default: false,
    clinical_auto_advance_enabled: true,
  });
  const [profileColorUpdateTimeout, setProfileColorUpdateTimeout] =
    useState<NodeJS.Timeout | null>(null);

  // Google Calendar state
  const [settingsBaselineVersion, setSettingsBaselineVersion] = useState(0);
  const [savedSettingsSnapshot, setSavedSettingsSnapshot] = useState<
    string | null
  >(null);
  const dirtyVersionRef = useRef(0);
  const [settingsDirtyVersion, setSettingsDirtyVersion] = useState(0);
  const [savedSettingsDirtyVersion, setSavedSettingsDirtyVersion] = useState(0);

  const currentSettingsSnapshot = useMemo(
    () =>
      JSON.stringify(
        createSettingsUnsavedSnapshot(
          localSettings,
          localClinic,
          personalProfile,
        ),
      ),
    [localSettings, localClinic, personalProfile],
  );

  const hasSettingsUnsavedChanges =
    savedSettingsSnapshot !== null &&
    settingsDirtyVersion !== savedSettingsDirtyVersion &&
    currentSettingsSnapshot !== savedSettingsSnapshot;

  const markSettingsDirty = useCallback(() => {
    dirtyVersionRef.current += 1;
    setSettingsDirtyVersion(dirtyVersionRef.current);
  }, []);

  const getSerializedState = useCallback(
    () => currentSettingsSnapshot,
    [currentSettingsSnapshot],
  );

  const {
    showUnsavedDialog,
    handleUnsavedConfirm,
    handleUnsavedCancel,
    setBaseline,
    baselineInitializedRef,
  } = useUnsavedChanges({
    getSerializedState,
    isEditing: hasSettingsUnsavedChanges,
    isNewMode: false,
  });

  useEffect(() => {
    let isActive = true;
    baselineInitializedRef.current = false;
    setLoading(true);

    const loadSettings = async () => {
      try {
        if (settings) {
          setLocalSettings(settings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error("שגיאה בטעינת ההגדרות");
      }
    };
    const loadClinic = async () => {
      try {
        if (currentClinic?.id) {
          const resp = await apiClient.getClinic(currentClinic.id);
          if (resp.data) setLocalClinic(resp.data as Clinic);
        }
      } catch (e) {
        console.error("Error loading clinic:", e);
      }
    };

    const loadUsers = async () => {
      try {
        setUsersLoading(true);
        if (currentClinic?.id) {
          // Other users can only see users in their clinic
          const usersData = await getUsersByClinic(currentClinic.id);
          setUsers(usersData);
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error("Error loading users:", error);
        toast.error("שגיאה בטעינת המשתמשים");
      } finally {
        setUsersLoading(false);
      }
    };

    const loadPersonalProfile = () => {
      if (currentUser) {
        setPersonalProfile({
          full_name: currentUser.full_name || "",
          email: currentUser.email || "",
          phone: currentUser.phone || "",
          profile_picture: currentUser.profile_picture || "",
          primary_theme_color: currentUser.primary_theme_color || "#3f3f46",
          secondary_theme_color: currentUser.secondary_theme_color || "#f4f4f5",
          theme_preference: currentUser.theme_preference || "system",
          system_vacation_dates: currentUser.system_vacation_dates || [],
          added_vacation_dates: currentUser.added_vacation_dates || [],
          va_format: currentUser.va_format || "meter",
          cyl_format: currentUser.cyl_format || "minus",
          sync_subjective_to_final_subjective:
            currentUser.sync_subjective_to_final_subjective || false,
          import_order_to_old_refraction_default:
            currentUser.import_order_to_old_refraction_default || false,
          clinical_auto_advance_enabled:
            currentUser.clinical_auto_advance_enabled !== false,
        });
      }
    };

    const loadInitialData = async () => {
      await Promise.all([loadSettings(), loadClinic()]);
      if (isActive) {
        setSettingsBaselineVersion((prev) => prev + 1);
        setLoading(false);
      }
    };

    loadInitialData();
    loadUsers();
    loadPersonalProfile();

    return () => {
      isActive = false;
      if (colorUpdateTimeout) {
        clearTimeout(colorUpdateTimeout);
      }
      if (profileColorUpdateTimeout) {
        clearTimeout(profileColorUpdateTimeout);
      }
    };
  }, [baselineInitializedRef, currentClinic?.id, settings, currentUser]);

  useEffect(() => {
    if (
      loading ||
      settingsBaselineVersion === 0 ||
      baselineInitializedRef.current
    )
      return;
    const baselineSnapshot = createSettingsUnsavedSnapshot(
      localSettings,
      localClinic,
      personalProfile,
    );
    setSavedSettingsSnapshot(JSON.stringify(baselineSnapshot));
    setSavedSettingsDirtyVersion(dirtyVersionRef.current);
    setBaseline(baselineSnapshot);
  }, [
    baselineInitializedRef,
    loading,
    localClinic,
    localSettings,
    personalProfile,
    setBaseline,
    settingsBaselineVersion,
  ]);

  const handleInputChange = (
    field: keyof Settings,
    value: string | number | boolean,
  ) => {
    markSettingsDirty();
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);
  };

  const handleClinicChange = (field: keyof Clinic, value: any) => {
    markSettingsDirty();
    const updated = { ...localClinic, [field]: value };
    setLocalClinic(updated);
  };

  const handlePersonalProfileChange = (field: keyof User, value: any) => {
    markSettingsDirty();
    const newProfile = { ...personalProfile, [field]: value };
    setPersonalProfile(newProfile);
    if (field === "email" && emailError) {
      setEmailError(null);
    }

    // Note: primary_theme_color is now only used for appointment coloring, not for app theme
    // App theme colors come from company settings
  };

  const handleSave = async () => {
    const saveDirtyVersion = dirtyVersionRef.current;

    try {
      setSaving(true);
      setSaveSuccess(false);
      setEmailError(null);

      // Unified save API call
      const payload: any = {
        clinic_id: currentClinic?.id,
        settings_id: localSettings.id,
      };
      // Map clinic fields to backend ClinicUpdate names
      if (currentClinic?.id) {
        const entryPin =
          typeof localClinic.entry_pin === "string"
            ? localClinic.entry_pin.trim()
            : "";
        payload.clinic = {
          clinic_position: localClinic.clinic_position || undefined,
          email: localClinic.email || undefined,
          phone_number: localClinic.phone_number || undefined,
          clinic_name: localClinic.clinic_name || undefined,
          clinic_address: localClinic.clinic_address || undefined,
          clinic_city: localClinic.clinic_city || undefined,
          clinic_postal_code: localClinic.clinic_postal_code || undefined,
          clinic_directions: localClinic.clinic_directions || undefined,
          clinic_website: localClinic.clinic_website || undefined,
          manager_name: localClinic.manager_name || undefined,
          license_number: localClinic.license_number || undefined,
          entry_pin: entryPin || undefined,
          remove_entry_pin: localClinic.remove_entry_pin || undefined,
        };
      }
      payload.settings = {
        ...localSettings,
        clinic_id: localSettings.clinic_id || currentClinic?.id,
      };
      if (currentUser?.id) {
        payload.user_id = currentUser.id;
        payload.user = {
          full_name: personalProfile.full_name || currentUser.full_name,
          email: personalProfile.email,
          phone: personalProfile.phone,
          profile_picture: personalProfile.profile_picture,
          primary_theme_color: personalProfile.primary_theme_color,
          secondary_theme_color: personalProfile.secondary_theme_color,
          theme_preference: getAppearanceStore().getSnapshot().mode,
          system_vacation_dates: personalProfile.system_vacation_dates,
          added_vacation_dates: personalProfile.added_vacation_dates,
          va_format: personalProfile.va_format,
          cyl_format: personalProfile.cyl_format,
          sync_subjective_to_final_subjective:
            personalProfile.sync_subjective_to_final_subjective,
          import_order_to_old_refraction_default:
            personalProfile.import_order_to_old_refraction_default,
          clinical_auto_advance_enabled:
            personalProfile.clinical_auto_advance_enabled,
        };
      }

      const unifiedResp = await apiClient.saveAll(payload);
      if (unifiedResp.error) {
        if (String(unifiedResp.error).includes("EMAIL_ALREADY_REGISTERED")) {
          setEmailError("האימייל הזה כבר נמצא בשימוש");
          toast.error("האימייל הזה כבר נמצא בשימוש במערכת");
          return;
        }
        toast.error("שגיאה בשמירת ההגדרות");
        return;
      }
      const data = unifiedResp.data as any;
      let nextClinic = localClinic;
      let nextSettings = localSettings;
      let nextProfile = personalProfile;

      if (data?.clinic) {
        nextClinic = {
          ...(data.clinic as Clinic),
          entry_pin: "",
          remove_entry_pin: false,
        };
        setLocalClinic(nextClinic);
      }
      if (data?.settings) {
        nextSettings = data.settings as Settings;
        setLocalSettings(nextSettings);
        updateBaseSettings(nextSettings);
      }
      if (data?.user) {
        const updatedUser = data.user as User;

        const normalizeDates = (v: any): string[] => {
          if (Array.isArray(v)) return v as string[];
          if (typeof v === "string") {
            try {
              const parsed = JSON.parse(v);
              return Array.isArray(parsed) ? (parsed as string[]) : [];
            } catch {
              return [];
            }
          }
          return [];
        };

        const newProfile = {
          full_name: updatedUser.full_name ?? personalProfile.full_name ?? "",
          email: updatedUser.email ?? personalProfile.email ?? "",
          phone: updatedUser.phone ?? personalProfile.phone ?? "",
          profile_picture:
            updatedUser.profile_picture ??
            personalProfile.profile_picture ??
            "",
          primary_theme_color:
            updatedUser.primary_theme_color ??
            personalProfile.primary_theme_color ??
            "#3f3f46",
          secondary_theme_color:
            updatedUser.secondary_theme_color ??
            personalProfile.secondary_theme_color ??
            "#f4f4f5",
          theme_preference:
            updatedUser.theme_preference ??
            personalProfile.theme_preference ??
            "system",
          system_vacation_dates:
            updatedUser.system_vacation_dates !== undefined &&
            updatedUser.system_vacation_dates !== null
              ? normalizeDates(updatedUser.system_vacation_dates)
              : (personalProfile.system_vacation_dates as string[]) || [],
          added_vacation_dates:
            updatedUser.added_vacation_dates !== undefined &&
            updatedUser.added_vacation_dates !== null
              ? normalizeDates(updatedUser.added_vacation_dates)
              : (personalProfile.added_vacation_dates as string[]) || [],
          va_format:
            updatedUser.va_format ?? personalProfile.va_format ?? "meter",
          cyl_format:
            updatedUser.cyl_format ?? personalProfile.cyl_format ?? "minus",
          sync_subjective_to_final_subjective:
            updatedUser.sync_subjective_to_final_subjective ??
            personalProfile.sync_subjective_to_final_subjective ??
            false,
          import_order_to_old_refraction_default:
            updatedUser.import_order_to_old_refraction_default ??
            personalProfile.import_order_to_old_refraction_default ??
            false,
          clinical_auto_advance_enabled:
            updatedUser.clinical_auto_advance_enabled ??
            personalProfile.clinical_auto_advance_enabled ??
            true,
        };

        nextProfile = newProfile;
        setPersonalProfile(newProfile);

        await setCurrentUser(updatedUser, true);
        // Reflect changes immediately in users list (if present)
        setUsers((prev) =>
          prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
        );
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
      const savedSnapshot = createSettingsUnsavedSnapshot(
        nextSettings,
        nextClinic,
        nextProfile,
      );
      setSavedSettingsSnapshot(JSON.stringify(savedSnapshot));
      if (dirtyVersionRef.current === saveDirtyVersion) {
        setSavedSettingsDirtyVersion(saveDirtyVersion);
      }
      setBaseline(savedSnapshot);
      toast.success("כל ההגדרות נשמרו בהצלחה");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("שגיאה בשמירת ההגדרות");
    } finally {
      setSaving(false);
    }
  };

  // Image upload handled via ImageInput component

  // User management handlers
  const openCreateUserModal = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const openEditUserModal = (user: User) => {
    if (
      !isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo) &&
      user.id !== currentUser?.id
    ) {
      toast.error("אין לך הרשאה לערוך משתמש זה");
      return;
    }

    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleUserDelete = async (userId: number) => {
    if (!isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo)) {
      toast.error("אין לך הרשאה למחוק משתמשים");
      return;
    }

    if (userId === currentUser?.id) {
      toast.error("לא ניתן למחוק את המשתמש הנוכחי");
      return;
    }

    if (window.confirm("האם אתה בטוח שברצונך למחוק את המשתמש?")) {
      try {
        const success = await deleteUser(userId);
        if (success) {
          setUsers((prev) => prev.filter((u) => u.id !== userId));
          toast.success("המשתמש נמחק בהצלחה");
        } else {
          toast.error("שגיאה במחיקת המשתמש");
        }
      } catch (error) {
        console.error("Error deleting user:", error);
        toast.error("שגיאה במחיקת המשתמש");
      }
    }
  };

  const handleTestEmailConnection = async () => {
    try {
      toast.info("בודק חיבור אימייל...");
      const result = await window.electronAPI.emailTestConnection(
        currentClinic?.id,
      );
      if (result) {
        toast.success("חיבור האימייל תקין!");
      } else {
        toast.error("שגיאה בחיבור האימייל. בדוק את ההגדרות.");
      }
    } catch (error) {
      console.error("Error testing email connection:", error);
      toast.error("שגיאה בבדיקת חיבור האימייל");
    }
  };

  // Google Calendar handlers
  if (loading) {
    return (
      <>
        <SiteHeader title={t("settingsTitle")} />
        <div
          className="flex h-full flex-col items-center justify-center"
          dir={direction}
        >
          <div className="text-lg">{t("loadingSettings")}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader title={t("settingsTitle")} />
      <div className="flex h-[calc(100vh-4rem)] flex-col" dir={direction}>
        {/* Fixed Header */}
        <div className="shrink-0 bg-transparent pt-5 pb-2">
          <div className="mx-auto flex max-w-4xl items-start justify-between">
            <div className="space-y-2 text-start">
              <h1 className="text-2xl font-bold">{t("clinicSettings")}</h1>
              <p className="text-muted-foreground">
                {t("clinicSettingsDescription")}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-6 pl-1">
              {hasSettingsUnsavedChanges && !saving && (
                <div className="animate-fade-in flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>{t("unsavedChanges")}</span>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className="relative h-10 w-[140px] px-8 shadow-md"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`transition-opacity duration-150 ${saving ? "opacity-0" : "opacity-100"}`}
                  >
                    <span>{t("saveAll")}</span>
                  </div>
                  <div
                    className={`absolute transition-opacity duration-150 ${saving ? "opacity-100" : "opacity-0"}`}
                  >
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  </div>
                </div>
              </Button>

              {saveSuccess && (
                <div className="animate-fade-in flex items-center text-green-600">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <div className="flex-1 overflow-hidden">
          <div className="mx-auto h-full max-w-[950px]">
            <Tabs
              defaultValue="personal-profile"
              className="flex h-full"
              orientation="vertical"
              dir={direction}
            >
              <div
                className="flex h-full flex-row-reverse gap-6 p-6"
                dir={direction}
              >
                {/* Scrollable Content Area */}
                <div
                  className="flex-1 overflow-y-auto pr-2 pb-8"
                  style={{ scrollbarWidth: "none" }}
                >
                  <TabsContent value="profile" className="mt-0 space-y-6">
                    <ProfileTab
                      localClinic={localClinic}
                      onClinicChange={handleClinicChange}
                    />
                  </TabsContent>

                  <TabsContent value="preferences" className="mt-0 space-y-6">
                    <PreferencesTab
                      localSettings={localSettings}
                      onInputChange={handleInputChange}
                    />
                  </TabsContent>

                  <TabsContent value="notifications" className="mt-0 space-y-6">
                    <NotificationsTab
                      localSettings={localSettings}
                      onInputChange={handleInputChange}
                    />
                  </TabsContent>

                  {campaignsEnabled && <TabsContent value="messaging" className="mt-0 space-y-6"><MessagingTab /></TabsContent>}
                  <TabsContent value="email" className="mt-0 space-y-6">
                    <EmailTab
                      localSettings={localSettings}
                      onInputChange={handleInputChange}
                      onTestConnection={handleTestEmailConnection}
                    />
                  </TabsContent>

                  <TabsContent value="users" className="mt-0 space-y-6">
                    <UsersTab
                      users={users}
                      currentUser={currentUser}
                      usersLoading={usersLoading}
                      onCreateUser={openCreateUserModal}
                      onEditUser={openEditUserModal}
                      onDeleteUser={handleUserDelete}
                    />
                  </TabsContent>

                  {isWindowsElectron &&
                    isRoleAtLeast(
                      currentUser?.role_level,
                      ROLE_LEVELS.manager,
                    ) && (
                      <TabsContent value="migration" className="mt-0 space-y-6">
                        <MigrationTab clinicId={currentClinic?.id} />
                      </TabsContent>
                    )}

                  {isRoleAtLeast(
                    currentUser?.role_level,
                    ROLE_LEVELS.manager,
                  ) && (
                    <TabsContent
                      value="clinic-holidays"
                      className="mt-0 space-y-6"
                    >
                      <ClinicHolidaysTab clinicId={currentClinic?.id} />
                    </TabsContent>
                  )}

                  {isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo) && (
                    <TabsContent value="danger-zone" className="mt-0 space-y-6">
                      <ClinicDataPruneTab
                        clinicId={currentClinic?.id}
                        clinicName={
                          currentClinic?.name || currentClinic?.clinic_name
                        }
                      />
                    </TabsContent>
                  )}

                  {isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.worker) && (
                    <TabsContent value="trash" className="mt-0 space-y-6">
                      <TrashTab
                        currentClinic={currentClinic}
                        currentUser={currentUser}
                      />
                    </TabsContent>
                  )}

                  <TabsContent value="field-data" className="mt-0 space-y-6">
                    <FieldDataTab
                      clinicId={currentClinic?.id}
                      currentLookupTable={currentLookupTable}
                      lookupData={lookupData}
                      isLoading={loadingLookup}
                      onSelectTable={selectLookupTable}
                      onRefresh={refreshLookupData}
                    />
                  </TabsContent>

                  <TabsContent
                    value="personal-profile"
                    className="mt-0 space-y-6"
                  >
                    <PersonalProfileTab
                      personalProfile={personalProfile}
                      currentUser={currentUser}
                      emailError={emailError}
                      onProfileChange={handlePersonalProfileChange}
                      onProfilePictureRemove={() => {
                        markSettingsDirty();
                        setPersonalProfile((prev) => ({
                          ...prev,
                          profile_picture: "",
                        }));
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="discounts" className="mt-0 space-y-6"><DiscountsTab /></TabsContent>

                  <TabsContent value="appearance" className="mt-0 space-y-6">
                    <AppearanceTab />
                  </TabsContent>

                  <TabsContent value="about" className="mt-0 space-y-6">
                    <AboutTab />
                  </TabsContent>
                </div>

                {/* Fixed vertical settings navigation */}
                <div className="shrink-0">
                  <TabsList
                    className="flex h-fit w-48 flex-col p-1"
                    dir={direction}
                  >
                    <TabsTrigger
                      value="profile"
                      className="w-full justify-start text-start"
                    >
                      {t("clinicProfile")}
                    </TabsTrigger>
                    <TabsTrigger
                      value="preferences"
                      className="w-full justify-start text-start"
                    >
                      {t("clinicSettings")}
                    </TabsTrigger>
                    <TabsTrigger
                      value="notifications"
                      className="w-full justify-start text-start"
                    >
                      {t("notifications")}
                    </TabsTrigger>
                    {campaignsEnabled && <TabsTrigger value="messaging" className="w-full justify-start text-start">{t("campaign.usageTitle")}</TabsTrigger>}
                    <TabsTrigger
                      value="email"
                      className="w-full justify-start text-start"
                    >
                      {t("emailSettings")}
                    </TabsTrigger>
                    <TabsTrigger
                      value="personal-profile"
                      className="w-full justify-start text-start"
                    >
                      {t("personalProfile")}
                    </TabsTrigger>
                    <TabsTrigger value="discounts" className="w-full justify-start text-start">{t("discounts.title")}</TabsTrigger>
                    <TabsTrigger
                      value="appearance"
                      className="w-full justify-start text-start"
                    >
                      {t("appearanceMenu")}
                    </TabsTrigger>
                    {isRoleAtLeast(
                      currentUser?.role_level,
                      ROLE_LEVELS.manager,
                    ) && (
                      <TabsTrigger
                        value="users"
                        className="w-full justify-start text-start"
                      >
                        {t("userManagement")}
                      </TabsTrigger>
                    )}
                    {isWindowsElectron &&
                      isRoleAtLeast(
                        currentUser?.role_level,
                        ROLE_LEVELS.manager,
                      ) && (
                        <TabsTrigger
                          value="migration"
                          className="w-full justify-start text-start"
                        >
                          {t("dataMigration")}
                        </TabsTrigger>
                      )}
                    {isRoleAtLeast(
                      currentUser?.role_level,
                      ROLE_LEVELS.manager,
                    ) && (
                      <TabsTrigger
                        value="clinic-holidays"
                        className="w-full justify-start text-start"
                      >
                        {t("holidays")}
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="field-data"
                      className="w-full justify-start text-start"
                    >
                      {t("fieldData")}
                    </TabsTrigger>
                    {isRoleAtLeast(
                      currentUser?.role_level,
                      ROLE_LEVELS.worker,
                    ) && (
                      <TabsTrigger
                        value="trash"
                        className="w-full justify-start text-start"
                      >
                        {t("trashTitle")}
                      </TabsTrigger>
                    )}
                    {isRoleAtLeast(
                      currentUser?.role_level,
                      ROLE_LEVELS.ceo,
                    ) && (
                      <TabsTrigger
                        value="danger-zone"
                        className="text-destructive w-full justify-start text-start"
                      >
                        {t("dangerZone")}
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="about"
                      className="w-full justify-start text-start"
                    >
                      {t("aboutApp")}
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      <UserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        editingUser={editingUser}
        currentUser={currentUser}
        defaultClinicId={currentClinic?.id}
        onUserSaved={(newUser) => {
          setUsers((prev) => [...prev, newUser]);
        }}
        onUserUpdated={(updatedUser) => {
          setUsers((prev) =>
            prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
          );
        }}
      />
      <UnsavedChangesDialog
        open={showUnsavedDialog && hasSettingsUnsavedChanges}
        onConfirm={handleUnsavedConfirm}
        onCancel={handleUnsavedCancel}
      />
    </>
  );
}
