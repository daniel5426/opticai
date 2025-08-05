/// <reference path="../../types/electron.d.ts" />
import { Client } from "./schema-interface";
import { apiClient } from '../api-client';

export async function getAllClients(clinicId?: number): Promise<Client[]> {
  try {
    const response = await apiClient.getClients(clinicId);
    if (response.error) {
      console.error('Error getting all clients:', response.error);
      return [];
    }
    return response.data as Client[] || [];
  } catch (error) {
    console.error('Error getting all clients:', error);
    return [];
  }
}

export async function getClientById(id: number): Promise<Client | undefined> {
  try {
    const response = await apiClient.getClient(id);
    if (response.error) {
      console.error('Error getting client:', response.error);
      return undefined;
    }
    return response.data || undefined;
  } catch (error) {
    console.error('Error getting client:', error);
    return undefined;
  }
}

export async function createClient(client: Omit<Client, 'id'>): Promise<Client | null> {
  try {
    const response = await apiClient.createClient(client);
    if (response.error) {
      console.error('Error creating client:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating client:', error);
    return null;
  }
}

export async function updateClient(client: Client): Promise<Client | undefined> {
  try {
    if (!client.id) {
      console.error('Error updating client: No client ID provided');
      return undefined;
    }
    const response = await apiClient.updateClient(client.id, client);
    if (response.error) {
      console.error('Error updating client:', response.error);
      return undefined;
    }
    return response.data || undefined;
  } catch (error) {
    console.error('Error updating client:', error);
    return undefined;
  }
}

export async function deleteClient(id: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteClient(id);
    if (response.error) {
      console.error('Error deleting client:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting client:', error);
    return false;
  }
} 