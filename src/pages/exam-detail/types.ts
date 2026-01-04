import { OpticalExam } from "@/lib/db/schema-interface";
import { CardItem } from "@/components/exam/ExamCardRenderer";

export interface ExamDetailPageProps {
  mode?: "view" | "edit" | "new";
  clientId?: string;
  examId?: string;
  onSave?: (exam: OpticalExam, ...examData: any[]) => void;
  onCancel?: () => void;
  pageType?: "exam" | "contact-lens";
}

export interface CardRow {
  id: string;
  cards: CardItem[];
}

export interface LayoutTab {
  id: number;
  layout_id: number;
  name: string;
  layout_data: string;
  isActive: boolean;
}
