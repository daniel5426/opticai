export interface PdfExportResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface PrintHtmlResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export async function exportHtmlToPdf(
  html: string,
  defaultFileName: string,
): Promise<PdfExportResult> {
  const exporter = window.electronAPI?.exportHtmlToPdf;
  if (!exporter) {
    throw new Error("ייצוא PDF זמין רק באפליקציית הדסקטופ");
  }

  return exporter({ html, defaultFileName });
}

export async function printHtml(html: string, defaultFileName?: string): Promise<PrintHtmlResult> {
  const printer = window.electronAPI?.printHtml;
  if (!printer) {
    throw new Error("הדפסה זמינה רק באפליקציית הדסקטופ");
  }

  return printer({ html, defaultFileName });
}
