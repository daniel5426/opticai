import { useCallback, useRef, useLayoutEffect } from "react";
import { toast } from "sonner";
import { OpticalExam } from "@/lib/db/schema-interface";
import { updateExam, createExam } from "@/lib/db/exams-db";
import { addLayoutToExam } from "@/lib/db/exam-layouts-db";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import { LayoutTab } from "@/pages/exam-detail/types";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import { FULL_DATA_NAME } from "@/pages/exam-detail/utils";

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
  setExamFormDataByInstance: React.Dispatch<React.SetStateAction<Record<number | string, Record<string, any>>>>;
  fullDataSourcesRef: React.MutableRefObject<Record<number, Record<string, number | string | null>>>;
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
  // Use refs to ensure handleSave (which is a stable callback) can access the 
  // MOST RECENT data even after calling inputSyncManager.flush().
  const formDataRef = useRef(formData);
  const examFormDataRef = useRef(examFormData);
  const examFormDataByInstanceRef = useRef(examFormDataByInstance);
  const layoutTabsRef = useRef(layoutTabs);

  useLayoutEffect(() => { formDataRef.current = formData; }, [formData]);
  useLayoutEffect(() => { examFormDataRef.current = examFormData; }, [examFormData]);
  useLayoutEffect(() => { examFormDataByInstanceRef.current = examFormDataByInstance; }, [examFormDataByInstance]);
  useLayoutEffect(() => { layoutTabsRef.current = layoutTabs; }, [layoutTabs]);

  const handleSave = useCallback(async () => {
    if (!formRef.current || isSaveInFlight) return;

    // Flush any pending updates from optimized components
    inputSyncManager.flush();

    // After flush, we MUST read from the refs because the local state variables 
    // (formData, examFormData, etc.) still hold the "old" values from the previous render.
    const currentFormData = formDataRef.current;
    const currentExamFormData = examFormDataRef.current;
    const currentExamFormDataByInstance = examFormDataByInstanceRef.current;
    const currentLayoutTabs = layoutTabsRef.current;
    const currentActiveInstanceId = activeInstanceId;
    const saveBuckets: Record<number | string, Record<string, any>> = {
      ...currentExamFormDataByInstance,
    };

    if (currentActiveInstanceId != null) {
      saveBuckets[currentActiveInstanceId] = currentExamFormData;
    }

    const activeLayoutTab =
      currentActiveInstanceId != null
        ? currentLayoutTabs.find((tab) => tab.id === currentActiveInstanceId)
        : undefined;

    if (
      currentActiveInstanceId != null &&
      activeLayoutTab?.name === FULL_DATA_NAME
    ) {
      const sources = fullDataSourcesRef.current[currentActiveInstanceId] || {};
      const keys = new Set([
        ...Object.keys(sources),
        ...Object.keys(currentExamFormData),
      ]);

      keys.forEach((componentKey) => {
        const currentValue = currentExamFormData[componentKey];
        const mappedSource =
          sources[componentKey] ??
          (currentValue as any)?.source_layout_instance_id ??
          null;
        if (mappedSource == null) return;

        const resolvedKey =
          typeof mappedSource === "number"
            ? mappedSource
            : Number(mappedSource);
        if (!Number.isFinite(resolvedKey)) return;
        if (resolvedKey === currentActiveInstanceId) return;

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

    setIsSaveInFlight(true);

    try {
      if (isNewMode) {
        setIsEditing(false);
        const examData = {
          client_id: Number(clientId),
          exam_date:
            currentFormData.exam_date || new Date().toISOString().split("T")[0],
          test_name: currentFormData.test_name || "",
          clinic_id: currentClinic?.id,
          user_id: currentFormData.user_id || currentUser?.id,
          dominant_eye: currentFormData.dominant_eye || null,
          type: currentFormData.type || config.dbType,
        };

        const newExam = await createExam(examData);

        if (!newExam || !newExam.id) {
          toast.error(config.saveErrorNew);
          setIsEditing(true);
          return;
        }

        setExam(newExam);
        setFormData({ ...newExam });
        toast.success(config.saveSuccessNew);
        if (onSave) onSave(newExam);

        const activeTempTab = currentLayoutTabs.find((t) => t.isActive);
        if (
          activeTempTab &&
          activeInstanceId != null &&
          activeTempTab.id === activeInstanceId
        ) {
          setExamFormDataByInstance(saveBuckets);
        }

        const tempIdToRealId: Record<number, number> = {};
        try {
          for (const tab of currentLayoutTabs) {
            const instance = await addLayoutToExam(
              Number(newExam.id),
              Number(tab.layout_id || 0),
              tab.isActive,
            );
            if (!instance || instance.id == null)
              throw new Error("failed to create instance");
            tempIdToRealId[tab.id] = Number(instance.id);
            const dataBucket = saveBuckets[tab.id] || {};
            await examComponentRegistry.saveAllData(
              Number(instance.id),
              dataBucket,
            );
          }

          const remappedTabs = currentLayoutTabs.map((tab) => ({
            ...tab,
            id:
              tempIdToRealId[tab.id] !== undefined
                ? tempIdToRealId[tab.id]
                : tab.id,
          }));
          setLayoutTabs(remappedTabs);

          if (
            activeTempTab &&
            Object.prototype.hasOwnProperty.call(
              tempIdToRealId,
              activeTempTab.id,
            )
          ) {
            const realId = Number(tempIdToRealId[activeTempTab.id]);
            setActiveInstanceId(realId);
            setExamFormData(saveBuckets[activeTempTab.id] || {});
          }
        } catch (error) {
          toast.error(config.saveErrorNewData);
          setIsEditing(true);
          return;
        }

        setBaseline({
          formData: { ...newExam },
          examFormData: currentExamFormData,
          examFormDataByInstance: saveBuckets,
        });
        allowNavigationRef.current = true;
        navigate({
          to: "/clients/$clientId",
          params: { clientId: String(clientId) },
          search: { tab: config.sidebarTab },
        });
        setTimeout(() => {
          allowNavigationRef.current = false;
        }, 0);
      } else {
        const prevExam = exam;
        try {
          const updatedExam = await updateExam(currentFormData as OpticalExam);

          setExamFormDataByInstance(saveBuckets);

          for (const tab of currentLayoutTabs) {
            if (tab.id > 0) {
              const bucket = saveBuckets[tab.id] || {};
              await examComponentRegistry.saveAllData(tab.id, bucket);
            }
          }

          if (updatedExam) {
            setExam(updatedExam);
            setFormData({ ...updatedExam });
            const localExamData = { ...currentExamFormData };
            if (onSave) onSave(updatedExam, ...Object.values(localExamData));
            setBaseline({
              formData: { ...updatedExam },
              examFormData: currentExamFormData,
              examFormDataByInstance: saveBuckets,
            });
            
            toast.success(config.saveSuccessUpdate);
            setIsEditing(false);
          } else {
            throw new Error("update failed");
          }
        } catch (error) {
          console.error("Save error:", error);
          toast.error("לא הצלחנו לשמור את השינויים");
          setIsEditing(true);
          if (prevExam) {
            setExam(prevExam);
            setFormData({ ...prevExam });
          }
        }
      }
    } finally {
      setIsSaveInFlight(false);
    }
  }, [
    formRef,
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
  ]);

  return { handleSave };
}
