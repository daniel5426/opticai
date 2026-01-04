import { useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { OpticalExam } from "@/lib/db/schema-interface";
import { updateExam, createExam } from "@/lib/db/exams-db";
import { addLayoutToExam } from "@/lib/db/exam-layouts-db";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import { LayoutTab } from "@/pages/exam-detail/types";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";

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

  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { examFormDataRef.current = examFormData; }, [examFormData]);
  useEffect(() => { examFormDataByInstanceRef.current = examFormDataByInstance; }, [examFormDataByInstance]);
  useEffect(() => { layoutTabsRef.current = layoutTabs; }, [layoutTabs]);

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
          setExamFormDataByInstance((prev) => ({
            ...prev,
            [activeTempTab.id]: currentExamFormData,
          }));
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
            const dataBucket = currentExamFormDataByInstance[tab.id] || {};
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
            setExamFormData(currentExamFormDataByInstance[activeTempTab.id] || {});
          }
        } catch (error) {
          toast.error(config.saveErrorNewData);
          setIsEditing(true);
          return;
        }

        setBaseline({
          formData: { ...newExam },
          examFormData: currentExamFormData,
          examFormDataByInstance: currentExamFormDataByInstance,
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
        const optimisticExam = {
          ...(exam || {}),
          ...(currentFormData as OpticalExam),
        } as OpticalExam;
        setIsEditing(false);
        if (optimisticExam) {
          setExam(optimisticExam);
          setFormData({ ...optimisticExam });
        }
        const localExamData = { ...currentExamFormData };
        toast.success(config.saveSuccessUpdate);

        try {
          const updatedExam = await updateExam(currentFormData as OpticalExam);

          if (activeInstanceId != null) {
            setExamFormDataByInstance((prev) => ({
              ...prev,
              [activeInstanceId]: currentExamFormData,
            }));
          }

          for (const tab of currentLayoutTabs) {
            if (tab.id > 0) {
              const bucket = currentExamFormDataByInstance[tab.id] || {};
              await examComponentRegistry.saveAllData(tab.id, bucket);
            }
          }

          if (updatedExam) {
            setExam(updatedExam);
            setFormData({ ...updatedExam });
            if (onSave) onSave(updatedExam, ...Object.values(localExamData));
            setBaseline({
              formData: { ...updatedExam },
              examFormData: currentExamFormData,
              examFormDataByInstance: currentExamFormDataByInstance,
            });
          } else {
            throw new Error("update failed");
          }
        } catch (error) {
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
