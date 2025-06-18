import { contextBridge, ipcRenderer } from 'electron';

// Expose theme functionality
contextBridge.exposeInMainWorld('themeMode', {
  current: () => ipcRenderer.invoke('theme-mode:current'),
  toggle: () => ipcRenderer.invoke('theme-mode:toggle'),
  dark: () => ipcRenderer.invoke('theme-mode:dark'),
  light: () => ipcRenderer.invoke('theme-mode:light'),
  system: () => ipcRenderer.invoke('theme-mode:system'),
});

// Expose window controls
contextBridge.exposeInMainWorld('electronWindow', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
});

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Client operations
  getAllClients: () => ipcRenderer.invoke('db-get-all-clients'),
  getClient: (id: number) => ipcRenderer.invoke('db-get-client', id),
  createClient: (clientData: any) => ipcRenderer.invoke('db-create-client', clientData),
  updateClient: (clientData: any) => ipcRenderer.invoke('db-update-client', clientData),
  deleteClient: (id: number) => ipcRenderer.invoke('db-delete-client', id),

  // Exam operations
  getExamsByClient: (clientId: number) => ipcRenderer.invoke('db-get-exams-by-client', clientId),
  getAllExams: () => ipcRenderer.invoke('db-get-all-exams'),
  getExam: (examId: number) => ipcRenderer.invoke('db-get-exam', examId),
  createExam: (examData: any) => ipcRenderer.invoke('db-create-exam', examData),
  updateExam: (examData: any) => ipcRenderer.invoke('db-update-exam', examData),
  deleteExam: (examId: number) => ipcRenderer.invoke('db-delete-exam', examId),

  // Eye Exam operations
  getEyeExamsByExam: (examId: number) => ipcRenderer.invoke('db-get-eye-exams-by-exam', examId),
  createEyeExam: (eyeExamData: any) => ipcRenderer.invoke('db-create-eye-exam', eyeExamData),
  updateEyeExam: (eyeExamData: any) => ipcRenderer.invoke('db-update-eye-exam', eyeExamData),

  // Order operations
  getOrdersByClient: (clientId: number) => ipcRenderer.invoke('db-get-orders-by-client', clientId),
  getAllOrders: () => ipcRenderer.invoke('db-get-all-orders'),
  getOrder: (orderId: number) => ipcRenderer.invoke('db-get-order', orderId),
  createOrder: (orderData: any) => ipcRenderer.invoke('db-create-order', orderData),
  updateOrder: (orderData: any) => ipcRenderer.invoke('db-update-order', orderData),
  deleteOrder: (orderId: number) => ipcRenderer.invoke('db-delete-order', orderId),

  // Order Eye operations
  getOrderEyesByOrder: (orderId: number) => ipcRenderer.invoke('db-get-order-eyes-by-order', orderId),
  createOrderEye: (orderEyeData: any) => ipcRenderer.invoke('db-create-order-eye', orderEyeData),
  updateOrderEye: (orderEyeData: any) => ipcRenderer.invoke('db-update-order-eye', orderEyeData),

  // Order Lens operations
  getOrderLensByOrder: (orderId: number) => ipcRenderer.invoke('db-get-order-lens-by-order', orderId),
  createOrderLens: (orderLensData: any) => ipcRenderer.invoke('db-create-order-lens', orderLensData),
  updateOrderLens: (orderLensData: any) => ipcRenderer.invoke('db-update-order-lens', orderLensData),

  // Frame operations
  getFrameByOrder: (orderId: number) => ipcRenderer.invoke('db-get-frame-by-order', orderId),
  createFrame: (frameData: any) => ipcRenderer.invoke('db-create-frame', frameData),
  updateFrame: (frameData: any) => ipcRenderer.invoke('db-update-frame', frameData),

  // Order Details operations
  getOrderDetailsByOrder: (orderId: number) => ipcRenderer.invoke('db-get-order-details-by-order', orderId),
  createOrderDetails: (orderDetailsData: any) => ipcRenderer.invoke('db-create-order-details', orderDetailsData),
  updateOrderDetails: (orderDetailsData: any) => ipcRenderer.invoke('db-update-order-details', orderDetailsData),

  // Billing operations
  getBillingByOrder: (orderId: number) => ipcRenderer.invoke('db-get-billing-by-order', orderId),
  getBillingByContactLens: (contactLensId: number) => ipcRenderer.invoke('db-get-billing-by-contact-lens', contactLensId),
  createBilling: (billingData: any) => ipcRenderer.invoke('db-create-billing', billingData),
  updateBilling: (billingData: any) => ipcRenderer.invoke('db-update-billing', billingData),

  // Order Line Item operations
  getOrderLineItemsByBilling: (billingId: number) => ipcRenderer.invoke('db-get-order-line-items-by-billing', billingId),
  createOrderLineItem: (orderLineItemData: any) => ipcRenderer.invoke('db-create-order-line-item', orderLineItemData),
  updateOrderLineItem: (orderLineItemData: any) => ipcRenderer.invoke('db-update-order-line-item', orderLineItemData),
  deleteOrderLineItem: (orderLineItemId: number) => ipcRenderer.invoke('db-delete-order-line-item', orderLineItemId),

  // Medical Log operations
  getMedicalLogsByClient: (clientId: number) => ipcRenderer.invoke('db-get-medical-logs-by-client', clientId),
  createMedicalLog: (logData: any) => ipcRenderer.invoke('db-create-medical-log', logData),
  updateMedicalLog: (logData: any) => ipcRenderer.invoke('db-update-medical-log', logData),
  deleteMedicalLog: (id: number) => ipcRenderer.invoke('db-delete-medical-log', id),

  // Contact Lens operations
  getContactLensesByClient: (clientId: number) => ipcRenderer.invoke('db-get-contact-lenses-by-client', clientId),
  getAllContactLenses: () => ipcRenderer.invoke('db-get-all-contact-lenses'),
  getContactLens: (contactLensId: number) => ipcRenderer.invoke('db-get-contact-lens', contactLensId),
  createContactLens: (contactLensData: any) => ipcRenderer.invoke('db-create-contact-lens', contactLensData),
  updateContactLens: (contactLensData: any) => ipcRenderer.invoke('db-update-contact-lens', contactLensData),
  deleteContactLens: (contactLensId: number) => ipcRenderer.invoke('db-delete-contact-lens', contactLensId),

  // Contact Eye operations
  getContactEyesByContactLens: (contactLensId: number) => ipcRenderer.invoke('db-get-contact-eyes-by-contact-lens', contactLensId),
  createContactEye: (contactEyeData: any) => ipcRenderer.invoke('db-create-contact-eye', contactEyeData),
  updateContactEye: (contactEyeData: any) => ipcRenderer.invoke('db-update-contact-eye', contactEyeData),

  // Contact Lens Order operations
  getContactLensOrderByContactLens: (contactLensId: number) => ipcRenderer.invoke('db-get-contact-lens-order-by-contact-lens', contactLensId),
  createContactLensOrder: (contactLensOrderData: any) => ipcRenderer.invoke('db-create-contact-lens-order', contactLensOrderData),
  updateContactLensOrder: (contactLensOrderData: any) => ipcRenderer.invoke('db-update-contact-lens-order', contactLensOrderData),

  // Referral operations
  getReferralsByClient: (clientId: number) => ipcRenderer.invoke('db-get-referrals-by-client', clientId),
  getAllReferrals: () => ipcRenderer.invoke('db-get-all-referrals'),
  getReferral: (referralId: number) => ipcRenderer.invoke('db-get-referral', referralId),
  createReferral: (referralData: any) => ipcRenderer.invoke('db-create-referral', referralData),
  updateReferral: (referralData: any) => ipcRenderer.invoke('db-update-referral', referralData),
  deleteReferral: (referralId: number) => ipcRenderer.invoke('db-delete-referral', referralId),

  // ReferralEye operations
  getReferralEyesByReferral: (referralId: number) => ipcRenderer.invoke('db-get-referral-eyes-by-referral', referralId),
  createReferralEye: (referralEyeData: any) => ipcRenderer.invoke('db-create-referral-eye', referralEyeData),
  updateReferralEye: (referralEyeData: any) => ipcRenderer.invoke('db-update-referral-eye', referralEyeData),

  // Appointment operations
  getAppointmentsByClient: (clientId: number) => ipcRenderer.invoke('db-get-appointments-by-client', clientId),
  getAllAppointments: () => ipcRenderer.invoke('db-get-all-appointments'),
  getAppointment: (appointmentId: number) => ipcRenderer.invoke('db-get-appointment', appointmentId),
  createAppointment: (appointmentData: any) => ipcRenderer.invoke('db-create-appointment', appointmentData),
  updateAppointment: (appointmentData: any) => ipcRenderer.invoke('db-update-appointment', appointmentData),
  deleteAppointment: (appointmentId: number) => ipcRenderer.invoke('db-delete-appointment', appointmentId),
});
