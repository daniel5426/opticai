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

  // Chat operations
  createChat: (title: string) => Promise<Chat | null>;
  getChatById: (id: number) => Promise<Chat | null>;
  getChatMessages: (chatId: number) => Promise<ChatMessage[]>;
  createChatMessage: (messageData: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<ChatMessage | null>;

  // Email operations
  emailTestConnection: () => Promise<boolean>;
  emailSendTestReminder: (appointmentId: number) => Promise<boolean>;
  emailSchedulerStatus: () => Promise<{ isRunning: boolean; nextRun: string | null }>;
  emailSchedulerRestart: () => Promise<boolean>;

  // Campaign operations
  campaignSchedulerStatus: () => Promise<{ isRunning: boolean; nextRun: string | null }>;
  campaignSchedulerRestart: () => Promise<boolean>;
  campaignExecuteTest: (campaignId: number) => Promise<{ success: boolean; message: string; details?: any }>;
  campaignExecuteFull: (campaignId: number) => Promise<{ success: boolean; message: string; details?: any }>;
  campaignGetTargetClients: (campaignId: number) => Promise<{ success: boolean; clients?: any[]; error?: string }>;
  campaignValidate: (campaignId: number) => Promise<{ success: boolean; validation?: any; error?: string }>;

  // Google OAuth and Calendar operations
  googleOAuthAuthenticate: () => Promise<{
    success?: boolean;
    error?: string;
    tokens?: {
      access_token: string;
      refresh_token: string;
      scope: string;
      token_type: string;
      expiry_date: number;
    };
    userInfo?: {
      email: string;
      name?: string;
      picture?: string;
    };
  }>;
  googleOAuthRefreshToken: (refreshToken: string) => Promise<{
    success?: boolean;
    error?: string;
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    expiry_date?: number;
  }>;
  googleOAuthValidateTokens: (tokens: any) => Promise<boolean>;
  googleCalendarCreateEvent: (tokens: any, appointment: any, client?: any) => Promise<string | null>;
  googleCalendarUpdateEvent: (tokens: any, eventId: string, appointment: any, client?: any) => Promise<boolean>;
  googleCalendarDeleteEvent: (tokens: any, eventId: string) => Promise<boolean>;
  googleCalendarSyncAppointments: (tokens: any, appointments: any[]) => Promise<{ success: number; failed: number }>;
  googleCalendarGetEvents: (tokens: any, startDate: string, endDate: string) => Promise<any[]>;
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
    electronAPI: ElectronAPI;
  }
}

export {}; 