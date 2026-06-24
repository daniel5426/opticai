// Load environment variables from .env file
import dotenv from 'dotenv';
import fs from 'fs';
import path from "path";
import { spawn } from "child_process";

// Load the appropriate .env file based on environment
if (process.env.NODE_ENV === 'production') {
  // In production, load the packaged runtime env for the current platform.
  const runtimeEnvFile = process.platform === 'win32'
    ? '.env.windows.production'
    : '.env.production';
  const envPath = path.join(process.resourcesPath, runtimeEnvFile);
  dotenv.config({ path: envPath });
  console.log('Loading production environment from:', envPath);
} else {
  // In development, load .env.development or .env
  dotenv.config({ path: '.env.development' });
  dotenv.config(); // Fallback to .env if .env.development doesn't exist
  console.log('Loading development environment');
}

import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import { autoUpdater } from "electron-updater";
import { GoogleOAuthService } from './lib/google/google-oauth';
import { GoogleCalendarService } from './lib/google/google-calendar';
import registerListeners from "./helpers/ipc/listeners-register";
// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
// Express server removed - using FastAPI backend instead
// import express from "express";
// import cors from "cors";
// import { Server } from "http";
import os from "os";
import { emailScheduler } from "./lib/email/email-scheduler";
import { emailService } from "./lib/email/email-service";
import { campaignScheduler } from "./lib/campaign-scheduler";
import { apiClient } from "./lib/api-client";
// Import will be done dynamically to allow hot reload

const inDevelopment = process.env.NODE_ENV === "development";
const isStagingBuild = process.env.APP_ENVIRONMENT === 'staging';
const isWindows = process.platform === 'win32';
let mainWindow: BrowserWindow | null = null; // Store reference to the main window
const APP_PROFILE_NAME = process.env.APP_PROFILE_NAME || 'Prysm';
const AUTH_PROTOCOL = process.env.AUTH_PROTOCOL || 'prysm';
const APP_USER_LOGOUT_BEFORE_CLOSE_CHANNEL = 'app:user-logout-before-close';
const APP_USER_LOGOUT_BEFORE_CLOSE_DONE_CHANNEL = 'app:user-logout-before-close:done';
let allowWindowCloseAfterUserLogout = false;
let windowCloseLogoutInProgress = false;

function forwardAuthCallbackUrl(url: string) {
  if (!url.startsWith(`${AUTH_PROTOCOL}://auth/callback`)) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth-callback-url', url);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  forwardAuthCallbackUrl(url);
});

function hasPersistedBrowserState(dirPath: string): boolean {
  return fs.existsSync(path.join(dirPath, 'Local Storage', 'leveldb'));
}

function copyProfileIfNeeded(fromDir: string, toDir: string): boolean {
  if (!fs.existsSync(fromDir) || hasPersistedBrowserState(toDir) || !hasPersistedBrowserState(fromDir)) {
    return false;
  }

  fs.mkdirSync(toDir, { recursive: true });
  fs.cpSync(fromDir, toDir, {
    recursive: true,
    dereference: true,
    errorOnExist: false,
    force: false,
  });

  return true;
}

function configureAppStoragePaths() {
  app.setName(APP_PROFILE_NAME);

  const appDataPath = app.getPath('appData');
  const stableUserDataPath = path.join(appDataPath, APP_PROFILE_NAME);
  const stableSessionDataPath = stableUserDataPath;

  const legacyPaths = [
    path.join(appDataPath, 'OpticAI'),
    path.join(appDataPath, 'opticai'),
    path.join(appDataPath, 'Electron'),
  ];

  for (const legacyPath of legacyPaths) {
    try {
      if (copyProfileIfNeeded(legacyPath, stableUserDataPath)) {
        console.log('[Storage] Migrated browser profile from:', legacyPath);
        break;
      }
    } catch (error) {
      console.warn('[Storage] Failed to migrate browser profile from:', legacyPath, error);
    }
  }

  app.setPath('userData', stableUserDataPath);
  app.setPath('sessionData', stableSessionDataPath);
}

configureAppStoragePaths();

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const callbackUrl = argv.find(arg => arg.startsWith(`${AUTH_PROTOCOL}://auth/callback`));
    if (callbackUrl) forwardAuthCallbackUrl(callbackUrl);
  });
}

app.setAsDefaultProtocolClient(AUTH_PROTOCOL);

function getWindowsDownloadPageUrl() {
  return process.env.DOWNLOAD_PAGE_URL?.trim() || '';
}

async function openWindowsDownloadPage(version?: string) {
  const basePageUrl = getWindowsDownloadPageUrl();
  if (!basePageUrl) {
    return {
      success: false,
      error: 'Download page URL is not configured'
    };
  }

  const url = new URL(basePageUrl);
  if (version) {
    url.searchParams.set('version', version);
  }

  await shell.openExternal(url.toString());

  return {
    success: true,
    url: url.toString()
  };
}

