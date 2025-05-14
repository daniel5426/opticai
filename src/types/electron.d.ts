interface IpcRenderer {
  invoke(channel: string, ...args: any[]): Promise<any>;
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
  }
}

export {}; 