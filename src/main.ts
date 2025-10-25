/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
// Load environment variables from .env file
import dotenv from 'dotenv';
import path from "path";

// Load the appropriate .env file based on environment
if (process.env.NODE_ENV === 'production') {
  // In production, load .env.production from extraResources
  const envPath = path.join(process.resourcesPath, '.env.production');
  dotenv.config({ path: envPath });
  console.log('Loading production environment from:', envPath);
} else {
  // In development, load .env.development or .env
  dotenv.config({ path: '.env.development' });
  dotenv.config(); // Fallback to .env if .env.development doesn't exist
  console.log('Loading development environment');
}

import { app, BrowserWindow, ipcMain, dialog } from "electron";
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
let mainWindow: BrowserWindow | null = null; // Store reference to the main window

// Performance optimizations for production
if (!inDevelopment) {
  // Enable hardware acceleration (enabled by default, but explicit for clarity)
  // app.disableHardwareAcceleration() // DON'T call this - we WANT hardware acceleration
  
  // Optimize memory usage
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// Configure auto-updater
autoUpdater.autoDownload = false; // We'll prompt the user first
autoUpdater.autoInstallOnAppQuit = true;

// Set update server for GitHub releases
if (!inDevelopment) {
  try {
    const updateConfig: any = {
      provider: 'github',
      owner: 'daniel5426',
      repo: 'opticai'
    };
    
    // Add private repository configuration if token is available
    const ghToken = process.env.GH_TOKEN;
    if (ghToken) {
      updateConfig.private = true;
      updateConfig.token = ghToken;
      console.log('Auto-updater configured for private GitHub repository');
    } else {
      console.log('Auto-updater configured for public GitHub repository');
    }
    
    autoUpdater.setFeedURL(updateConfig);
    console.log('Auto-updater configured for GitHub releases');
  } catch (error) {
    console.error('Error setting up auto-updater:', error);
  }
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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      devTools: inDevelopment, // Only enable DevTools in development
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,

      preload: preload,
    },
    titleBarStyle: "hidden",
  });
  registerListeners(mainWindow);

  // Add keyboard shortcut for DevTools (development only)
  if (inDevelopment) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  // Clean up the reference when window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return mainWindow;
}

function setupIpcHandlers() {
  // Generic DB Handler for all database operations - DEPRECATED
  // This has been replaced with direct API calls using apiClient
  ipcMain.handle('db-operation', async (_, methodName: string, ...args: any[]) => {
    throw new Error(`DB operation ${methodName} is deprecated. Use direct API calls instead.`);
  });

  // Server Mode operations removed - using FastAPI backend instead

  // Removed AI IPC handlers; AI moved to backend

  // Email operations
  ipcMain.handle('email-test-connection', async () => {
    try {
      await emailService.updateFromSettings();
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

      const settingsResponse = await apiClient.getSettings();
      const settings = settingsResponse.data;
      if (!settings) {
        return false;
      }

      await emailService.updateFromSettings();
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
      const { campaignService } = await import('./lib/campaign-service');
      const targetClients = await campaignService.getTargetClientsForCampaign(campaignId);
      return { success: true, clients: targetClients };
    } catch (error) {
      console.error('Error getting target clients:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('campaign-validate', async (event, campaignId: number) => {
    try {
      const { campaignService } = await import('./lib/campaign-service');
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
  if (inDevelopment) {
    console.log('Auto-update disabled in development mode');
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
        autoUpdater.downloadUpdate();
        
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
    console.error('Error in auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log(logMessage);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    
    // Notify user that update is ready to install
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
        // User chose to restart now
        setImmediate(() => autoUpdater.quitAndInstall());
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
      return {
        available: false,
        message: 'No releases found - this might be the first version',
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

// IPC handler for installing update
ipcMain.handle('install-update', async () => {
  if (inDevelopment) {
    return;
  }
  
  setImmediate(() => autoUpdater.quitAndInstall());
});

// IPC handler for getting app version
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

async function installExtensions() {
  // Only install extensions in development mode
  if (!inDevelopment) {
    return;
  }
  
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  setupAutoUpdater();
  installExtensions(); // Install extensions after other setup
});

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
