import { BrowserWindow, ipcMain } from "electron";
import {
  WIN_CLOSE_CHANNEL,
  WIN_MAXIMIZE_CHANNEL,
  WIN_MINIMIZE_CHANNEL,
} from "./window-channels";

// Keep track of whether handlers have been registered
let handlersRegistered = false;

export function addWindowEventListeners(mainWindow: BrowserWindow) {
  // Prevent registering duplicate handlers
  if (handlersRegistered) {
    return;
  }

  // Attempt to remove any existing handlers first (no error if none exist)
  try {
    ipcMain.removeHandler(WIN_MINIMIZE_CHANNEL);
    ipcMain.removeHandler(WIN_MAXIMIZE_CHANNEL);
    ipcMain.removeHandler(WIN_CLOSE_CHANNEL);
  } catch (error) {
    // Ignore errors - handlers might not exist yet
  }

  // Register new handlers
  ipcMain.handle(WIN_MINIMIZE_CHANNEL, () => {
    mainWindow.minimize();
  });
  ipcMain.handle(WIN_MAXIMIZE_CHANNEL, () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle(WIN_CLOSE_CHANNEL, () => {
    mainWindow.close();
  });
  
  // Set flag to indicate handlers are registered
  handlersRegistered = true;
}
