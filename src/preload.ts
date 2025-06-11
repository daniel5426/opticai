import { contextBridge, ipcRenderer } from 'electron';

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
});
