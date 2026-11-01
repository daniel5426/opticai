import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAppLocale } from "@/localization/use-app-locale";
import { ClientSearchDetails } from "@/components/search/ClientSearchDetails";
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
  Clinic,
  RecentClientVisit,
  PrescriptionSearchResult,
  SearchClientDetails,
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
  clientDetails?: SearchClientDetails;
  data: any;
  matchedFields: string[];
}

interface GlobalSearchProps {
  onClose?: () => void;
  inModal?: boolean;
}

export function GlobalSearch({ onClose, inModal = false }: GlobalSearchProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
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
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    // Aborting the superseded request stops the browser from waiting on it while the user types.
    const controller = new AbortController();
    const cancelled = () => controller.signal.aborted;
    const run = async () => {
      if (!isOpen) return;
      if (activePanel && activePanel !== "search") return;
      if (!currentClinic?.id) return;
      const q = debouncedQuery.trim();
      if (q.length < 2) {
        setResults([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const offset = (page - 1) * pageSize;
        const res = await apiClient.unifiedSearch(q, currentClinic.id, {
          limit: pageSize,
          offset,
          signal: controller.signal,
        });
        const data = res.data;
        if (data && !cancelled()) {
          const mapped: SearchResult[] = data.items.map((it) => ({
            id: `${it.type}-${it.id}`,
            type: it.type as SearchResult["type"],
            title: it.title,
            subtitle: it.subtitle,
            description: it.description,
            clientDetails: it.client_details,
            data: it,
            matchedFields: [],
          }));
          setResults(mapped);
          setTotal(data.total);
        }
      } catch (e) {
        console.error("Unified search error:", e);
      } finally {
        if (!cancelled()) setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [activePanel, isOpen, currentClinic?.id, debouncedQuery, page]);

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
    return t(`globalSearch.${type}`);
  };

  useEffect(() => {
    setHighlightedResultIndex(0);
  }, [results, activePanel]);

  useEffect(() => {
    if (inModal && activePanel === "search") {
      containerRef.current?.querySelector(`[data-search-result-index="${highlightedResultIndex}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
    }
  }, [inModal, activePanel, highlightedResultIndex, results]);

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
      dir={direction}
      className={`pointer-events-auto ${inModal ? "flex flex-col" : "relative z-9999 pt-2"}`}
      ref={containerRef}
      style={{ pointerEvents: "auto" }}
    >
      <div
        className={`pointer-events-auto relative ${inModal ? "flex items-center gap-2 border-b px-3" : ""}`}
        style={{ pointerEvents: "auto" }}
      >
        <Search
          className={`text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 transform ${inModal ? "start-3 h-4 w-4" : "start-3 h-3 w-4"}`}
        />
        <Input
          ref={inputRef}
          type="text"
          placeholder={t("globalSearch.placeholder")}
          aria-label={t("search")}
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
          className={`${inModal ? "h-auto w-0 flex-1 rounded-none border-0 bg-transparent py-3 ps-8 pe-20 text-base shadow-none focus-visible:ring-0" : "h-7 w-lg border-1 border-cyan-800/30 ps-10 pe-24 text-sm"} pointer-events-auto`}
          style={{ direction, pointerEvents: "auto" }}
        />
        <div
          className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-1 ${inModal ? "end-3" : "end-1"}`}
        >
          <Button
            variant="ghost"
            size="icon"
            className={inModal ? "h-7 w-7" : "h-6 w-6"}
            title={t("recentClients")}
            aria-label={t("recentClients")}
            onClick={openRecentPanel}
          >
            <History className={inModal ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={inModal ? "h-7 w-7" : "h-6 w-6"}
            title={t("globalSearch.prescriptionSearch")}
            aria-label={t("globalSearch.prescriptionSearch")}
            onClick={openPrescriptionPanel}
          >
            <Glasses className={inModal ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
          </Button>
        </div>
      </div>

      {isOpen && (activePanel || query || results.length > 0) && (
        <div
          dir={direction}
          className={`${inModal ? "max-h-[min(460px,calc(90vh-5rem))] overflow-y-auto border-t p-2" : "bg-card text-card-foreground absolute top-full z-50 mt-1 rounded-xl border border-slate-300/80 ring-1 ring-black/10"} ${
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
                className={inModal ? "divide-border divide-y" : "max-h-96 overflow-auto"}
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
                      className={`${inModal ? "hover:bg-muted focus-visible:bg-muted flex min-h-10 w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-start text-sm transition-colors outline-none" : "hover:bg-muted block w-full border-b p-3 text-start transition-colors last:border-b-0"}`}
                      onClick={() => handleClientClick(visit.client_id)}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <User className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div
                            data-no-localize
                            className={
                              inModal
                                ? "truncate text-sm font-medium"
                                : "truncate text-sm font-medium"
                            }
                          >
                            {`${visit.client?.first_name || ""} ${visit.client?.last_name || ""}`.trim() ||
                              t("recentClientFallback", { id: visit.client_id })}
                          </div>
                          {inModal && visit.client ? (
                            <ClientSearchDetails client={visit.client} />
                          ) : (
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
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-muted-foreground p-4 text-center text-sm">
                    {t("noRecentClients")}
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
                        className="hover:bg-muted block w-full border-b p-3 text-start transition-colors last:border-b-0"
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
                {Array.from({ length: inModal ? 4 : 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={
                      inModal
                        ? "flex min-h-24 items-start gap-2.5 rounded-lg px-2 py-2.5"
                        : "border-b p-3 last:border-b-0"
                    }
                  >
                    <div
                      className={
                        inModal
                          ? "flex w-full min-w-0 items-start gap-2.5"
                          : "flex items-center gap-6 px-4"
                      }
                    >
                      <div className="text-muted-foreground flex-shrink-0">
                        <Skeleton className="h-5 w-5 rounded" />
                      </div>
                      <div className="w-0 min-w-0 flex-1">
                        <Skeleton className="mb-2 h-4 w-52 max-w-full" />
                        <Skeleton className="h-3 w-36 max-w-full" />
                        {inModal && <Skeleton className="mt-2 h-3 w-64 max-w-full" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 ? (
              <div
                className={inModal ? "divide-border divide-y" : "max-h-96 overflow-auto"}
                style={{ scrollbarWidth: "none" }}
              >
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    type="button"
                    className={
                      inModal
                        ? `flex min-h-10 w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-start text-sm transition-colors outline-none ${
                            highlightedResultIndex === index
                              ? "bg-muted"
                              : "hover:bg-muted focus-visible:bg-muted"
                          }`
                        : "hover:bg-muted block w-full cursor-pointer border-b p-3 text-start transition-colors last:border-b-0"
                    }
                    data-search-result-index={index}
                    onMouseMove={() => setHighlightedResultIndex(index)}
                    onClick={() => handleResultClick(result)}
                  >
                    <div
                      className={
                        inModal
                          ? "text-muted-foreground mt-0.5 flex-shrink-0"
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
                        data-no-localize
                        className={
                          inModal
                            ? "truncate text-sm font-medium"
                            : "mb-1 truncate text-sm font-medium"
                        }
                      >
                        {result.title}
                      </div>
                      {inModal && result.type === "client" && result.clientDetails ? (
                        <ClientSearchDetails client={result.clientDetails} />
                      ) : (
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
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : query ? (
              <div className="text-muted-foreground p-4 text-center text-sm">
                {t("globalSearch.noResults", { query })}
              </div>
            ) : null}
          </CardContent>
        </div>
      )}
    </div>
  );
}
