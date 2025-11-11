import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] Script loading...');

// Expose theme functionality
contextBridge.exposeInMainWorld('themeMode', {
  current: () => ipcRenderer.invoke('theme-mode:current'),
  toggle: () => ipcRenderer.invoke('theme-mode:toggle'),
  dark: () => ipcRenderer.invoke('theme-mode:dark'),
  light: () => ipcRenderer.invoke('theme-mode:light'),
  system: () => ipcRenderer.invoke('theme-mode:system'),
});

console.log('[Preload] themeMode exposed to window');

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

  // AI moved to backend; no AI IPC exposed

  // Chat operations - These are now handled by the API backend
  createChat: (title: string) => ipcRenderer.invoke('chat-create', title),
  getChatById: (id: number) => ipcRenderer.invoke('chat-get-by-id', id),
  getChatMessages: (chatId: number) => ipcRenderer.invoke('chat-get-messages', chatId),
  createChatMessage: (messageData: any) => ipcRenderer.invoke('chat-create-message', messageData),

  // Email operations
  emailTestConnection: (clinicId?: number) => ipcRenderer.invoke('email-test-connection', clinicId),
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

  // Update operations
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  onDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('download-progress', (_, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners('download-progress');
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
    return () => ipcRenderer.removeAllListeners('update-downloaded');
  },
});
