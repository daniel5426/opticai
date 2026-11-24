export interface PdfExportResult {
  success: boolean;
  canceled?: boolean;
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

const PRINT_FRAME_ID = "print-frame";

/**
 * Opens the system's print dialog for a page, over the app's own window, in the desktop app and in a browser alike.
 * The page sits in a hidden frame. print() can return while the dialog is still open, so the frame stays until the next print.
 */
export async function printHtml(html: string): Promise<void> {
  document.getElementById(PRINT_FRAME_ID)?.remove();
  const frame = document.createElement("iframe");
  frame.id = PRINT_FRAME_ID;
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  frame.srcdoc = html;
  document.body.appendChild(frame);
  // Images have loaded by the frame's load event; fonts may still be on their way.
  await loaded;
  const view = frame.contentWindow;
  if (!view) throw new Error("Print frame unavailable");
  await view.document.fonts?.ready;
  view.focus();
  view.print();
}
