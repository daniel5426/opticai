export interface PdfExportResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface PrintHtmlResult {
  success: boolean;
  canceled?: boolean;
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

/** Prints the page straight to the default printer, from the desktop app. */
export async function printHtml(html: string): Promise<PrintHtmlResult> {
  const printer = window.electronAPI?.printHtml;
  if (!printer) {
    throw new Error("הדפסה זמינה רק באפליקציית הדסקטופ");
  }

  return printer({ html });
}
