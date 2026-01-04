import { ExamLayout, OpticalExam } from "@/lib/db/schema-interface";
import { CardItem } from "@/components/exam/ExamCardRenderer";
import { ExamComponentType } from "@/lib/exam-field-mappings";
import { CardRow, LayoutTab } from "@/pages/exam-detail/types";

// Common types used across all exam hooks

export interface ExamPageConfig {
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

export interface UseLayoutTabsParams {
  exam: OpticalExam | null;
  isNewMode: boolean;
  layoutTabs: LayoutTab[];
  setLayoutTabs: React.Dispatch<React.SetStateAction<LayoutTab[]>>;
  activeInstanceId: number | null;
  setActiveInstanceId: React.Dispatch<React.SetStateAction<number | null>>;
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
}

export interface UseCoverTestTabsParams {
  cardRows: CardRow[];
  examFormData: Record<string, any>;
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  activeInstanceId: number | null;
  loading: boolean;
}

export interface UseExamClipboardParams {
  examFormData: Record<string, any>;
  fieldHandlers: Record<string, (field: string, value: string) => void>;
  activeCoverTestTabs: Record<string, number>;
  computedCoverTestTabs: Record<string, string[]>;
}

export interface UseExamSaveParams {
  formRef: React.RefObject<HTMLFormElement | null>;
  isSaveInFlight: boolean;
  setIsSaveInFlight: (value: boolean) => void;
  isNewMode: boolean;
  isEditing: boolean;
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
  clientId: string | undefined;
  currentClinic: { id?: number } | null | undefined;
  currentUser: { id?: number } | null | undefined;
  config: ExamPageConfig;
  setBaseline: (data?: any) => void;
  allowNavigationRef: React.MutableRefObject<boolean>;
  navigate: (options: any) => void;
  onSave?: (exam: OpticalExam, ...examData: any[]) => void;
}
