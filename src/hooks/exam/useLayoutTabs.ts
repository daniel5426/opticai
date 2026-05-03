import { startTransition, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ExamLayout, ExamLayoutInstance } from "@/lib/db/schema-interface";
import { CardItem } from "@/components/exam/ExamCardRenderer";
import {
  addLayoutToExam,
  setActiveExamLayoutInstance,
  deleteExamLayoutInstance,
  reorderExamLayoutInstances,
} from "@/lib/db/exam-layouts-db";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import { CardRow, LayoutTab } from "@/pages/exam-detail/types";
import {
  collectLeafLayouts,
  createParsedLayoutCache,
  FULL_DATA_NAME,
  isInternalFullDataTab,
  isNonEmptyComponent,
  isPersistableLayoutTab,
  packCardsIntoRows,
  VIRTUAL_FULL_DATA_TAB_ID,
  isVirtualFullDataTabId,
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
  initializeFormData: (
    instanceKey: number,
    layoutData?: string,
    setCurrent?: boolean,
  ) => void;
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
  setIsAddingLayouts,
  tempLayoutIdCounterRef,
  latestLoadIdRef,
}: UseLayoutTabsParams) {
  const parsedLayoutCacheRef = useRef(createParsedLayoutCache());

  const applyParsedLayout = useCallback(
    (instanceId: number | string, layoutData?: string) => {
      const parsed = parsedLayoutCacheRef.current.get(instanceId, layoutData);
      setCardRows(parsed.rows);
      setCustomWidths(parsed.customWidths);
    },
    [setCardRows, setCustomWidths],
  );

  // Get contributing instance IDs for full data aggregation
  const getContributingInstanceIds = useCallback(
    (excludeInstanceId?: number | string) => {
      const excludedKey =
        excludeInstanceId == null ? null : String(excludeInstanceId);
      return layoutTabs
        .filter(
          (tab) =>
            tab.layout_id != null &&
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
      const sourceBuckets =
        activeInstanceId != null && !isVirtualFullDataTabId(activeInstanceId)
          ? {
              ...examFormDataByInstance,
              [activeInstanceId]: examFormData,
            }
          : examFormDataByInstance;

      Object.entries(sourceBuckets).forEach(([instanceKey, bucket]) => {
        if (allowed && !allowed.has(instanceKey)) return;
        const numericInstanceKey = Number(instanceKey);
        const sourceInstanceId = Number.isFinite(numericInstanceKey)
          ? numericInstanceKey
          : instanceKey;

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
            aggregated[key] = {
              ...(val as any),
              layout_instance_id:
                (val as any)?.layout_instance_id ?? sourceInstanceId,
            };
            if (instanceId) addedInstanceIds.add(instanceId);
          }
        });
      });

      return aggregated;
    },
    [activeInstanceId, examFormData, examFormDataByInstance],
  );

  // Build full data layout structure
  const buildFullDataLayoutData = useCallback((): string | null => {
    const aggregated = aggregateAllData(getContributingInstanceIds());
    const entries = Object.entries(aggregated);
    if (entries.length === 0) return null;

    const cardDefs: { id: string; type: CardItem["type"]; title?: string }[] = [];
    const addedStandard = new Set<string>();
    const addedCoverCards = new Set<string>();
    const addedOldRefractionCards = new Set<string>();

    entries.forEach(([key, value]) => {
      let type: CardItem["type"] | null = null;
      let cardId: string | null = null;

      if (key.startsWith("notes-")) {
        type = "notes";
        cardId = key.replace("notes-", "");
      } else if (key.startsWith("cover-test-")) {
        const suffix = key.slice("cover-test-".length);
        const dashIndex = suffix.indexOf("-");
        const tabId = (value as any)?.card_instance_id;
        const id =
          (value as any)?.card_id ||
          (tabId && suffix.endsWith(`-${tabId}`)
            ? suffix.slice(0, -(String(tabId).length + 1))
            : dashIndex >= 0 ? suffix.slice(0, dashIndex) : suffix);
        if (addedCoverCards.has(id)) return;
        addedCoverCards.add(id);
        cardDefs.push({ id, type: "cover-test" });
        return;
      } else if (key.startsWith("old-refraction-")) {
        const suffix = key.slice("old-refraction-".length);
        const dashIndex = suffix.indexOf("-");
        const tabId = (value as any)?.card_instance_id;
        const id =
          (value as any)?.card_id ||
          (tabId && suffix.endsWith(`-${tabId}`)
            ? suffix.slice(0, -(String(tabId).length + 1))
            : dashIndex >= 0 ? suffix.slice(0, dashIndex) : suffix);
        if (addedOldRefractionCards.has(id)) return;
        addedOldRefractionCards.add(id);
        cardDefs.push({ id, type: "old-refraction" });
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
    (instanceId: number = VIRTUAL_FULL_DATA_TAB_ID): Record<string, any> => {
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

  const activateFullDataTab = useCallback(() => {
    ++latestLoadIdRef.current;
    const layoutData = buildFullDataLayoutData();
    const bucket = layoutData
      ? buildFullDataBucket(VIRTUAL_FULL_DATA_TAB_ID)
      : {};
    if (!layoutData) {
      delete fullDataSourcesRef.current[VIRTUAL_FULL_DATA_TAB_ID];
    }

    setLayoutTabs((prev) => {
      const withoutFullData = prev.filter((tab) => !isInternalFullDataTab(tab));
      return [
        ...withoutFullData.map((tab) => ({ ...tab, isActive: false })),
        {
          id: VIRTUAL_FULL_DATA_TAB_ID,
          layout_id: null,
          name: FULL_DATA_NAME,
          layout_data: layoutData || "[]",
          isActive: true,
        },
      ];
    });
    setActiveInstanceId(VIRTUAL_FULL_DATA_TAB_ID);
    setExamFormDataByInstance((prev) => ({
      ...prev,
      [VIRTUAL_FULL_DATA_TAB_ID]: bucket,
    }));
    setExamFormData(bucket);

    startTransition(() => {
      applyParsedLayout(VIRTUAL_FULL_DATA_TAB_ID, layoutData || undefined);
    });
  }, [
    buildFullDataLayoutData,
    buildFullDataBucket,
    setLayoutTabs,
    setActiveInstanceId,
    applyParsedLayout,
    setExamFormData,
    fullDataSourcesRef,
    latestLoadIdRef,
  ]);

  // Handle layout tab change
  const handleLayoutTabChange = useCallback(
    (tabId: number) => {
      if (isVirtualFullDataTabId(tabId)) {
        activateFullDataTab();
        return;
      }

      const selectedTab = layoutTabs.find((tab) => tab.id === tabId);
      if (!selectedTab) return;
      if (selectedTab.layout_id == null) {
        activateFullDataTab();
        return;
      }

      try {
        ++latestLoadIdRef.current;
        const updatedTabs = layoutTabs.map((tab) => ({
          ...tab,
          isActive: tab.id === tabId,
        }));

        setLayoutTabs(updatedTabs);
        setActiveInstanceId(selectedTab.id);

        startTransition(() => {
          applyParsedLayout(selectedTab.id, selectedTab.layout_data);

          const existingBucket = examFormDataByInstance[selectedTab.id];
          if (existingBucket && Object.keys(existingBucket).length > 0) {
            setExamFormData(existingBucket);
          } else {
            setExamFormData({});
          }
        });

        if (exam && exam.id && !isNewMode && selectedTab.layout_id != null) {
          setActiveExamLayoutInstance(exam.id, tabId).catch((error) => {
            console.error("Error saving active layout tab:", error);
          });
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
      activateFullDataTab,
      applyParsedLayout,
      setLayoutTabs,
      setActiveInstanceId,
      setExamFormData,
      latestLoadIdRef,
    ],
  );

  // Handle layout tab drop (reorder)
  const handleLayoutTabDrop = useCallback(
    async (id: string, index?: number) => {
      if (index === undefined) return;

      const draggedTabId = Number(id);
      const visibleTabs = layoutTabs.filter(isPersistableLayoutTab);
      const hiddenTabs = layoutTabs.filter((tab) => !isPersistableLayoutTab(tab));
      const currentIndex = visibleTabs.findIndex((tab) => tab.id === draggedTabId);

      if (currentIndex === -1 || currentIndex === index) return;

      const newTabs = [...visibleTabs];
      const [removed] = newTabs.splice(currentIndex, 1);
      newTabs.splice(index, 0, removed);
      const nextTabs = [...newTabs, ...hiddenTabs];

      setLayoutTabs(nextTabs);
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
          applyParsedLayout(newLayoutInstance.id || 0, layout.layout_data);
          if (newLayoutInstance.id) {
            await loadExamComponentData(newLayoutInstance.id, layout.layout_data, true);
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
        initializeFormData(tempId, layout.layout_data, activate);
        if (activate) {
          setActiveInstanceId(tempId);
          applyParsedLayout(tempId, layout.layout_data);
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
      applyParsedLayout,
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

  const handleAddFullDataTab = useCallback(async () => {
    activateFullDataTab();
  }, [activateFullDataTab]);

  const handleRegenerateFullData = useCallback(async () => {
    activateFullDataTab();
  }, [activateFullDataTab]);

  // Handle remove layout tab
  const handleRemoveLayoutTab = useCallback(
    async (tabId: number) => {
      const removableTabs = layoutTabs.filter(isPersistableLayoutTab);
      if (removableTabs.length <= 1) {
        toast.error("לא ניתן להסיר את הלשונית האחרונה");
        return;
      }

      const tabIndex = layoutTabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) return;

      const tabToRemove = layoutTabs[tabIndex];
      if (!isPersistableLayoutTab(tabToRemove)) return;
      const isActive = tabToRemove.isActive;
      delete fullDataSourcesRef.current[tabId];

      // Optimistic update: Calculate next state immediately
      const updatedTabs = [...layoutTabs];
      updatedTabs.splice(tabIndex, 1);

      let newActiveTabId: number | null = null;
      let nextActiveFormData: Record<string, any> | null = null;

      if (isActive && updatedTabs.some(isPersistableLayoutTab)) {
        const realTabs = updatedTabs.filter(isPersistableLayoutTab);
        const newActiveIndex = Math.min(tabIndex, realTabs.length - 1);
        const selectedActiveTabId = realTabs[newActiveIndex].id;
        const selectedUpdatedIndex = updatedTabs.findIndex(
          (tab) => tab.id === selectedActiveTabId,
        );
        const newActiveTab = {
          ...updatedTabs[selectedUpdatedIndex],
          isActive: true,
        };
        updatedTabs[selectedUpdatedIndex] = newActiveTab;
        newActiveTabId = newActiveTab.id;
        nextActiveFormData = examFormDataByInstance[newActiveTabId] || {};

        setActiveInstanceId(newActiveTabId);
        setExamFormData(nextActiveFormData);

        applyParsedLayout(newActiveTab.id, newActiveTab.layout_data);
      }

      // Update the tabs state immediately
      setLayoutTabs(updatedTabs);
      parsedLayoutCacheRef.current.clear(tabId);
      setExamFormDataByInstance((prev) => {
        const next = { ...prev };
        delete next[tabId];
        if (newActiveTabId !== null && nextActiveFormData !== null) {
          next[newActiveTabId] = nextActiveFormData;
        }
        return next;
      });
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

              if (
                isActive &&
                newActiveTabId !== null &&
                !isVirtualFullDataTabId(newActiveTabId)
              ) {
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
      examFormDataByInstance,
      exam,
      isNewMode,
      setLayoutTabs,
      setActiveInstanceId,
      setExamFormData,
      setExamFormDataByInstance,
      fullDataSourcesRef,
      applyParsedLayout,
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
    isRegeneratingFullData: false,
  };
}
