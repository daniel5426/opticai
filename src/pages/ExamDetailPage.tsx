import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import {
  useParams,
  useNavigate,
  Link,
  useLocation,
  useSearch,
} from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { getExamPageData } from "@/lib/db/exams-db";
import { getOrdersByClientId } from "@/lib/db/orders-db";
import {
  OpticalExam,
  Client,
  ExamLayout,
} from "@/lib/db/schema-interface";
import { getAllExamLayouts, getExamLayoutById } from "@/lib/db/exam-layouts-db";
import { Button } from "@/components/ui/button";
import { Edit, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { createDetailProps, DetailProps } from "@/components/exam/ExamCardRenderer";
import { createToolboxActions } from "@/components/exam/ExamToolbox";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import { ExamComponentType } from "@/lib/exam-field-mappings";
import { getClipboardContentType } from "@/lib/exam-clipboard";
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout";
import { useClientSidebar } from "@/contexts/ClientSidebarContext";
import { apiClient } from "@/lib/api-client";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useUnsavedChanges } from "@/hooks/shared/useUnsavedChanges";
import { useRowWidthTracking } from "@/hooks/shared/useRowWidthTracking";
import { ExamDetailsCard } from "@/components/exam/ExamDetailsCard";
import { LayoutSelectorDropdown } from "@/components/exam/LayoutSelectorDropdown";
import { ExamDetailPageProps, CardRow, LayoutTab } from "./exam-detail/types";
import { pageConfig } from "./exam-detail/constants";
import {
  flattenExamLayouts,
  collectLeafLayouts,
  sortKeysDeep,
  normalizeFieldValue,
  shallowEqual,
  FULL_DATA_NAME,
} from "./exam-detail/utils";

// Import new hooks
import { useLayoutTabs } from "@/hooks/exam/useLayoutTabs";
import { useCoverTestTabs } from "@/hooks/exam/useCoverTestTabs";
import { useOldRefractionTabs } from "@/hooks/exam/useOldRefractionTabs";
import { useExamClipboard } from "@/hooks/exam/useExamClipboard";
import { useExamSave } from "@/hooks/exam/useExamSave";

// Import new components
import { ExamLoadingState, ExamNotFoundState } from "@/components/exam/ExamLoadingState";
import { ExamLayoutTabs } from "@/components/exam/ExamLayoutTabs";
import { ExamLayoutRenderer } from "@/components/exam/ExamLayoutRenderer";

// Sync imports
import { ExamSyncManager } from "@/lib/exam-sync/ExamSyncManager";
import { SubjectiveToFinalSyncRule } from "@/lib/exam-sync/rules/SubjectiveToFinalSyncRule";
import { SyncContext } from "@/lib/exam-sync/types";

