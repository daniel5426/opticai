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

  // Email operations
  emailTestConnection: () => ipcRenderer.invoke('email-test-connection'),
  emailSendTestReminder: (appointmentId: number) => ipcRenderer.invoke('email-send-test-reminder', appointmentId),
  emailSchedulerStatus: () => ipcRenderer.invoke('email-scheduler-status'),
  emailSchedulerRestart: () => ipcRenderer.invoke('email-scheduler-restart'),

  // Client operations
  getClients: () => ipcRenderer.invoke('db-get-clients'),
});
