class HttpClient {
  private baseUrl: string;
  
  constructor(serverUrl?: string) {
    this.baseUrl = serverUrl || this.discoverServer() || 'http://localhost:3000';
  }

  private discoverServer(): string | null {
    const savedServer = localStorage.getItem('opticai-server-url');
    if (savedServer) {
      return savedServer;
    }
    return null;
  }

  setServerUrl(url: string) {
    this.baseUrl = url;
    localStorage.setItem('opticai-server-url', url);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, mergedOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; message: string; timestamp: string }> {
    return this.request('/health');
  }

  async getServerInfo(): Promise<{ hostname: string; addresses: string[]; port: number; urls: string[] }> {
    return this.request('/server-info');
  }

  async authenticateUser(username: string, password?: string): Promise<{ success: boolean; user?: any; message?: string }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  async getAllUsers(): Promise<any[]> {
    return this.request('/users');
  }

  async createClient(client: any): Promise<any> {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(client)
    });
  }

  async getAllClients(): Promise<any[]> {
    return this.request('/clients');
  }

  async getClientById(id: number): Promise<any> {
    return this.request(`/clients/${id}`);
  }

  async updateClient(client: any): Promise<any> {
    return this.request(`/clients/${client.id}`, {
      method: 'PUT',
      body: JSON.stringify(client)
    });
  }

  async deleteClient(id: number): Promise<{ success: boolean }> {
    return this.request(`/clients/${id}`, {
      method: 'DELETE'
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  async scanForServers(): Promise<string[]> {
    const servers: string[] = [];
    const timeoutMs = 2000;
    
    const getLocalIPs = (): string[] => {
      const ips: string[] = [];
      const currentIP = window.location.hostname;
      
      if (currentIP && currentIP !== 'localhost' && currentIP !== '127.0.0.1') {
        const parts = currentIP.split('.');
        if (parts.length === 4) {
          const baseIP = parts.slice(0, 3).join('.');
          for (let i = 1; i <= 254; i++) {
            ips.push(`${baseIP}.${i}`);
          }
        }
      }
      
      return ips;
    };

    const testIP = async (ip: string): Promise<string | null> => {
      const url = `http://${ip}:3000`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(`${url}/api/health`, {
          signal: controller.signal,
          mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'OK') {
            return url;
          }
        }
      } catch {
        // Ignore errors for unreachable IPs
      }
      return null;
    };

    const commonIPs = ['192.168.1', '192.168.0', '10.0.0', '172.16.0'];
    const testPromises: Promise<string | null>[] = [];

    for (const baseIP of commonIPs) {
      for (let i = 1; i <= 20; i++) {
        testPromises.push(testIP(`${baseIP}.${i}`));
      }
    }

    const results = await Promise.allSettled(testPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        servers.push(result.value);
      }
    }

    return servers;
  }
}

export const httpClient = new HttpClient();
export default httpClient; 