interface IpcRenderer {
  invoke(channel: string, ...args: any[]): Promise<any>;
}

export interface ElectronAPI {
  // Client operations
  getAllClients: () => Promise<any[]>;
  getClient: (id: number) => Promise<any>;
  createClient: (clientData: any) => Promise<any>;
  updateClient: (clientData: any) => Promise<any>;
  deleteClient: (id: number) => Promise<boolean>;

  // Exam operations
  getExamsByClient: (clientId: number) => Promise<any[]>;
  getExam: (examId: number) => Promise<any>;
  createExam: (examData: any) => Promise<any>;
  updateExam: (examData: any) => Promise<any>;
  deleteExam: (examId: number) => Promise<boolean>;

  // Eye Exam operations
  getEyeExamsByExam: (examId: number) => Promise<any[]>;
  createEyeExam: (eyeExamData: any) => Promise<any>;
  updateEyeExam: (eyeExamData: any) => Promise<any>;

  // Order operations
  getOrdersByClient: (clientId: number) => Promise<any[]>;
  getOrder: (orderId: number) => Promise<any>;
  createOrder: (orderData: any) => Promise<any>;
  updateOrder: (orderData: any) => Promise<any>;
  deleteOrder: (orderId: number) => Promise<boolean>;

  // Order Eye operations
  getOrderEyesByOrder: (orderId: number) => Promise<any[]>;
  createOrderEye: (orderEyeData: any) => Promise<any>;
  updateOrderEye: (orderEyeData: any) => Promise<any>;

  // Order Lens operations
  getOrderLensByOrder: (orderId: number) => Promise<any>;
  createOrderLens: (orderLensData: any) => Promise<any>;
  updateOrderLens: (orderLensData: any) => Promise<any>;

  // Frame operations
  getFrameByOrder: (orderId: number) => Promise<any>;
  createFrame: (frameData: any) => Promise<any>;
  updateFrame: (frameData: any) => Promise<any>;

  // Order Details operations
  getOrderDetailsByOrder: (orderId: number) => Promise<any>;
  createOrderDetails: (orderDetailsData: any) => Promise<any>;
  updateOrderDetails: (orderDetailsData: any) => Promise<any>;

  // Billing operations
  getBillingByOrder: (orderId: number) => Promise<any>;
  getBillingByContactLens: (contactLensId: number) => Promise<any>;
  createBilling: (billingData: any) => Promise<any>;
  updateBilling: (billingData: any) => Promise<any>;

  // Order Line Item operations
  getOrderLineItemsByBilling: (billingId: number) => Promise<any[]>;
  createOrderLineItem: (orderLineItemData: any) => Promise<any>;
  updateOrderLineItem: (orderLineItemData: any) => Promise<any>;
  deleteOrderLineItem: (orderLineItemId: number) => Promise<boolean>;

  // Medical Log operations
  getMedicalLogsByClient: (clientId: number) => Promise<any[]>;
  createMedicalLog: (logData: any) => Promise<any>;
  updateMedicalLog: (logData: any) => Promise<any>;
  deleteMedicalLog: (id: number) => Promise<boolean>;

  // Contact Lens operations
  getContactLensesByClient: (clientId: number) => Promise<any[]>;
  getContactLens: (contactLensId: number) => Promise<any>;
  createContactLens: (contactLensData: any) => Promise<any>;
  updateContactLens: (contactLensData: any) => Promise<any>;
  deleteContactLens: (contactLensId: number) => Promise<boolean>;

  // Contact Eye operations
  getContactEyesByContactLens: (contactLensId: number) => Promise<any[]>;
  createContactEye: (contactEyeData: any) => Promise<any>;
  updateContactEye: (contactEyeData: any) => Promise<any>;

  // Contact Lens Order operations
  getContactLensOrderByContactLens: (contactLensId: number) => Promise<any>;
  createContactLensOrder: (contactLensOrderData: any) => Promise<any>;
  updateContactLensOrder: (contactLensOrderData: any) => Promise<any>;

  // Referral operations
  getReferralsByClient: (clientId: number) => Promise<any[]>;
  getReferral: (referralId: number) => Promise<any>;
  createReferral: (referralData: any) => Promise<any>;
  updateReferral: (referralData: any) => Promise<any>;
  deleteReferral: (referralId: number) => Promise<boolean>;

  // ReferralEye operations
  getReferralEyesByReferral: (referralId: number) => Promise<any[]>;
  createReferralEye: (referralEyeData: any) => Promise<any>;
  updateReferralEye: (referralEyeData: any) => Promise<any>;
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
    electronAPI: ElectronAPI;
  }
}

export {}; 