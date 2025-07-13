/// <reference path="../../types/electron.d.ts" />
import { Family, Client } from "./schema";
import { connectionManager } from './connection-manager';

export async function getAllFamilies(): Promise<Family[]> {
  try {
    return await connectionManager.getAllFamilies();
  } catch (error) {
    console.error('Error getting all families:', error);
    return [];
  }
}

export async function getFamilyById(id: number): Promise<Family | undefined> {
  try {
    const family = await connectionManager.getFamilyById(id);
    return family || undefined;
  } catch (error) {
    console.error('Error getting family:', error);
    return undefined;
  }
}

export async function createFamily(family: Omit<Family, 'id'>): Promise<Family | null> {
  try {
    return await connectionManager.createFamily(family);
  } catch (error) {
    console.error('Error creating family:', error);
    return null;
  }
}

export async function updateFamily(family: Family): Promise<Family | undefined> {
  try {
    const updated = await connectionManager.updateFamily(family);
    return updated || undefined;
  } catch (error) {
    console.error('Error updating family:', error);
    return undefined;
  }
}

export async function deleteFamily(id: number): Promise<boolean> {
  try {
    return await connectionManager.deleteFamily(id);
  } catch (error) {
    console.error('Error deleting family:', error);
    return false;
  }
}

export async function getFamilyMembers(familyId: number): Promise<Client[]> {
  try {
    return await connectionManager.getFamilyMembers(familyId);
  } catch (error) {
    console.error('Error getting family members:', error);
    return [];
  }
}

export async function addClientToFamily(clientId: number, familyId: number, role: string): Promise<boolean> {
  try {
    return await connectionManager.addClientToFamily(clientId, familyId, role);
  } catch (error) {
    console.error('Error adding client to family:', error);
    return false;
  }
}

export async function removeClientFromFamily(clientId: number): Promise<boolean> {
  try {
    return await connectionManager.removeClientFromFamily(clientId);
  } catch (error) {
    console.error('Error removing client from family:', error);
    return false;
  }
} 