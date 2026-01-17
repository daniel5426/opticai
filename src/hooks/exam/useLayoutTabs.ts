import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { ExamLayout, ExamLayoutInstance } from "@/lib/db/schema-interface";
import { CardItem } from "@/components/exam/ExamCardRenderer";
import {
  addLayoutToExam,
  setActiveExamLayoutInstance,
  deleteExamLayoutInstance,
  createExamLayoutInstance,
  updateExamLayoutInstance,
  reorderExamLayoutInstances,
} from "@/lib/db/exam-layouts-db";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import { CardRow, LayoutTab } from "@/pages/exam-detail/types";
import {
  collectLeafLayouts,
  isNonEmptyComponent,
  packCardsIntoRows,
  FULL_DATA_NAME,
} from "@/pages/exam-detail/utils";

interface UseLayoutTabsParams {
  exam: { id?: number } | null;
  isNewMode: boolean;
  layoutTabs: LayoutTab[];
  setLayoutTabs: React.Dispatch<React.SetStateAction<LayoutTab[]>>;
  layoutTabsRef: React.MutableRefObject<LayoutTab[]>;
  activeInstanceId: number | null;
  setActiveInstanceId: React.Dispatch<React.SetStateAction<number | null>>;
  examFormData: Record<string, any>;
  examFormDataByInstance: Record<number | string, Record<string, any>>;
  setExamFormDataByInstance: React.Dispatch<React.SetStateAction<Record<number | string, Record<string, any>>>>;
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setCardRows: React.Dispatch<React.SetStateAction<CardRow[]>>;
  setCustomWidths: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  layoutMap: Map<number, ExamLayout>;
  fullDataSourcesRef: React.MutableRefObject<Record<number, Record<string, number | string | null>>>;
  loadExamComponentData: (layoutInstanceId: number, layoutData?: string, setCurrent?: boolean) => Promise<void>;
  initializeFormData: (instanceKey: number, layoutData?: string) => void;
  applyLayoutStructure: (layoutData?: string) => void;
  setIsAddingLayouts: React.Dispatch<React.SetStateAction<boolean>>;
  tempLayoutIdCounterRef: React.MutableRefObject<number>;
  latestLoadIdRef: React.MutableRefObject<number>;
}

