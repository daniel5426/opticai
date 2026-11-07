import { hasOpticPlusLayout } from "@/lib/opticplus-cards";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { useSaveController } from "@/hooks/shared/useSaveController";
import { saveExamWorkspace, stableSaveJson, type ExamWorkspaceResponse } from "@/lib/exam-workspace";
import { getExamPageData } from "@/lib/db/exams-db";
import { useCallback, useRef, useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { examPageDataQueryKey } from "@/lib/db/exams-db";
import { toast } from "sonner";
import { OpticalExam } from "@/lib/db/schema-interface";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import { LayoutTab } from "@/pages/exam-detail/types";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import {
  parseLayoutData,
  VIRTUAL_FULL_DATA_TAB_ID,
  isPersistableLayoutTab,
  isVirtualFullDataTabId,
  resolveFullDataSourceInstanceId,
} from "@/pages/exam-detail/utils";
import { ensureTabsMetadataForRows } from "@/lib/exam-ui-metadata";
import { syncSavedClientExam } from "@/hooks/client/clientTabCache";

interface ExamPageConfig {
  dbType: "exam" | "opticlens";
  sidebarTab: string;
  paramName: string;
  newTitle: string;
  detailTitle: string;
  headerInfo: (id: string) => string;
  saveSuccessNew: string;
  saveSuccessUpdate: string;
  saveErrorNew: string;
  saveErrorNewData: string;
}

interface UseExamSaveParams {
  hasUnsavedChanges?: boolean;
  checkDirty?: () => boolean;
  onCreated?: (id: number) => void;
  onReconcile?: () => void;
  formRef: React.RefObject<HTMLFormElement | null>;
  isSaveInFlight: boolean;
  setIsSaveInFlight: (value: boolean) => void;
  isNewMode: boolean;
  setIsEditing: (value: boolean) => void;
  formData: Partial<OpticalExam>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<OpticalExam>>>;
  exam: OpticalExam | null;
  setExam: React.Dispatch<React.SetStateAction<OpticalExam | null>>;
  examFormData: Record<string, any>;
  examFormDataByInstance: Record<number | string, Record<string, any>>;
  setExamFormDataByInstance: React.Dispatch<
    React.SetStateAction<Record<number | string, Record<string, any>>>
  >;
  fullDataSourcesRef: React.MutableRefObject<
    Record<number, Record<string, number | string | null>>
  >;
  layoutTabs: LayoutTab[];
  setLayoutTabs: React.Dispatch<React.SetStateAction<LayoutTab[]>>;
  activeInstanceId: number | null;
  setActiveInstanceId: React.Dispatch<React.SetStateAction<number | null>>;
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  clientId: string | undefined;
  currentClinic: { id?: number } | null | undefined;
  currentUser: { id?: number } | null | undefined;
  config: ExamPageConfig;
  setBaseline: (data?: any) => void;
  allowNavigationRef: React.MutableRefObject<boolean>;
  navigate: (options: any) => void;
  onSave?: (exam: OpticalExam, ...examData: any[]) => void;
}

export function useExamSave({
  hasUnsavedChanges = true,
  checkDirty,
  onCreated,
  onReconcile,
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
  fullDataSourcesRef,
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
}: UseExamSaveParams) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const controller = useSaveController({ dirty: hasUnsavedChanges, identity: clientId });
  const creationKey = useRef(crypto.randomUUID());
  const pendingCreation = useRef<any>(null);
  const saveRoute = useRef(clientId);
  saveRoute.current = clientId;

  // Use refs to ensure handleSave (which is a stable callback) can access the
  // MOST RECENT data even after calling inputSyncManager.flush().
  const formDataRef = useRef(formData);
  const examFormDataRef = useRef(examFormData);
  const examFormDataByInstanceRef = useRef(examFormDataByInstance);
  const layoutTabsRef = useRef(layoutTabs);

  useLayoutEffect(() => {
    formDataRef.current = formData;
  }, [formData]);
  useLayoutEffect(() => {
    examFormDataRef.current = examFormData;
  }, [examFormData]);
  useLayoutEffect(() => {
    examFormDataByInstanceRef.current = examFormDataByInstance;
  }, [examFormDataByInstance]);
  useLayoutEffect(() => {
    layoutTabsRef.current = layoutTabs;
  }, [layoutTabs]);

  const handleSave = useCallback(async () => {
    if (isSaveInFlight || controller.busy.current) return;

    // Flush any pending updates from optimized components
    flushSync(() => inputSyncManager.flush());
    if (!isNewMode && !(checkDirty ? checkDirty() : hasUnsavedChanges)) return;
    if (formRef.current && !formRef.current.reportValidity()) return;

    // After flush, we MUST read from the refs because the local state variables
    // (formData, examFormData, etc.) still hold the "old" values from the previous render.
    const currentFormData = formDataRef.current;
    const currentExamFormData = examFormDataRef.current;
    const currentExamFormDataByInstance = examFormDataByInstanceRef.current;
    const currentLayoutTabs = layoutTabsRef.current;
    const currentActiveInstanceId = activeInstanceId;
    const realLayoutTabs = currentLayoutTabs.filter(isPersistableLayoutTab);
    const hasActiveRealTab =
      currentActiveInstanceId != null &&
      realLayoutTabs.some((tab) => tab.id === currentActiveInstanceId);
    const tabsToPersist = realLayoutTabs.map((tab, index) => ({
      ...tab,
      isActive: hasActiveRealTab
        ? tab.id === currentActiveInstanceId
        : index === 0,
    }));
    const saveBuckets: Record<number | string, Record<string, any>> = {
      ...currentExamFormDataByInstance,
    };

    if (
      currentActiveInstanceId != null &&
      !isVirtualFullDataTabId(currentActiveInstanceId)
    ) {
      saveBuckets[currentActiveInstanceId] = currentExamFormData;
    }

    if (isVirtualFullDataTabId(currentActiveInstanceId)) {
      const sources =
        fullDataSourcesRef.current[VIRTUAL_FULL_DATA_TAB_ID] || {};
      const keys = new Set([
        ...Object.keys(sources),
        ...Object.keys(currentExamFormData),
      ]);

      keys.forEach((componentKey) => {
        const currentValue = currentExamFormData[componentKey];
        const mappedSource = resolveFullDataSourceInstanceId(
          componentKey,
          currentValue,
          sources,
        );
        if (mappedSource == null) return;

        const resolvedKey =
          typeof mappedSource === "number"
            ? mappedSource
            : Number(mappedSource);
        if (!Number.isFinite(resolvedKey)) return;
        if (isVirtualFullDataTabId(resolvedKey)) return;

        const existingBucket = saveBuckets[resolvedKey] || {};

        if (!currentValue) {
          if (existingBucket[componentKey]) {
            const updatedBucket = { ...existingBucket };
            delete updatedBucket[componentKey];
            saveBuckets[resolvedKey] = updatedBucket;
          }
          return;
        }

        const updatedValue = {
          ...currentValue,
          layout_instance_id: resolvedKey,
        };
        delete (updatedValue as any).source_layout_instance_id;
        saveBuckets[resolvedKey] = {
          ...existingBucket,
          [componentKey]: updatedValue,
        };
      });
    }

    delete saveBuckets[VIRTUAL_FULL_DATA_TAB_ID];

    tabsToPersist.forEach((tab) => {
      const bucket = saveBuckets[tab.id];
      if (!bucket) return;
      const normalized = ensureTabsMetadataForRows(
        bucket,
        parseLayoutData(tab.layout_data).rows,
      );
      if (normalized.changed) {
        saveBuckets[tab.id] = normalized.examData;
      }
    });

    const identity = clientId;
    setIsSaveInFlight(true);
    try {
      await controller.run(async () => {
        const originalPage = exam?.id ? queryClient.getQueryData<any>(examPageDataQueryKey(exam.id)) : undefined;
        const originalInstances = new Map<number, any>((originalPage?.instances || []).map((row: any) => [Number(row.instance.id), row]));
        const metadataFields = ['client_id', 'clinic_id', 'user_id', 'exam_date', 'test_name', 'dominant_eye', 'type'] as const;
        const metadata: Record<string, any> = {};
        for (const field of metadataFields) {
          const value = currentFormData[field] ?? (field === 'type' ? config.dbType : null);
          if (isNewMode || stableSaveJson(value) !== stableSaveJson(originalPage?.exam?.[field] ?? null)) metadata[field] = value;
        }
        if (isNewMode) {
          metadata.client_id = Number(clientId);
          metadata.clinic_id = currentClinic?.id;
          metadata.user_id = currentFormData.user_id || currentUser?.id;
          metadata.exam_date ||= new Date().toISOString().split('T')[0];
        }
        const presentIds = new Set(realLayoutTabs.filter(tab => tab.id > 0).map(tab => tab.id));
        // Layout-less imported instances do not appear in the template tab strip.
        const removed = [...originalInstances.keys()].filter(id => {
          const original = originalInstances.get(id);
          return (original?.instance.layout_id != null || hasOpticPlusLayout(original || {})) && !presentIds.has(id);
        });
        const instanceIds = new Set<number>([...realLayoutTabs.map(tab => tab.id), ...Object.keys(saveBuckets).map(Number)]);
        const instances: any[] = [];
        for (const id of instanceIds) {
          if (!Number.isFinite(id) || isVirtualFullDataTabId(id) || removed.includes(id)) continue;
          const tab = realLayoutTabs.find(item => item.id === id);
          const original = originalInstances.get(id);
          const data = examComponentRegistry.prepareData(id, saveBuckets[id] || {});
          const originalData = original ? examComponentRegistry.prepareData(id, original.exam_data || {}) : undefined;
          if (id > 0 && !original) continue;
          if (id > 0 && stableSaveJson(data) === stableSaveJson(originalData) && (!tab || tab.layout_data === (original.instance.layout_data || original.layout?.layout_data))) continue;
          instances.push({ ...(id > 0 ? { id } : {}), client_key: String(id),
            ...(tab?.layout_id ? { layout_id: tab.layout_id } : {}),
            ...(tab?.layout_data ? { layout_data: tab.layout_data } : {}), exam_data: data });
        }
        const orderedIds = [...realLayoutTabs.map(tab => String(tab.id)), ...[...originalInstances.keys()]
          .filter(id => !removed.includes(id) && !presentIds.has(id)).map(String)];
        const originalOrder = [...originalInstances.values()].sort((a, b) => (a.instance.order || 0) - (b.instance.order || 0) || a.instance.id - b.instance.id).map(row => String(row.instance.id));
        const payload: any = { exam: metadata, instances, removed_instance_ids: removed,
          ...(originalPage?.save_token ? { save_token: originalPage.save_token } : {}),
          ...(isNewMode || stableSaveJson(orderedIds) !== stableSaveJson(originalOrder) ? { instance_order: orderedIds } : {}),
          ...(currentActiveInstanceId != null && !isVirtualFullDataTabId(currentActiveInstanceId) ? { active_client_key: String(currentActiveInstanceId) } : {}) };
        if (!isNewMode && !Object.keys(metadata).length && !instances.length && !removed.length && !payload.instance_order) { setBaseline(); return; }
        if (isNewMode) pendingCreation.current ||= payload;
        const submitted = isNewMode ? pendingCreation.current : payload;
        let saved: ExamWorkspaceResponse;
        try {
          saved = await saveExamWorkspace(exam?.id, submitted, creationKey.current);
        } catch (reason) {
          const status = (reason as Error & { status?: number }).status;
          if (status || !exam?.id) throw reason;
          // Resolve a lost acknowledgement before allowing another update.
          const latest = await getExamPageData(exam.id);
          if (!latest || latest.save_token === originalPage?.save_token) throw reason;
          const matches = Object.entries(metadata).every(([field, value]) => stableSaveJson(latest.exam[field] ?? null) === stableSaveJson(value)) &&
            instances.every(item => { const row = latest.instances.find((candidate: any) => candidate.instance.id === item.id); return row && stableSaveJson(examComponentRegistry.prepareData(item.id, row.exam_data)) === stableSaveJson(item.exam_data); }) &&
            removed.every(id => !latest.instances.some((row: any) => row.instance.id === id)) &&
            (!payload.instance_order || stableSaveJson([...latest.instances].sort((a: any,b: any) => (a.instance.order || 0)-(b.instance.order || 0)).map((row: any) => String(row.instance.id))) === stableSaveJson(payload.instance_order));
          if (!matches) throw new Error('exam_save_conflict');
          saved = { ...latest, removed_instance_ids: removed, client_keys: Object.fromEntries(latest.instances.map((row: any) => [String(row.instance.id), row.instance.id])) };
        }
        if (saveRoute.current !== identity) return;
        const newerCreationDraft = isNewMode && stableSaveJson(submitted) !== stableSaveJson(payload);
        const remap = (id: number | string) => saved.client_keys[String(id)] ?? Number(id);
        const buckets: Record<number | string, Record<string, any>> = {};
        for (const [key, value] of Object.entries(saveBuckets)) if (!removed.includes(Number(key))) buckets[remap(key)] = value;
        if (!newerCreationDraft) for (const row of saved.instances) buckets[row.instance.id] = row.exam_data;
        const tabs = realLayoutTabs.map(tab => ({ ...tab, id: remap(tab.id), clientKey: (tab as any).clientKey || String(tab.id) }));
        const nextActive = currentActiveInstanceId != null ? remap(currentActiveInstanceId) : null;
        const nextData = isVirtualFullDataTabId(currentActiveInstanceId) ? currentExamFormData : buckets[nextActive!] || currentExamFormData;
        const pageInstances = new Map(originalInstances);
        for (const id of saved.removed_instance_ids) pageInstances.delete(id);
        for (const row of saved.instances) pageInstances.set(row.instance.id, { ...originalInstances.get(row.instance.id), ...row });
        queryClient.setQueryData(examPageDataQueryKey(saved.exam.id!), { ...originalPage, exam: saved.exam, instances: [...pageInstances.values()], save_token: saved.save_token, chosen_active_instance_id: nextActive });
        onReconcile?.();
        flushSync(() => {
          setExam(saved.exam);
          setFormData(newerCreationDraft ? { ...currentFormData, id: saved.exam.id } : { ...saved.exam });
          setExamFormDataByInstance(buckets); setLayoutTabs(tabs);
          setActiveInstanceId(nextActive); setExamFormData(nextData); setIsEditing(true);
        });
        if (!newerCreationDraft) setBaseline();
        syncSavedClientExam(queryClient, saved.exam, config.dbType);
        pendingCreation.current = null;
        onSave?.(saved.exam);
        if (isNewMode) {
          onCreated?.(saved.exam.id!);
          allowNavigationRef.current = true;
          await navigate({ to: '/clients/$clientId/exams/$examId', params: { clientId: String(clientId), examId: String(saved.exam.id) }, replace: true });
          allowNavigationRef.current = false;
        }
      });
    } catch (reason) {
      if (saveRoute.current === identity) {
        if (isNewMode && (reason as any)?.status && (reason as any).status < 500) pendingCreation.current = null;
        toast.error(t(/conflict|409/.test(String(reason)) ? 'saveStatus.conflict' : 'saveStatus.error'));
      }
    } finally { if (saveRoute.current === identity) setIsSaveInFlight(false); }

  }, [
    formRef,
    hasUnsavedChanges,
    onCreated,
    isSaveInFlight,
    setIsSaveInFlight,
    isNewMode,
    setIsEditing,
    // formData, // Removed from dependencies as we use refs
    // setFormData,
    exam,
    setExam,
    // examFormData, // Removed
    // examFormDataByInstance, // Removed
    setExamFormDataByInstance,
    fullDataSourcesRef,
    // layoutTabs, // Removed
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
    queryClient,
  ]);

  return { handleSave, saveState: controller.state };
}
