import { httpClient } from './http-client';

export type ConnectionMode = 'local' | 'remote';

class ConnectionManager {
  private mode: ConnectionMode = 'local';
  private serverUrl: string | null = null;
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const savedMode = localStorage.getItem('opticai-connection-mode') as ConnectionMode;
    const savedServerUrl = localStorage.getItem('opticai-server-url');

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
      localStorage.setItem('opticai-connection-mode', 'remote');
      localStorage.setItem('opticai-server-url', serverUrl);
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
    localStorage.setItem('opticai-connection-mode', 'local');
    localStorage.removeItem('opticai-server-url');
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

  private async executeLocal<T>(operation: () => Promise<T>): Promise<T> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return operation();
  }

  private async executeRemote<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.serverUrl) {
      throw new Error('No server URL configured');
    }
    return operation();
  }

  async execute<T>(
    localOperation: () => Promise<T>,
    remoteOperation: () => Promise<T>
  ): Promise<T> {
    await this.initialize();
    
    if (this.mode === 'local') {
      return this.executeLocal(localOperation);
    } else {
      return this.executeRemote(remoteOperation);
    }
  }

  async authenticateUser(username: string, password?: string): Promise<any> {
    return this.execute(
      () => window.electronAPI.authenticateUser(username, password),
      () => httpClient.authenticateUser(username, password)
    );
  }

  async getAllUsers(): Promise<any[]> {
    return this.execute(
      () => window.electronAPI.getAllUsers(),
      () => httpClient.getAllUsers()
    );
  }

  async createClient(client: any): Promise<any> {
    return this.execute(
      () => window.electronAPI.createClient(client),
      () => httpClient.createClient(client)
    );
  }

  async getAllClients(): Promise<any[]> {
    return this.execute(
      () => window.electronAPI.getAllClients(),
      () => httpClient.getAllClients()
    );
  }

  async getClientById(id: number): Promise<any> {
    return this.execute(
      () => window.electronAPI.getClient(id),
      () => httpClient.getClientById(id)
    );
  }

  async updateClient(client: any): Promise<any> {
    return this.execute(
      () => window.electronAPI.updateClient(client),
      () => httpClient.updateClient(client)
    );
  }

  async deleteClient(id: number): Promise<boolean> {
    return this.execute(
      () => window.electronAPI.deleteClient(id),
      async () => {
        const result = await httpClient.deleteClient(id);
        return result.success;
      }
    );
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

export const connectionManager = new ConnectionManager();
export default connectionManager; 