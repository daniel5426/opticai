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
import { dbService } from "./lib/db/index";
import express from "express";
import cors from "cors";
import { Server } from "http";
import os from "os";
import { emailScheduler } from "./lib/email/email-scheduler";
import { emailService } from "./lib/email/email-service";
import { campaignScheduler } from "./lib/campaign-scheduler";
// Import will be done dynamically to allow hot reload

const inDevelopment = process.env.NODE_ENV === "development";
let mainWindow: BrowserWindow | null = null; // Store reference to the main window

// Server Mode Variables
let expressApp: express.Application | null = null;
let httpServer: Server | null = null;
const SERVER_PORT = 3000;

// AI Agent Variables
let aiAgent: any = null;
const AI_PROXY_SERVER_URL = 'http://localhost:8001';

function setupExpressRoutes(app: express.Application) {
  app.use(cors());
  app.use(express.json());

  // Client operations
  app.get('/api/clients', (req, res) => {
    try {
      const clients = dbService.getAllClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get clients' });
    }
  });

  app.get('/api/clients/:id', (req, res) => {
    try {
      const client = dbService.getClientById(parseInt(req.params.id));
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
      } else {
        res.json(client);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get client' });
    }
  });

  app.post('/api/clients', (req, res) => {
    try {
      const client = dbService.createClient(req.body);
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create client' });
    }
  });

  app.put('/api/clients/:id', (req, res) => {
    try {
      const client = dbService.updateClient({ ...req.body, id: parseInt(req.params.id) });
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update client' });
    }
  });

  app.delete('/api/clients/:id', (req, res) => {
    try {
      const result = dbService.deleteClient(parseInt(req.params.id));
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete client' });
    }
  });

  // Exam operations
  app.get('/api/exams', (req, res) => {
    try {
      const exams = dbService.getAllExams();
      res.json(exams);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get exams' });
    }
  });

  app.get('/api/exams/client/:clientId', (req, res) => {
    try {
      const exams = dbService.getExamsByClientId(parseInt(req.params.clientId));
      res.json(exams);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get exams' });
    }
  });

  app.get('/api/exams/:id', (req, res) => {
    try {
      const exam = dbService.getExamById(parseInt(req.params.id));
      res.json(exam);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get exam' });
    }
  });

  app.post('/api/exams', (req, res) => {
    try {
      const exam = dbService.createExam(req.body);
      res.json(exam);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create exam' });
    }
  });

  app.put('/api/exams/:id', (req, res) => {
    try {
      const exam = dbService.updateExam({ ...req.body, id: parseInt(req.params.id) });
      res.json(exam);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update exam' });
    }
  });

  app.delete('/api/exams/:id', (req, res) => {
    try {
      const result = dbService.deleteExam(parseInt(req.params.id));
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete exam' });
    }
  });

  // Users operations
  app.get('/api/users', (req, res) => {
    try {
      const users = dbService.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get users' });
    }
  });

  app.get('/api/users/:id', (req, res) => {
    try {
      const user = dbService.getUserById(parseInt(req.params.id));
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  app.post('/api/users', (req, res) => {
    try {
      const user = dbService.createUser(req.body);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', (req, res) => {
    try {
      const user = dbService.updateUser({ ...req.body, id: parseInt(req.params.id) });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    try {
      const result = dbService.deleteUser(parseInt(req.params.id));
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  app.post('/api/auth', (req, res) => {
    try {
      const { username, password } = req.body;
      const user = dbService.authenticateUser(username, password);
      res.json({ user, success: !!user });
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
  // Generic DB Handler for all database operations
  ipcMain.handle('db-operation', async (_, methodName: string, ...args: any[]) => {
    try {
      if (dbService && typeof (dbService as any)[methodName] === 'function') {
        return await (dbService as any)[methodName](...args);
      }
      throw new Error(`Invalid or non-function DB method: ${methodName}`);
    } catch (error) {
      console.error(`Error in db-operation for method ${methodName}:`, error);
      throw error;
    }
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

  // AI Agent operations
  ipcMain.handle('ai-initialize', async () => {
    try {
      // Dynamically import the module
      const { AIAgent } = await import('./lib/ai/ai-agent');
      
      // Always recreate the agent (helpful for development)
      aiAgent = new AIAgent(
        { proxyServerUrl: AI_PROXY_SERVER_URL },
        dbService
      );
      return { success: true };
    } catch (error) {
      console.error('Error initializing AI agent:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('ai-chat', async (event, message: string, conversationHistory: any[]) => {
    try {
      if (!aiAgent) {
        throw new Error('AI agent not initialized');
      }
      return await aiAgent.processMessage(message, conversationHistory);
    } catch (error) {
      console.error('Error processing AI message:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error while processing your request.',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  ipcMain.handle('ai-chat-stream', async (event, message: string, conversationHistory: any[]) => {
    try {
      if (!aiAgent) {
        throw new Error('AI agent not initialized');
      }
      
      // Start the streaming process
      const stream = aiAgent.processMessageStream(message, conversationHistory);
      let fullMessage = '';
      
      for await (const chunk of stream) {
        fullMessage += chunk;
        // Send chunk to renderer process
        event.sender.send('ai-chat-stream-chunk', { chunk, fullMessage });
      }
      
      // Send completion signal
      event.sender.send('ai-chat-stream-complete', { message: fullMessage });
      
      return {
        success: true,
        message: fullMessage
      };
    } catch (error) {
      console.error('Error processing AI streaming message:', error);
      event.sender.send('ai-chat-stream-error', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        success: false,
        message: 'Sorry, I encountered an error while processing your request.',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  ipcMain.handle('ai-execute-action', async (event, action: string, data: any) => {
    try {
      if (!aiAgent) {
        throw new Error('AI agent not initialized');
      }
      return await aiAgent.executeAction(action, data);
    } catch (error) {
      console.error('Error executing AI action:', error);
      return {
        success: false,
        message: 'Failed to execute action',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  ipcMain.handle('ai-generate-main-state', async (event, clientId: number) => {
    try {
      if (!aiAgent) {
        throw new Error('AI agent not initialized');
      }
      
      const aiMainState = await aiAgent.generateClientAiMainState(clientId);
      await dbService.updateClientAiMainState(clientId, aiMainState);
      
      return aiMainState;
    } catch (error) {
      console.error('Error generating AI main state:', error);
      return 'שגיאה ביצירת סיכום AI';
    }
  });

  ipcMain.handle('ai-generate-part-state', async (event, clientId: number, part: string) => {
    try {
      if (!aiAgent) {
        throw new Error('AI agent not initialized');
      }
      
      const client = await dbService.getClientById(clientId);
      if (!client?.ai_main_state) {
        throw new Error('Client AI main state not found');
      }
      
      const aiPartState = await aiAgent.generateClientAiPartState(clientId, part, client.ai_main_state);
      await dbService.updateClientAiPartState(clientId, part, aiPartState);
      
      return aiPartState;
    } catch (error) {
      console.error('Error generating AI part state:', error);
      return 'שגיאה ביצירת מידע AI לתחום זה';
    }
  });

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
      const appointment = await dbService.getAppointmentById(appointmentId);
      if (!appointment) {
        return false;
      }
      
      const client = await dbService.getClientById(appointment.client_id);
      if (!client || !client.email) {
        return false;
      }

      const settings = await dbService.getSettings();
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
      const campaign = dbService.getCampaignById(campaignId);
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
  dbService.initialize();
  setupIpcHandlers();
  createWindow();
}).then(installExtensions);

//osX only
app.on("window-all-closed", async () => {
  await stopExpressServer();
  dbService.close();
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
  dbService.close();
});
