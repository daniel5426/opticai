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

const inDevelopment = process.env.NODE_ENV === "development";
let mainWindow: BrowserWindow | null = null; // Store reference to the main window

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
app.on("window-all-closed", () => {
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

app.on("before-quit", () => {
  dbService.close();
});
