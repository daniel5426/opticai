/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
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
  // Client operations
  ipcMain.handle('db-get-all-clients', async () => {
    try {
      return dbService.getAllClients();
    } catch (error) {
      console.error('Error getting all clients:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-client', async (event, id: number) => {
    try {
      return dbService.getClientById(id);
    } catch (error) {
      console.error('Error getting client:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-client', async (event, clientData) => {
    try {
      return dbService.createClient(clientData);
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-client', async (event, clientData) => {
    try {
      return dbService.updateClient(clientData);
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-client', async (event, id: number) => {
    try {
      return dbService.deleteClient(id);
    } catch (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  });

  // Exam operations
  ipcMain.handle('db-get-exams-by-client', async (event, clientId: number) => {
    try {
      console.log(`Getting exams for client ${clientId}`);
      const exams = dbService.getExamsByClientId(clientId);
      console.log(`Found ${exams.length} exams`);
      return exams;
    } catch (error) {
      console.error('Error in get-exams-by-client:', error);
      return [];
    }
  });

  ipcMain.handle('db-get-all-exams', async () => {
    try {
      console.log('Getting all exams');
      const exams = dbService.getAllExams();
      console.log(`Found ${exams.length} exams`);
      return exams;
    } catch (error) {
      console.error('Error in get-all-exams:', error);
      return [];
    }
  });

  ipcMain.handle('db-get-exam', async (event, examId: number) => {
    try {
      return dbService.getExamById(examId);
    } catch (error) {
      console.error('Error getting exam:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-exam', async (event, examData) => {
    try {
      return dbService.createExam(examData);
    } catch (error) {
      console.error('Error creating exam:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-exam', async (event, examData) => {
    try {
      return dbService.updateExam(examData);
    } catch (error) {
      console.error('Error updating exam:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-exam', async (event, examId: number) => {
    try {
      return dbService.deleteExam(examId);
    } catch (error) {
      console.error('Error deleting exam:', error);
      throw error;
    }
  });

  // Eye Exam operations
  ipcMain.handle('db-get-eye-exams-by-exam', async (event, examId: number) => {
    try {
      return dbService.getEyeExamsByExamId(examId);
    } catch (error) {
      console.error('Error getting eye exams:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-eye-exam', async (event, eyeExamData) => {
    try {
      return dbService.createEyeExam(eyeExamData);
    } catch (error) {
      console.error('Error creating eye exam:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-eye-exam', async (event, eyeExamData) => {
    try {
      return dbService.updateEyeExam(eyeExamData);
    } catch (error) {
      console.error('Error updating eye exam:', error);
      throw error;
    }
  });

  // Order operations
  ipcMain.handle('db-get-orders-by-client', async (event, clientId: number) => {
    try {
      return dbService.getOrdersByClientId(clientId);
    } catch (error) {
      console.error('Error getting orders by client:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-order', async (event, orderId: number) => {
    try {
      return dbService.getOrderById(orderId);
    } catch (error) {
      console.error('Error getting order:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-order', async (event, orderData) => {
    try {
      return dbService.createOrder(orderData);
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-order', async (event, orderData) => {
    try {
      return dbService.updateOrder(orderData);
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-order', async (event, orderId: number) => {
    try {
      return dbService.deleteOrder(orderId);
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  });

  // Order Eye operations
  ipcMain.handle('db-get-order-eyes-by-order', async (event, orderId: number) => {
    try {
      return dbService.getOrderEyesByOrderId(orderId);
    } catch (error) {
      console.error('Error getting order eyes:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-order-eye', async (event, orderEyeData) => {
    try {
      return dbService.createOrderEye(orderEyeData);
    } catch (error) {
      console.error('Error creating order eye:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-order-eye', async (event, orderEyeData) => {
    try {
      return dbService.updateOrderEye(orderEyeData);
    } catch (error) {
      console.error('Error updating order eye:', error);
      throw error;
    }
  });

  // Order Lens operations
  ipcMain.handle('db-get-order-lens-by-order', async (event, orderId: number) => {
    try {
      return dbService.getOrderLensByOrderId(orderId);
    } catch (error) {
      console.error('Error getting order lens:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-order-lens', async (event, orderLensData) => {
    try {
      return dbService.createOrderLens(orderLensData);
    } catch (error) {
      console.error('Error creating order lens:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-order-lens', async (event, orderLensData) => {
    try {
      return dbService.updateOrderLens(orderLensData);
    } catch (error) {
      console.error('Error updating order lens:', error);
      throw error;
    }
  });

  // Frame operations
  ipcMain.handle('db-get-frame-by-order', async (event, orderId: number) => {
    try {
      return dbService.getFrameByOrderId(orderId);
    } catch (error) {
      console.error('Error getting frame:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-frame', async (event, frameData) => {
    try {
      return dbService.createFrame(frameData);
    } catch (error) {
      console.error('Error creating frame:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-frame', async (event, frameData) => {
    try {
      return dbService.updateFrame(frameData);
    } catch (error) {
      console.error('Error updating frame:', error);
      throw error;
    }
  });

  // Order Details operations
  ipcMain.handle('db-get-order-details-by-order', async (event, orderId: number) => {
    try {
      return dbService.getOrderDetailsByOrderId(orderId);
    } catch (error) {
      console.error('Error getting order details:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-order-details', async (event, orderDetailsData) => {
    try {
      return dbService.createOrderDetails(orderDetailsData);
    } catch (error) {
      console.error('Error creating order details:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-order-details', async (event, orderDetailsData) => {
    try {
      return dbService.updateOrderDetails(orderDetailsData);
    } catch (error) {
      console.error('Error updating order details:', error);
      throw error;
    }
  });

  // Billing operations
  ipcMain.handle('db-get-billing-by-order', async (event, orderId: number) => {
    try {
      return dbService.getBillingByOrderId(orderId);
    } catch (error) {
      console.error('Error getting billing by order:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-billing-by-contact-lens', async (event, contactLensId: number) => {
    try {
      return dbService.getBillingByContactLensId(contactLensId);
    } catch (error) {
      console.error('Error getting billing by contact lens:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-billing', async (event, billingData) => {
    try {
      return dbService.createBilling(billingData);
    } catch (error) {
      console.error('Error creating billing:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-billing', async (event, billingData) => {
    try {
      return dbService.updateBilling(billingData);
    } catch (error) {
      console.error('Error updating billing:', error);
      throw error;
    }
  });

  // Order Line Item operations
  ipcMain.handle('db-get-order-line-items-by-billing', async (event, billingId: number) => {
    try {
      return dbService.getOrderLineItemsByBillingId(billingId);
    } catch (error) {
      console.error('Error getting order line items by billing:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-order-line-item', async (event, orderLineItemData) => {
    try {
      return dbService.createOrderLineItem(orderLineItemData);
    } catch (error) {
      console.error('Error creating order line item:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-order-line-item', async (event, orderLineItemData) => {
    try {
      return dbService.updateOrderLineItem(orderLineItemData);
    } catch (error) {
      console.error('Error updating order line item:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-order-line-item', async (event, orderLineItemId: number) => {
    try {
      return dbService.deleteOrderLineItem(orderLineItemId);
    } catch (error) {
      console.error('Error deleting order line item:', error);
      throw error;
    }
  });

  // Medical Log operations
  ipcMain.handle('db-get-medical-logs-by-client', async (event, clientId: number) => {
    try {
      return dbService.getMedicalLogsByClientId(clientId);
    } catch (error) {
      console.error('Error getting medical logs:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-medical-log', async (event, logData) => {
    try {
      return dbService.createMedicalLog(logData);
    } catch (error) {
      console.error('Error creating medical log:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-medical-log', async (event, id: number) => {
    try {
      return dbService.deleteMedicalLog(id);
    } catch (error) {
      console.error('Error deleting medical log:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-medical-log', async (event, logData) => {
    try {
      return dbService.updateMedicalLog(logData);
    } catch (error) {
      console.error('Error updating medical log:', error);
      throw error;
    }
  });

  // Contact Lens operations
  ipcMain.handle('db-get-contact-lenses-by-client', async (event, clientId: number) => {
    try {
      return dbService.getContactLensesByClientId(clientId);
    } catch (error) {
      console.error('Error getting contact lenses by client:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-all-contact-lenses', async () => {
    try {
      console.log('Getting all contact lenses');
      const contactLenses = dbService.getAllContactLenses();
      console.log(`Found ${contactLenses.length} contact lenses`);
      return contactLenses;
    } catch (error) {
      console.error('Error in get-all-contact-lenses:', error);
      return [];
    }
  });

  ipcMain.handle('db-get-contact-lens', async (event, contactLensId: number) => {
    try {
      return dbService.getContactLensById(contactLensId);
    } catch (error) {
      console.error('Error getting contact lens:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-contact-lens', async (event, contactLensData) => {
    try {
      return dbService.createContactLens(contactLensData);
    } catch (error) {
      console.error('Error creating contact lens:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-contact-lens', async (event, contactLensData) => {
    try {
      return dbService.updateContactLens(contactLensData);
    } catch (error) {
      console.error('Error updating contact lens:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-contact-lens', async (event, contactLensId: number) => {
    try {
      return dbService.deleteContactLens(contactLensId);
    } catch (error) {
      console.error('Error deleting contact lens:', error);
      throw error;
    }
  });

  // Contact Eye operations
  ipcMain.handle('db-get-contact-eyes-by-contact-lens', async (event, contactLensId: number) => {
    try {
      return dbService.getContactEyesByContactLensId(contactLensId);
    } catch (error) {
      console.error('Error getting contact eyes by contact lens:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-contact-eye', async (event, contactEyeData) => {
    try {
      return dbService.createContactEye(contactEyeData);
    } catch (error) {
      console.error('Error creating contact eye:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-contact-eye', async (event, contactEyeData) => {
    try {
      return dbService.updateContactEye(contactEyeData);
    } catch (error) {
      console.error('Error updating contact eye:', error);
      throw error;
    }
  });

  // Contact Lens Order operations
  ipcMain.handle('db-get-contact-lens-order-by-contact-lens', async (event, contactLensId: number) => {
    try {
      return dbService.getContactLensOrderByContactLensId(contactLensId);
    } catch (error) {
      console.error('Error getting contact lens order by contact lens:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-contact-lens-order', async (event, contactLensOrderData) => {
    try {
      return dbService.createContactLensOrder(contactLensOrderData);
    } catch (error) {
      console.error('Error creating contact lens order:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-contact-lens-order', async (event, contactLensOrderData) => {
    try {
      return dbService.updateContactLensOrder(contactLensOrderData);
    } catch (error) {
      console.error('Error updating contact lens order:', error);
      throw error;
    }
  });

  // Referral operations
  ipcMain.handle('db-get-referrals-by-client', async (event, clientId: number) => {
    try {
      return dbService.getReferralsByClientId(clientId);
    } catch (error) {
      console.error('Error getting referrals by client:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-all-referrals', async () => {
    try {
      console.log('Getting all referrals');
      const referrals = dbService.getAllReferrals();
      console.log(`Found ${referrals.length} referrals`);
      return referrals;
    } catch (error) {
      console.error('Error in get-all-referrals:', error);
      return [];
    }
  });

  ipcMain.handle('db-get-referral', async (event, referralId: number) => {
    try {
      return dbService.getReferralById(referralId);
    } catch (error) {
      console.error('Error getting referral:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-referral', async (event, referralData) => {
    try {
      return dbService.createReferral(referralData);
    } catch (error) {
      console.error('Error creating referral:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-referral', async (event, referralData) => {
    try {
      return dbService.updateReferral(referralData);
    } catch (error) {
      console.error('Error updating referral:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-referral', async (event, referralId: number) => {
    try {
      return dbService.deleteReferral(referralId);
    } catch (error) {
      console.error('Error deleting referral:', error);
      throw error;
    }
  });

  // ReferralEye operations
  ipcMain.handle('db-get-referral-eyes-by-referral', async (event, referralId: number) => {
    try {
      return dbService.getReferralEyesByReferralId(referralId);
    } catch (error) {
      console.error('Error getting referral eyes by referral:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-referral-eye', async (event, referralEyeData) => {
    try {
      return dbService.createReferralEye(referralEyeData);
    } catch (error) {
      console.error('Error creating referral eye:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-referral-eye', async (event, referralEyeData) => {
    try {
      return dbService.updateReferralEye(referralEyeData);
    } catch (error) {
      console.error('Error updating referral eye:', error);
      throw error;
    }
  });

  // Appointment operations
  ipcMain.handle('db-get-appointments-by-client', async (event, clientId: number) => {
    try {
      return dbService.getAppointmentsByClientId(clientId);
    } catch (error) {
      console.error('Error getting appointments by client:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-appointment', async (event, appointmentId: number) => {
    try {
      return dbService.getAppointmentById(appointmentId);
    } catch (error) {
      console.error('Error getting appointment:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-appointment', async (event, appointmentData) => {
    try {
      return dbService.createAppointment(appointmentData);
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-appointment', async (event, appointmentData) => {
    try {
      return dbService.updateAppointment(appointmentData);
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-appointment', async (event, appointmentId: number) => {
    try {
      return dbService.deleteAppointment(appointmentId);
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-all-appointments', async () => {
    try {
      console.log('Getting all appointments');
      const appointments = dbService.getAllAppointments();
      console.log(`Found ${appointments.length} appointments`);
      return appointments;
    } catch (error) {
      console.error('Error in get-all-appointments:', error);
      return [];
    }
  });

  ipcMain.handle('db-get-all-orders', async () => {
    try {
      console.log('Getting all orders');
      const orders = dbService.getAllOrders();
      console.log(`Found ${orders.length} orders`);
      return orders;
    } catch (error) {
      console.error('Error in get-all-orders:', error);
      return [];
    }
  });

  // Settings operations
  ipcMain.handle('db-get-settings', async () => {
    try {
      return dbService.getSettings();
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-settings', async (event, settingsData) => {
    try {
      return dbService.updateSettings(settingsData);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  });

  // User operations
  ipcMain.handle('db-get-all-users', async () => {
    try {
      return dbService.getAllUsers();
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-user', async (event, userId: number) => {
    try {
      return dbService.getUserById(userId);
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-user-by-username', async (event, username: string) => {
    try {
      return dbService.getUserByUsername(username);
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  });

  ipcMain.handle('db-create-user', async (event, userData) => {
    try {
      return dbService.createUser(userData);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-user', async (event, userData) => {
    try {
      return dbService.updateUser(userData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-user', async (event, userId: number) => {
    try {
      return dbService.deleteUser(userId);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  });

  ipcMain.handle('db-authenticate-user', async (event, username: string, password?: string) => {
    try {
      return dbService.authenticateUser(username, password);
    } catch (error) {
      console.error('Error authenticating user:', error);
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

  // Chat operations
  ipcMain.handle('db-create-chat', async (event, title: string) => {
    try {
      return dbService.createChat(title);
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-chat', async (event, chatId: number) => {
    try {
      return dbService.getChatById(chatId);
    } catch (error) {
      console.error('Error getting chat:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-all-chats', async () => {
    try {
      return dbService.getAllChats();
    } catch (error) {
      console.error('Error getting all chats:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-chat', async (event, chatData) => {
    try {
      return dbService.updateChat(chatData);
    } catch (error) {
      console.error('Error updating chat:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-chat', async (event, chatId: number) => {
    try {
      return dbService.deleteChat(chatId);
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  });

  // Chat Message operations
  ipcMain.handle('db-create-chat-message', async (event, chatMessageData) => {
    try {
      return dbService.createChatMessage(chatMessageData);
    } catch (error) {
      console.error('Error creating chat message:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-chat-messages', async (event, chatId: number) => {
    try {
      return dbService.getChatMessagesByChatId(chatId);
    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update-chat-message', async (event, chatMessageData) => {
    try {
      return dbService.updateChatMessage(chatMessageData);
    } catch (error) {
      console.error('Error updating chat message:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete-chat-message', async (event, chatMessageId: number) => {
    try {
      return dbService.deleteChatMessage(chatMessageId);
    } catch (error) {
      console.error('Error deleting chat message:', error);
      throw error;
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

  // Email Log operations
  ipcMain.handle('db-get-email-logs', async (event, appointmentId: number) => {
    try {
      return dbService.getEmailLogsByAppointment(appointmentId);
    } catch (error) {
      console.error('Error getting email logs:', error);
      throw error;
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
