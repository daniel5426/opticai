import { BrowserWindow, type WebContents } from "electron";

/** Returns whether Electron accepted the job for the system default printer. */
export async function printOnDefaultPrinter(source: WebContents, html: string): Promise<boolean> {
  const printer = (await source.getPrintersAsync()).find((printer) => printer.isDefault);
  if (!printer) return false;

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: false,
    },
  });
  const { webContents } = window;
  webContents.on("will-navigate", (event) => event.preventDefault());
  webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await new Promise<boolean>((resolve) => {
      webContents.print(
        { silent: true, deviceName: printer.name, pageSize: "A4", printBackground: true },
        (success) => resolve(success),
      );
    });
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}
