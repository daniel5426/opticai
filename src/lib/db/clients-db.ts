/// <reference path="../../types/electron.d.ts" />
import { Client } from "./schema";

// Function to get all clients
export async function getAllClients(): Promise<Client[]> {
  try {
    return await window.electronAPI.getAllClients();
  } catch (error) {
    console.error('Error getting all clients:', error);
    return [];
  }
}

// Function to get a client by ID
export async function getClientById(id: number): Promise<Client | undefined> {
  try {
    return await window.electronAPI.getClient(id);
  } catch (error) {
    console.error('Error getting client:', error);
    return undefined;
  }
}

// In a real app, we would add functions to create, update, and delete clients
// These would interact with the actual database
export async function createClient(client: Omit<Client, 'id'>): Promise<Client | null> {
  try {
    return await window.electronAPI.createClient(client);
  } catch (error) {
    console.error('Error creating client:', error);
    return null;
  }
}

export async function updateClient(client: Client): Promise<Client | undefined> {
  try {
    return await window.electronAPI.updateClient(client);
  } catch (error) {
    console.error('Error updating client:', error);
    return undefined;
  }
}

export async function deleteClient(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteClient(id);
  } catch (error) {
    console.error('Error deleting client:', error);
    return false;
  }
} 