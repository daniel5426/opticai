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
  // A browser cannot print without asking: open its print dialog on the same page.
  if (!printer) return printHtmlInBrowser(html);

  return printer({ html, defaultFileName });
}

/** Opens the browser's print dialog for a page, from a hidden frame so the app stays as it is. */
export async function printHtmlInBrowser(html: string): Promise<PrintHtmlResult> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  frame.srcdoc = html;
  document.body.appendChild(frame);
  try {
    await loaded;
    const view = frame.contentWindow;
    if (!view) return { success: false, error: "Print frame unavailable" };
    await view.document.fonts?.ready;
    // Images (the logo) must be in before printing.
    await Promise.all(Array.from(view.document.images).map((image) =>
      image.complete ? null : new Promise((resolve) => { image.onload = image.onerror = resolve; })));
    view.focus();
    view.print();
    return { success: true };
  } finally {
    // print() returns once the dialog closes; leave the frame a moment for browsers that return early.
    setTimeout(() => frame.remove(), 1000);
  }
}
