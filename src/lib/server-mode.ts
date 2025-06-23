import express from 'express';
import cors from 'cors';
import { Server } from 'http';

class ElectronServerMode {
  private app: express.Application | null = null;
  private server: Server | null = null;
  private isServerMode: boolean = false;
  private port: number = 3000;

  constructor() {
    this.isServerMode = process.env.SERVER_MODE === 'true' || false;
  }

  async startServer(): Promise<boolean> {
    try {
      const result = await window.electronAPI.startServerMode();
      return result;
    } catch (error) {
      console.error('Failed to start server:', error);
      return false;
    }
  }

  private setupRoutes() {
    if (!this.app) return;

    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'OK', 
        message: 'OpticAI Electron Server is running',
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/server-info', (req, res) => {
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      const addresses: string[] = [];
      
      for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            addresses.push(net.address);
          }
        }
      }
      
      res.json({
        hostname: os.hostname(),
        addresses,
        port: this.port,
        urls: addresses.map(addr => `http://${addr}:${this.port}`)
      });
    });

    this.app.post('/api/auth/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        const user = await window.electronAPI.authenticateUser(username, password);
        
        if (user) {
          const { password: _, ...userWithoutPassword } = user;
          res.json({ success: true, user: userWithoutPassword });
        } else {
          res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
      }
    });

    this.app.get('/api/users', async (req, res) => {
      try {
        const users = await window.electronAPI.getAllUsers();
        const usersWithoutPasswords = users.map(({ password, ...user }: any) => user);
        res.json(usersWithoutPasswords);
      } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
      }
    });

    this.app.post('/api/clients', async (req, res) => {
      try {
        const client = await window.electronAPI.createClient(req.body);
        res.json(client);
      } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({ error: 'Failed to create client' });
      }
    });

    this.app.get('/api/clients', async (req, res) => {
      try {
        const clients = await window.electronAPI.getAllClients();
        res.json(clients);
      } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ error: 'Failed to get clients' });
      }
    });

    this.app.get('/api/clients/:id', async (req, res) => {
      try {
        const client = await window.electronAPI.getClient(parseInt(req.params.id));
        if (client) {
          res.json(client);
        } else {
          res.status(404).json({ error: 'Client not found' });
        }
      } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ error: 'Failed to get client' });
      }
    });

    this.app.put('/api/clients/:id', async (req, res) => {
      try {
        const clientData = { ...req.body, id: parseInt(req.params.id) };
        const client = await window.electronAPI.updateClient(clientData);
        res.json(client);
      } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({ error: 'Failed to update client' });
      }
    });

    this.app.delete('/api/clients/:id', async (req, res) => {
      try {
        const success = await window.electronAPI.deleteClient(parseInt(req.params.id));
        res.json({ success });
      } catch (error) {
        console.error('Delete client error:', error);
        res.status(500).json({ error: 'Failed to delete client' });
      }
    });
  }

  private logNetworkAddresses() {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    
    console.log('\n🌐 Network access URLs:');
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`   http://${net.address}:${this.port}`);
        }
      }
    }
    console.log('\n📋 Share these URLs with other workstations to connect\n');
  }

  async stopServer(): Promise<void> {
    try {
      await window.electronAPI.stopServerMode();
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
  }

  isRunning(): boolean {
    return this.isServerMode;
  }

  setServerMode(enabled: boolean) {
    this.isServerMode = enabled;
    localStorage.setItem('opticai-server-mode', enabled.toString());
  }

  getServerMode(): boolean {
    const saved = localStorage.getItem('opticai-server-mode');
    return saved ? saved === 'true' : this.isServerMode;
  }

  getPort(): number {
    return this.port;
  }

  setPort(port: number) {
    this.port = port;
  }

  async getServerInfo(): Promise<{ hostname: string; addresses: string[]; port: number; urls: string[] } | null> {
    try {
      return await window.electronAPI.getServerInfo();
    } catch (error) {
      console.error('Failed to get server info:', error);
      return null;
    }
  }
}

export const electronServerMode = new ElectronServerMode();
export default electronServerMode; 