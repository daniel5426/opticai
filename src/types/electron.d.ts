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

  // Medical Log operations
  getMedicalLogsByClient: (clientId: number) => Promise<any[]>;
  createMedicalLog: (logData: any) => Promise<any>;
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
    electronAPI: ElectronAPI;
  }
}

export {}; 