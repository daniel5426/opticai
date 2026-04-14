import React, { useState, useEffect, useRef } from "react";
import { SiteHeader } from "@/components/site-header";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomModal } from "@/components/ui/custom-modal";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  getAllCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "@/lib/db/campaigns-db";
import { Campaign } from "@/lib/db/schema-interface";
import { toast } from "sonner";
import {
  Trash2,
  Edit3,
  Plus,
  Filter,
  Mail,
  MessageSquare,
  Users,
  Calendar,
  X,
  ChevronDown,
  Play,
  StarsIcon,
  Loader2,
  ArrowUp,
} from "lucide-react";
import { FILTER_FIELDS, OPERATORS } from "@/lib/campaign-filter-options";
import { useUser } from "@/contexts/UserContext";
import { apiClient } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { DateInput } from "@/components/ui/date";

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic?: "AND" | "OR";
}

function FilterBuilder({
  filters,
  onChange,
}: {
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
}) {
  const addFilter = () => {
    const newFilter: FilterCondition = {
      id: Date.now().toString(),
      field: "",
      operator: "",
      value: "",
      logic: filters.length > 0 ? "AND" : undefined,
    };
    onChange([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    onChange(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const getOperators = (fieldType: string) => {
    return OPERATORS[fieldType as keyof typeof OPERATORS] || OPERATORS.text;
  };

  const renderValueInput = (filter: FilterCondition) => {
    const field = FILTER_FIELDS[filter.field as keyof typeof FILTER_FIELDS];
    if (!field) return null;

    const needsNoValue = ["is_empty", "is_not_empty"].includes(filter.operator);
    if (needsNoValue) return null;

    if (field.type === "boolean") {
      return (
        <Select
          value={filter.value}
          onValueChange={(value) => updateFilter(filter.id, { value })}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="ערך" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">כן</SelectItem>
            <SelectItem value="false">לא</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (field.type === "select" && "options" in field) {
      return (
        <Select
          value={filter.value}
          onValueChange={(value) => updateFilter(filter.id, { value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="ערך" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option: string) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === "date") {
      // For last_days/next_days operators, show number input instead of date
      if (["last_days", "next_days"].includes(filter.operator)) {
        return (
          <Input
            type="number"
            value={filter.value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            placeholder="מספר ימים"
            className="w-32"
          />
        );
      }
      return (
        <DateInput
          name={`filter-date-${filter.id}`}
          value={filter.value}
          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
          className="w-40"
        />
      );
    }

    return (
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={filter.value}
        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
        placeholder="ערך"
        className="w-40"
      />
    );
  };

  // Group fields by category
  const fieldsByCategory = Object.entries(FILTER_FIELDS).reduce(
    (acc, [key, field]) => {
      if (!acc[field.category]) acc[field.category] = [];
      acc[field.category].push({ key, ...field });
      return acc;
    },
    {} as Record<string, any[]>,
  );

  return (
    <div className="space-y-3">
      {filters.map((filter, index) => (
        <div
          key={filter.id}
          className="bg-muted/50 flex items-center gap-2 rounded-lg border p-3"
        >
          {index > 0 && (
            <Select
              value={filter.logic}
              onValueChange={(value) =>
                updateFilter(filter.id, { logic: value as "AND" | "OR" })
              }
            >
              <SelectTrigger className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">וגם</SelectItem>
                <SelectItem value="OR">או</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select
            value={filter.field}
            onValueChange={(value) =>
              updateFilter(filter.id, { field: value, operator: "", value: "" })
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="בחר שדה" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(fieldsByCategory).map(([category, fields]) => (
                <div key={category}>
                  <div className="text-muted-foreground bg-muted sticky top-0 z-10 px-2 py-1 text-xs font-medium">
                    {category}
                  </div>
                  {fields.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>

          {filter.field && (
            <Select
              value={filter.operator}
              onValueChange={(value) =>
                updateFilter(filter.id, { operator: value, value: "" })
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="אופרטור" />
              </SelectTrigger>
              <SelectContent>
                {getOperators(
                  FILTER_FIELDS[filter.field as keyof typeof FILTER_FIELDS]
                    ?.type || "text",
                ).map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filter.field && filter.operator && renderValueInput(filter)}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeFilter(filter.id)}
            className="text-red-500 hover:bg-red-50 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button variant="outline" onClick={addFilter} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        הוספת תנאי
      </Button>
    </div>
  );
}

function CampaignModal({
  isOpen,
  onClose,
  campaign,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  campaign?: Campaign;
  onSave: (data: Campaign) => void;
}) {
  const [name, setName] = useState(campaign?.name || "");
  const [filters, setFilters] = useState<FilterCondition[]>(
    campaign ? JSON.parse(campaign.filters || "[]") : [],
  );
  const [emailEnabled, setEmailEnabled] = useState(
    campaign?.email_enabled || false,
  );
  const [emailContent, setEmailContent] = useState(
    campaign?.email_content || "",
  );
  const [smsEnabled, setSmsEnabled] = useState(campaign?.sms_enabled || false);
  const [smsContent, setSmsContent] = useState(campaign?.sms_content || "");
  const [cycleType, setCycleType] = useState<
    "daily" | "monthly" | "yearly" | "custom"
  >(campaign?.cycle_type || "daily");
  const [customDays, setCustomDays] = useState(
    campaign?.cycle_custom_days || 1,
  );
  const [executeOncePerClient, setExecuteOncePerClient] = useState(
    campaign?.execute_once_per_client || false,
  );

  const handleConfirm = () => {
    const data = {
      id: campaign?.id,
      name,
      filters: JSON.stringify(filters),
      email_enabled: emailEnabled,
      email_content: emailContent,
      sms_enabled: smsEnabled,
      sms_content: smsContent,
      active: campaign?.active || false,
      active_since: campaign?.active_since,
      mail_sent: campaign?.mail_sent || false,
      sms_sent: campaign?.sms_sent || false,
      emails_sent_count: campaign?.emails_sent_count || 0,
      sms_sent_count: campaign?.sms_sent_count || 0,
      cycle_type: cycleType,
      cycle_custom_days: cycleType === "custom" ? customDays : undefined,
      last_executed: campaign?.last_executed,
      execute_once_per_client: executeOncePerClient,
    };
    onSave(data as Campaign);
  };

  const reset = () => {
    setName(campaign?.name || "");
    setFilters(campaign ? JSON.parse(campaign.filters || "[]") : []);
    setEmailEnabled(campaign?.email_enabled || false);
    setEmailContent(campaign?.email_content || "");
    setSmsEnabled(campaign?.sms_enabled || false);
    setSmsContent(campaign?.sms_content || "");
    setCycleType(campaign?.cycle_type || "daily");
    setCustomDays(campaign?.cycle_custom_days || 1);
    setExecuteOncePerClient(campaign?.execute_once_per_client || false);
  };

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, campaign]);

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={campaign ? "עריכת קמפיין" : "קמפיין חדש"}
      onConfirm={handleConfirm}
      confirmText="שמירה"
      cancelText="ביטול"
      width="max-w-4xl"
    >
      <div className="space-y-6" dir="rtl">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              שם הקמפיין
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="הכנס שם לקמפיין"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center text-sm font-medium">
              <Calendar className="ml-2 h-4 w-4" />
              תדירות ביצוע
            </Label>
            <div className="flex w-full items-center gap-2">
              <Select
                value={cycleType}
                onValueChange={(
                  value: "daily" | "monthly" | "yearly" | "custom",
                ) => setCycleType(value)}
              >
                <SelectTrigger
                  className={cycleType === "custom" ? "w-1/2" : "w-full"}
                >
                  <SelectValue placeholder="בחר תדירות ביצוע" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">כל יום</SelectItem>
                  <SelectItem value="monthly">כל חודש</SelectItem>
                  <SelectItem value="yearly">כל שנה</SelectItem>
                  <SelectItem value="custom">מספר ימים מותאם אישית</SelectItem>
                </SelectContent>
              </Select>
              {cycleType === "custom" && (
                <div className="flex w-1/2 items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={customDays}
                    onChange={(e) =>
                      setCustomDays(parseInt(e.target.value) || 1)
                    }
                    placeholder="מספר ימים"
                    className="w-full"
                  />
                  <span className="text-muted-foreground text-sm">ימים</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col justify-end space-y-2">
            <div className="bg-muted/50 flex items-center space-x-2 rounded-lg border p-2">
              <Checkbox
                id="execute-once"
                checked={executeOncePerClient}
                onCheckedChange={(checked) => {
                  if (checked !== "indeterminate")
                    setExecuteOncePerClient(checked);
                }}
              />
              <Label htmlFor="execute-once" className="text-sm font-medium">
                פעם אחת ללקוח
              </Label>
            </div>
          </div>
        </div>

        {cycleType && (
          <div className="text-muted-foreground rounded-md bg-blue-50 p-3 text-xs">
            <strong>הסבר:</strong> הקמפיין יבוצע אוטומטית לפי התדירות שנבחרה.
            {cycleType === "daily" && " הקמפיין יבוצע כל יום בשעה 10:00."}
            {cycleType === "monthly" && " הקמפיין יבוצע פעם בחודש באותו תאריך."}
            {cycleType === "yearly" && " הקמפיין יבוצע פעם בשנה באותו תאריך."}
            {cycleType === "custom" && ` הקמפיין יבוצע כל ${customDays} ימים.`}
          </div>
        )}

        <div className="space-y-3">
          <Label className="flex items-center text-sm font-medium">
            <Filter className="h-4 w-4" />
            מסננים
          </Label>
          <div className="bg-background rounded-lg border p-4">
            <FilterBuilder filters={filters} onChange={setFilters} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email"
                checked={emailEnabled}
                onCheckedChange={(checked) => {
                  if (checked !== "indeterminate") setEmailEnabled(checked);
                }}
              />
              <Label
                htmlFor="email"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Mail className="h-4 w-4" />
                שליחת אימייל
              </Label>
            </div>
            {emailEnabled && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">
                  תוכן האימייל
                </Label>
                <Textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  rows={6}
                  placeholder="הכנס את תוכן האימייל כאן..."
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sms"
                checked={smsEnabled}
                onCheckedChange={(checked) => {
                  if (checked !== "indeterminate") setSmsEnabled(checked);
                }}
              />
              <Label
                htmlFor="sms"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <MessageSquare className="h-4 w-4" />
                שליחת SMS
              </Label>
            </div>
            {smsEnabled && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">
                  תוכן ה-SMS
                </Label>
                <Textarea
                  value={smsContent}
                  onChange={(e) => setSmsContent(e.target.value)}
                  rows={4}
                  placeholder="הכנס את תוכן ה-SMS כאן..."
                  className="w-full"
                  maxLength={160}
                />
                <div className="text-muted-foreground text-left text-xs">
                  {smsContent.length}/160 תווים
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomModal>
  );
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const { currentClinic } = useUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>(
    undefined,
  );
  const [runningCampaignId, setRunningCampaignId] = useState<number | null>(
    null,
  );
  const [emailSettingsConfigured, setEmailSettingsConfigured] =
    useState<boolean>(true);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      console.log("Loading campaigns...");
      const data = await getAllCampaigns(currentClinic?.id);
      console.log("Loaded campaigns:", data);

      // Check if campaigns have the new fields
      if (data && data.length > 0) {
        const firstCampaign = data[0];
        console.log("First campaign structure:", Object.keys(firstCampaign));
        if (firstCampaign.active === undefined) {
          console.warn(
            "⚠️ Database schema is outdated - missing new fields. Please delete database file and restart.",
          );
          toast.error("בעיה במבנה הנתונים - יש צורך לאפס את בסיס הנתונים");
        }
      }

      setCampaigns(data || []);

      // Check email settings configuration
      const emailConfigured = await checkEmailSettingsConfigured();
      setEmailSettingsConfigured(emailConfigured || false);
    } catch (error) {
      console.error("Error loading campaigns:", error);
      toast.error("שגיאה בטעינת הקמפיינים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentClinic) {
      loadCampaigns();
    }
  }, [currentClinic]);

  useEffect(() => {
    const handleOpenCampaignModal = (event: CustomEvent) => {
      const { campaignId } = event.detail;
      const campaign = campaigns.find((c) => c.id === campaignId);
      if (campaign) {
        openModal(campaign);
      }
    };

    window.addEventListener(
      "openCampaignModal",
      handleOpenCampaignModal as EventListener,
    );

    return () => {
      window.removeEventListener(
        "openCampaignModal",
        handleOpenCampaignModal as EventListener,
      );
    };
  }, [campaigns]);

  const handleToggleActive = async (campaign: Campaign) => {
    // Optimistic update - update UI immediately
    const optimisticCampaigns = campaigns.map((c) =>
      c.id === campaign.id
        ? {
            ...c,
            active: !c.active,
            active_since: !c.active ? new Date().toISOString() : c.active_since,
          }
        : c,
    );
    setCampaigns(optimisticCampaigns);

    try {
      console.log(
        "Toggling campaign:",
        campaign.id,
        "from",
        campaign.active,
        "to",
        !campaign.active,
      );
      const updatedCampaign = {
        ...campaign,
        active: !campaign.active,
        active_since: !campaign.active
          ? new Date().toISOString()
          : campaign.active_since,
      };
      console.log("Updated campaign data:", updatedCampaign);

      const result = await updateCampaign(updatedCampaign);
      console.log("Update result:", result);

      if (!result) {
        throw new Error("Failed to update campaign");
      }

      toast.success(updatedCampaign.active ? "קמפיין הופעל" : "קמפיין הושבת");
    } catch (error) {
      console.error("Error toggling campaign:", error);
      // Revert optimistic update on error
      setCampaigns(campaigns);
      toast.error("שגיאה בעדכון סטטוס הקמפיין");
    }
  };

  const handleSave = async (data: Campaign) => {
    try {
      if (data.id) {
        const result = await updateCampaign(data);
        if (result) {
          // Optimistic update for edit
          setCampaigns(campaigns.map((c) => (c.id === data.id ? result : c)));
          toast.success("קמפיין עודכן בהצלחה");
        } else {
          throw new Error("Failed to update campaign");
        }
      } else {
        // Set created_at to now for immediate UI display
        const now = new Date().toISOString();
        const result = await createCampaign({
          ...data,
          created_at: now,
          clinic_id: currentClinic?.id,
        });
        if (result) {
          setCampaigns([result, ...campaigns]);
          toast.success("קמפיין נוצר בהצלחה");
        } else {
          throw new Error("Failed to create campaign");
        }
      }
      setIsModalOpen(false);
      setEditingCampaign(undefined);
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("שגיאה בשמירת הקמפיין");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("האם אתה בטוח שברצונך למחוק קמפיין זה?")) {
      // Optimistic update - remove immediately
      const originalCampaigns = campaigns;
      setCampaigns(campaigns.filter((c) => c.id !== id));

      try {
        const result = await deleteCampaign(id);
        if (!result) {
          throw new Error("Failed to delete campaign");
        }
        toast.success("קמפיין נמחק בהצלחה");
      } catch (error) {
        console.error("Error deleting campaign:", error);
        // Revert optimistic update on error
        setCampaigns(originalCampaigns);
        toast.error("שגיאה במחיקת הקמפיין");
      }
    }
  };

  const handleRunCampaign = async (campaign: Campaign) => {
    if (!campaign.id || runningCampaignId) return;

    const confirmed = confirm(
      `האם אתה בטוח שברצונך להריץ את הקמפיין "${campaign.name}" עכשיו? זה ישלח הודעות לכל הלקוחות המסוננים.`,
    );
    if (!confirmed) return;

    setRunningCampaignId(campaign.id);
    const loadingToast = toast.loading("מריץ קמפיין...");

    try {
      const result = await window.electronAPI.campaignExecuteFull(campaign.id);

      console.log("Campaign execution result:", result);

      if (result.success) {
        toast.success(`קמפיין הורץ בהצלחה: ${result.message}`, {
          id: loadingToast,
        });

        // Update the campaign status with new counts
        const updatedCampaign = {
          ...campaign,
          mail_sent: campaign.email_enabled && result.details?.emailsSent > 0,
          sms_sent: campaign.sms_enabled && result.details?.smsSent > 0,
          emails_sent_count:
            (campaign.emails_sent_count || 0) +
            (result.details?.emailsSent || 0),
          sms_sent_count:
            (campaign.sms_sent_count || 0) + (result.details?.smsSent || 0),
        };

        setCampaigns(
          campaigns.map((c) => (c.id === campaign.id ? updatedCampaign : c)),
        );
      } else {
        let errorMessage = result.message;
        if (result.details && Array.isArray(result.details)) {
          errorMessage += `: ${result.details.join(", ")}`;
        }
        const onlyNoClients =
          result.details &&
          Array.isArray(result.details) &&
          result.details.length === 1 &&
          (result.details[0].includes("No target clients have phone numbers") ||
            result.details[0].includes(
              "No target clients have email addresses",
            ) ||
            result.details[0].includes(
              "No target clients found matching the filters",
            ));

        const emailSettingsNotConfigured =
          (result.details &&
            Array.isArray(result.details) &&
            result.details.some((detail) =>
              detail.includes("Email settings not configured"),
            )) ||
          (result.message &&
            result.message.includes("Email settings not configured")) ||
          (result.details &&
            Array.isArray(result.details) &&
            result.details.some((detail) =>
              detail.includes("Email settings not found"),
            )) ||
          (result.message &&
            result.message.includes("Email settings not found"));

        if (emailSettingsNotConfigured) {
          toast.error(
            "הגדרות האימייל לא מוגדרות. יש להגדיר הגדרות אימייל בעמוד ההגדרות.",
            {
              id: loadingToast,
              action: {
                label: "פתח הגדרות",
                onClick: () => {
                  navigate({ to: "/settings" });
                },
              },
            },
          );
        } else if (
          campaign.email_enabled &&
          result.details?.emailsSent === 0 &&
          result.details?.targetClients > 0
        ) {
          // Campaign was supposed to send emails but none were sent, likely due to email settings
          toast.error(
            "הגדרות האימייל לא מוגדרות או שגויות. יש להגדיר הגדרות אימייל בעמוד ההגדרות.",
            {
              id: loadingToast,
              action: {
                label: "פתח הגדרות",
                onClick: () => {
                  navigate({ to: "/settings" });
                },
              },
            },
          );
        } else if (onlyNoClients) {
          toast.info("אין לקוחות מתאימים לשליחת הודעות בקמפיין זה.", {
            id: loadingToast,
          });
        } else {
          toast.error(`שגיאה בהרצת הקמפיין: ${errorMessage}`, {
            id: loadingToast,
          });
        }
      }
    } catch (error) {
      console.error("Error running campaign:", error);
      toast.error("שגיאה בהרצת הקמפיין", {
        id: loadingToast,
      });
    } finally {
      setRunningCampaignId(null);
    }
  };

  const openModal = (campaign?: Campaign) => {
    setEditingCampaign(campaign);
    setIsModalOpen(true);
  };

  const getFilterCount = (campaign: Campaign) => {
    try {
      const filters = JSON.parse(campaign.filters || "[]");
      return filters.length;
    } catch {
      return 0;
    }
  };

  const checkEmailSettingsConfigured = async (): Promise<boolean> => {
    try {
      const settingsResponse = await apiClient.getSettings(currentClinic?.id);
      const settings = settingsResponse.data;
      return !!(settings && settings.email_username && settings.email_password);
    } catch {
      return false;
    }
  };

  // AI Campaign Creation Handler
  const handleAICreateCampaign = async () => {
    setAiError(null);
    setAiSuccess(null);
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const result = await apiClient.aiCreateCampaignFromPrompt(
        aiInput.trim(),
        currentClinic?.id,
      );
      const payload = (result as any).data || (result as any);
      if ((result as any).error || !payload?.data) {
        throw new Error((result as any).error || "AI service error");
      }
      const createdCampaign = payload.data as Campaign;
      setCampaigns([createdCampaign, ...campaigns]);
      setAiSuccess("הקמפיין נוצר בהצלחה!");
      setAiInput("");
      setAiModalOpen(false);
    } catch (e: any) {
      setAiError(e.message || "שגיאה לא ידועה");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader title="קמפיינים" />
        <div
          className="bg-muted/30 h-full overflow-auto"
          style={{ scrollbarWidth: "none" }}
          dir="rtl"
        >
          <div className="mx-auto max-w-7xl space-y-6 p-6 pb-20">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">קמפיינים</h1>
                <p className="text-muted-foreground">
                  נהל קמפיינים שיווקיים ושליחת הודעות ללקוחות
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setAiModalOpen(true)}
                  size="lg"
                  variant="outline"
                  className="gap-2"
                  title="צור קמפיין עם AI"
                >
                  <StarsIcon className="h-5 w-5" />
                </Button>
                <Button onClick={() => openModal()} size="lg" className="gap-2">
                  קמפיין חדש
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Card key={idx} className="border-0 shadow-sm">
                  <CardContent className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2 pr-2">
                        <Skeleton className="ml-auto h-4 w-40" />
                        <div className="flex items-center justify-end gap-2">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-100">
                        <Skeleton className="h-6 w-6 rounded-md" />
                        <Skeleton className="h-6 w-6 rounded-md" />
                        <Skeleton className="h-6 w-6 rounded-md" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-2 w-2 rounded-full" />
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-5 w-10 rounded-full" />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </div>

                    <Skeleton className="h-8 w-full rounded-md" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader title="קמפיינים" />
      <div
        className="bg-muted/30 h-full overflow-auto"
        style={{ scrollbarWidth: "none" }}
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-6 p-6 pb-20">
          {!emailSettingsConfigured &&
            campaigns.some((c) => c.email_enabled) && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-amber-600">
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
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm font-medium text-amber-800">
                        הגדרות אימייל לא מוגדרות
                      </h3>
                      <p className="mt-1 text-xs text-amber-700">
                        יש קמפיינים עם אימייל מופעל אך הגדרות האימייל לא
                        מוגדרות. יש להגדיר הגדרות אימייל בעמוד ההגדרות.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate({ to: "/settings" })}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    פתח הגדרות
                  </Button>
                </div>
              </div>
            )}

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">קמפיינים</h1>
              <p className="text-muted-foreground">
                נהל קמפיינים שיווקיים ושליחת הודעות ללקוחות
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setAiModalOpen(true)}
                size="lg"
                variant="outline"
                className="gap-2"
                title="צור קמפיין עם AI"
              >
                <StarsIcon className="h-5 w-5" />
              </Button>
              <Button onClick={() => openModal()} size="lg" className="gap-2">
                קמפיין חדש
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Users className="text-muted-foreground mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">אין קמפיינים</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  צור קמפיין ראשון כדי להתחיל לשלוח הודעות ללקוחות
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  data-campaign-id={campaign.id}
                  className="group border-0 bg-gradient-to-br from-white to-gray-50/50 shadow-sm transition-all duration-300 hover:shadow-lg"
                >
                  <CardContent className="px-4">
                    {/* Header with Title and Actions */}
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="mb-1 truncate pr-2 text-sm font-semibold text-gray-900">
                          {campaign.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {(() => {
                            const createdAt = campaign.created_at
                              ? new Date(campaign.created_at)
                              : null;
                            return createdAt && !isNaN(createdAt.getTime())
                              ? createdAt.toLocaleDateString("he-IL")
                              : "";
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRunCampaign(campaign)}
                            className="h-6 w-6 p-0 hover:bg-green-50 hover:text-green-600"
                            disabled={
                              !campaign.active ||
                              (!campaign.email_enabled &&
                                !campaign.sms_enabled) ||
                              runningCampaignId !== null
                            }
                            title={
                              runningCampaignId === campaign.id
                                ? "קמפיין רץ..."
                                : "הרץ קמפיין עכשיו"
                            }
                          >
                            <Play
                              className={`h-3 w-3 ${runningCampaignId === campaign.id ? "animate-spin" : ""}`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openModal(campaign)}
                            className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(campaign.id!)}
                            className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Status Toggle */}
                    <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-50/50 p-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${campaign.active ? "bg-green-500" : "bg-gray-300"}`}
                        ></div>
                        <span className="text-xs font-medium text-gray-600">
                          {campaign.active ? "פעיל" : "לא פעיל"}
                        </span>
                        {campaign.active &&
                          campaign.active_since &&
                          (() => {
                            const activeSinceDate = new Date(
                              campaign.active_since,
                            );
                            return !isNaN(activeSinceDate.getTime()) ? (
                              <span className="text-xs text-gray-400">
                                מאז{" "}
                                {activeSinceDate.toLocaleDateString("he-IL")}
                              </span>
                            ) : null;
                          })()}
                      </div>
                      <Switch
                        dir="ltr"
                        checked={campaign.active}
                        onCheckedChange={() => handleToggleActive(campaign)}
                        className="scale-75"
                      />
                    </div>

                    {/* Stats Row */}
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <div className="rounded-md bg-blue-50/50 p-2 text-center">
                        <div className="text-xs font-semibold text-blue-600">
                          {getFilterCount(campaign)}
                        </div>
                        <div className="text-xs text-blue-500">מסננים</div>
                      </div>

                      <div
                        className={`rounded-md p-2 text-center ${
                          campaign.email_enabled
                            ? emailSettingsConfigured
                              ? "bg-green-50/50"
                              : "bg-amber-50/50"
                            : "bg-gray-50/50"
                        }`}
                        title={
                          campaign.email_enabled && !emailSettingsConfigured
                            ? "הגדרות האימייל לא מוגדרות. יש להגדיר הגדרות אימייל בעמוד ההגדרות."
                            : undefined
                        }
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Mail
                            className={`h-3 w-3 ${
                              campaign.email_enabled
                                ? emailSettingsConfigured
                                  ? "text-green-600"
                                  : "text-amber-600"
                                : "text-gray-400"
                            }`}
                          />
                          <span
                            className={`text-xs font-semibold ${
                              campaign.email_enabled
                                ? emailSettingsConfigured
                                  ? "text-green-600"
                                  : "text-amber-600"
                                : "text-gray-400"
                            }`}
                          >
                            {campaign.emails_sent_count || 0}
                          </span>
                        </div>
                        <div
                          className={`text-xs ${
                            campaign.email_enabled
                              ? emailSettingsConfigured
                                ? "text-green-500"
                                : "text-amber-500"
                              : "text-gray-400"
                          }`}
                        >
                          {campaign.email_enabled && !emailSettingsConfigured
                            ? "אימייל ⚠️"
                            : "אימייל"}
                        </div>
                      </div>

                      <div className="rounded-md bg-purple-50/50 p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <MessageSquare
                            className={`h-3 w-3 ${campaign.sms_enabled ? "text-purple-600" : "text-gray-400"}`}
                          />
                          <span
                            className={`text-xs font-semibold ${campaign.sms_enabled ? "text-purple-600" : "text-gray-400"}`}
                          >
                            {campaign.sms_sent_count || 0}
                          </span>
                        </div>
                        <div className="text-xs text-purple-500">SMS</div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="w-full">
                      {campaign.active ? (
                        campaign.email_enabled || campaign.sms_enabled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-full border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 text-xs font-medium text-blue-700 hover:from-blue-100 hover:to-purple-100 hover:text-blue-800"
                          >
                            <Users className="mr-1 h-3 w-3" />
                            קמפיין פעיל
                          </Button>
                        ) : (
                          <div className="flex h-8 w-full items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-600">
                            יש להפעיל אימייל או SMS
                          </div>
                        )
                      ) : (
                        <div className="flex h-8 w-full items-center justify-center rounded-md bg-gray-50 text-xs text-gray-400">
                          הפעל כדי להריץ קמפיין
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <CampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaign={editingCampaign}
        onSave={handleSave}
      />
      {/* AI Campaign Modal */}
      <CustomModal
        isOpen={aiModalOpen}
        onClose={() => !aiLoading && setAiModalOpen(false)}
        title="צור קמפיין עם AI"
        width="max-w-lg"
      >
        <div
          className="space-y-3 ring-0"
          dir="rtl"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="relative ring-0">
            <textarea
              ref={aiTextareaRef}
              className="bg-muted h-24 max-h-[320px] min-h-[68px] w-full resize-none overflow-hidden rounded-3xl border-1 p-2 pr-4 pb-12 pl-12 text-base shadow-sm ring-0"
              style={{ direction: "rtl", scrollbarWidth: "none" }}
              placeholder="תאר בקצרה את הקמפיין שתרצה ליצור..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              disabled={aiLoading}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!aiLoading) handleAICreateCampaign();
                }
              }}
            />
            <div className="absolute bottom-[13px] left-2 flex items-center">
              {aiLoading ? (
                <Button
                  className="h-8 w-8 rounded-full p-0"
                  size="sm"
                  variant="ghost"
                  disabled
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </Button>
              ) : (
                <Button
                  className="h-8 w-8 rounded-full p-0"
                  size="sm"
                  onClick={handleAICreateCampaign}
                  disabled={!aiInput.trim() || aiLoading}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {aiError && (
            <div className="mt-2 text-center text-sm text-red-600">
              {aiError}
            </div>
          )}
          {aiSuccess && (
            <div className="mt-2 text-center text-sm text-green-600">
              {aiSuccess}
            </div>
          )}
          <p
            className="text-muted-foreground mt-3 text-center text-xs"
            dir="rtl"
          >
            תאר בעברית מה תרצה שהקמפיין יעשה. לדוג׳: "כל שנה לשלוח מייל למי שעשה
            בדיקה, עם קופון 10% הנחה".
          </p>
        </div>
      </CustomModal>
    </>
  );
}