async function openUrlInChrome(url: string) {
  const parsedUrl = new URL(url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs can be opened in Chrome');
  }

  const targetUrl = parsedUrl.toString();
  const getWindowsChromeExecutables = () => {
    const installRoots = [
      process.env.ProgramFiles,
      process.env['PROGRAMFILES(X86)'],
      process.env.ProgramW6432,
      process.env.LOCALAPPDATA,
    ].filter(Boolean) as string[];

    return [...new Set(installRoots.map((root) => path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')))]
      .filter((chromePath) => fs.existsSync(chromePath));
  };

  const spawnDetached = (command: string, args: string[]) => new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    child.once('error', reject);
    child.once('spawn', resolve);
    child.unref();
  });

  const openWithChrome = () => new Promise<void>((resolve, reject) => {
    const candidates = process.platform === 'darwin'
      ? [{ command: 'open', args: ['-a', 'Google Chrome', targetUrl] }]
      : process.platform === 'win32'
        ? getWindowsChromeExecutables().map((command) => ({ command, args: [targetUrl] }))
        : [
            { command: 'google-chrome', args: [targetUrl] },
            { command: 'google-chrome-stable', args: [targetUrl] },
            { command: 'chromium', args: [targetUrl] },
            { command: 'chromium-browser', args: [targetUrl] },
          ];

    let index = 0;
    const tryNext = () => {
      const candidate = candidates[index];
      if (!candidate) {
        reject(new Error('Google Chrome was not found'));
        return;
      }

      index += 1;
      if (process.platform === 'win32') {
        spawnDetached(candidate.command, candidate.args).then(resolve, tryNext);
        return;
      }

      const child = spawn(candidate.command, candidate.args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });

      child.once('error', tryNext);
      child.once('exit', (code) => {
        if (code === 0 || process.platform === 'win32') {
          resolve();
        } else {
          tryNext();
        }
      });
      child.unref();
    };

    tryNext();
  });

  try {
    await openWithChrome();
  } catch (error) {
    console.warn('[ExternalLink] Failed to open Chrome, falling back to default browser:', error);
    await shell.openExternal(targetUrl);
  }

  return true;
}

function waitForUserLogoutBeforeClose(window: BrowserWindow, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      ipcMain.removeListener(APP_USER_LOGOUT_BEFORE_CLOSE_DONE_CHANNEL, finish);
      resolve();
    };
    const timeout = setTimeout(finish, timeoutMs);
    ipcMain.once(APP_USER_LOGOUT_BEFORE_CLOSE_DONE_CHANNEL, finish);
    window.webContents.send(APP_USER_LOGOUT_BEFORE_CLOSE_CHANNEL);
  });
}

function addUserLogoutOnWindowClose(window: BrowserWindow) {
  window.on('close', async (event) => {
    if (allowWindowCloseAfterUserLogout || windowCloseLogoutInProgress || window.webContents.isDestroyed()) {
      return;
    }

    event.preventDefault();
    windowCloseLogoutInProgress = true;
    try {
      await waitForUserLogoutBeforeClose(window);
    } catch (error) {
      console.warn('[AppClose] Failed to logout user before close:', error);
    } finally {
      allowWindowCloseAfterUserLogout = true;
      windowCloseLogoutInProgress = false;
      if (!window.isDestroyed()) {
        window.close();
      }
    }
  });
}

// Performance optimizations for production
if (!inDevelopment) {
  // Enable hardware acceleration (enabled by default, but explicit for clarity)
  // app.disableHardwareAcceleration() // DON'T call this - we WANT hardware acceleration
  
  // Optimize memory usage
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// Configure auto-updater
console.log('Main: Configuring auto-updater');
autoUpdater.autoDownload = false; // We'll prompt the user first
autoUpdater.autoInstallOnAppQuit = true;
console.log('Main: autoUpdater.autoDownload =', autoUpdater.autoDownload);
console.log('Main: autoUpdater.autoInstallOnAppQuit =', autoUpdater.autoInstallOnAppQuit);

// Set update server for public GitHub releases.
console.log('Main: Setting up update server, inDevelopment =', inDevelopment);
if (isStagingBuild) {
  console.log('Main: Skipping auto-updater setup for staging build');
} else if (!inDevelopment) {
  try {
    const updateConfig: any = {
      provider: 'github',
      owner: 'daniel5426',
      repo: 'opticai'
    };

    console.log('Main: Setting feed URL with config:', updateConfig);
    autoUpdater.setFeedURL(updateConfig);
    console.log('Main: Auto-updater configured for public GitHub releases');
  } catch (error) {
    console.error('Main: Error setting up auto-updater:', error);
  }
} else {
  console.log('Main: Skipping auto-updater setup in development mode');
}

// Server Mode Variables - REMOVED (using FastAPI backend instead)
// let expressApp: express.Application | null = null;
// let httpServer: Server | null = null;
// const SERVER_PORT = 3000;

// AI handlers removed; AI now handled in backend

// Express server functions removed - using FastAPI backend instead

function createWindow() {
  // Don't create a new window if one already exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }

  
  const preload = path.join(__dirname, "preload.js");
  if (isWindows) {
    Menu.setApplicationMenu(null);
  }
  allowWindowCloseAfterUserLogout = false;
  windowCloseLogoutInProgress = false;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    ...(isWindows
      ? {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#111827',
            height: 32,
          },
          autoHideMenuBar: true,
        }
      : {}),
    webPreferences: {
      devTools: true, // Enable DevTools in both development and production for debugging
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,

      preload: preload,
    },
  });
  registerListeners(mainWindow);
  addUserLogoutOnWindowClose(mainWindow);

  // Add keyboard shortcut for DevTools (both development and production)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Clean up the reference when window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (inDevelopment) {
    mainWindow.loadURL('http://localhost:5126');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }


  
  return mainWindow;
}