export default function ExamDetailPage({
  mode = "view",
  clientId: propClientId,
  examId: propExamId,
  pageType: propPageType,
  onSave,
  onCancel,
}: ExamDetailPageProps = {}) {
  const location = useLocation();
  const pageType =
    propPageType ||
    (location.pathname.includes("/contact-lenses") ? "contact-lens" : "exam");
  const config = pageConfig[pageType];

  // Move all useParams calls to the top level, outside of any conditionals
  let routeClientId: string | undefined, routeExamId: string | undefined;
  if (pageType === "exam") {
    try {
      const params = useParams({ from: "/clients/$clientId/exams/$examId" });
      routeClientId = params.clientId;
      routeExamId = params.examId;
    } catch {
      try {
        const params = useParams({ from: "/clients/$clientId/exams/new" });
        routeClientId = params.clientId;
      } catch {
        routeClientId = undefined;
        routeExamId = undefined;
      }
    }
  } else {
    try {
      const params = useParams({
        from: "/clients/$clientId/contact-lenses/$contactLensId",
      });
      routeClientId = params.clientId;
      routeExamId = params.contactLensId;
    } catch {
      try {
        const params = useParams({
          from: "/clients/$clientId/contact-lenses/new",
        });
        routeClientId = params.clientId;
      } catch {
        routeClientId = undefined;
        routeExamId = undefined;
      }
    }
  }

  const clientId = propClientId || routeClientId;
  const examId = propExamId || routeExamId;

  const isNewMode = mode === "new" || !examId;

  let layoutIdFromSearch: string | undefined;
  if (pageType === "exam" && isNewMode) {
    try {
      const search = useSearch({ from: "/clients/$clientId/exams/new", strict: false });
      layoutIdFromSearch = (search as any)?.layoutId as string | undefined;
    } catch {
      layoutIdFromSearch = undefined;
    }
  }

  // State declarations
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [exam, setExam] = useState<OpticalExam | null>(null);
  const [availableLayouts, setAvailableLayouts] = useState<ExamLayout[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<number | null>(null);
  const [layoutTabs, setLayoutTabs] = useState<LayoutTab[]>([]);
  const [isAddingLayouts, setIsAddingLayouts] = useState(false);
  const layoutTabsRef = useRef<LayoutTab[]>([]);
  const tempLayoutIdCounterRef = useRef(0);
  const latestLoadIdRef = useRef(0);
  const { currentUser, currentClinic } = useUser();
  const autoImportAttemptedRef = useRef(false);

  useEffect(() => {
    layoutTabsRef.current = layoutTabs;
  }, [layoutTabs]);

  // Sync Manager Initialization
  const syncManager = useMemo(() => {
    const manager = new ExamSyncManager();
    manager.registerRule(new SubjectiveToFinalSyncRule());
    return manager;
  }, []);

  // Form data state
  const [examComponentData, setExamComponentData] = useState<Record<string, any>>({});
  const [examFormData, setExamFormData] = useState<Record<string, any>>({});
  const [examFormDataByInstance, setExamFormDataByInstance] = useState<
    Record<number | string, Record<string, any>>
  >({});
  const fullDataSourcesRef = useRef<
    Record<number, Record<string, number | string | null>>
  >({});

  const [isEditing, setIsEditing] = useState(isNewMode);
  const [activeTab, setActiveTab] = useState(config.sidebarTab);

  const [formData, setFormData] = useState<Partial<OpticalExam>>(
    isNewMode
      ? {
        client_id: Number(clientId),
        exam_date: new Date().toISOString().split("T")[0],
        test_name: "",
        user_id: currentUser?.id,
        dominant_eye: null,
        type: config.dbType,
      }
      : {},
  );

  const [cardRows, setCardRows] = useState<CardRow[]>([
    {
      id: "row-2",
      cards: [{ id: "old-refraction-1", type: "old-refraction" }],
    },
    { id: "row-3", cards: [{ id: "objective-1", type: "objective" }] },
    { id: "row-4", cards: [{ id: "subjective-1", type: "subjective" }] },
    {
      id: "row-5",
      cards: [{ id: "final-subjective-1", type: "final-subjective" }],
    },
    { id: "row-6", cards: [{ id: "addition-1", type: "addition" }] },
    { id: "row-7", cards: [{ id: "notes-1", type: "notes" }] },
  ]);

  const [customWidths, setCustomWidths] = useState<
    Record<string, Record<string, number>>
  >({});
  const [isRegeneratingFullData, setIsRegeneratingFullData] = useState(false);

  // Computed values
  const flattenedAvailableLayouts = useMemo(
    () => flattenExamLayouts(availableLayouts),
    [availableLayouts],
  );
  const leafLayouts = useMemo(
    () => flattenedAvailableLayouts.filter((layout) => !layout.is_group),
    [flattenedAvailableLayouts],
  );
  const layoutMap = useMemo(() => {
    const map = new Map<number, ExamLayout>();
    flattenedAvailableLayouts.forEach((layout) => {
      if (layout.id != null) {
        map.set(layout.id, layout);
      }
    });
    return map;
  }, [flattenedAvailableLayouts]);

  // Unsaved changes hook
  const getSerializedState = useCallback(
    () =>
      JSON.stringify({
        formData: sortKeysDeep(formData),
        examFormData: sortKeysDeep(examFormData),
        examFormDataByInstance: sortKeysDeep(examFormDataByInstance),
      }),
    [formData, examFormData, examFormDataByInstance],
  );

  const {
    hasUnsavedChanges,
    showUnsavedDialog,
    isSaveInFlight,
    setIsSaveInFlight,
    handleNavigationAttempt,
    handleUnsavedConfirm,
    handleUnsavedCancel,
    setBaseline,
    baselineInitializedRef,
    allowNavigationRef,
  } = useUnsavedChanges({
    getSerializedState,
    isEditing,
    isNewMode,
  });

  const { rowWidths, rowRefs } = useRowWidthTracking(cardRows, [
    activeInstanceId,
    layoutTabs,
  ]);

  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  // Helper functions
  const createInitialFormDataBucket = (
    instanceKey: number,
    layoutData?: string,
  ) => {
    const initialData: Record<string, any> = {};
    const baseDataByInstance: Record<string, any> = { layout_instance_id: instanceKey };

    if (layoutData) {
      try {
        const parsedLayout = JSON.parse(layoutData);
        const rows = Array.isArray(parsedLayout)
          ? parsedLayout
          : parsedLayout.rows || [];

        rows.forEach((row: any) => {
          row.cards?.forEach((card: any) => {
            const type = card.type as ExamComponentType;
            const cardId = card.id;
            const key = `${type}-${cardId}`;

            const instanceData: any = { ...baseDataByInstance, card_instance_id: cardId };
            if (card.title) {
              instanceData.title = card.title;
            }
            initialData[key] = instanceData;

            if (!initialData[type]) {
              initialData[type] = instanceData;
            }
          });
        });
      } catch (error) {
        console.error("Error parsing layout data:", error);
      }
    }

    examComponentRegistry.getAllTypes().forEach((type) => {
      if (!initialData[type]) {
        initialData[type] = { layout_instance_id: instanceKey };
      }
    });

    return initialData;
  };

  const initializeFormData = (instanceKey: number, layoutData?: string) => {
    const initialData = createInitialFormDataBucket(instanceKey, layoutData);

    setExamFormData(initialData);
    setExamFormDataByInstance((prev) => ({
      ...prev,
      [instanceKey]: initialData,
    }));
  };

  const applyLayoutStructure = (layoutData?: string) => {
    if (!layoutData) {
      setCardRows([]);
      setCustomWidths({});
      return;
    }
    try {
      const parsed = JSON.parse(layoutData);
      if (Array.isArray(parsed)) {
        setCardRows(parsed);
        setCustomWidths({});
      } else {
        setCardRows(parsed.rows || []);
        setCustomWidths(parsed.customWidths || {});
      }
    } catch (error) {
      console.error("Error parsing layout structure:", error);
      setCardRows([]);
      setCustomWidths({});
    }
  };

  const loadExamComponentData = async (
    layoutInstanceId: number,
    layoutData?: string,
    setCurrent: boolean = false,
  ) => {
    try {
      const data = await examComponentRegistry.loadAllData(layoutInstanceId);
      setExamComponentData(data);

      const formDataLocal: Record<string, any> = {};
      const layoutTitles: Record<string, string> = {};

      if (layoutData) {
        try {
          const parsedLayout = JSON.parse(layoutData);
          const rows = Array.isArray(parsedLayout) ? parsedLayout : (parsedLayout.rows || []);

          rows.forEach((row: any) => {
            row.cards?.forEach((card: any) => {
              const type = card.type as ExamComponentType;
              const cardId = card.id;
              const key = `${type}-${cardId}`;

              layoutTitles[cardId] = card.title || "";

              let instanceData = data[key];

              if (!instanceData && !formDataLocal[type]) {
                instanceData = data[type];
              }

              if (instanceData) {
                formDataLocal[key] = {
                  ...(instanceData as Record<string, any>),
                  card_instance_id: cardId,
                  layout_instance_id: layoutInstanceId
                };

                if (!formDataLocal[type]) {
                  formDataLocal[type] = formDataLocal[key];
                }
              } else {
                const emptyData = {
                  layout_instance_id: layoutInstanceId,
                  card_instance_id: cardId,
                  title: card.title
                };
                formDataLocal[key] = emptyData;
                if (!formDataLocal[type]) formDataLocal[type] = emptyData;
              }

              if (type === "cover-test") {
                Object.keys(data).forEach((k) => {
                  if (k.startsWith(`cover-test-${cardId}-`)) {
                    formDataLocal[k] = (data as any)[k];
                  }
                });
              }
            });
          });
        } catch (error) {
          console.error("Error parsing layout data in loadExamComponentData:", error);
        }
      }

      examComponentRegistry.getAllTypes().forEach((type) => {
        if (!formDataLocal[type]) {
          formDataLocal[type] = data[type] || { layout_instance_id: layoutInstanceId };
        }
      });

      setExamFormDataByInstance((prev) => ({
        ...prev,
        [layoutInstanceId]: formDataLocal,
      }));
      if (setCurrent || activeInstanceId === layoutInstanceId) {
        setExamFormData(formDataLocal);
      }
    } catch (error) {
      console.error("Error loading exam component data:", error);
    }
  };

  // Cover test tabs hook
  const {
    computedCoverTestTabs,
    activeCoverTestTabs,
    setActiveCoverTestTabs,
    addCoverTestTab,
    removeCoverTestTab,
  } = useCoverTestTabs({
    cardRows,
    examFormData,
    setExamFormData,
    activeInstanceId,
    loading,
  });

  // Old refraction tabs hook
  const {
    computedOldRefractionTabs,
    activeOldRefractionTabs,
    setActiveOldRefractionTabs,
    addOldRefractionTab,
    removeOldRefractionTab,
    duplicateOldRefractionTab,
    updateOldRefractionTabType,
  } = useOldRefractionTabs({
    cardRows,
    examFormData,
    setExamFormData,
    activeInstanceId,
    loading,
  });

  const examFormDataByInstanceRef = useRef(examFormDataByInstance);
  const activeInstanceIdRef = useRef(activeInstanceId);

  useEffect(() => {
    examFormDataByInstanceRef.current = examFormDataByInstance;
  }, [examFormDataByInstance]);

  useEffect(() => {
    activeInstanceIdRef.current = activeInstanceId;
  }, [activeInstanceId]);

  // Create field handlers
  const fieldHandlers = useMemo(() => {
    const handlers: Record<string, (field: string, value: string) => void> = {};

    const generateHandler = (key: string, baseType: string) => {
      return (field: string, value: string) => {
        setExamFormData((prev) => {
          const prevEntry = prev[key] || prev[baseType] || {};
          const prevValue = prevEntry[field];
          const normalized = normalizeFieldValue(prevValue, value);
          const nextEntry = { ...prevEntry };

          const currentActiveInstanceId = activeInstanceIdRef.current;

          if (nextEntry.layout_instance_id == null && currentActiveInstanceId != null) {
            nextEntry.layout_instance_id = currentActiveInstanceId;
          }

          if (normalized === undefined) {
            delete nextEntry[field];
          } else {
            nextEntry[field] = normalized;
          }

          const result = { ...prev, [key]: nextEntry };
          if (key !== baseType && (!prev[baseType] || prev[baseType].card_instance_id === nextEntry.card_instance_id)) {
            result[baseType] = nextEntry;
          }

          // Sync Logic
          if (currentUser?.sync_subjective_to_final_subjective) {
            try {
              const context: SyncContext = {
                userSettings: currentUser as any,
                activeInstanceData: result, // result is the new active state
                otherInstancesData: examFormDataByInstanceRef.current,
                activeInstanceId: activeInstanceIdRef.current
              };

              const change = {
                modelName: baseType,
                fieldName: field,
                newValue: normalized,
                instanceId: key,
                layoutInstanceId: activeInstanceIdRef.current || 0
              };

              // Process sync rules
              const syncUpdates = syncManager.process(change, context);

              // Apply updates
              Object.entries(syncUpdates).forEach(([instId, components]) => {
                const instanceIdNum = Number(instId);

                // If update is for ACTIVE instance, merge into `result`
                if (instanceIdNum === activeInstanceIdRef.current) {
                  Object.entries(components).forEach(([compKey, fields]) => {
                    if (!result[compKey]) result[compKey] = { layout_instance_id: activeInstanceIdRef.current };
                    result[compKey] = { ...result[compKey], ...fields };
                  });
                } else {
                  // Queue external update
                  setTimeout(() => {
                    setExamFormDataByInstance(prevInstance => {
                      const next = { ...prevInstance };
                      if (!next[instanceIdNum]) next[instanceIdNum] = {};

                      Object.entries(components).forEach(([compKey, fields]) => {
                        if (!next[instanceIdNum][compKey]) next[instanceIdNum][compKey] = { layout_instance_id: instanceIdNum };
                        next[instanceIdNum][compKey] = { ...next[instanceIdNum][compKey], ...fields };
                      });
                      return next;
                    });
                  }, 0);
                }
              });

            } catch (e) {
              console.error("Error in sync logic:", e);
            }
          }

          return result;
        });
      };
    };

    examComponentRegistry.getAllTypes().forEach((type) => {
      handlers[type] = generateHandler(type, type);
    });

    if (cardRows) {
      cardRows.forEach((row) => {
        row.cards.forEach((card) => {
          const type = card.type as ExamComponentType;
          const cardId = card.id;
          const key = `${type}-${cardId}`;

          if (type === "cover-test") {
            const tabIds = computedCoverTestTabs[cardId] || [];
            tabIds.forEach((tabId) => {
              const coverKey = `cover-test-${cardId}-${tabId}`;
              handlers[coverKey] = (field, value) => {
                setExamFormData((prev) => {
                  const tabIndex = (computedCoverTestTabs[cardId] || []).indexOf(tabId);
                  const prevTab = prev[coverKey] || {};
                  const normalized = normalizeFieldValue(prevTab[field], value);
                  const nextTab = {
                    ...prevTab,
                    card_instance_id: tabId,
                    card_id: cardId,
                    tab_index: tabIndex,
                    layout_instance_id: prevTab.layout_instance_id ?? activeInstanceId,
                  };
                  if (normalized === undefined) {
                    delete nextTab[field];
                  } else {
                    nextTab[field] = normalized;
                  }
                  return { ...prev, [coverKey]: nextTab };
                });
              };
            });
          } else if (type === "old-refraction") {
            const tabIds = computedOldRefractionTabs[cardId] || [];
            tabIds.forEach((tabId) => {
              const oldRefKey = `old-refraction-${cardId}-${tabId}`;
              handlers[oldRefKey] = (field, value) => {
                setExamFormData((prev) => {
                  const tabIndex = (computedOldRefractionTabs[cardId] || []).indexOf(tabId);
                  const prevTab = prev[oldRefKey] || {};
                  const normalized = normalizeFieldValue(prevTab[field], value);
                  const nextTab = {
                    ...prevTab,
                    card_instance_id: tabId,
                    card_id: cardId,
                    tab_index: tabIndex,
                    layout_instance_id: prevTab.layout_instance_id ?? activeInstanceId,
                  };
                  if (normalized === undefined) {
                    delete nextTab[field];
                  } else {
                    nextTab[field] = normalized;
                  }
                  return { ...prev, [oldRefKey]: nextTab };
                });
              };
            });
          } else {
            handlers[key] = generateHandler(key, type);
          }
        });
      });
    }

    return handlers;
  }, [
    currentUser,
    syncManager,
    cardRows,
    computedCoverTestTabs,
    computedOldRefractionTabs
  ]);

  const examFormDataRef = useRef(examFormData);
  useLayoutEffect(() => {
    examFormDataRef.current = examFormData;
  }, [examFormData]);

  const getExamFormData = useCallback(() => examFormDataRef.current, []);

  // const fieldHandlers = createFieldHandlers(); (removed)
  const toolboxActions = useMemo(() => createToolboxActions(getExamFormData, fieldHandlers), [getExamFormData, fieldHandlers]);

  // Clipboard hook
  const {
    clipboardContentType,
    setClipboardContentType,
    handleCopy,
    handlePaste,
  } = useExamClipboard({
    getExamFormData,
    fieldHandlers,
    activeCoverTestTabs,
    computedCoverTestTabs,
    activeOldRefractionTabs,
    computedOldRefractionTabs,
  });

  // Layout tabs hook
  const {
    handleLayoutTabChange,
    handleLayoutTabDrop,
    handleSelectLayoutOption,
    handleAddFullDataTab,
    handleRegenerateFullData,
    handleRemoveLayoutTab,
    buildFullDataBucket,
  } = useLayoutTabs({
    exam,
    isNewMode,
    layoutTabs,
    setLayoutTabs,
    layoutTabsRef,
    activeInstanceId,
    setActiveInstanceId,
    examFormData,
    examFormDataByInstance,
    setExamFormDataByInstance,
    setExamFormData,
    setCardRows,
    setCustomWidths,
    layoutMap,
    fullDataSourcesRef,
    loadExamComponentData,
    initializeFormData,
    applyLayoutStructure,
    setIsAddingLayouts,
    tempLayoutIdCounterRef,
    latestLoadIdRef,
  });

  // Save hook
  const { handleSave } = useExamSave({
    formRef,
    isSaveInFlight,
    setIsSaveInFlight,
    isNewMode,
    setIsEditing,
    formData,
    setFormData,
    exam,
    setExam,
    examFormData,
    examFormDataByInstance,
    setExamFormDataByInstance,
    layoutTabs,
    setLayoutTabs,
    activeInstanceId,
    setActiveInstanceId,
    setExamFormData,
    clientId,
    currentClinic,
    currentUser,
    config,
    setBaseline,
    allowNavigationRef,
    navigate,
    onSave,
  });

  const { currentClient, setActiveTab: setSidebarActiveTab } =
    useClientSidebar();

  // Auto-import order data to old refraction
  useEffect(() => {
    const performAutoImport = async () => {
      if (
        !isNewMode ||
        !clientId ||
        !currentUser?.import_order_to_old_refraction_default ||
        !activeInstanceId ||
        autoImportAttemptedRef.current
      )
        return;

      const hasOldRefraction = Object.keys(computedOldRefractionTabs).length > 0;
      if (!hasOldRefraction) return;

      autoImportAttemptedRef.current = true;

      try {
        const orders = await getOrdersByClientId(Number(clientId));
        if (!orders || orders.length === 0) return;

        const sortedOrders = orders.sort((a, b) => {
          const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
          const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
          return dateB - dateA;
        });

        const latestOrder = sortedOrders[0];
        if (!latestOrder.order_data) return;

        const isContact =
          latestOrder.type === "עדשות מגע" || (latestOrder as any).__contact;
        const orderData = latestOrder.order_data as Record<string, any>;

        let sourceData: any = {};
        if (isContact) {
          sourceData = orderData["contact-lens-exam"] || {};
        } else {
          sourceData = orderData["final-prescription"] || {};
        }

        setExamFormData((prev) => {
          const nextState = { ...prev };
          let changed = false;

          Object.keys(computedOldRefractionTabs).forEach((cardId) => {
            // Find existing tabs in PREV state to ensure we target the correct one
            const prefix = `old-refraction-${cardId}-`;
            const tabKeys = Object.keys(prev).filter((k) =>
              k.startsWith(prefix),
            );

            if (tabKeys.length === 0) return;

            // Sort by tab_index to find the first/default tab
            tabKeys.sort((a, b) => {
              const idxA = prev[a]?.tab_index ?? 0;
              const idxB = prev[b]?.tab_index ?? 0;
              return idxA - idxB;
            });

            const targetKey = tabKeys[0];
            const prevTab = prev[targetKey] || {};
            const nextTab = { ...prevTab };

            if (nextTab.layout_instance_id == null) {
              nextTab.layout_instance_id = activeInstanceId;
            }

            const updateFieldRaw = (key: string, value: any) => {
              if (value !== undefined && value !== null) {
                nextTab[key] = String(value);
                changed = true;
              }
            };

            ["r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax"].forEach(
              (key) => {
                updateFieldRaw(key, sourceData[key]);
              },
            );

            if (!isContact) {
              ["r_pris", "l_pris", "r_base", "l_base"].forEach((key) => {
                updateFieldRaw(key, sourceData[key]);
              });
            }

            if (isContact) {
              if (sourceData["r_read_ad"] !== undefined)
                updateFieldRaw("r_ad", sourceData["r_read_ad"]);
              if (sourceData["l_read_ad"] !== undefined)
                updateFieldRaw("l_ad", sourceData["l_read_ad"]);
            } else {
              ["r_ad", "l_ad"].forEach((key) => {
                updateFieldRaw(key, sourceData[key]);
              });
            }

            if (changed) {
              nextState[targetKey] = nextTab;
            }
          });

          if (changed) {
            return nextState;
          }
          return prev;
        });
      } catch (error) {
        console.error("Failed to auto-import order data", error);
      }
    };

    performAutoImport();
  }, [
    isNewMode,
    clientId,
    currentUser,
    activeInstanceId,
    computedOldRefractionTabs,
    activeOldRefractionTabs,
  ]);


  // Effects
  useEffect(() => {
    setSidebarActiveTab(config.sidebarTab);
  }, [setSidebarActiveTab, config.sidebarTab]);

  useEffect(() => {
    baselineInitializedRef.current = false;
    const loadData = async () => {
      if (!clientId) return;
      try {
        setLoading(true);
        setClipboardContentType(getClipboardContentType());
        if (examId && !isNewMode) {
          const pageData = await getExamPageData(Number(examId));
          if (pageData) {
            const {
              exam: examData,
              instances,
              chosen_active_instance_id,
              available_layouts,
            } = pageData;
            setExam(examData || null);
            const layoutInstances = (instances || []).map(
              (e: any) => e.instance,
            );
            const layoutMapLocal: Record<number, any> = Object.fromEntries(
              (instances || []).map((e: any) => [
                e.instance.layout_id,
                e.layout,
              ]),
            );
            if (layoutInstances && layoutInstances.length > 0) {
              const tabs = layoutInstances.map((instance: any) => {
                const layout = layoutMapLocal[instance.layout_id];
                const layoutDataStr =
                  layout?.layout_data || instance?.layout_data || "";
                const name =
                  layout?.name || (instance?.layout_data ? FULL_DATA_NAME : "");
                return {
                  id: instance.id || 0,
                  layout_id: instance.layout_id,
                  name,
                  layout_data: layoutDataStr,
                  isActive: instance.id === chosen_active_instance_id,
                };
              });
              setLayoutTabs(tabs);
              const chosenInstId = chosen_active_instance_id as
                | number
                | undefined;
              const chosen =
                (instances || []).find(
                  (e: any) => e?.instance?.id === chosenInstId,
                ) || (instances || [])[0];
              if (
                chosen &&
                chosen.instance &&
                (chosen.layout || chosen.instance?.layout_data)
              ) {
                setActiveInstanceId(chosen.instance.id || 0);
                const layoutDataStr =
                  chosen.layout?.layout_data ||
                  chosen.instance?.layout_data ||
                  "[]";
                const parsedLayout = JSON.parse(layoutDataStr);
                if (Array.isArray(parsedLayout)) {
                  setCardRows(parsedLayout);
                  setCustomWidths({});
                } else {
                  setCardRows(parsedLayout.rows || []);
                  setCustomWidths(parsedLayout.customWidths || {});
                }

                const initialFormDataByInstance: Record<number, any> = {};
                instances.forEach((instanceData: any) => {
                  if (
                    instanceData.exam_data &&
                    typeof instanceData.exam_data === "object"
                  ) {
                    initialFormDataByInstance[instanceData.instance.id] =
                      instanceData.exam_data;
                  }
                });
                setExamFormDataByInstance(initialFormDataByInstance);

                const activeExamData =
                  initialFormDataByInstance[chosen.instance.id];
                const chosenTab = layoutTabs.find(
                  (tab) => tab.id === chosenInstId,
                );

                if (chosenTab && chosenTab.name === FULL_DATA_NAME) {
                  const seedBucket = buildFullDataBucket(chosen.instance.id);
                  setExamFormData(seedBucket);
                  setExamFormDataByInstance((prev) => ({
                    ...prev,
                    [chosen.instance.id]: seedBucket,
                  }));
                } else if (
                  activeExamData &&
                  Object.keys(activeExamData).length > 0
                ) {
                  setExamFormData(activeExamData);
                } else if (chosen.layout && chosen.layout.layout_data) {
                  await loadExamComponentData(
                    chosen.instance.id,
                    layoutDataStr,
                    true,
                  );
                } else {
                  const seedBucket = buildFullDataBucket(chosen.instance.id);
                  setExamFormData(seedBucket);
                  setExamFormDataByInstance((prev) => ({
                    ...prev,
                    [chosen.instance.id]: seedBucket,
                  }));
                }
              }
              if (Array.isArray(available_layouts)) {
                setAvailableLayouts(available_layouts as any);
              }
            }
          }
        } else {
          const layoutsTree = await getAllExamLayouts(currentClinic?.id);
          setAvailableLayouts(layoutsTree as ExamLayout[]);

          if (layoutIdFromSearch) {
            const selectedLayoutId = Number(layoutIdFromSearch);
            const flattened = flattenExamLayouts(layoutsTree as ExamLayout[]);
            const map = new Map<number, ExamLayout>();
            flattened.forEach((layout) => {
              if (layout.id != null) map.set(layout.id, layout);
            });
            const fromTree = map.get(selectedLayoutId);
            const selectedLayout = fromTree || (await getExamLayoutById(selectedLayoutId));

            if (selectedLayout) {
              setFormData((prev) => ({
                ...prev,
                test_name: selectedLayout.name || prev.test_name,
              }));

              const layoutsToOpen = selectedLayout.is_group
                ? collectLeafLayouts(fromTree || selectedLayout).filter(
                  (layout) => layout.id && !layout.is_group,
                )
                : [selectedLayout];

              if (layoutsToOpen.length > 0) {
                const tempTabs: LayoutTab[] = [];
                const buckets: Record<number | string, Record<string, any>> = {};
                let activeTempId: number | null = null;

                layoutsToOpen.forEach((layout, idx) => {
                  const tempInstanceId = -Date.now() - idx;
                  if (idx === 0) activeTempId = tempInstanceId;
                  tempTabs.push({
                    id: tempInstanceId,
                    layout_id: layout.id || 0,
                    name: layout.name || "",
                    layout_data: layout.layout_data || "[]",
                    isActive: idx === 0,
                  });
                  buckets[tempInstanceId] = createInitialFormDataBucket(
                    tempInstanceId,
                    layout.layout_data || "",
                  );
                });

                applyLayoutStructure(layoutsToOpen[0].layout_data || "[]");
                setLayoutTabs(tempTabs);
                setActiveInstanceId(activeTempId);
                setExamFormDataByInstance((prev) => ({ ...prev, ...buckets }));
                if (activeTempId != null) {
                  setExamFormData(buckets[activeTempId] || {});
                }
              }
            }
          }
        }
      } catch (error) {
        toast.error("שגיאה בטעינת נתוני הבדיקה");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [clientId, examId, isNewMode, config.dbType, currentClinic?.id, layoutIdFromSearch]);

  useEffect(() => {
    if (!loading && !baselineInitializedRef.current) {
      const timer = setTimeout(() => {
        setBaseline();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, setBaseline]);

  useEffect(() => {
    const prefetch = async () => {
      const types = [
        "old-refraction",
        "objective",
        "subjective",
        "final-subjective",
        "addition",
        "notes",
        "final-prescription",
      ] as const;
      await Promise.all(
        types.map((t) => {
          const cfg = examComponentRegistry.get(t as any);
          return cfg?.component
            ? cfg.component().catch(() => null)
            : Promise.resolve(null);
        }),
      );
    };
    prefetch();
  }, []);

  useEffect(() => {
    if (exam) setFormData({ ...exam });
  }, [exam]);

  useEffect(() => {
    if (activeInstanceId != null) {
      const bucket = examFormDataByInstance[activeInstanceId];
      if (!shallowEqual(bucket || {}, examFormData)) {
        setExamFormData(bucket || {});
      }
    }
  }, [activeInstanceId]);

  useEffect(() => {
    if (activeInstanceId != null) {
      const currentBucket = examFormDataByInstance[activeInstanceId] || {};
      if (!shallowEqual(currentBucket, examFormData)) {
        setExamFormDataByInstance((prev) => ({
          ...prev,
          [activeInstanceId]: examFormData,
        }));
      }
    }
  }, [examFormData]);

  useEffect(() => {
    if (activeInstanceId == null) return;
    const activeTabItem = layoutTabs.find((tab) => tab.isActive);
    if (!activeTabItem || activeTabItem.name !== FULL_DATA_NAME) return;
    const sources = fullDataSourcesRef.current[activeInstanceId] || {};
    setExamFormDataByInstance((prev) => {
      const nextState: Record<number | string, Record<string, any>> = {
        ...prev,
      };
      let changed = false;

      const keys = new Set([
        ...Object.keys(sources),
        ...Object.keys(examFormData),
      ]);

      keys.forEach((componentKey) => {
        const currentValue = examFormData[componentKey];
        const mappedSource =
          sources[componentKey] ??
          (currentValue as any)?.source_layout_instance_id ??
          null;
        if (mappedSource == null) {
          if (sources[componentKey] != null) {
            delete sources[componentKey];
          }
          return;
        }

        if (sources[componentKey] == null) {
          sources[componentKey] = mappedSource;
        }

        const resolvedKey =
          typeof mappedSource === "number"
            ? mappedSource
            : Number(mappedSource);
        if (!Number.isFinite(resolvedKey)) return;
        if (resolvedKey === activeInstanceId) return;

        const existingBucket =
          nextState[resolvedKey] || prev[resolvedKey] || {};

        if (!currentValue) {
          if (existingBucket && existingBucket[componentKey]) {
            const updatedBucket = { ...existingBucket };
            delete updatedBucket[componentKey];
            nextState[resolvedKey] = updatedBucket;
            changed = true;
          }
          delete sources[componentKey];
          return;
        }

        if ((currentValue as any).__deleted) {
          const deletedValue = {
            ...currentValue,
            layout_instance_id: resolvedKey,
          };
          delete (deletedValue as any).source_layout_instance_id;
          const previousValue = existingBucket[componentKey];
          if (!shallowEqual(previousValue || {}, deletedValue)) {
            nextState[resolvedKey] = {
              ...existingBucket,
              [componentKey]: deletedValue,
            };
            changed = true;
          }
          return;
        }

        const updatedValue = {
          ...currentValue,
          layout_instance_id: resolvedKey,
        };
        delete (updatedValue as any).source_layout_instance_id;
        const previousValue = existingBucket[componentKey];
        if (!shallowEqual(previousValue || {}, updatedValue)) {
          nextState[resolvedKey] = {
            ...existingBucket,
            [componentKey]: updatedValue,
          };
          changed = true;
        }
      });

      return changed ? nextState : prev;
    });
  }, [examFormData, activeInstanceId, layoutTabs]);

  // Event handlers
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditButtonClick = () => {
    if (isEditing) {
      handleSave();
    } else {
      setIsEditing(true);
      setTimeout(() => {
        setBaseline();
      }, 0);
    }
  };

  const handleTabChange = (value: string) => {
    if (clientId && value !== config.sidebarTab) {
      handleNavigationAttempt(() => {
        navigate({
          to: "/clients/$clientId",
          params: { clientId: String(clientId) },
          search: { tab: value },
        });
      });
    }
  };

  // Build detail props
  const detailProps = useMemo(() => createDetailProps(
    isEditing,
    isNewMode,
    exam,
    formData,
    examFormData,
    fieldHandlers,
    handleInputChange,
    handleSelectChange,
    setFormData,
    (value: string) => { },
    toolboxActions,
    cardRows.map((row) => row.cards),
    {
      handleMultifocalOldRefraction: () => { },
      handleVHConfirmOldRefraction: (
        rightPris: number,
        rightBase: number,
        leftPris: number,
        leftBase: number,
      ) => {
        const oldRefractionHandler = fieldHandlers["old-refraction"];
        if (oldRefractionHandler) {
          oldRefractionHandler("r_pris", rightPris.toString());
          oldRefractionHandler("r_base", rightBase.toString());
          oldRefractionHandler("l_pris", leftPris.toString());
          oldRefractionHandler("l_base", leftBase.toString());
        }
      },
      handleVHConfirm: (
        rightPris: number,
        rightBase: number,
        leftPris: number,
        leftBase: number,
      ) => {
        const subjectiveHandler = fieldHandlers["subjective"];
        if (subjectiveHandler) {
          subjectiveHandler("r_pris", rightPris.toString());
          subjectiveHandler("r_base", rightBase.toString());
          subjectiveHandler("l_pris", leftPris.toString());
          subjectiveHandler("l_base", leftBase.toString());
        }
      },
      handleMultifocalSubjective: () => { },
      handleFinalSubjectiveVHConfirm: (
        rightPrisH: number,
        rightBaseH: string,
        rightPrisV: number,
        rightBaseV: string,
        leftPrisH: number,
        leftBaseH: string,
        leftPrisV: number,
        leftBaseV: string,
      ) => {
        const finalSubjectiveHandler = fieldHandlers["final-subjective"];
        if (finalSubjectiveHandler) {
          finalSubjectiveHandler("r_pr_h", rightPrisH.toString());
          finalSubjectiveHandler("r_base_h", rightBaseH);
          finalSubjectiveHandler("r_pr_v", rightPrisV.toString());
          finalSubjectiveHandler("r_base_v", rightBaseV);
          finalSubjectiveHandler("l_pr_h", leftPrisH.toString());
          finalSubjectiveHandler("l_base_h", leftBaseH);
          finalSubjectiveHandler("l_pr_v", leftPrisV.toString());
          finalSubjectiveHandler("l_base_v", leftBaseV);
        }
      },
      handleMultifocalOldRefractionExtension: () => { },
      coverTestTabs: computedCoverTestTabs as any,
      activeCoverTestTabs: activeCoverTestTabs as any,
      setActiveCoverTestTabs: setActiveCoverTestTabs as any,
      addCoverTestTab: addCoverTestTab as any,
      removeCoverTestTab: removeCoverTestTab as any,
      oldRefractionTabs: computedOldRefractionTabs as any,
      activeOldRefractionTabs: activeOldRefractionTabs as any,
      setActiveOldRefractionTabs: setActiveOldRefractionTabs as any,
      addOldRefractionTab: addOldRefractionTab as any,
      removeOldRefractionTab: removeOldRefractionTab as any,
      duplicateOldRefractionTab: duplicateOldRefractionTab as any,
      updateOldRefractionTabType: updateOldRefractionTabType as any,
      layoutInstanceId: activeInstanceId,
      setExamFormData: setExamFormData,
    } as any,
  ), [
    isEditing, isNewMode, exam, formData, examFormData, fieldHandlers, toolboxActions, cardRows, computedCoverTestTabs, activeCoverTestTabs, computedOldRefractionTabs, activeOldRefractionTabs, activeInstanceId
  ]);

  const detailPropsWithOverrides: DetailProps = {
    ...detailProps,
    isEditing: detailProps.isEditing,
    coverTestTabs: computedCoverTestTabs,
    availableExamLayouts: availableLayouts,
    onSelectLayout: handleSelectLayoutOption,
    isLayoutSelectionLoading: isAddingLayouts,
  };

  const handleRequestLayouts = useCallback(async () => {
    if (leafLayouts.length === 0 && currentClinic?.id) {
      const res = await apiClient.getExamLayouts(currentClinic.id);
      if (!res.error) {
        setAvailableLayouts((res.data || []) as ExamLayout[]);
      }
    }
  }, [leafLayouts.length, currentClinic?.id, setAvailableLayouts]);

  // Header actions
  const headerActions = (
    <>
      {!isNewMode && !isEditing && exam?.id && (
        <Link
          to="/clients/$clientId/orders/new"
          params={{ clientId: String(clientId) }}
          search={{ examId: String(exam.id) }}
          onClick={(e) => {
            if (!hasUnsavedChanges) return;
            e.preventDefault();
            handleNavigationAttempt(() => {
              navigate({
                to: "/clients/$clientId/orders/new",
                params: { clientId: String(clientId) },
                search: { examId: String(exam.id) },
              });
            });
          }}
        >
        </Link>
      )}
      {!isNewMode && (<><LayoutSelectorDropdown
        availableLayouts={availableLayouts}
        onSelectLayout={handleSelectLayoutOption}
        onAddFullData={handleAddFullDataTab}
        onRequestLayouts={handleRequestLayouts}
        isLoading={isAddingLayouts}
      />
        <Button variant="outline" className="h-9 px-4">
          הזמנה
        </Button></>)}

      {isNewMode && onCancel && (
        <Button
          variant="outline"
          className="h-9 px-4"
          onClick={(e) => {
            e.preventDefault();
            handleNavigationAttempt(() => {
              if (onCancel) onCancel();
            });
          }}
        >
          ביטול
        </Button>
      )}
      <Button
        variant={isEditing ? "outline" : "default"}
        className="h-9 px-4"
        onClick={handleEditButtonClick}
        disabled={isSaveInFlight}
      >
        {isSaveInFlight ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : isNewMode || isEditing ? (
          <Save size={18} />
        ) : (
          <Edit size={18} />
        )}
      </Button>
    </>
  );

  // Render loading state
  if (loading || !currentClient) {
    return <ExamLoadingState activeTab={activeTab} onTabChange={handleTabChange} />;
  }

  // Render not found state
  if (!isNewMode && !loading && !exam) {
    return <ExamNotFoundState activeTab={activeTab} onTabChange={handleTabChange} />;
  }

  // Main render
  return (
    <>
      <SiteHeader
        title="לקוחות"
        backLink="/clients"
        examInfo={isNewMode ? config.newTitle : config.headerInfo(examId || "")}
        tabs={{ activeTab, onTabChange: handleTabChange }}
      />
      <ClientSpaceLayout>
        <div
          className="no-scrollbar flex flex-1 flex-col p-4 lg:p-5"
          dir="rtl"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            margin: "0",
          }}
        >
          <div className="mb-4">
            <ExamDetailsCard
              mode="detail"
              detailProps={detailPropsWithOverrides}
              actions={headerActions}
            />
          </div>

          {/* Layout Tabs */}
          <ExamLayoutTabs
            layoutTabs={layoutTabs}
            activeInstanceId={activeInstanceId}
            isEditing={isEditing}
            isRegeneratingFullData={isRegeneratingFullData}
            onTabClick={handleLayoutTabChange}
            onTabDrop={handleLayoutTabDrop}
            onRegenerateFullData={handleRegenerateFullData}
            onRemoveTab={handleRemoveLayoutTab}
          />

          <form ref={formRef} className="pt-4 pb-14">
            <ExamLayoutRenderer
              cardRows={cardRows}
              customWidths={customWidths}
              rowWidths={rowWidths}
              rowRefs={rowRefs}
              isEditing={isEditing}
              detailProps={detailPropsWithOverrides}
              clipboardContentType={clipboardContentType}
              activeCoverTestTabs={activeCoverTestTabs}
              computedCoverTestTabs={computedCoverTestTabs}
              activeOldRefractionTabs={activeOldRefractionTabs}
              computedOldRefractionTabs={computedOldRefractionTabs}
              examFormData={examFormData}
              setExamFormData={setExamFormData}
              toolboxActions={toolboxActions}
              onCopy={handleCopy}
              onPaste={handlePaste}
            />
          </form>
        </div>
      </ClientSpaceLayout>
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onConfirm={handleUnsavedConfirm}
        onCancel={handleUnsavedCancel}
      />
    </>
  );
}
