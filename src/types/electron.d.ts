import { 
  Client, 
  OpticalExam, 
  OldRefractionExam, 
  ObjectiveExam, 
  SubjectiveExam, 
  AdditionExam, 
  FinalSubjectiveExam,
  RetinoscopExam,
  RetinoscopDilationExam, 
  UncorrectedVAExam,
  KeratometerExam,
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
  // Generic DB Operation
  db: (method: string, ...args: any[]) => Promise<any>;

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

  // Email operations
  emailTestConnection: () => Promise<boolean>;
  emailSendTestReminder: (appointmentId: number) => Promise<boolean>;
  emailSchedulerStatus: () => Promise<{ isRunning: boolean; nextRun: string | null }>;
  emailSchedulerRestart: () => Promise<boolean>;
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
    electronAPI: ElectronAPI;
  }
}

export {}; 