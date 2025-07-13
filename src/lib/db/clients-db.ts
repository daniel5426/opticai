/// <reference path="../../types/electron.d.ts" />
import { Client } from "./schema";
import { connectionManager } from './connection-manager';

export async function getAllClients(): Promise<Client[]> {
  try {
    return await connectionManager.getAllClients();
  } catch (error) {
    console.error('Error getting all clients:', error);
    return [];
  }
}

export async function getClientById(id: number): Promise<Client | undefined> {
  try {
    const client = await connectionManager.getClientById(id);
    return client || undefined;
  } catch (error) {
    console.error('Error getting client:', error);
    return undefined;
  }
}

export async function createClient(client: Omit<Client, 'id'>): Promise<Client | null> {
  try {
    return await connectionManager.createClient(client);
  } catch (error) {
    console.error('Error creating client:', error);
    return null;
  }
}

export async function updateClient(client: Client): Promise<Client | undefined> {
  try {
    const updated = await connectionManager.updateClient(client);
    if (updated && client.id) {
      await connectionManager.updateClientUpdatedDate(client.id);
    }
    return updated || undefined;
  } catch (error) {
    console.error('Error updating client:', error);
    return undefined;
  }
}

export async function deleteClient(id: number): Promise<boolean> {
  try {
    return await connectionManager.deleteClient(id);
  } catch (error) {
    console.error('Error deleting client:', error);
    return false;
  }
} 