function sanitizePdfFileName(fileName: string) {
  const sanitized = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  return sanitized.toLowerCase().endsWith(".pdf") ? sanitized : `${sanitized || "document"}.pdf`;
}

type SoftOpticCandidate = {
  id: string;
  kind: "dsn" | "db-file";
  label: string;
  dsn?: string;
  dbFile?: string;
  logFile?: string;
  documentPath?: string;
  sizeBytes?: number;
  modifiedAt?: string;
  score: number;
  recommended: boolean;
  reasons: string[];
};

function runProcess(command: string, args: string[], options: { cwd?: string } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr?.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `${command} exited with ${code}`));
    });
  });
}

function getSoftOpticExporterPath() {
  const packaged = process.resourcesPath
    ? path.join(process.resourcesPath, "migration_wizard", "export_opticsoft_csv.ps1")
    : "";
  if (packaged && fs.existsSync(packaged)) return packaged;
  return path.join(process.cwd(), "docs", "migration_wizzard_doc", "export_opticsoft_csv.ps1");
}

function getFileInfo(filePath: string) {
  try {
    const stat = fs.statSync(filePath);
    return {
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch {
    return {};
  }
}

function scoreSoftOpticCandidate(candidate: Omit<SoftOpticCandidate, "score" | "recommended">): number {
  let score = 0;
  const dbFile = (candidate.dbFile || "").toLowerCase();
  if ((candidate.dsn || "").toUpperCase() === "RRDB") score += 50;
  if (dbFile === "c:\\rr\\data\\rrdb.db") score += 45;
  if (dbFile.endsWith("\\rrdb.db")) score += 20;
  if (candidate.logFile && fs.existsSync(candidate.logFile)) score += 10;
  if (candidate.documentPath && fs.existsSync(candidate.documentPath)) score += 5;
  if (candidate.modifiedAt) score += 5;
  return score;
}

async function scanSoftOpticCandidates(): Promise<{ supported: boolean; candidates: SoftOpticCandidate[]; error?: string }> {
  if (process.platform !== "win32") {
    return { supported: false, candidates: [], error: "SoftOptic import is available only on Windows" };
  }

  const candidatesByKey = new Map<string, Omit<SoftOpticCandidate, "score" | "recommended">>();
  const addCandidate = (candidate: Omit<SoftOpticCandidate, "score" | "recommended">) => {
    const key = candidate.dsn ? `dsn:${candidate.dsn}` : `db:${candidate.dbFile?.toLowerCase()}`;
    if (!key) return;
    candidatesByKey.set(key, candidate);
  };

  const knownDbFiles = [
    "C:\\RR\\Data\\RRDB.db",
    "C:\\RR\\DATA\\RRDB.DB",
    path.join(os.homedir(), "Downloads", "old_db", "back", "RRDB.db"),
  ];
  for (const dbFile of knownDbFiles) {
    if (!fs.existsSync(dbFile)) continue;
    const logFile = path.join(path.dirname(dbFile), "rrdb.log");
    addCandidate({
      id: `db-${Buffer.from(dbFile).toString("base64url")}`,
      kind: "db-file",
      label: path.basename(dbFile),
      dbFile,
      logFile: fs.existsSync(logFile) ? logFile : undefined,
      documentPath: fs.existsSync("C:\\RR\\Document") ? "C:\\RR\\Document" : undefined,
      ...getFileInfo(dbFile),
      reasons: ["נמצא במסלול מוכר של OpticSoft"],
    });
  }

  try {
    const { stdout } = await runProcess("reg", ["query", "HKLM\\SOFTWARE\\WOW6432Node\\ODBC\\ODBC.INI\\RRDB", "/s"]);
    const driverMatch = stdout.match(/Driver\s+REG_\w+\s+(.+)/i);
    const dbMatch = stdout.match(/(?:DatabaseFile|Database|DBF)\s+REG_\w+\s+(.+)/i);
    const dbFile = dbMatch?.[1]?.trim();
    const dbFileExists = Boolean(dbFile && fs.existsSync(dbFile));
    if (!dbFile || dbFileExists) {
      addCandidate({
        id: "dsn-RRDB",
        kind: "dsn",
        label: "RRDB",
        dsn: "RRDB",
        dbFile: dbFileExists ? dbFile : undefined,
        logFile: fs.existsSync("C:\\RR\\Data\\rrdb.log") ? "C:\\RR\\Data\\rrdb.log" : undefined,
        documentPath: fs.existsSync("C:\\RR\\Document") ? "C:\\RR\\Document" : undefined,
        ...(dbFileExists && dbFile ? getFileInfo(dbFile) : {}),
        reasons: [
          "נמצא DSN בשם RRDB",
          ...(driverMatch?.[1] ? [`דרייבר: ${driverMatch[1].trim()}`] : []),
        ],
      });
    }
  } catch {
    // DSN might not exist; known file candidates still cover copied DB flow.
  }

  const scored = [...candidatesByKey.values()].map(candidate => {
    const score = scoreSoftOpticCandidate(candidate);
    return { ...candidate, score, recommended: false };
  });
  const maxScore = Math.max(0, ...scored.map(candidate => candidate.score));
  const candidates = scored
    .map(candidate => ({ ...candidate, recommended: candidate.score === maxScore && maxScore > 0 }))
    .sort((a, b) => b.score - a.score);

  return { supported: true, candidates };
}

async function countFileRows(filePath: string) {
  if (!fs.existsSync(filePath)) return 0;
  const readline = await import("readline");
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lines = 0;
  for await (const line of reader) {
    if (line.trim()) lines += 1;
  }
  return Math.max(0, lines - 1);
}

async function countFiles(rootPath?: string) {
  if (!rootPath || !fs.existsSync(rootPath)) return 0;
  let count = 0;
  const entries = await fs.promises.readdir(rootPath, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) count += 1;
  }
  return count;
}

async function exportSoftOpticCandidate(candidate: SoftOpticCandidate, sqlAnywhereBin?: string, includeDocuments = false) {
  if (process.platform !== "win32") {
    return { success: false, error: "SoftOptic import is available only on Windows" };
  }

  const exporterPath = getSoftOpticExporterPath();
  if (!fs.existsSync(exporterPath)) {
    return { success: false, error: "SoftOptic exporter script is missing" };
  }

  const outputDir = path.join(app.getPath("temp"), `softoptic_export_${Date.now()}`);
  await fs.promises.mkdir(outputDir, { recursive: true });

  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    exporterPath,
    "-OutputDir",
    outputDir,
  ];
  if (candidate.kind === "dsn" && candidate.dsn) {
    args.push("-Dsn", candidate.dsn);
  } else if (candidate.dbFile) {
    args.push("-DbFile", candidate.dbFile);
  }
  if (sqlAnywhereBin) {
    args.push("-SqlAnywhereBin", sqlAnywhereBin);
  }

  try {
    await runProcess("powershell.exe", args, { cwd: outputDir });
    if (includeDocuments && candidate.documentPath && fs.existsSync(candidate.documentPath)) {
      const targetDocuments = path.join(outputDir, "documents");
      await fs.promises.cp(candidate.documentPath, targetDocuments, { recursive: true, force: true });
    }

    const manifestPath = path.join(outputDir, "manifest.json");
    const manifestText = fs.existsSync(manifestPath)
      ? await fs.promises.readFile(manifestPath, "utf-8")
      : "";
    const manifest = manifestText
      ? JSON.parse(manifestText.replace(/^\uFEFF/, ""))
      : {};
    const summary = {
      clients: await countFileRows(path.join(outputDir, "account.csv")),
      exams: await countFileRows(path.join(outputDir, "optic_eye_tests.csv")),
      glasses_orders: await countFileRows(path.join(outputDir, "optic_glasses_presc.csv")),
      contact_lens_orders: await countFileRows(path.join(outputDir, "optic_contact_presc.csv")),
      appointments: await countFileRows(path.join(outputDir, "diary_timetab.csv")),
      notes: await countFileRows(path.join(outputDir, "account_memos.csv")),
      referrals: await countFileRows(path.join(outputDir, "optic_reference.csv")),
      embedded_files: await countFileRows(path.join(outputDir, "account_files_blob.csv")),
      external_documents: includeDocuments ? await countFiles(candidate.documentPath) : 0,
      includeDocuments,
      manifest,
      exportedAt: new Date().toISOString(),
      outputDir,
    };

    const zipPath = `${outputDir}.zip`;
    await runProcess("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -Path '${outputDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ]);
    return { success: true, outputDir, zipPath, summary };
  } catch (error) {
    return {
      success: false,
      outputDir,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function uploadSoftOpticBundle(payload: { apiBaseUrl: string; jobId: string; zipPath: string; accessToken: string }) {
  try {
    if (!payload.accessToken) {
      return { success: false, error: "Missing authorization token" };
    }
    if (!payload.zipPath || !fs.existsSync(payload.zipPath)) {
      return { success: false, error: "SoftOptic ZIP file was not found" };
    }
    const openAsBlob = (fs as any).openAsBlob;
    if (typeof openAsBlob !== "function") {
      return { success: false, error: "This Electron runtime cannot stream local files for upload" };
    }
    const blob = await openAsBlob(payload.zipPath, { type: "application/zip" });
    const formData = new FormData();
    formData.append("bundle", blob, path.basename(payload.zipPath));
    const baseUrl = payload.apiBaseUrl.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/migration/softoptic/imports/${encodeURIComponent(payload.jobId)}/bundle`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${payload.accessToken}` },
      body: formData as any,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data?.detail || data?.error || `Upload failed (${response.status})` };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function setupIpcHandlers() {
  // Generic DB Handler for all database operations - DEPRECATED
  // This has been replaced with direct API calls using apiClient
  ipcMain.handle('db-operation', async (_, methodName: string, ...args: any[]) => {
    throw new Error(`DB operation ${methodName} is deprecated. Use direct API calls instead.`);
  });

  ipcMain.handle('open-external-auth-url', async (_event, url: string) => {
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('open-url-in-chrome', async (_event, url: string) => {
    return openUrlInChrome(url);
  });

  ipcMain.handle('softoptic-scan', async () => {
    return scanSoftOpticCandidates();
  });

  ipcMain.handle('softoptic-export', async (_event, payload: { candidate: SoftOpticCandidate; sqlAnywhereBin?: string; includeDocuments?: boolean }) => {
    return exportSoftOpticCandidate(payload.candidate, payload.sqlAnywhereBin, Boolean(payload.includeDocuments));
  });

  ipcMain.handle('softoptic-upload-bundle', async (_event, payload: { apiBaseUrl: string; jobId: string; zipPath: string; accessToken: string }) => {
    return uploadSoftOpticBundle(payload);
  });

  ipcMain.handle('export-html-to-pdf', async (_event, payload: { html: string; defaultFileName: string }) => {
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    try {
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`);
      await pdfWindow.webContents.executeJavaScript(
        "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
      );

      const pdfData = await pdfWindow.webContents.printToPDF({
        pageSize: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });

      const defaultPath = path.join(app.getPath("documents"), sanitizePdfFileName(payload.defaultFileName));
      const result = await dialog.showSaveDialog(mainWindow || undefined, {
        title: "שמירת PDF",
        defaultPath,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      await fs.promises.writeFile(result.filePath, pdfData);
      await shell.openPath(result.filePath);

      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error("Error exporting HTML to PDF:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (!pdfWindow.isDestroyed()) {
        pdfWindow.close();
      }
    }
  });

  ipcMain.handle('print-html', async (_event, payload: { html: string; defaultFileName?: string }) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`);
      await printWindow.webContents.executeJavaScript(
        "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
      );

      const pdfData = await printWindow.webContents.printToPDF({
        pageSize: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });

      const tempDir = await fs.promises.mkdtemp(path.join(app.getPath("temp"), "opticai-print-"));
      const filePath = path.join(tempDir, sanitizePdfFileName(payload.defaultFileName || "print-preview.pdf"));
      await fs.promises.writeFile(filePath, pdfData);

      const openError = await shell.openPath(filePath);
      if (openError) {
        return { success: false, error: openError };
      }

      return { success: true, filePath };
    } catch (error) {
      console.error("Error printing HTML:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (!printWindow.isDestroyed()) {
        printWindow.close();
      }
    }
  });

  // Server Mode operations removed - using FastAPI backend instead

  // Removed AI IPC handlers; AI moved to backend

  // Email operations
  ipcMain.handle('email-test-connection', async (event, clinicId?: number) => {
    try {
      await emailService.updateFromSettings(clinicId);
      return await emailService.testConnection();
    } catch (error) {
      console.error('Error testing email connection:', error);
      return false;
    }
  });

  ipcMain.handle('email-send-test-reminder', async (event, appointmentId: number) => {
    try {
      const appointmentResponse = await apiClient.getAppointmentById(appointmentId);
      const appointment = appointmentResponse.data;
      if (!appointment) {
        return false;
      }
      
      const clientResponse = await apiClient.getClientById(appointment.client_id);
      const client = clientResponse.data;
      if (!client || !client.email) {
        return false;
      }

      const settingsResponse = await apiClient.getSettings(appointment.clinic_id);
      const settings = settingsResponse.data;
      if (!settings) {
        return false;
      }

      await emailService.updateFromSettings(appointment.clinic_id);
      return await emailService.sendAppointmentReminder(appointment, client, settings);
    } catch (error) {
      console.error('Error sending test reminder:', error);
      return false;
    }
  });

  ipcMain.handle('email-scheduler-status', async () => {
    try {
      return emailScheduler.getStatus();
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      return { isRunning: false, nextRun: null };
    }
  });

  ipcMain.handle('email-scheduler-restart', async () => {
    try {
      emailScheduler.restart();
      return true;
    } catch (error) {
      console.error('Error restarting scheduler:', error);
      return false;
    }
  });

  // Campaign operations
  ipcMain.handle('campaign-scheduler-status', async () => {
    try {
      return campaignScheduler.getStatus();
    } catch (error) {
      console.error('Error getting campaign scheduler status:', error);
      return { isRunning: false, nextRun: null };
    }
  });

  ipcMain.handle('campaign-scheduler-restart', async () => {
    try {
      campaignScheduler.restart();
      return true;
    } catch (error) {
      console.error('Error restarting campaign scheduler:', error);
      return false;
    }
  });

  ipcMain.handle('campaign-execute-test', async (event, campaignId: number) => {
    try {
      return await campaignScheduler.executeTestCampaign(campaignId);
    } catch (error) {
      console.error('Error executing test campaign:', error);
      return { 
        success: false, 
        message: 'Error executing test campaign', 
        details: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  ipcMain.handle('campaign-execute-full', async (event, campaignId: number) => {
    try {
      return await campaignScheduler.executeFullCampaign(campaignId);
    } catch (error) {
      console.error('Error executing full campaign:', error);
      return { 
        success: false, 
        message: 'Error executing full campaign', 
        details: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  ipcMain.handle('campaign-get-target-clients', async (event, campaignId: number) => {
    try {
      const { campaignService } = await import('./lib/campaign-service.js');
      const targetClients = await campaignService.getTargetClientsForCampaign(campaignId);
      return { success: true, clients: targetClients };
    } catch (error) {
      console.error('Error getting target clients:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('campaign-validate', async (event, campaignId: number) => {
    try {
      const { campaignService } = await import('./lib/campaign-service.js');
      const campaignResponse = await apiClient.getCampaignById(campaignId);
      const campaign = campaignResponse.data;
      if (!campaign) {
        return { success: false, error: 'Campaign not found' };
      }
      const validation = await campaignService.validateCampaignForExecution(campaign);
      return { success: true, validation };
    } catch (error) {
      console.error('Error validating campaign:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Google OAuth and Calendar operations
  ipcMain.handle('google-oauth-authenticate', async () => {
    try {
      const oauthService = new GoogleOAuthService();
      return await oauthService.authenticate();
    } catch (error) {
      console.error('Error authenticating with Google:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('google-oauth-code-received', async (event, code: string) => {
    try {
      console.log('Main: Received Google OAuth code from renderer');
      return await GoogleOAuthService.resolvePendingAuth(code);
    } catch (error) {
      console.error('Error handling received Google OAuth code:', error);
      return false;
    }
  });

  ipcMain.handle('google-oauth-cancel', async () => {
    return GoogleOAuthService.cancelPendingAuth();
  });

  ipcMain.handle('google-oauth-refresh-token', async (event, refreshToken: string) => {
    try {
      const oauthService = new GoogleOAuthService();
      return await oauthService.refreshToken(refreshToken);
    } catch (error) {
      console.error('Error refreshing Google token:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('google-oauth-validate-tokens', async (event, tokens: any) => {
    try {
      const oauthService = new GoogleOAuthService();
      return await oauthService.validateTokens(tokens);
    } catch (error) {
      console.error('Error validating Google tokens:', error);
      return false;
    }
  });

  ipcMain.handle('google-calendar-create-event', async (event, tokens: any, appointment: any, client?: any) => {
    try {
      const calendarService = new GoogleCalendarService();
      return await calendarService.createEvent(tokens, appointment, client);
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      return null;
    }
  });

  ipcMain.handle('google-calendar-update-event', async (event, tokens: any, eventId: string, appointment: any, client?: any) => {
    try {
      const calendarService = new GoogleCalendarService();
      return await calendarService.updateEvent(tokens, eventId, appointment, client);
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      return false;
    }
  });

  ipcMain.handle('google-calendar-delete-event', async (event, tokens: any, eventId: string) => {
    try {
      const calendarService = new GoogleCalendarService();
      return await calendarService.deleteEvent(tokens, eventId);
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      return false;
    }
  });

  ipcMain.handle('google-calendar-sync-appointments', async (event, tokens: any, appointments: any[]) => {
    try {
      const calendarService = new GoogleCalendarService();
      return await calendarService.syncAppointments(tokens, appointments);
    } catch (error) {
      console.error('Error syncing appointments to Google Calendar:', error);
      return { success: 0, failed: appointments.length };
    }
  });

  ipcMain.handle('google-calendar-get-events', async (event, tokens: any, startDate: string, endDate: string) => {
    try {
      const calendarService = new GoogleCalendarService();
      return await calendarService.getEvents(tokens, startDate, endDate);
    } catch (error) {
      console.error('Error getting Google Calendar events:', error);
      return [];
    }
  });



  // Client operations handler
  ipcMain.handle('db-get-clients', async () => {
    try {
      const response = await apiClient.getAllClients();
      return response.data || [];
    } catch (error) {
      console.error('Error getting clients:', error);
      return [];
    }
  });

  // Chat operations handlers
  ipcMain.handle('chat-create', async (event, title: string) => {
    try {
      const response = await apiClient.createChat(title);
      return response.data;
    } catch (error) {
      console.error('Error creating chat:', error);
      return null;
    }
  });

  ipcMain.handle('chat-get-by-id', async (event, id: number) => {
    try {
      const response = await apiClient.getChat(id);
      return response.data;
    } catch (error) {
      console.error('Error getting chat by id:', error);
      return null;
    }
  });

  ipcMain.handle('chat-get-messages', async (event, chatId: number) => {
    try {
      const response = await apiClient.getChatMessages(chatId);
      return response.data || [];
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  });

  ipcMain.handle('chat-create-message', async (event, messageData: any) => {
    try {
      const response = await apiClient.createChatMessage(messageData);
      return response.data;
    } catch (error) {
      console.error('Error creating chat message:', error);
      return null;
    }
  });
}

// Auto-updater event handlers
function setupAutoUpdater() {
  // Skip auto-update in development
  if (inDevelopment || isStagingBuild) {
    console.log('Auto-update disabled in development or staging mode');
    return;
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    
    // Ask user if they want to download the update
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'עדכון זמין',
      message: `גרסה חדשה ${info.version} זמינה להורדה.`,
      detail: 'האם ברצונך להוריד ולהתקין את העדכון?',
      buttons: ['כן', 'לא'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        // User chose to download
        autoUpdater.downloadUpdate().catch((error) => {
          console.error('Failed to download update after user confirmation:', error);
        });
        
        // Show downloading notification
        dialog.showMessageBox(mainWindow!, {
          type: 'info',
          title: 'מוריד עדכון',
          message: 'העדכון מתבצע ברקע. תקבל הודעה כאשר יהיה מוכן להתקנה.',
          buttons: ['אישור']
        });
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available');
  });

  autoUpdater.on('error', (err) => {
    console.error('=== AUTO-UPDATER ERROR ===');
    console.error('Error details:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
  });

  autoUpdater.on('before-quit-for-update' as any, () => {
    console.log('autoUpdater before-quit-for-update event triggered');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log(logMessage);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('=== UPDATE DOWNLOADED EVENT ===');
    console.log('Update version:', info.version);
    console.log('Update info:', JSON.stringify(info, null, 2));
    
    const downloadedUpdateHelper = (autoUpdater as any).downloadedUpdateHelper;
    console.log('downloadedUpdateHelper in update-downloaded:', downloadedUpdateHelper);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    }
    
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'עדכון מוכן',
      message: `גרסה ${info.version} הורדה בהצלחה והוכנה להתקנה.`,
      detail: 'האפליקציה תאותחל מחדש כדי להתקין את העדכון.',
      buttons: ['אתחל עכשיו', 'אתחל מאוחר יותר'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log('User confirmed immediate restart for update');
        setImmediate(() => {
          console.log('Invoking autoUpdater.quitAndInstall(false, true) from update-downloaded prompt');
          try {
            autoUpdater.quitAndInstall(false, true);
            console.log('autoUpdater.quitAndInstall call returned without throwing');
          } catch (error) {
            console.error('autoUpdater.quitAndInstall threw inside update-downloaded prompt', error);
          }
        });
      } else {
        console.log('User chose to postpone restart after update download');
      }
    });
  });

  // Check for updates on app start
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Failed to check for updates:', err);
    });
  }, 3000); // Wait 3 seconds after app start
}

// IPC handler for manual update check
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    
    // If no result, it might mean no updates available or no releases exist yet
    if (!result) {
      return {
        available: false,
        message: 'No updates available or no releases found',
        currentVersion: app.getVersion()
      };
    }
    
    return {
      available: result !== null,
      version: result?.updateInfo.version || null,
      currentVersion: app.getVersion()
    };
  } catch (error) {
    console.error('Error checking for updates:', error);
    
    // Handle specific GitHub 404 errors
    if (error instanceof Error && error.message.includes('404')) {
      console.error('Error checking for updates:', error);
      return {
        available: false,
        message: 'No releases found - this might be the first version, here the error: ' + error.message,
        currentVersion: app.getVersion()
      };
    }
    
    return { 
      available: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      currentVersion: app.getVersion()
    };
  }
});

// IPC handler for downloading update
ipcMain.handle('download-update', async () => {
  if (inDevelopment) {
    return { success: false, error: 'Updates disabled in development' };
  }
  
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error('Error downloading update:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

ipcMain.handle('open-update-download-page', async () => {
  if (inDevelopment) {
    return openWindowsDownloadPage();
  }

  if (isWindows) {
    return openWindowsDownloadPage();
  }

  return {
    success: false,
    error: 'Manual download page is only used on Windows'
  };
});

ipcMain.handle('install-update', async () => {
  if (inDevelopment) {
    return { success: false, error: 'Updates disabled in development' };
  }

  console.log('=== INSTALL UPDATE REQUESTED ===');
  console.log('Current platform:', process.platform);
  console.log('Current arch:', process.arch);
  console.log('Current app version:', app.getVersion());
  console.log('App path:', app.getPath('exe'));
  console.log('App name:', app.getName());
  console.log('autoUpdater.autoInstallOnAppQuit value:', autoUpdater.autoInstallOnAppQuit);

  const downloadedUpdateHelper = (autoUpdater as any).downloadedUpdateHelper;
  console.log('downloadedUpdateHelper exists:', !!downloadedUpdateHelper);
  console.log('downloadedUpdateHelper full object:', JSON.stringify(downloadedUpdateHelper, null, 2));
  
  if (downloadedUpdateHelper && downloadedUpdateHelper.file) {
    const fs = require('fs');
    const { shell } = require('electron');
    const updateFileExists = fs.existsSync(downloadedUpdateHelper.file);
    console.log('Update file path:', downloadedUpdateHelper.file);
    console.log('Update file exists:', updateFileExists);
    
    if (updateFileExists) {
      const stats = fs.statSync(downloadedUpdateHelper.file);
      console.log('Update file size:', stats.size, 'bytes');
    } else {
      console.error('Update file does not exist at path:', downloadedUpdateHelper.file);
      return { success: false, error: 'Update file not found' };
    }

    console.log('Found downloaded update helper state:', {
      file: downloadedUpdateHelper.file,
      sha512: downloadedUpdateHelper.sha512,
      version: downloadedUpdateHelper.version
    });

    try {
      console.log('Attempting to quit and install...');
      
      if (process.platform === 'darwin') {
        console.log('macOS detected - checking code signing status');
        
        const { execSync } = require('child_process');
        let isSigned = false;
        try {
          const codesignCheck = execSync(`codesign -dv "${app.getPath('exe')}" 2>&1`, { encoding: 'utf-8' });
          console.log('Code signing check result:', codesignCheck);
          isSigned = !codesignCheck.includes('code object is not signed');
        } catch (err) {
          console.log('Code signing check failed (app may not be signed):', err);
        }
        
        console.log('App is signed:', isSigned);
        
        if (!isSigned) {
          console.log('WARNING: App is not code-signed - auto-update may not work properly');
          console.log('Update file location:', downloadedUpdateHelper.file);
          console.log('You may need to manually install the update');
        }
        
        console.log('macOS detected - using quitAndInstall with forceRunAfter=true');
        
        setTimeout(() => {
          console.log('setTimeout callback executing for macOS install');
          
          const allWindows = BrowserWindow.getAllWindows();
          console.log('Found', allWindows.length, 'windows to close');
          
          allWindows.forEach((win, index) => {
            console.log(`Destroying window ${index + 1}`);
            try {
              win.removeAllListeners('close');
              win.destroy();
            } catch (err) {
              console.error(`Error destroying window ${index + 1}:`, err);
            }
          });
          
          console.log('All windows destroyed, calling quitAndInstall(false, true)');
          console.log('Parameters: isSilent=false, forceRunAfter=true');
          
          try {
            const result = autoUpdater.quitAndInstall(false, true);
            console.log('quitAndInstall returned:', result);
            console.log('quitAndInstall called successfully - app should restart');
            
            setTimeout(() => {
              console.log('WARNING: App still running after 3 seconds - quitAndInstall may have failed');
              console.log('This might indicate the app is not properly signed/notarized');
              if (!isSigned) {
                console.log('App is unsigned - attempting to open update file location');
                try {
                  shell.showItemInFolder(downloadedUpdateHelper.file);
                  const currentWindow = BrowserWindow.getFocusedWindow();
                  if (currentWindow) {
                    dialog.showMessageBox(currentWindow, {
                      type: 'warning',
                      title: 'עדכון ידני נדרש',
                      message: 'האפליקציה לא חתומה, ולכן עדכון אוטומטי אינו זמין.',
                      detail: `קובץ העדכון נמצא ב: ${downloadedUpdateHelper.file}\n\nאנא התקן את העדכון ידנית.`,
                      buttons: ['אישור']
                    });
                  }
                } catch (err) {
                  console.error('Failed to show update file location:', err);
                }
              }
              console.log('Forcing app.exit(0) as fallback');
              app.exit(0);
            }, 3000);
          } catch (err) {
            console.error('quitAndInstall threw error:', err);
            console.error('Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
            console.log('Forcing app.exit(0) due to error');
            app.exit(0);
          }
        }, 100);
      } else {
        console.log('Non-macOS platform - using standard quit');
        setImmediate(() => {
          console.log('setImmediate callback executing');
          try {
            autoUpdater.quitAndInstall(false, true);
            console.log('quitAndInstall returned');
          } catch (err) {
            console.error('quitAndInstall threw:', err);
          }
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('quitAndInstall setup failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  } else {
    console.log('No downloaded update found. Helper contents:', downloadedUpdateHelper);
    return { success: false, error: 'No update available to install' };
  }
});

// IPC handler for getting app version
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

async function installExtensions() {
  // Keep React DevTools opt-in; its extension service worker can corrupt/noise the dev profile.
  if (!inDevelopment || process.env.ELECTRON_INSTALL_REACT_DEVTOOLS !== '1') {
    return;
  }
  
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch (error) {
    console.warn("Failed to install React Developer Tools:", error);
  }
}

app.whenReady().then(() => {
  console.log('=== APP STARTUP ===');
  console.log('App version:', app.getVersion());
  console.log('App name:', app.getName());
  console.log('Platform:', process.platform);
  console.log('Arch:', process.arch);
  console.log('App path:', app.getPath('exe'));
  console.log('User data path:', app.getPath('userData'));
  console.log('Session data path:', app.getPath('sessionData'));
  
  setupIpcHandlers();
  createWindow();
  setupAutoUpdater();
  installExtensions();
});

app.on('before-quit', (event) => {
  console.log('=== APP BEFORE-QUIT EVENT TRIGGERED ===');
  console.log('Event defaultPrevented:', event.defaultPrevented);
});

app.on('will-quit', (event) => {
  console.log('=== APP WILL-QUIT EVENT TRIGGERED ===');
  console.log('Event defaultPrevented:', event.defaultPrevented);
});

app.on("window-all-closed", () => {
  console.log('=== WINDOW-ALL-CLOSED EVENT ===');
  console.log('Platform:', process.platform);
  if (process.platform !== "darwin") {
    console.log('Non-macOS: calling app.quit()');
    app.quit();
  } else {
    console.log('macOS: keeping app running (standard macOS behavior)');
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