export function useLayoutTabs({
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
}: UseLayoutTabsParams) {
  const isRegeneratingFullDataRef = useRef(false);

  // Get contributing instance IDs for full data aggregation
  const getContributingInstanceIds = useCallback(
    (excludeInstanceId?: number | string) => {
      const excludedKey =
        excludeInstanceId == null ? null : String(excludeInstanceId);
      return layoutTabs
        .filter(
          (tab) =>
            tab.name !== FULL_DATA_NAME &&
            (excludedKey === null || String(tab.id) !== excludedKey),
        )
        .map((tab) => String(tab.id));
    },
    [layoutTabs],
  );

  // Aggregate all data from all instances
  const aggregateAllData = useCallback(
    (allowedInstanceIds?: Array<number | string>): Record<string, any> => {
      const allowed = allowedInstanceIds
        ? new Set(allowedInstanceIds.map(String))
        : null;
      const aggregated: Record<string, any> = {};
      const addedInstanceIds = new Set<string>();

      Object.entries(examFormDataByInstance).forEach(([instanceKey, bucket]) => {
        if (allowed && !allowed.has(instanceKey)) return;

        const keys = Object.keys(bucket || {}).sort((a, b) => {
          const aHasHyphen = a.includes('-');
          const bHasHyphen = b.includes('-');
          if (aHasHyphen && !bHasHyphen) return -1;
          if (!aHasHyphen && bHasHyphen) return 1;
          return 0;
        });

        keys.forEach((key) => {
          const val = bucket[key];
          if (!val || typeof val !== "object" || (val as any)?.__deleted) return;

          const instanceId = (val as any)?.card_instance_id;
          if (instanceId && addedInstanceIds.has(instanceId)) return;

          if (isNonEmptyComponent(key, val)) {
            aggregated[key] = val;
            if (instanceId) addedInstanceIds.add(instanceId);
          }
        });
      });

      return aggregated;
    },
    [examFormDataByInstance],
  );

  // Build full data layout structure
  const buildFullDataLayoutData = useCallback((): string | null => {
    const aggregated = aggregateAllData(getContributingInstanceIds());
    const entries = Object.entries(aggregated);
    if (entries.length === 0) return null;

    const cardDefs: { id: string; type: CardItem["type"]; title?: string }[] = [];
    const addedStandard = new Set<string>();
    const addedCoverCards = new Set<string>();

    entries.forEach(([key, value]) => {
      let type: CardItem["type"] | null = null;
      let cardId: string | null = null;

      if (key.startsWith("notes-")) {
        type = "notes";
        cardId = key.replace("notes-", "");
      } else if (key.startsWith("cover-test-")) {
        const suffix = key.slice("cover-test-".length);
        const dashIndex = suffix.indexOf("-");
        const id = dashIndex >= 0 ? suffix.slice(0, dashIndex) : suffix;
        if (addedCoverCards.has(id)) return;
        addedCoverCards.add(id);
        cardDefs.push({ id, type: "cover-test" });
        return;
      } else {
        for (const registeredType of examComponentRegistry.getAllTypes()) {
          if (key === registeredType) {
            type = registeredType as CardItem["type"];
            cardId = (value as any)?.card_instance_id || "";
            break;
          } else if (key.startsWith(`${registeredType}-`)) {
            type = registeredType as CardItem["type"];
            cardId = key.replace(`${registeredType}-`, "");
            break;
          }
        }
      }

      if (type && cardId && !addedStandard.has(`${type}-${cardId}`)) {
        addedStandard.add(`${type}-${cardId}`);
        const title = (value as any)?.title;
        cardDefs.push({ id: cardId, type, ...(title ? { title } : {}) });
      }
    });

    if (cardDefs.length === 0) return null;
    const rows = packCardsIntoRows(cardDefs);
    const layout = {
      rows,
      customWidths: {} as Record<string, Record<string, number>>,
    };
    return JSON.stringify(layout);
  }, [aggregateAllData, getContributingInstanceIds]);

  // Build full data bucket for an instance
  const buildFullDataBucket = useCallback(
    (instanceId: number): Record<string, any> => {
      const aggregated = aggregateAllData(getContributingInstanceIds(instanceId));
      const bucket: Record<string, any> = {};
      const sources: Record<string, number | string | null> = {};

      Object.entries(aggregated).forEach(([key, val]) => {
        if (!isNonEmptyComponent(key, val)) return;
        const sourceInstanceId = (val as any)?.layout_instance_id ?? null;
        sources[key] = sourceInstanceId;
        const clone = { ...(val as any) };
        clone.source_layout_instance_id = sourceInstanceId;
        clone.layout_instance_id = instanceId;

        if (!clone.card_instance_id) {
          if (key.startsWith("notes-")) {
            clone.card_instance_id = key.replace("notes-", "");
          } else {
            for (const type of examComponentRegistry.getAllTypes()) {
              if (key.startsWith(`${type}-`)) {
                clone.card_instance_id = key.replace(`${type}-`, "");
                break;
              }
            }
          }
        }

        delete (clone as any).__deleted;
        bucket[key] = clone;
      });

      if (Object.keys(sources).length > 0) {
        fullDataSourcesRef.current[instanceId] = sources;
      } else {
        delete fullDataSourcesRef.current[instanceId];
      }

      return bucket;
    },
    [aggregateAllData, getContributingInstanceIds, fullDataSourcesRef],
  );

  // Handle layout tab change
  const handleLayoutTabChange = useCallback(
    async (tabId: number) => {
      const selectedTab = layoutTabs.find((tab) => tab.id === tabId);
      if (!selectedTab) return;

      try {
        const loadId = ++latestLoadIdRef.current;
        const updatedTabs = layoutTabs.map((tab) => ({
          ...tab,
          isActive: tab.id === tabId,
        }));

        setLayoutTabs(updatedTabs);
        setActiveInstanceId(selectedTab.id);

        const parsedLayout = JSON.parse(selectedTab.layout_data);
        if (Array.isArray(parsedLayout)) {
          setCardRows(parsedLayout);
          setCustomWidths({});
        } else {
          setCardRows(parsedLayout.rows || []);
          setCustomWidths(parsedLayout.customWidths || {});
        }

        const existingBucket = examFormDataByInstance[selectedTab.id];
        if (selectedTab.name === FULL_DATA_NAME && selectedTab.layout_data) {
          const refreshedBucket = buildFullDataBucket(selectedTab.id);
          setExamFormDataByInstance((prev) => ({
            ...prev,
            [selectedTab.id]: refreshedBucket,
          }));
          setExamFormData(refreshedBucket);
        } else if (existingBucket && Object.keys(existingBucket).length > 0) {
          setExamFormData(existingBucket);
        }

        if (exam && exam.id && !isNewMode) {
          await setActiveExamLayoutInstance(exam.id, tabId);
        }
      } catch (error) {
        console.error("Error changing layout tab:", error);
        toast.error("שגיאה בהחלפת לשונית פריסה");
      }
    },
    [
      layoutTabs,
      exam,
      isNewMode,
      examFormDataByInstance,
      buildFullDataBucket,
      setLayoutTabs,
      setActiveInstanceId,
      setCardRows,
      setCustomWidths,
      setExamFormDataByInstance,
      setExamFormData,
      latestLoadIdRef,
    ],
  );

  // Handle layout tab drop (reorder)
  const handleLayoutTabDrop = useCallback(
    async (id: string, index?: number) => {
      if (index === undefined) return;

      const draggedTabId = Number(id);
      const currentIndex = layoutTabs.findIndex((tab) => tab.id === draggedTabId);

      if (currentIndex === -1 || currentIndex === index) return;

      const newTabs = [...layoutTabs];
      const [removed] = newTabs.splice(currentIndex, 1);
      newTabs.splice(index, 0, removed);

      setLayoutTabs(newTabs);
      if (!exam || !exam.id || isNewMode) {
        return;
      }
      const reorderItems = newTabs
        .filter((tab) => tab.id > 0)
        .map((tab, newIndex) => ({
          id: Number(tab.id),
          order: newIndex,
        }));
      if (reorderItems.length === 0) {
        return;
      }
      try {
        await reorderExamLayoutInstances(Number(exam.id), reorderItems);
      } catch (error) {
        console.error("Error saving layout tab order:", error);
      }
    },
    [layoutTabs, exam, isNewMode, setLayoutTabs],
  );

  // Add layout node
  const addLayoutNode = useCallback(
    async (
      layout: ExamLayout,
      activate: boolean,
    ): Promise<{ added: boolean; existed: boolean }> => {
      if (!layout.id) {
        return { added: false, existed: false };
      }
      const existingTab = layoutTabsRef.current.find(
        (tab) => tab.layout_id === layout.id,
      );
      if (existingTab) {
        if (activate) {
          await handleLayoutTabChange(existingTab.id);
        }
        return { added: false, existed: true };
      }
      if (exam && exam.id && !isNewMode) {
        const newLayoutInstance = await addLayoutToExam(
          exam.id,
          layout.id,
          activate,
        );
        if (!newLayoutInstance) {
          toast.error("שגיאה בהוספת לשונית פריסה");
          return { added: false, existed: false };
        }
        setLayoutTabs((prev) => {
          const base = activate
            ? prev.map((tab) => ({ ...tab, isActive: false }))
            : prev;
          return [
            ...base,
            {
              id: newLayoutInstance.id || 0,
              layout_id: layout.id,
              name: layout.name || "",
              layout_data: layout.layout_data || "",
              isActive: activate,
            },
          ];
        });
        if (activate) {
          setActiveInstanceId(newLayoutInstance.id || null);
          applyLayoutStructure(layout.layout_data);
          if (newLayoutInstance.id) {
            await loadExamComponentData(newLayoutInstance.id, layout.layout_data);
          }
        }
      } else {
        tempLayoutIdCounterRef.current += 1;
        const tempId = -Date.now() - tempLayoutIdCounterRef.current;
        setLayoutTabs((prev) => {
          const base = activate
            ? prev.map((tab) => ({ ...tab, isActive: false }))
            : prev;
          return [
            ...base,
            {
              id: tempId,
              layout_id: layout.id,
              name: layout.name || "",
              layout_data: layout.layout_data || "",
              isActive: activate,
            },
          ];
        });
        initializeFormData(tempId, layout.layout_data);
        if (activate) {
          setActiveInstanceId(tempId);
          applyLayoutStructure(layout.layout_data);
        }
      }
      return { added: true, existed: false };
    },
    [
      exam,
      isNewMode,
      layoutTabsRef,
      handleLayoutTabChange,
      setLayoutTabs,
      setActiveInstanceId,
      applyLayoutStructure,
      loadExamComponentData,
      initializeFormData,
      tempLayoutIdCounterRef,
    ],
  );

  // Handle select layout option
  const handleSelectLayoutOption = useCallback(
    async (layoutId: number) => {
      const targetLayout = layoutMap.get(layoutId);
      if (!targetLayout) {
        toast.error("הפריסה לא נמצאה");
        return;
      }
      setIsAddingLayouts(true);
      try {
        if (targetLayout.is_group) {
          const layouts = collectLeafLayouts(targetLayout).filter(
            (layout) => layout.id,
          );
          if (layouts.length === 0) {
            toast.info(`לא נמצאו פריסות בקבוצה "${targetLayout.name}"`);
            return;
          }
          let addedCount = 0;
          let existingCount = 0;
          for (let i = 0; i < layouts.length; i += 1) {
            const result = await addLayoutNode(layouts[i], i === 0);
            if (result.added) {
              addedCount += 1;
            } else if (result.existed) {
              existingCount += 1;
            }
          }
          if (addedCount > 0) {
            toast.success(
              `נוספו ${addedCount} פריסות מקבוצה "${targetLayout.name}"`,
            );
          }
          if (existingCount > 0 && addedCount === 0) {
            toast.info(`כל פריסות הקבוצה "${targetLayout.name}" כבר קיימות`);
          } else if (existingCount > 0) {
            toast.info(`${existingCount} פריסות כבר היו קיימות`);
          }
        } else {
          const result = await addLayoutNode(targetLayout, true);
          if (result.added) {
            toast.success(`פריסה "${targetLayout.name}" הוספה והוחלה`);
          } else if (result.existed) {
            toast.info(`הפריסה "${targetLayout.name}" כבר קיימת בלשוניות`);
          }
        }
      } catch (error) {
        console.error("Error selecting layout option:", error);
        toast.error("שגיאה בהוספת פריסה");
      } finally {
        setIsAddingLayouts(false);
      }
    },
    [layoutMap, addLayoutNode, setIsAddingLayouts],
  );

  // Handle add layout tab
  const handleAddLayoutTab = useCallback(
    async (layoutId: number) => {
      await handleSelectLayoutOption(layoutId);
    },
    [handleSelectLayoutOption],
  );

  // Handle add full data tab
  const handleAddFullDataTab = useCallback(async () => {
    const existing = layoutTabs.find((t) => t.name === FULL_DATA_NAME);
    if (existing) {
      handleLayoutTabChange(existing.id);
      return;
    }

    const layoutData = buildFullDataLayoutData();
    if (!layoutData) {
      toast.info("אין נתונים להצגה ");
      return;
    }
    if (exam && exam.id && !isNewMode) {
      const newInstance = await createExamLayoutInstance({
        exam_id: exam.id,
        layout_id: null,
        is_active: true,
        order: 0,
        layout_data: layoutData,
      } as any);
      if (!newInstance || !newInstance.id) {
        toast.error("שגיאה בהוספת פריסת הנתונים");
        return;
      }
      const updatedTabs = layoutTabs.map((t) => ({ ...t, isActive: false }));
      const newTab = {
        id: newInstance.id || 0,
        layout_id: null as any,
        name: FULL_DATA_NAME,
        layout_data: layoutData,
        isActive: true,
      };
      setLayoutTabs([...updatedTabs, newTab]);
      setActiveInstanceId(newInstance.id || null);
      const seedBucket = buildFullDataBucket(newInstance.id!);
      setExamFormDataByInstance((prev) => ({
        ...prev,
        [newInstance.id!]: seedBucket,
      }));
      setExamFormData(seedBucket);
      try {
        const parsed = JSON.parse(layoutData);
        if (Array.isArray(parsed)) {
          setCardRows(parsed);
          setCustomWidths({});
        } else {
          setCardRows(parsed.rows || []);
          setCustomWidths(parsed.customWidths || {});
        }
      } catch { }
      toast.success("פריסת הנתונים הוספה לבדיקה");
    } else {
      const updatedTabs = layoutTabs.map((t) => ({ ...t, isActive: false }));
      const tempId = -Date.now();
      const newTab = {
        id: tempId,
        layout_id: 0,
        name: FULL_DATA_NAME,
        layout_data: layoutData,
        isActive: true,
      };
      setLayoutTabs([...updatedTabs, newTab]);
      setActiveInstanceId(tempId);
      try {
        const parsed = JSON.parse(layoutData);
        if (Array.isArray(parsed)) {
          setCardRows(parsed);
          setCustomWidths({});
        } else {
          setCardRows(parsed.rows || []);
          setCustomWidths(parsed.customWidths || {});
        }
      } catch { }
      const seedBucket = buildFullDataBucket(tempId);
      setExamFormData(seedBucket);
      setExamFormDataByInstance((prev) => ({ ...prev, [tempId]: seedBucket }));
      toast.success("פריסת הנתונים הוספה לבדיקה");
    }
  }, [
    layoutTabs,
    exam,
    isNewMode,
    buildFullDataLayoutData,
    buildFullDataBucket,
    handleLayoutTabChange,
    setLayoutTabs,
    setActiveInstanceId,
    setExamFormDataByInstance,
    setExamFormData,
    setCardRows,
    setCustomWidths,
  ]);

  const EMPTY_FULL_DATA_LAYOUT = JSON.stringify({ rows: [], customWidths: {} });

  // Handle regenerate full data
  const handleRegenerateFullData = useCallback(async () => {
    const active = layoutTabs.find((t) => t.isActive);
    if (!active || active.name !== FULL_DATA_NAME) return;

    isRegeneratingFullDataRef.current = true;
    try {
      const layoutData = buildFullDataLayoutData();
      if (!layoutData) {
        if (exam && exam.id && !isNewMode && active.id > 0) {
          await updateExamLayoutInstance({
            id: active.id,
            exam_id: exam.id,
            layout_id: null as any,
            layout_data: EMPTY_FULL_DATA_LAYOUT,
          } as any);
        }
        delete fullDataSourcesRef.current[active.id];
        setExamFormDataByInstance((prev) => ({ ...prev, [active.id]: {} }));
        setExamFormData({});
        setLayoutTabs((prev) =>
          prev.map((t) =>
            t.id === active.id
              ? { ...t, layout_data: EMPTY_FULL_DATA_LAYOUT }
              : t,
          ),
        );
        setCardRows([]);
        setCustomWidths({});
        toast.info("אין נתונים להצגה בפריסת הנתונים");
        return;
      }
      if (exam && exam.id && !isNewMode && active.id > 0) {
        await updateExamLayoutInstance({
          id: active.id,
          exam_id: exam.id,
          layout_id: null as any,
          layout_data: layoutData,
        } as any);
        const seedBucket = buildFullDataBucket(active.id);
        setExamFormDataByInstance((prev) => ({
          ...prev,
          [active.id]: seedBucket,
        }));
        setExamFormData(seedBucket);
      } else {
        const seedBucket = buildFullDataBucket(active.id);
        setExamFormDataByInstance((prev) => ({
          ...prev,
          [active.id]: seedBucket,
        }));
        setExamFormData(seedBucket);
      }
      const newTabs = layoutTabs.map((t) =>
        t.id === active.id ? { ...t, layout_data: layoutData } : t,
      );
      setLayoutTabs(newTabs);
      try {
        const parsed = JSON.parse(layoutData);
        if (Array.isArray(parsed)) {
          setCardRows(parsed);
          setCustomWidths({});
        } else {
          setCardRows(parsed.rows || []);
          setCustomWidths(parsed.customWidths || {});
        }
      } catch { }
      toast.success("פריסת הנתונים רועננה");
    } finally {
      isRegeneratingFullDataRef.current = false;
    }
  }, [
    layoutTabs,
    exam,
    isNewMode,
    buildFullDataLayoutData,
    buildFullDataBucket,
    fullDataSourcesRef,
    setLayoutTabs,
    setExamFormDataByInstance,
    setExamFormData,
    setCardRows,
    setCustomWidths,
  ]);

  // Handle remove layout tab
  const handleRemoveLayoutTab = useCallback(
    async (tabId: number) => {
      if (layoutTabs.length <= 1) {
        toast.error("לא ניתן להסיר את הלשונית האחרונה");
        return;
      }

      const tabIndex = layoutTabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) return;

      const tabToRemove = layoutTabs[tabIndex];
      const isActive = tabToRemove.isActive;

      // Optimistic update: Calculate next state immediately
      const updatedTabs = [...layoutTabs];
      updatedTabs.splice(tabIndex, 1);
      
      let newActiveTabId: number | null = null;

      if (isActive && updatedTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, updatedTabs.length - 1);
        updatedTabs[newActiveIndex].isActive = true;
        newActiveTabId = updatedTabs[newActiveIndex].id;

        setActiveInstanceId(newActiveTabId);

        try {
          const newActiveTab = updatedTabs[newActiveIndex];
          const parsedLayout = JSON.parse(newActiveTab.layout_data);
          if (Array.isArray(parsedLayout)) {
            setCardRows(parsedLayout);
            setCustomWidths({});
          } else {
            setCardRows(parsedLayout.rows || []);
            setCustomWidths(parsedLayout.customWidths || {});
          }
        } catch (error) {
          console.error("Error applying layout after tab removal:", error);
        }
      }

      // Update the tabs state immediately
      setLayoutTabs(updatedTabs);
      toast.success("לשונית הפריסה הוסרה");

      // Perform API calls in the background
      try {
        if (exam && exam.id && !isNewMode) {
          // Chain the operations to avoid server-side concurrency issues (StaleDataError)
          // where set-active tries to update a row that is being deleted
          const deletePromise = tabId > 0 
            ? deleteExamLayoutInstance(tabId) 
            : Promise.resolve(true);

          deletePromise
            .then((success) => {
              if (tabId > 0 && !success) {
                console.error("Failed to delete layout instance from DB");
                toast.error("שגיאה במחיקת פריסה מהשרת");
              }
              
              if (isActive && newActiveTabId !== null) {
                // Return this promise so it can be caught by the chain if needed, 
                // though we mainly just want it to execute sequentially
                return setActiveExamLayoutInstance(exam.id, newActiveTabId);
              }
            })
            .catch((err) => {
              console.error("Error in background layout updates:", err);
            });
        }
      } catch (error) {
        console.error("Error in background layout removal API calls:", error);
      }
    },
    [
      layoutTabs,
      exam,
      isNewMode,
      setLayoutTabs,
      setActiveInstanceId,
      setCardRows,
      setCustomWidths,
    ],
  );

  return {
    handleLayoutTabChange,
    handleLayoutTabDrop,
    addLayoutNode,
    handleSelectLayoutOption,
    handleAddLayoutTab,
    handleAddFullDataTab,
    handleRegenerateFullData,
    handleRemoveLayoutTab,
    buildFullDataBucket,
    buildFullDataLayoutData,
    aggregateAllData,
    getContributingInstanceIds,
    isRegeneratingFullData: isRegeneratingFullDataRef.current,
  };
}
