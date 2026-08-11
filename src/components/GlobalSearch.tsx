import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  User,
  Eye,
  FileText,
  Users,
  Calendar,
  Mail,
  History,
  Glasses,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Client,
  OpticalExam,
  MedicalLog,
  Family,
  Referral,
  Appointment,
  Campaign,
  Clinic,
  RecentClientVisit,
  PrescriptionSearchResult,
} from "@/lib/db/schema-interface";
import { useUser } from "@/contexts/UserContext";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { FastInput } from "@/components/exam/shared/OptimizedInputs";
import {
  EXAM_FIELDS,
  FieldConfig,
} from "@/components/exam/data/exam-field-definitions";

interface SearchResult {
  id: string;
  type:
    | "client"
    | "exam"
    | "medical-log"
    | "family"
    | "referral"
    | "appointment"
    | "campaign";
  title: string;
  subtitle?: string;
  description?: string;
  data: any;
  matchedFields: string[];
}

interface GlobalSearchProps {
  onClose?: () => void;
  inModal?: boolean;
}

export function GlobalSearch({ onClose, inModal = false }: GlobalSearchProps) {
  // Safely get user context with error handling
  let currentClinic: Clinic | null = null;
  try {
    const userContext = useUser();
    currentClinic = userContext.currentClinic;
  } catch (error) {
    // UserContext not ready yet, return early
    return null;
  }

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedResultIndex, setHighlightedResultIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<
    "search" | "recent" | "prescription" | null
  >(null);
  const [recentClients, setRecentClients] = useState<RecentClientVisit[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [prescriptionResults, setPrescriptionResults] = useState<
    PrescriptionSearchResult[]
  >([]);
  const [prescriptionTotal, setPrescriptionTotal] = useState(0);
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);
  const [hoveredPrescriptionEye, setHoveredPrescriptionEye] = useState<
    "R" | "L" | null
  >(null);
  const [prescriptionForm, setPrescriptionForm] = useState({
    r_sph: "",
    r_cyl: "",
    r_ax: "",
    r_add: "",
    r_va: "",
    r_pd: "",
    l_sph: "",
    l_cyl: "",
    l_ax: "",
    l_add: "",
    l_va: "",
    l_pd: "",
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;
  const [allData, setAllData] = useState<{
    clients: Client[];
    exams: OpticalExam[];
    medicalLogs: MedicalLog[];
    families: Family[];
    referrals: Referral[];
    appointments: Appointment[];
    campaigns: Campaign[];
  }>({
    clients: [],
    exams: [],
    medicalLogs: [],
    families: [],
    referrals: [],
    appointments: [],
    campaigns: [],
  });

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedClinicIdRef = useRef<number | null>(null);
  const isLoadingAllRef = useRef(false);

  useEffect(() => {
    if (!inModal) return;

    setIsOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [inModal]);

  // Debounce query input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const run = async () => {
      if (!isOpen) return;
      if (activePanel && activePanel !== "search") return;
      if (!currentClinic?.id) return;
      const q = debouncedQuery.trim();
      if (q.length < 2) {
        setResults([]);
        setTotal(0);
        return;
      }
      setLoading(true);
      try {
        const offset = (page - 1) * pageSize;
        const res = await apiClient.unifiedSearch(q, currentClinic.id, {
          limit: pageSize,
          offset,
        });
        const data = res.data;
        if (data) {
          const mapped: SearchResult[] = data.items.map((it) => ({
            id: `${it.type}-${it.id}`,
            type: it.type as SearchResult["type"],
            title: it.title,
            subtitle: it.subtitle,
            description: it.description,
            data: it,
            matchedFields: [],
          }));
          setResults(mapped);
          setTotal(data.total);
        }
      } catch (e) {
        console.error("Unified search error:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [activePanel, isOpen, currentClinic?.id, debouncedQuery, page]);

  const normalizeDate = (dateStr: string): string => {
    return dateStr.replace(/[.-]/g, "-");
  };

  const normalizeSearchDate = (
    searchTerm: string,
  ): { primary: string; alternate: string } => {
    const normalized = searchTerm.replace(/[.-]/g, "-");

    // Handle incomplete partial dates (e.g., "06-")
    if (normalized.endsWith("-")) {
      const numberPart = normalized.slice(0, -1);
      return { primary: numberPart, alternate: "" };
    }

    // Year-first full date: YYYY-MM-DD or YYYY-M-D
    const yearFirstPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    const yearFirstMatch = normalized.match(yearFirstPattern);
    if (yearFirstMatch) {
      const [, year, month, day] = yearFirstMatch;
      const primary = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      return { primary, alternate: "" };
    }

    // Day/Month-first full date with year: DD-MM-YYYY or MM-DD-YYYY
    const dayMonthYearPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
    const dayMonthYearMatch = normalized.match(dayMonthYearPattern);
    if (dayMonthYearMatch) {
      const [, first, second, year] = dayMonthYearMatch;
      const firstNum = parseInt(first);
      const secondNum = parseInt(second);

      let month, day;
      if (firstNum > 12 && secondNum <= 12) {
        // DD-MM-YYYY
        day = first.padStart(2, "0");
        month = second.padStart(2, "0");
      } else if (firstNum <= 12 && secondNum > 12) {
        // MM-DD-YYYY
        month = first.padStart(2, "0");
        day = second.padStart(2, "0");
      } else {
        // Ambiguous, assume DD-MM-YYYY
        day = first.padStart(2, "0");
        month = second.padStart(2, "0");
      }
      const primary = `${year}-${month}-${day}`;
      return { primary, alternate: "" };
    }

    // Partial date: DD-MM or MM-DD
    const partialPattern = /^(\d{1,2})-(\d{1,2})$/;
    const partialMatch = normalized.match(partialPattern);
    if (partialMatch) {
      const [, first, second] = partialMatch;
      const firstNum = parseInt(first);
      const secondNum = parseInt(second);

      let primary,
        alternate = "";
      if (firstNum > 12 && secondNum <= 12) {
        // Clearly DD-MM -> normalize to MM-DD
        primary = `${second.padStart(2, "0")}-${first.padStart(2, "0")}`;
      } else if (firstNum <= 12 && secondNum > 12) {
        // Clearly MM-DD -> normalize to MM-DD
        primary = `${first.padStart(2, "0")}-${second.padStart(2, "0")}`;
      } else {
        // Ambiguous (both <=12), assume DD-MM normalized to MM-DD
        primary = `${second.padStart(2, "0")}-${first.padStart(2, "0")}`;
        alternate = `${first.padStart(2, "0")}-${second.padStart(2, "0")}`;
      }
      return { primary, alternate };
    }

    // No match, return as is
    return { primary: normalized, alternate: "" };
  };

  const searchClients = (searchTerm: string): SearchResult[] => {
    return allData.clients
      .filter((client) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();
        const normalizedQuery = normalizeDate(searchTerm);
        const searchDateQuery = normalizeSearchDate(searchTerm);

        if (client.first_name?.toLowerCase().includes(lowerQuery))
          matchedFields.push("שם פרטי");
        if (client.last_name?.toLowerCase().includes(lowerQuery))
          matchedFields.push("שם משפחה");
        if (client.national_id?.includes(searchTerm))
          matchedFields.push("ת.ז.");
        if (client.phone_mobile?.includes(searchTerm))
          matchedFields.push("טלפון נייד");
        if (client.phone_home?.includes(searchTerm))
          matchedFields.push("טלפון בית");
        if (client.address_city?.toLowerCase().includes(lowerQuery))
          matchedFields.push("עיר");
        if (client.address_street?.toLowerCase().includes(lowerQuery))
          matchedFields.push("רחוב");
        if (client.date_of_birth) {
          const storedNormalized = normalizeDate(client.date_of_birth);
          const { primary, alternate } = normalizeSearchDate(searchTerm);
          if (
            storedNormalized.includes(primary) ||
            (alternate && storedNormalized.includes(alternate))
          ) {
            matchedFields.push("תאריך לידה");
          }
        }
        if (client.email?.toLowerCase().includes(lowerQuery))
          matchedFields.push("אימייל");
        if (client.postal_code?.includes(searchTerm))
          matchedFields.push("מיקוד");

        return matchedFields.length > 0;
      })
      .map((client) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();
        const normalizedQuery = normalizeDate(searchTerm);
        const searchDateQuery = normalizeSearchDate(searchTerm);

        if (client.first_name?.toLowerCase().includes(lowerQuery))
          matchedFields.push("שם פרטי");
        if (client.last_name?.toLowerCase().includes(lowerQuery))
          matchedFields.push("שם משפחה");
        if (client.national_id?.includes(searchTerm))
          matchedFields.push("ת.ז.");
        if (client.phone_mobile?.includes(searchTerm))
          matchedFields.push("טלפון נייד");
        if (client.phone_home?.includes(searchTerm))
          matchedFields.push("טלפון בית");
        if (client.address_city?.toLowerCase().includes(lowerQuery))
          matchedFields.push("עיר");
        if (client.address_street?.toLowerCase().includes(lowerQuery))
          matchedFields.push("רחוב");
        if (client.date_of_birth) {
          const storedNormalized = normalizeDate(client.date_of_birth);
          const { primary, alternate } = normalizeSearchDate(searchTerm);
          if (
            storedNormalized.includes(primary) ||
            (alternate && storedNormalized.includes(alternate))
          ) {
            matchedFields.push("תאריך לידה");
          }
        }
        if (client.email?.toLowerCase().includes(lowerQuery))
          matchedFields.push("אימייל");
        if (client.postal_code?.includes(searchTerm))
          matchedFields.push("מיקוד");

        return {
          id: `client-${client.id}`,
          type: "client" as const,
          title: `${client.first_name} ${client.last_name}`.trim(),
          subtitle: client.national_id || client.phone_mobile,
          description:
            `${client.address_city || ""} ${client.address_street || ""}`.trim(),
          data: client,
          matchedFields: matchedFields,
        };
      });
  };

  const searchExams = (searchTerm: string): SearchResult[] => {
    return allData.exams
      .filter((exam) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();
        const normalizedQuery = normalizeDate(searchTerm);
        const searchDateQuery = normalizeSearchDate(searchTerm);

        if (exam.exam_date) {
          const storedNormalized = normalizeDate(exam.exam_date);
          const { primary, alternate } = normalizeSearchDate(searchTerm);
          if (
            storedNormalized.includes(primary) ||
            (alternate && storedNormalized.includes(alternate))
          ) {
            matchedFields.push("תאריך בדיקה");
          }
        }

        return matchedFields.length > 0;
      })
      .map((exam) => {
        const client = allData.clients.find((c) => c.id === exam.client_id);
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();
        const normalizedQuery = normalizeDate(searchTerm);
        const searchDateQuery = normalizeSearchDate(searchTerm);

        if (exam.exam_date) {
          const storedNormalized = normalizeDate(exam.exam_date);
          const { primary, alternate } = normalizeSearchDate(searchTerm);
          if (
            storedNormalized.includes(primary) ||
            (alternate && storedNormalized.includes(alternate))
          ) {
            matchedFields.push("תאריך בדיקה");
          }
        }

        return {
          id: `exam-${exam.id}`,
          type: "exam" as const,
          title: exam.test_name || "בדיקה",
          subtitle: client
            ? `${client.first_name} ${client.last_name}`
            : "לקוח לא נמצא",
          description: exam.exam_date,
          data: exam,
          matchedFields: matchedFields,
        };
      });
  };

  const searchMedicalLogs = (searchTerm: string): SearchResult[] => {
    return allData.medicalLogs
      .filter((log) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();

        if (log.log?.toLowerCase().includes(lowerQuery))
          matchedFields.push("רישום רפואי");

        return matchedFields.length > 0;
      })
      .map((log) => {
        const client = allData.clients.find((c) => c.id === log.client_id);
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();

        if (log.log?.toLowerCase().includes(lowerQuery))
          matchedFields.push("רישום רפואי");

        return {
          id: `medical-log-${log.id}`,
          type: "medical-log" as const,
          title: "רישום רפואי",
          subtitle: client
            ? `${client.first_name} ${client.last_name}`
            : "לקוח לא נמצא",
          description:
            log.log?.substring(0, 100) +
            (log.log && log.log.length > 100 ? "..." : ""),
          data: log,
          matchedFields: matchedFields,
        };
      });
  };

  const searchFamilies = (searchTerm: string): SearchResult[] => {
    return allData.families
      .filter((family) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();

        if (family.name?.toLowerCase().includes(lowerQuery))
          matchedFields.push("שם משפחה");

        return matchedFields.length > 0;
      })
      .map((family) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();

        if (family.name?.toLowerCase().includes(lowerQuery))
          matchedFields.push("שם משפחה");

        return {
          id: `family-${family.id}`,
          type: "family" as const,
          title: family.name,
          subtitle: "משפחה",
          description: family.notes,
          data: family,
          matchedFields: matchedFields,
        };
      });
  };

  const searchReferrals = (searchTerm: string): SearchResult[] => {
    return allData.referrals
      .filter((referral) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();

        if (referral.referral_notes?.toLowerCase().includes(lowerQuery))
          matchedFields.push("הערות הפניה");
        if (referral.prescription_notes?.toLowerCase().includes(lowerQuery))
          matchedFields.push("הערות מרשם");

        return matchedFields.length > 0;
      })
      .map((referral) => {
        const client = allData.clients.find((c) => c.id === referral.client_id);
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();

        if (referral.referral_notes?.toLowerCase().includes(lowerQuery))
          matchedFields.push("הערות הפניה");
        if (referral.prescription_notes?.toLowerCase().includes(lowerQuery))
          matchedFields.push("הערות מרשם");

        return {
          id: `referral-${referral.id}`,
          type: "referral" as const,
          title: "הפניה",
          subtitle: client
            ? `${client.first_name} ${client.last_name}`
            : "לקוח לא נמצא",
          description:
            referral.referral_notes?.substring(0, 100) +
            (referral.referral_notes && referral.referral_notes.length > 100
              ? "..."
              : ""),
          data: referral,
          matchedFields: matchedFields,
        };
      });
  };

  const searchAppointments = (searchTerm: string): SearchResult[] => {
    return allData.appointments
      .filter((appointment) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();
        const normalizedQuery = normalizeDate(searchTerm);
        const searchDateQuery = normalizeSearchDate(searchTerm);

        if (appointment.date) {
          const storedNormalized = normalizeDate(appointment.date);
          const { primary, alternate } = normalizeSearchDate(searchTerm);
          if (
            storedNormalized.includes(primary) ||
            (alternate && storedNormalized.includes(alternate))
          ) {
            matchedFields.push("תאריך");
          }
        }
        if (appointment.note?.toLowerCase().includes(lowerQuery))
          matchedFields.push("הערות");

        return matchedFields.length > 0;
      })
      .map((appointment) => {
        const client = allData.clients.find(
          (c) => c.id === appointment.client_id,
        );
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();
        const normalizedQuery = normalizeDate(searchTerm);
        const searchDateQuery = normalizeSearchDate(searchTerm);

        if (appointment.date) {
          const storedNormalized = normalizeDate(appointment.date);
          const { primary, alternate } = normalizeSearchDate(searchTerm);
          if (
            storedNormalized.includes(primary) ||
            (alternate && storedNormalized.includes(alternate))
          ) {
            matchedFields.push("תאריך");
          }
        }
        if (appointment.note?.toLowerCase().includes(lowerQuery))
          matchedFields.push("הערות");

        return {
          id: `appointment-${appointment.id}`,
          type: "appointment" as const,
          title: appointment.exam_name || "תור",
          subtitle: client
            ? `${client.first_name} ${client.last_name}`
            : "לקוח לא נמצא",
          description: `${appointment.date} ${appointment.time}`,
          data: appointment,
          matchedFields: matchedFields,
        };
      });
  };

  const searchCampaigns = (searchTerm: string): SearchResult[] => {
    return allData.campaigns
      .filter((campaign) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();

        if (campaign.name?.toLowerCase().includes(lowerQuery))
          matchedFields.push("שם קמפיין");

        return matchedFields.length > 0;
      })
      .map((campaign) => {
        const matchedFields: string[] = [];
        const lowerQuery = searchTerm.toLowerCase();

        if (campaign.name?.toLowerCase().includes(lowerQuery))
          matchedFields.push("שם קמפיין");

        return {
          id: `campaign-${campaign.id}`,
          type: "campaign" as const,
          title: campaign.name,
          subtitle: "קמפיין",
          description: campaign.active ? "פעיל" : "לא פעיל",
          data: campaign,
          matchedFields: matchedFields,
        };
      });
  };

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      const clientResults = searchClients(searchTerm);
      const examResults = searchExams(searchTerm);
      const medicalLogResults = searchMedicalLogs(searchTerm);
      const familyResults = searchFamilies(searchTerm);
      const referralResults = searchReferrals(searchTerm);
      const appointmentResults = searchAppointments(searchTerm);
      const campaignResults = searchCampaigns(searchTerm);

      const allResults = [
        ...clientResults,
        ...examResults,
        ...medicalLogResults,
        ...familyResults,
        ...referralResults,
        ...appointmentResults,
        ...campaignResults,
      ];

      setResults(allResults.slice(0, 50));
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  // No local filtering; results come from backend now

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case "client":
        navigate({
          to: "/clients/$clientId",
          params: { clientId: String(result.data.id) },
          search: { tab: "details" },
        });
        break;
      case "exam":
        navigate({
          to: "/clients/$clientId/exams/$examId",
          params: {
            clientId: String(result.data.client_id),
            examId: String(result.data.id),
          },
        });
        break;
      case "medical-log":
        navigate({
          to: "/clients/$clientId",
          params: { clientId: String(result.data.client_id) },
          search: { tab: "medical-record" },
        });
        break;
      case "family":
        navigate({ to: "/clients", search: {} });
        break;
      case "referral":
        navigate({
          to: "/clients/$clientId/referrals/$referralId",
          params: {
            clientId: String(result.data.client_id),
            referralId: String(result.data.id),
          },
        });
        break;
      case "appointment":
        navigate({ to: "/appointments", search: {} });
        setTimeout(() => {
          const event = new CustomEvent("openAppointmentModal", {
            detail: { appointmentId: result.data.id },
          });
          window.dispatchEvent(event);
        }, 100);
        break;
      case "campaign":
        navigate({ to: "/campaigns", search: {} });
        setTimeout(() => {
          const event = new CustomEvent("openCampaignModal", {
            detail: { campaignId: result.data.id },
          });
          window.dispatchEvent(event);
        }, 100);
        break;
    }

    setIsOpen(false);
    setActivePanel(null);
    setQuery("");
    onClose?.();
  };

  const handleClientClick = (clientId?: number) => {
    if (!clientId) return;
    navigate({
      to: "/clients/$clientId",
      params: { clientId: String(clientId) },
      search: { tab: "details" },
    });
    setIsOpen(false);
    setActivePanel(null);
    setQuery("");
    onClose?.();
  };

  const openRecentPanel = async () => {
    setQuery("");
    setResults([]);
    setActivePanel("recent");
    setIsOpen(true);
    if (!currentClinic?.id) return;
    setRecentLoading(true);
    try {
      const response = await apiClient.getRecentClients(currentClinic.id, 10);
      setRecentClients(response.data || []);
    } catch (error) {
      console.error("Recent clients error:", error);
      setRecentClients([]);
    } finally {
      setRecentLoading(false);
    }
  };

  const openPrescriptionPanel = () => {
    setQuery("");
    setResults([]);
    setActivePanel("prescription");
    setIsOpen(true);
  };

  type PrescriptionSearchField = "sph" | "cyl" | "ax" | "add" | "va" | "pd";
  type PrescriptionSearchColumn = FieldConfig & {
    key: PrescriptionSearchField;
  };

  const prescriptionColumns: PrescriptionSearchColumn[] = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "add", ...EXAM_FIELDS.ADD },
    { key: "va", label: "VA", type: "text" },
    { key: "pd", ...EXAM_FIELDS.PD_COMB },
  ];

  const updatePrescriptionField = (
    key: keyof typeof prescriptionForm,
    value: string,
  ) => {
    setPrescriptionForm((prev) => ({ ...prev, [key]: value }));
  };

  const copyPrescriptionEyeRow = (fromEye: "R" | "L") => {
    const sourcePrefix = fromEye === "R" ? "r" : "l";
    const targetPrefix = fromEye === "R" ? "l" : "r";
    setPrescriptionForm((prev) => {
      const next = { ...prev };
      prescriptionColumns.forEach(({ key }) => {
        const sourceKey =
          `${sourcePrefix}_${key}` as keyof typeof prescriptionForm;
        const targetKey =
          `${targetPrefix}_${key}` as keyof typeof prescriptionForm;
        next[targetKey] = prev[sourceKey];
      });
      return next;
    });
  };

  const parseNumber = (value: string): number | undefined => {
    if (value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const buildEyeCriteria = (prefix: "r" | "l") => {
    const parsedAx =
      prescriptionForm[`${prefix}_ax`].trim() === ""
        ? undefined
        : Number.parseInt(prescriptionForm[`${prefix}_ax`], 10);
    const criteria = {
      sph: parseNumber(prescriptionForm[`${prefix}_sph`]),
      cyl: parseNumber(prescriptionForm[`${prefix}_cyl`]),
      ax: Number.isFinite(parsedAx) ? parsedAx : undefined,
      add: parseNumber(prescriptionForm[`${prefix}_add`]),
      va: prescriptionForm[`${prefix}_va`].trim() || undefined,
      pd: parseNumber(prescriptionForm[`${prefix}_pd`]),
    };
    return Object.fromEntries(
      Object.entries(criteria).filter(([, value]) => value !== undefined),
    );
  };

  const runPrescriptionSearch = async () => {
    if (!currentClinic?.id) return;
    const right = buildEyeCriteria("r");
    const left = buildEyeCriteria("l");
    if (!Object.keys(right).length && !Object.keys(left).length) {
      toast.error("יש להזין לפחות שדה מרשם אחד");
      return;
    }
    setPrescriptionLoading(true);
    try {
      const response = await apiClient.searchPrescription({
        clinic_id: currentClinic.id,
        right: Object.keys(right).length ? right : undefined,
        left: Object.keys(left).length ? left : undefined,
        limit: 50,
        offset: 0,
      });
      setPrescriptionResults(response.data?.items || []);
      setPrescriptionTotal(response.data?.total || 0);
    } catch (error) {
      console.error("Prescription search error:", error);
      toast.error("שגיאה בחיפוש מרשם");
    } finally {
      setPrescriptionLoading(false);
    }
  };

  const getResultIcon = (type: SearchResult["type"], className = "h-5 w-5") => {
    switch (type) {
      case "client":
        return <User className={className} />;
      case "exam":
        return <Eye className={className} />;
      case "medical-log":
        return <FileText className={className} />;
      case "family":
        return <Users className={className} />;
      case "referral":
        return <FileText className={className} />;
      case "appointment":
        return <Calendar className={className} />;
      case "campaign":
        return <Mail className={className} />;
      default:
        return <Search className={className} />;
    }
  };

  const getResultTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "client":
        return "לקוח";
      case "exam":
        return "בדיקה";
      case "medical-log":
        return "רישום רפואי";
      case "family":
        return "משפחה";
      case "referral":
        return "הפניה";
      case "appointment":
        return "תור";
      case "campaign":
        return "קמפיין";
      default:
        return "";
    }
  };

  useEffect(() => {
    setHighlightedResultIndex(0);
  }, [results, activePanel]);

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (!inModal || activePanel !== "search" || !results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedResultIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedResultIndex(
        (index) => (index - 1 + results.length) % results.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleResultClick(results[highlightedResultIndex]);
    } else if (event.key === "Escape") {
      onClose?.();
    }
  };

  useEffect(() => {
    if (inModal) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inModal]);

  return (
    <div
      className={`pointer-events-auto ${inModal ? "flex flex-col" : "relative z-9999 pt-2"}`}
      ref={containerRef}
      style={{ pointerEvents: "auto" }}
    >
      <div
        className={`pointer-events-auto relative ${inModal ? "flex items-center gap-2 border-b px-3" : ""}`}
        style={{ pointerEvents: "auto" }}
      >
        <Search
          className={`text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 transform ${inModal ? "right-3 h-4 w-4" : "right-3 h-3 w-4"}`}
        />
        <Input
          ref={inputRef}
          type="text"
          placeholder="חיפוש גלובלי..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActivePanel("search");
          }}
          onFocus={() => {
            setActivePanel(query.trim() ? "search" : null);
            setIsOpen(true);
          }}
          onKeyDown={handleSearchKeyDown}
          className={`${inModal ? "h-auto w-0 flex-1 rounded-none border-0 bg-transparent py-3 pr-8 pl-20 text-base shadow-none focus-visible:ring-0" : "h-7 w-lg border-1 border-cyan-800/30 pr-10 pl-24 text-sm"} pointer-events-auto`}
          style={{ direction: "rtl", pointerEvents: "auto" }}
        />
        <div
          className={`absolute top-1/2 left-1 flex -translate-y-1/2 items-center gap-1 ${inModal ? "left-3" : ""}`}
        >
          <Button
            variant="ghost"
            size="icon"
            className={inModal ? "h-7 w-7" : "h-6 w-6"}
            title="לקוחות אחרונים"
            onClick={openRecentPanel}
          >
            <History className={inModal ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={inModal ? "h-7 w-7" : "h-6 w-6"}
            title="חיפוש לפי מרשם"
            onClick={openPrescriptionPanel}
          >
            <Glasses className={inModal ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
          </Button>
        </div>
      </div>

      {isOpen && (activePanel || query || results.length > 0) && (
        <div
          dir="rtl"
          className={`${inModal ? "max-h-[460px] overflow-y-auto border-t p-2" : "bg-card text-card-foreground absolute top-full z-50 mt-1 rounded-xl border border-slate-300/80 ring-1 ring-black/10"} ${
            activePanel === "prescription"
              ? inModal
                ? "w-full"
                : "left-1/2 w-[720px] max-w-[min(720px,90vw)] -translate-x-1/2"
              : inModal
                ? "w-full"
                : "right-0 left-0 max-h-96"
          }`}
          style={
            inModal
              ? undefined
              : {
                  boxShadow:
                    "0 18px 34px -18px rgba(15, 23, 42, 0.36), 16px 14px 30px -26px rgba(15, 23, 42, 0.24), -16px 14px 30px -26px rgba(15, 23, 42, 0.24)",
                }
          }
        >
          <CardContent
            className={inModal ? "p-0" : "overflow-hidden rounded-xl p-0"}
          >
            {activePanel === "recent" ? (
              <div
                className={inModal ? "space-y-1" : "max-h-96 overflow-auto"}
                style={{ scrollbarWidth: "none" }}
              >
                {recentLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="border-b p-3 last:border-b-0">
                      <Skeleton className="mb-2 h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))
                ) : recentClients.length > 0 ? (
                  recentClients.map((visit) => (
                    <button
                      key={visit.id}
                      type="button"
                      className={`${inModal ? "hover:bg-muted focus-visible:bg-muted flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 text-start text-sm transition-colors outline-none" : "hover:bg-muted block w-full border-b p-3 text-right transition-colors last:border-b-0"}`}
                      onClick={() => handleClientClick(visit.client_id)}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <User className="text-muted-foreground h-4 w-4" />
                        <div className="w-0 min-w-0 flex-1">
                          <div
                            className={
                              inModal
                                ? "truncate text-sm font-medium"
                                : "truncate text-sm font-medium"
                            }
                          >
                            {`${visit.client?.first_name || ""} ${visit.client?.last_name || ""}`.trim() ||
                              `לקוח ${visit.client_id}`}
                          </div>
                          <div
                            className={
                              inModal
                                ? "text-muted-foreground truncate text-xs"
                                : "text-muted-foreground text-xs"
                            }
                          >
                            {visit.client?.phone_mobile ||
                              visit.client?.national_id ||
                              ""}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-muted-foreground p-4 text-center text-sm">
                    אין לקוחות אחרונים
                  </div>
                )}
              </div>
            ) : activePanel === "prescription" ? (
              <div className="space-y-3 p-3">
                <div
                  className="examcard bg-card rounded-md border px-4 py-3"
                  dir="ltr"
                >
                  <div className="space-y-3">
                    <div className="text-center">
                      <h3 className="text-muted-foreground text-sm font-medium">
                        Prescription Search
                      </h3>
                    </div>
                    <div className="grid grid-cols-[20px_repeat(6,minmax(58px,1fr))] items-center gap-2">
                      <div />
                      {prescriptionColumns.map(({ key, label }) => (
                        <div
                          key={key}
                          className="flex h-4 items-center justify-center"
                        >
                          <span className="text-muted-foreground text-center text-xs font-medium">
                            {label}
                          </span>
                        </div>
                      ))}

                      <div className="flex items-center justify-center">
                        <span
                          className="hover:bg-accent cursor-pointer rounded-full px-2 text-base font-medium"
                          onMouseEnter={() => setHoveredPrescriptionEye("R")}
                          onMouseLeave={() => setHoveredPrescriptionEye(null)}
                          onClick={() => copyPrescriptionEyeRow("R")}
                          title="Copy R eye down to L"
                        >
                          {hoveredPrescriptionEye === "R" ? (
                            <ChevronDown size={16} />
                          ) : (
                            "R"
                          )}
                        </span>
                      </div>
                      {prescriptionColumns.map(
                        ({
                          key,
                          step,
                          type,
                          min,
                          max,
                          showPlus,
                          suffix,
                          center,
                        }) => {
                          const formKey =
                            `r_${key}` as keyof typeof prescriptionForm;
                          return (
                            <FastInput
                              key={formKey}
                              value={prescriptionForm[formKey]}
                              onChange={(value) =>
                                updatePrescriptionField(formKey, value)
                              }
                              debounceMs={0}
                              type={type === "text" ? "text" : "number"}
                              step={step}
                              min={min}
                              max={max}
                              showPlus={showPlus}
                              suffix={suffix}
                              center={center}
                              dir="ltr"
                              className="h-8 bg-white text-xs disabled:cursor-default disabled:opacity-100"
                            />
                          );
                        },
                      )}

                      <div className="flex items-center justify-center">
                        <span
                          className="hover:bg-accent cursor-pointer rounded-full px-2 text-base font-medium"
                          onMouseEnter={() => setHoveredPrescriptionEye("L")}
                          onMouseLeave={() => setHoveredPrescriptionEye(null)}
                          onClick={() => copyPrescriptionEyeRow("L")}
                          title="Copy L eye up to R"
                        >
                          {hoveredPrescriptionEye === "L" ? (
                            <ChevronUp size={16} />
                          ) : (
                            "L"
                          )}
                        </span>
                      </div>
                      {prescriptionColumns.map(
                        ({
                          key,
                          step,
                          type,
                          min,
                          max,
                          showPlus,
                          suffix,
                          center,
                        }) => {
                          const formKey =
                            `l_${key}` as keyof typeof prescriptionForm;
                          return (
                            <FastInput
                              key={formKey}
                              value={prescriptionForm[formKey]}
                              onChange={(value) =>
                                updatePrescriptionField(formKey, value)
                              }
                              debounceMs={0}
                              type={type === "text" ? "text" : "number"}
                              step={step}
                              min={min}
                              max={max}
                              showPlus={showPlus}
                              suffix={suffix}
                              center={center}
                              dir="ltr"
                              className="h-8 bg-white text-xs disabled:cursor-default disabled:opacity-100"
                            />
                          );
                        },
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground text-xs">
                    {prescriptionTotal ? `${prescriptionTotal} תוצאות` : ""}
                  </div>
                  <Button
                    size="sm"
                    onClick={runPrescriptionSearch}
                    disabled={prescriptionLoading}
                  >
                    חפש
                  </Button>
                </div>
                <div
                  className="max-h-72 overflow-auto rounded-md border"
                  style={{ scrollbarWidth: "none" }}
                >
                  {prescriptionLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className="border-b p-3 last:border-b-0">
                        <Skeleton className="mb-2 h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    ))
                  ) : prescriptionResults.length > 0 ? (
                    prescriptionResults.map((result) => (
                      <button
                        key={`${result.source_type}-${result.source_id}-${result.client_id}`}
                        type="button"
                        className="hover:bg-muted block w-full border-b p-3 text-right transition-colors last:border-b-0"
                        onClick={() => handleClientClick(result.client_id)}
                      >
                        <div className="flex items-center gap-3">
                          <Glasses className="text-muted-foreground h-4 w-4" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {result.client_full_name}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {[
                                result.source_date,
                                result.card_type,
                                result.phone_mobile || result.national_id,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-muted-foreground p-4 text-center text-sm">
                      אין תוצאות מרשם
                    </div>
                  )}
                </div>
              </div>
            ) : loading ? (
              <div
                className={inModal ? "space-y-1" : "max-h-96 overflow-auto"}
                style={{ scrollbarWidth: "none" }}
              >
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={
                      inModal
                        ? "flex min-h-10 items-center gap-2.5 rounded-lg px-2"
                        : "border-b p-3 last:border-b-0"
                    }
                  >
                    <div
                      className={
                        inModal
                          ? "flex min-w-0 items-center gap-2.5"
                          : "flex items-center gap-6 px-4"
                      }
                    >
                      <div className="text-muted-foreground flex-shrink-0">
                        <Skeleton className="h-5 w-5 rounded" />
                      </div>
                      <div className="w-0 min-w-0 flex-1">
                        <Skeleton className="mb-2 h-4 w-52" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 ? (
              <div
                className={inModal ? "space-y-1" : "max-h-96 overflow-auto"}
                style={{ scrollbarWidth: "none" }}
              >
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    type="button"
                    className={
                      inModal
                        ? `flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 text-start text-sm transition-colors outline-none ${
                            highlightedResultIndex === index
                              ? "bg-muted"
                              : "hover:bg-muted focus-visible:bg-muted"
                          }`
                        : "hover:bg-muted block w-full cursor-pointer border-b p-3 text-right transition-colors last:border-b-0"
                    }
                    onMouseMove={() => setHighlightedResultIndex(index)}
                    onClick={() => handleResultClick(result)}
                  >
                    <div
                      className={
                        inModal
                          ? "text-muted-foreground flex-shrink-0"
                          : "text-muted-foreground flex-shrink-0 py-4"
                      }
                    >
                      {getResultIcon(
                        result.type,
                        inModal ? "h-4 w-4" : "h-5 w-5",
                      )}
                    </div>
                    <div className="w-0 min-w-0 flex-1">
                      <div
                        className={
                          inModal
                            ? "truncate text-sm font-medium"
                            : "mb-1 truncate text-sm font-medium"
                        }
                      >
                        {result.title}
                      </div>
                      <div
                        className={
                          inModal
                            ? "text-muted-foreground truncate text-xs"
                            : "text-muted-foreground mb-1 truncate text-xs"
                        }
                        title={[
                          getResultTypeLabel(result.type),
                          result.subtitle,
                          result.description,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      >
                        {[
                          getResultTypeLabel(result.type),
                          result.subtitle,
                          result.description,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : query ? (
              <div className="text-muted-foreground p-4 text-center text-sm">
                לא נמצאו תוצאות עבור "{query}"
              </div>
            ) : null}
          </CardContent>
        </div>
      )}
    </div>
  );
}
