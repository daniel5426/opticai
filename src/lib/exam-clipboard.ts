import { ExamComponentType, ExamDataType } from './exam-field-mappings';

const CLIPBOARD_KEY = 'examCardClipboard';

interface ClipboardData {
  type: ExamComponentType;
  data: ExamDataType;
}

export function copyToClipboard(type: ExamComponentType, data: ExamDataType) {
  const clipboardData: ClipboardData = { type, data };
  sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(clipboardData));
}

export function pasteFromClipboard(): ClipboardData | null {
  const storedData = sessionStorage.getItem(CLIPBOARD_KEY);
  if (!storedData) return null;
  try {
    return JSON.parse(storedData) as ClipboardData;
  } catch (error) {
    console.error("Failed to parse clipboard data:", error);
    return null;
  }
}

export function getClipboardContentType(): ExamComponentType | null {
  const clipboardData = pasteFromClipboard();
  return clipboardData ? clipboardData.type : null;
}

export function clearClipboard() {
    sessionStorage.removeItem(CLIPBOARD_KEY);
} 