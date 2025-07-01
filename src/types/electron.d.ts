import { 
  Client, 
  OpticalExam, 
  OldRefractionExam, 
  ObjectiveExam, 
  SubjectiveExam, 
  AdditionExam, 
  FinalSubjectiveExam, 
  Order, 
  OrderEye, 
  OrderLens, 
  Frame, 
  OrderDetails, 
  Billing, 
  OrderLineItem, 
  MedicalLog, 
  ContactLens, 
  ContactEye, 
  ContactLensOrder, 
  Referral, 
  ReferralEye, 
  Appointment, 
  Settings, 
  User, 
  Chat, 
  ChatMessage, 
  EmailLog, 
  File, 
  ExamLayout,
  ExamLayoutInstance,
  LookupSupplier,
  LookupClinic,
  LookupOrderType,
  LookupReferralType,
  LookupLensModel,
  LookupColor,
  LookupMaterial,
  LookupCoating,
  LookupManufacturer,
  LookupFrameModel,
  LookupContactLensType,
  LookupContactEyeLensType,
  LookupContactEyeMaterial,
  LookupCleaningSolution,
  LookupDisinfectionSolution,
  LookupRinsingSolution,
  LookupManufacturingLab,
  LookupAdvisor 
} from '@/lib/db/schema';

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
  getAllExams: () => Promise<any[]>;
  getExam: (examId: number) => Promise<any>;
  createExam: (examData: any) => Promise<any>;
  updateExam: (examData: any) => Promise<any>;
  deleteExam: (examId: number) => Promise<boolean>;

  // Old Refraction Exam operations
  getOldRefractionExam: (examId: number) => Promise<OldRefractionExam | null>;
  getOldRefractionExamByLayoutInstance: (layoutInstanceId: number) => Promise<OldRefractionExam | null>;
  createOldRefractionExam: (examData: any) => Promise<OldRefractionExam | null>;
  updateOldRefractionExam: (examData: any) => Promise<OldRefractionExam | null>;

  // Objective Exam operations
  getObjectiveExam: (examId: number) => Promise<ObjectiveExam | null>;
  getObjectiveExamByLayoutInstance: (layoutInstanceId: number) => Promise<ObjectiveExam | null>;
  createObjectiveExam: (examData: any) => Promise<ObjectiveExam | null>;
  updateObjectiveExam: (examData: any) => Promise<ObjectiveExam | null>;

  // Subjective Exam operations
  getSubjectiveExam: (examId: number) => Promise<SubjectiveExam | null>;
  getSubjectiveExamByLayoutInstance: (layoutInstanceId: number) => Promise<SubjectiveExam | null>;
  createSubjectiveExam: (examData: any) => Promise<SubjectiveExam | null>;
  updateSubjectiveExam: (examData: any) => Promise<SubjectiveExam | null>;

  // Addition Exam operations
  getAdditionExam: (examId: number) => Promise<AdditionExam | null>;
  getAdditionExamByLayoutInstance: (layoutInstanceId: number) => Promise<AdditionExam | null>;
  createAdditionExam: (examData: any) => Promise<AdditionExam | null>;
  updateAdditionExam: (examData: any) => Promise<AdditionExam | null>;

  // Final Subjective Exam operations
  getFinalSubjectiveExam: (examId: number) => Promise<FinalSubjectiveExam | null>;
  getFinalSubjectiveExamByLayoutInstance: (layoutInstanceId: number) => Promise<FinalSubjectiveExam | null>;
  createFinalSubjectiveExam: (examData: any) => Promise<FinalSubjectiveExam | null>;
  updateFinalSubjectiveExam: (examData: any) => Promise<FinalSubjectiveExam | null>;
  deleteFinalSubjectiveExam: (id: number) => Promise<boolean>;

  // Order operations
  getOrdersByClient: (clientId: number) => Promise<any[]>;
  getAllOrders: () => Promise<any[]>;
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
  getAllContactLenses: () => Promise<any[]>;
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
  getAllReferrals: () => Promise<any[]>;
  getReferral: (referralId: number) => Promise<any>;
  createReferral: (referralData: any) => Promise<any>;
  updateReferral: (referralData: any) => Promise<any>;
  deleteReferral: (referralId: number) => Promise<boolean>;

  // ReferralEye operations
  getReferralEyesByReferral: (referralId: number) => Promise<any[]>;
  createReferralEye: (referralEyeData: any) => Promise<any>;
  updateReferralEye: (referralEyeData: any) => Promise<any>;

  // Appointment operations
  getAppointmentsByClient: (clientId: number) => Promise<any[]>;
  getAllAppointments: () => Promise<any[]>;
  getAppointment: (appointmentId: number) => Promise<any>;
  createAppointment: (appointmentData: any) => Promise<any>;
  updateAppointment: (appointmentData: any) => Promise<any>;
  deleteAppointment: (appointmentId: number) => Promise<boolean>;

  // Settings operations
  getSettings: () => Promise<any>;
  updateSettings: (settingsData: any) => Promise<any>;

  // User operations
  getAllUsers: () => Promise<any[]>;
  getUser: (userId: number) => Promise<any>;
  getUserByUsername: (username: string) => Promise<any>;
  createUser: (userData: any) => Promise<any>;
  updateUser: (userData: any) => Promise<any>;
  deleteUser: (userId: number) => Promise<boolean>;
  authenticateUser: (username: string, password?: string) => Promise<any>;

  // File operations
  getFilesByClient: (clientId: number) => Promise<any[]>;
  getAllFiles: () => Promise<any[]>;
  getFile: (fileId: number) => Promise<any>;
  createFile: (fileData: any) => Promise<any>;
  updateFile: (fileData: any) => Promise<any>;
  deleteFile: (fileId: number) => Promise<boolean>;

  // Server Mode operations
  startServerMode: () => Promise<boolean>;
  stopServerMode: () => Promise<void>;
  getServerInfo: () => Promise<{ hostname: string; addresses: string[]; port: number; urls: string[] } | null>;

  // AI Agent operations
  aiInitialize: () => Promise<{ success: boolean; error?: string }>;
  aiChat: (message: string, conversationHistory: any[]) => Promise<{ success: boolean; message: string; data?: any; error?: string }>;
  aiChatStream: (message: string, conversationHistory: any[]) => Promise<{ success: boolean; message: string; data?: any; error?: string }>;
  aiExecuteAction: (action: string, data: any) => Promise<{ success: boolean; message: string; data?: any; error?: string }>;
  
  // AI Stream listeners
  onAiStreamChunk: (callback: (data: { chunk: string; fullMessage: string }) => void) => void;
  onAiStreamComplete: (callback: (data: { message: string }) => void) => void;
  onAiStreamError: (callback: (data: { error: string }) => void) => void;
  removeAiStreamListeners: () => void;

  // Chat operations
  createChat: (title: string) => Promise<any>;
  getChatById: (chatId: number) => Promise<any>;
  getAllChats: () => Promise<any[]>;
  updateChat: (chatData: any) => Promise<any>;
  deleteChat: (chatId: number) => Promise<boolean>;

  // Chat Message operations
  createChatMessage: (chatMessageData: any) => Promise<any>;
  getChatMessages: (chatId: number) => Promise<any[]>;
  updateChatMessage: (chatMessageData: any) => Promise<any>;
  deleteChatMessage: (chatMessageId: number) => Promise<boolean>;

  // Email operations
  emailTestConnection: () => Promise<boolean>;
  emailSendTestReminder: (appointmentId: number) => Promise<boolean>;
  emailSchedulerStatus: () => Promise<{ isRunning: boolean; nextRun: string | null }>;
  emailSchedulerRestart: () => Promise<boolean>;
  emailUpdateConfig: (config: any) => Promise<boolean>;

  // Email Log operations
  getEmailLogsByAppointment: (appointmentId: number) => Promise<any[]>;
  getAllEmailLogs: () => Promise<any[]>;

  // Lookup table operations
  getAllLookupSuppliers: () => Promise<any[]>;
  createLookupSupplier: (data: any) => Promise<any>;
  updateLookupSupplier: (data: any) => Promise<any>;
  deleteLookupSupplier: (id: number) => Promise<boolean>;

  getAllLookupClinics: () => Promise<any[]>;
  createLookupClinic: (data: any) => Promise<any>;
  updateLookupClinic: (data: any) => Promise<any>;
  deleteLookupClinic: (id: number) => Promise<boolean>;

  getAllLookupOrderTypes: () => Promise<any[]>;
  createLookupOrderType: (data: any) => Promise<any>;
  updateLookupOrderType: (data: any) => Promise<any>;
  deleteLookupOrderType: (id: number) => Promise<boolean>;

  getAllLookupReferralTypes: () => Promise<any[]>;
  createLookupReferralType: (data: any) => Promise<any>;
  updateLookupReferralType: (data: any) => Promise<any>;
  deleteLookupReferralType: (id: number) => Promise<boolean>;

  getAllLookupLensModels: () => Promise<any[]>;
  createLookupLensModel: (data: any) => Promise<any>;
  updateLookupLensModel: (data: any) => Promise<any>;
  deleteLookupLensModel: (id: number) => Promise<boolean>;

  getAllLookupColors: () => Promise<any[]>;
  createLookupColor: (data: any) => Promise<any>;
  updateLookupColor: (data: any) => Promise<any>;
  deleteLookupColor: (id: number) => Promise<boolean>;

  getAllLookupMaterials: () => Promise<any[]>;
  createLookupMaterial: (data: any) => Promise<any>;
  updateLookupMaterial: (data: any) => Promise<any>;
  deleteLookupMaterial: (id: number) => Promise<boolean>;

  getAllLookupCoatings: () => Promise<any[]>;
  createLookupCoating: (data: any) => Promise<any>;
  updateLookupCoating: (data: any) => Promise<any>;
  deleteLookupCoating: (id: number) => Promise<boolean>;

  getAllLookupManufacturers: () => Promise<any[]>;
  createLookupManufacturer: (data: any) => Promise<any>;
  updateLookupManufacturer: (data: any) => Promise<any>;
  deleteLookupManufacturer: (id: number) => Promise<boolean>;

  getAllLookupFrameModels: () => Promise<any[]>;
  createLookupFrameModel: (data: any) => Promise<any>;
  updateLookupFrameModel: (data: any) => Promise<any>;
  deleteLookupFrameModel: (id: number) => Promise<boolean>;

  getAllLookupContactLensTypes: () => Promise<any[]>;
  createLookupContactLensType: (data: any) => Promise<any>;
  updateLookupContactLensType: (data: any) => Promise<any>;
  deleteLookupContactLensType: (id: number) => Promise<boolean>;

  getAllLookupContactEyeLensTypes: () => Promise<any[]>;
  createLookupContactEyeLensType: (data: any) => Promise<any>;
  updateLookupContactEyeLensType: (data: any) => Promise<any>;
  deleteLookupContactEyeLensType: (id: number) => Promise<boolean>;

  getAllLookupContactEyeMaterials: () => Promise<any[]>;
  createLookupContactEyeMaterial: (data: any) => Promise<any>;
  updateLookupContactEyeMaterial: (data: any) => Promise<any>;
  deleteLookupContactEyeMaterial: (id: number) => Promise<boolean>;

  getAllLookupCleaningSolutions: () => Promise<any[]>;
  createLookupCleaningSolution: (data: any) => Promise<any>;
  updateLookupCleaningSolution: (data: any) => Promise<any>;
  deleteLookupCleaningSolution: (id: number) => Promise<boolean>;

  getAllLookupDisinfectionSolutions: () => Promise<any[]>;
  createLookupDisinfectionSolution: (data: any) => Promise<any>;
  updateLookupDisinfectionSolution: (data: any) => Promise<any>;
  deleteLookupDisinfectionSolution: (id: number) => Promise<boolean>;

  getAllLookupRinsingSolutions: () => Promise<any[]>;
  createLookupRinsingSolution: (data: any) => Promise<any>;
  updateLookupRinsingSolution: (data: any) => Promise<any>;
  deleteLookupRinsingSolution: (id: number) => Promise<boolean>;

  getAllLookupManufacturingLabs: () => Promise<any[]>;
  createLookupManufacturingLab: (data: any) => Promise<any>;
  updateLookupManufacturingLab: (data: any) => Promise<any>;
  deleteLookupManufacturingLab: (id: number) => Promise<boolean>;

  getAllLookupAdvisors: () => Promise<LookupAdvisor[]>;
  createLookupAdvisor: (data: Omit<LookupAdvisor, 'id'>) => Promise<LookupAdvisor | null>;
  updateLookupAdvisor: (data: LookupAdvisor) => Promise<LookupAdvisor | null>;
  deleteLookupAdvisor: (id: number) => Promise<boolean>;

  // Exam Layout operations
  getAllExamLayouts: () => Promise<ExamLayout[]>;
  getExamLayoutById: (id: number) => Promise<ExamLayout | null>;
  createExamLayout: (layoutData: Omit<ExamLayout, 'id'>) => Promise<ExamLayout | null>;
  updateExamLayout: (layoutData: ExamLayout) => Promise<ExamLayout | null>;
  deleteExamLayout: (id: number) => Promise<boolean>;
  getDefaultExamLayout: () => Promise<ExamLayout | null>;
  getLayoutsByExamId: (examId: number) => Promise<ExamLayout[]>;
  deactivateAllLayoutsForExam: (examId: number) => Promise<boolean>;
  
  // ExamLayoutInstance operations
  getExamLayoutInstanceById: (id: number) => Promise<ExamLayoutInstance | null>;
  getExamLayoutInstancesByExamId: (examId: number) => Promise<ExamLayoutInstance[]>;
  getActiveExamLayoutInstanceByExamId: (examId: number) => Promise<ExamLayoutInstance | null>;
  createExamLayoutInstance: (data: Omit<ExamLayoutInstance, 'id'>) => Promise<ExamLayoutInstance | null>;
  updateExamLayoutInstance: (data: ExamLayoutInstance) => Promise<ExamLayoutInstance | null>;
  deleteExamLayoutInstance: (id: number) => Promise<boolean>;
  setActiveExamLayoutInstance: (examId: number, layoutInstanceId: number) => Promise<boolean>;
  ensureExamHasLayout: (examId: number) => Promise<ExamLayoutInstance | null>;
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
    electronAPI: ElectronAPI;
  }
}

export {}; 