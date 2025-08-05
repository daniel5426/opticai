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
  // Generic DB Operation
  db: (method: string, ...args: any[]) => ipcRenderer.invoke('db-operation', method, ...args),

  // Server Mode operations
  startServerMode: () => ipcRenderer.invoke('start-server-mode'),
  stopServerMode: () => ipcRenderer.invoke('stop-server-mode'),
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),

  // AI Agent operations
  aiInitialize: () => ipcRenderer.invoke('ai-initialize'),
  aiChat: (message: string, conversationHistory: any[]) => ipcRenderer.invoke('ai-chat', message, conversationHistory),
  aiChatStream: (message: string, conversationHistory: any[]) => ipcRenderer.invoke('ai-chat-stream', message, conversationHistory),
  aiExecuteAction: (action: string, data: any) => ipcRenderer.invoke('ai-execute-action', action, data),
  aiGenerateMainState: (clientId: number) => ipcRenderer.invoke('ai-generate-main-state', clientId),
  aiGeneratePartState: (clientId: number, part: string) => ipcRenderer.invoke('ai-generate-part-state', clientId, part),
  aiGenerateAllStates: (clientId: number) => ipcRenderer.invoke('ai-generate-all-states', clientId),
  createCampaignFromPrompt: (prompt: string) => ipcRenderer.invoke('ai-create-campaign-from-prompt', prompt),
  
  // AI Stream listeners
  onAiStreamChunk: (callback: (data: { chunk: string; fullMessage: string }) => void) => {
    ipcRenderer.on('ai-chat-stream-chunk', (_, data) => callback(data));
  },
  onAiStreamComplete: (callback: (data: { message: string }) => void) => {
    ipcRenderer.on('ai-chat-stream-complete', (_, data) => callback(data));
  },
  onAiStreamError: (callback: (data: { error: string }) => void) => {
    ipcRenderer.on('ai-chat-stream-error', (_, data) => callback(data));
  },
  removeAiStreamListeners: () => {
    ipcRenderer.removeAllListeners('ai-chat-stream-chunk');
    ipcRenderer.removeAllListeners('ai-chat-stream-complete');
    ipcRenderer.removeAllListeners('ai-chat-stream-error');
  },

  // Chat operations - These are now handled by the API backend
  createChat: (title: string) => ipcRenderer.invoke('chat-create', title),
  getChatById: (id: number) => ipcRenderer.invoke('chat-get-by-id', id),
  getChatMessages: (chatId: number) => ipcRenderer.invoke('chat-get-messages', chatId),
  createChatMessage: (messageData: any) => ipcRenderer.invoke('chat-create-message', messageData),

  // Email operations
  emailTestConnection: () => ipcRenderer.invoke('email-test-connection'),
  emailSendTestReminder: (appointmentId: number) => ipcRenderer.invoke('email-send-test-reminder', appointmentId),
  emailSchedulerStatus: () => ipcRenderer.invoke('email-scheduler-status'),
  emailSchedulerRestart: () => ipcRenderer.invoke('email-scheduler-restart'),

  // Campaign operations
  campaignSchedulerStatus: () => ipcRenderer.invoke('campaign-scheduler-status'),
  campaignSchedulerRestart: () => ipcRenderer.invoke('campaign-scheduler-restart'),
  campaignExecuteTest: (campaignId: number) => ipcRenderer.invoke('campaign-execute-test', campaignId),
  campaignExecuteFull: (campaignId: number) => ipcRenderer.invoke('campaign-execute-full', campaignId),
  campaignGetTargetClients: (campaignId: number) => ipcRenderer.invoke('campaign-get-target-clients', campaignId),
  campaignValidate: (campaignId: number) => ipcRenderer.invoke('campaign-validate', campaignId),

  // Google OAuth and Calendar operations
  googleOAuthAuthenticate: () => ipcRenderer.invoke('google-oauth-authenticate'),
  googleOAuthRefreshToken: (refreshToken: string) => ipcRenderer.invoke('google-oauth-refresh-token', refreshToken),
  googleOAuthValidateTokens: (tokens: any) => ipcRenderer.invoke('google-oauth-validate-tokens', tokens),
  googleCalendarCreateEvent: (tokens: any, appointment: any, client?: any) => ipcRenderer.invoke('google-calendar-create-event', tokens, appointment, client),
  googleCalendarUpdateEvent: (tokens: any, eventId: string, appointment: any, client?: any) => ipcRenderer.invoke('google-calendar-update-event', tokens, eventId, appointment, client),
  googleCalendarDeleteEvent: (tokens: any, eventId: string) => ipcRenderer.invoke('google-calendar-delete-event', tokens, eventId),
  googleCalendarSyncAppointments: (tokens: any, appointments: any[]) => ipcRenderer.invoke('google-calendar-sync-appointments', tokens, appointments),
  googleCalendarGetEvents: (tokens: any, startDate: string, endDate: string) => ipcRenderer.invoke('google-calendar-get-events', tokens, startDate, endDate),

  // Client operations
  getClients: () => ipcRenderer.invoke('db-get-clients'),
});
