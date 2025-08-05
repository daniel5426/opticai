import { httpClient } from './http-client';
import { ElectronAPI } from '../../types/electron';
import { dbService } from './index';

type DBServiceType = typeof dbService;

export type ConnectionMode = 'local' | 'remote';

class ConnectionManager {
  private mode: ConnectionMode = 'local';
  private serverUrl: string | null = null;
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    let savedMode: ConnectionMode = 'local';
    let savedServerUrl: string | null = null;
    if (typeof localStorage !== 'undefined') {
      savedMode = localStorage.getItem('opticai-connection-mode') as ConnectionMode;
      savedServerUrl = localStorage.getItem('opticai-server-url');
    }

    if (savedMode === 'remote' && savedServerUrl) {
      this.serverUrl = savedServerUrl;
      httpClient.setServerUrl(savedServerUrl);
      
      const isConnected = await httpClient.testConnection();
      if (isConnected) {
        this.mode = 'remote';
        console.log('✅ Connected to remote server:', savedServerUrl);
      } else {
        console.log('❌ Remote server not reachable, falling back to local mode');
        this.mode = 'local';
      }
    }

    this.isInitialized = true;
  }

  async setRemoteMode(serverUrl: string): Promise<boolean> {
    httpClient.setServerUrl(serverUrl);
    
    const isConnected = await httpClient.testConnection();
    if (isConnected) {
      this.mode = 'remote';
      this.serverUrl = serverUrl;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('opticai-connection-mode', 'remote');
        localStorage.setItem('opticai-server-url', serverUrl);
      }
      console.log('✅ Switched to remote mode:', serverUrl);
      return true;
    } else {
      console.log('❌ Failed to connect to server:', serverUrl);
      return false;
    }
  }

  setLocalMode(): void {
    this.mode = 'local';
    this.serverUrl = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('opticai-connection-mode', 'local');
      localStorage.removeItem('opticai-server-url');
    }
    console.log('✅ Switched to local mode');
  }

  getMode(): ConnectionMode {
    return this.mode;
  }

  getServerUrl(): string | null {
    return this.serverUrl;
  }

  isRemoteMode(): boolean {
    return this.mode === 'remote';
  }

  isLocalMode(): boolean {
    return this.mode === 'local';
  }

  async scanForServers(): Promise<string[]> {
    return httpClient.scanForServers();
  }

  async testConnection(url?: string): Promise<boolean> {
    if (url) {
      const tempClient = new (httpClient.constructor as any)(url);
      return tempClient.testConnection();
    }
    
    if (this.mode === 'remote') {
      return httpClient.testConnection();
    }
    
    return true;
  }

  protected async execute<T>(
    operationName: keyof ElectronAPI | keyof typeof httpClient,
    ...args: any[]
  ): Promise<T> {
    await this.initialize();
    
    if (this.mode === 'local') {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }
      return window.electronAPI.db(operationName as string, ...args);
    } else {
      if (!this.serverUrl) {
        throw new Error('No server URL configured');
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof httpClient[operationName] === 'function') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return httpClient[operationName](...args);
      }
      throw new Error(`Remote operation ${String(operationName)} not found`);
    }
  }

  async authenticateUser(username: string, password?: string): Promise<any> {
    if (this.isRemoteMode()) {
      return httpClient.authenticateUser(username, password);
  }
    // For local mode, authentication is handled by a specific IPC call, not the generic DB one.
    return window.electronAPI.db('authenticateUser', username, password);
  }

  getConnectionStatus(): {
    mode: ConnectionMode;
    serverUrl: string | null;
    isConnected: boolean;
  } {
    return {
      mode: this.mode,
      serverUrl: this.serverUrl,
      isConnected: this.mode === 'local' || !!this.serverUrl
    };
  }
}

class DynamicConnectionManager extends ConnectionManager {
  constructor() {
    super();
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        // Dynamically create a method that calls through execute
        return (...args: any[]) => {
          return this.execute(prop as any, ...args);
        };
      }
    });
  }
}

export const connectionManager: DynamicConnectionManager & DBServiceType = new DynamicConnectionManager() as any;
export default connectionManager; 