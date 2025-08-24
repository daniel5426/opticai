/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { app, BrowserWindow, ipcMain } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import express from "express";
import cors from "cors";
import { Server } from "http";
import os from "os";
import { emailScheduler } from "./lib/email/email-scheduler";
import { emailService } from "./lib/email/email-service";
import { campaignScheduler } from "./lib/campaign-scheduler";
import { apiClient } from "./lib/api-client";
// Import will be done dynamically to allow hot reload

const inDevelopment = process.env.NODE_ENV === "development";
let mainWindow: BrowserWindow | null = null; // Store reference to the main window

// Server Mode Variables
let expressApp: express.Application | null = null;
let httpServer: Server | null = null;
const SERVER_PORT = 3000;

// AI handlers removed; AI now handled in backend

function setupExpressRoutes(app: express.Application) {
  app.use(cors());
  app.use(express.json());

  // Client operations
  app.get('/api/clients', async (req, res) => {
    try {
      const response = await apiClient.getClients();
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get clients' });
    }
  });

  app.get('/api/clients/:id', async (req, res) => {
    try {
      const response = await apiClient.getClient(parseInt(req.params.id));
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else if (!response.data) {
        res.status(404).json({ error: 'Client not found' });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get client' });
    }
  });

  app.post('/api/clients', async (req, res) => {
    try {
      const response = await apiClient.createClient(req.body);
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to create client' });
    }
  });

  app.put('/api/clients/:id', async (req, res) => {
    try {
      const response = await apiClient.updateClient(parseInt(req.params.id), req.body);
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to update client' });
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      const response = await apiClient.deleteClient(parseInt(req.params.id));
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json({ success: true });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete client' });
    }
  });

  // Exam operations
  app.get('/api/exams', async (req, res) => {
    try {
      const response = await apiClient.getExams();
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get exams' });
    }
  });

  app.get('/api/exams/client/:clientId', async (req, res) => {
    try {
      const response = await apiClient.getExamsByClient(parseInt(req.params.clientId));
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get exams' });
    }
  });

  app.get('/api/exams/:id', async (req, res) => {
    try {
      const response = await apiClient.getExam(parseInt(req.params.id));
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else if (!response.data) {
        res.status(404).json({ error: 'Exam not found' });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get exam' });
    }
  });

  app.post('/api/exams', async (req, res) => {
    try {
      const response = await apiClient.createExam(req.body);
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to create exam' });
    }
  });

  app.put('/api/exams/:id', async (req, res) => {
    try {
      const response = await apiClient.updateExam(parseInt(req.params.id), req.body);
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to update exam' });
    }
  });

  app.delete('/api/exams/:id', async (req, res) => {
    try {
      const response = await apiClient.deleteExam(parseInt(req.params.id));
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json({ success: true });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete exam' });
    }
  });

  // Users operations
  app.get('/api/users', async (req, res) => {
    try {
      const response = await apiClient.getUsers();
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get users' });
    }
  });

  app.get('/api/users/:id', async (req, res) => {
    try {
      const response = await apiClient.getUser(parseInt(req.params.id));
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else if (!response.data) {
        res.status(404).json({ error: 'User not found' });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const response = await apiClient.createUser(req.body);
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    try {
      const response = await apiClient.updateUser(parseInt(req.params.id), req.body);
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response.data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const response = await apiClient.deleteUser(parseInt(req.params.id));
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json({ success: true });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  app.post('/api/auth', async (req, res) => {
    try {
      const response = await apiClient.getCurrentUser();
      if (response.error) {
        res.status(401).json({ error: response.error });
      } else {
        res.json({ user: response.data, success: !!response.data });
      }
    } catch (error) {
      res.status(500).json({ error: 'Authentication failed' });
    }
  });
}

function startExpressServer(): Promise<boolean> {
  return new Promise((resolve) => {
    if (httpServer) {
      console.log('Server already running');
      resolve(true);
      return;
    }

    try {
      expressApp = express();
      setupExpressRoutes(expressApp);

      httpServer = expressApp.listen(SERVER_PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${SERVER_PORT}`);
        resolve(true);
      });

      httpServer.on('error', (error) => {
        console.error('Server error:', error);
        httpServer = null;
        expressApp = null;
        resolve(false);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      resolve(false);
    }
  });
}

function stopExpressServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }

    httpServer.close(() => {
      console.log('Server stopped');
      httpServer = null;
      expressApp = null;
      resolve();
    });
  });
}

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
      devTools: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,

      preload: preload,
    },
    titleBarStyle: "hidden",
  });
  registerListeners(mainWindow);

  // Add keyboard shortcut for DevTools
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

  // Server Mode operations
  ipcMain.handle('start-server-mode', async () => {
    try {
      return await startExpressServer();
    } catch (error) {
      console.error('Error starting server mode:', error);
      return false;
    }
  });

  ipcMain.handle('stop-server-mode', async () => {
    try {
      await stopExpressServer();
    } catch (error) {
      console.error('Error stopping server mode:', error);
    }
  });

  ipcMain.handle('get-server-info', async () => {
    try {
      if (!httpServer) return null;
      
      const networkInterfaces = os.networkInterfaces();
      const addresses: string[] = [];
      
      for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            addresses.push(net.address);
          }
        }
      }
      
      return {
        hostname: os.hostname(),
        addresses,
        port: SERVER_PORT,
        urls: addresses.map(addr => `http://${addr}:${SERVER_PORT}`)
      };
    } catch (error) {
      console.error('Error getting server info:', error);
      return null;
    }
  });

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
      const { GoogleOAuthService } = await import('./lib/google/google-oauth');
      const oauthService = new GoogleOAuthService();
      return await oauthService.authenticate();
    } catch (error) {
      console.error('Error authenticating with Google:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('google-oauth-refresh-token', async (event, refreshToken: string) => {
    try {
      const { GoogleOAuthService } = await import('./lib/google/google-oauth');
      const oauthService = new GoogleOAuthService();
      return await oauthService.refreshToken(refreshToken);
    } catch (error) {
      console.error('Error refreshing Google token:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('google-oauth-validate-tokens', async (event, tokens: any) => {
    try {
      const { GoogleOAuthService } = await import('./lib/google/google-oauth');
      const oauthService = new GoogleOAuthService();
      return await oauthService.validateTokens(tokens);
    } catch (error) {
      console.error('Error validating Google tokens:', error);
      return false;
    }
  });

  ipcMain.handle('google-calendar-create-event', async (event, tokens: any, appointment: any, client?: any) => {
    try {
      const { GoogleCalendarService } = await import('./lib/google/google-calendar');
      const calendarService = new GoogleCalendarService();
      return await calendarService.createEvent(tokens, appointment, client);
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      return null;
    }
  });

  ipcMain.handle('google-calendar-update-event', async (event, tokens: any, eventId: string, appointment: any, client?: any) => {
    try {
      const { GoogleCalendarService } = await import('./lib/google/google-calendar');
      const calendarService = new GoogleCalendarService();
      return await calendarService.updateEvent(tokens, eventId, appointment, client);
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      return false;
    }
  });

  ipcMain.handle('google-calendar-delete-event', async (event, tokens: any, eventId: string) => {
    try {
      const { GoogleCalendarService } = await import('./lib/google/google-calendar');
      const calendarService = new GoogleCalendarService();
      return await calendarService.deleteEvent(tokens, eventId);
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      return false;
    }
  });

  ipcMain.handle('google-calendar-sync-appointments', async (event, tokens: any, appointments: any[]) => {
    try {
      const { GoogleCalendarService } = await import('./lib/google/google-calendar');
      const calendarService = new GoogleCalendarService();
      return await calendarService.syncAppointments(tokens, appointments);
    } catch (error) {
      console.error('Error syncing appointments to Google Calendar:', error);
      return { success: 0, failed: appointments.length };
    }
  });

  ipcMain.handle('google-calendar-get-events', async (event, tokens: any, startDate: string, endDate: string) => {
    try {
      const { GoogleCalendarService } = await import('./lib/google/google-calendar');
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

async function installExtensions() {
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
}).then(installExtensions);

//osX only
app.on("window-all-closed", async () => {
  await stopExpressServer();
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

app.on("before-quit", async () => {
  await stopExpressServer();
});
