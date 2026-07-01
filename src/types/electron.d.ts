import { 
  Chat, 
  ChatMessage, 
} from '@/lib/db/schema-interface';

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
  aiGenerateMainState: (clientId: number) => Promise<string>;
  aiGeneratePartState: (clientId: number, part: string) => Promise<string>;
  aiGenerateAllStates: (clientId: number) => Promise<void>;
  
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
  emailTestConnection: (clinicId?: number) => Promise<boolean>;
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
  createCampaignFromPrompt: (prompt: string) => Promise<{ success: boolean; data?: any; error?: string; message?: string }>;

  // Google OAuth and Calendar operations
  googleOAuthAuthenticate: () => Promise<{
    success?: boolean;
    error?: string;
    tokens?: {
      access_token: string;
      refresh_token: string;
      id_token?: string;
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
  googleOAuthCancel: () => Promise<boolean>;
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

  // Update operations
  checkForUpdates: () => Promise<{ available: boolean; version?: string; currentVersion?: string; error?: string; message?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  openUpdateDownloadPage: () => Promise<{ success: boolean; error?: string; url?: string }>;
  getAppVersion: () => Promise<string>;
  openExternalAuthUrl: (url: string) => Promise<boolean>;
  openUrlInChrome: (url: string) => Promise<boolean>;
  softOpticScan: () => Promise<{
    supported: boolean;
    candidates: Array<{
      id: string;
      kind: "dsn" | "db-file";
      label: string;
      dsn?: string;
      dbFile?: string;
      logFile?: string;
      documentPath?: string;
      sizeBytes?: number;
      modifiedAt?: string;
      score: number;
      recommended: boolean;
      reasons: string[];
    }>;
    error?: string;
  }>;
  softOpticExport: (payload: {
    candidate: any;
    sqlAnywhereBin?: string;
    includeDocuments?: boolean;
  }) => Promise<{
    success: boolean;
    outputDir?: string;
    zipPath?: string;
    summary?: Record<string, any>;
    error?: string;
  }>;
  softOpticStartExport: (payload: {
    clinicId?: number;
    candidate: any;
    sqlAnywhereBin?: string;
    includeDocuments?: boolean;
  }) => Promise<{
    success: boolean;
    jobId?: string;
    status?: Record<string, any>;
    error?: string;
  }>;
  softOpticExportStatus: (payload: {
    jobId: string;
  }) => Promise<Record<string, any> | null>;
  softOpticUploadBundle: (payload: {
    apiBaseUrl: string;
    jobId: string;
    zipPath: string;
    accessToken: string;
  }) => Promise<{ success: boolean; data?: any; error?: string }>;
  softOpticUploadStatus: (payload: {
    jobId: string;
  }) => Promise<Record<string, any> | null>;
  exportHtmlToPdf: (payload: {
    html: string;
    defaultFileName: string;
  }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
  printHtml: (payload: {
    html: string;
    defaultFileName?: string;
  }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  onUserLogoutBeforeClose: (callback: () => Promise<void> | void) => () => void;
  onAuthCallbackUrl: (callback: (url: string) => void) => () => void;
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
    electronAPI: ElectronAPI;
  }
}

export {}; 
