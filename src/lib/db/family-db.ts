/// <reference path="../../types/electron.d.ts" />
import { Family, Client } from "./schema-interface";
import { apiClient } from '../api-client';

export async function getAllFamilies(clinicId?: number): Promise<Family[]> {
  try {
    const response = await apiClient.getFamilies(clinicId);
    if (response.error) {
      console.error('Error getting all families:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting all families:', error);
    return [];
  }
}

export async function getPaginatedFamilies(
  clinicId?: number,
  options?: { limit?: number; offset?: number; order?: 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'id_desc' | 'id_asc'; search?: string },
  companyId?: number
): Promise<{ items: (Family & { clients?: Client[] })[]; total: number }> {
  try {
    const effectiveOptions = options ?? { limit: 25, offset: 0, order: 'created_desc' as const };
    const response = await apiClient.getFamiliesPaginated(clinicId, effectiveOptions, companyId);
    if (response.error) {
      console.error('Error getting paginated families:', response.error);
      return { items: [], total: 0 };
    }
    return response.data || { items: [], total: 0 };
  } catch (error) {
    console.error('Error getting paginated families:', error);
    return { items: [], total: 0 };
  }
}

export async function getFamilyById(id: number): Promise<Family | undefined> {
  try {
    const response = await apiClient.getFamily(id);
    if (response.error) {
      console.error('Error getting family:', response.error);
      return undefined;
    }
    return response.data || undefined;
  } catch (error) {
    console.error('Error getting family:', error);
    return undefined;
  }
}

export async function createFamily(family: Omit<Family, 'id'>): Promise<Family | null> {
  try {
    const response = await apiClient.createFamily(family);
    if (response.error) {
      console.error('Error creating family:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating family:', error);
    return null;
  }
}

export async function updateFamily(family: Family): Promise<Family | undefined> {
  try {
    if (!family.id) {
      console.error('Error updating family: No family ID provided');
      return undefined;
    }
    const response = await apiClient.updateFamily(family.id, family);
    if (response.error) {
      console.error('Error updating family:', response.error);
      return undefined;
    }
    return response.data || undefined;
  } catch (error) {
    console.error('Error updating family:', error);
    return undefined;
  }
}

export async function deleteFamily(id: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteFamily(id);
    if (response.error) {
      console.error('Error deleting family:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting family:', error);
    return false;
  }
}

export async function getFamilyMembers(familyId: number): Promise<Client[]> {
  try {
    const response = await apiClient.getFamilyMembers(familyId);
    if (response.error) {
      console.error('Error getting family members:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting family members:', error);
    return [];
  }
}

export async function addClientToFamily(clientId: number, familyId: number, role: string): Promise<boolean> {
  try {
    const response = await apiClient.addClientToFamily(clientId, familyId, role);
    if (response.error) {
      console.error('Error adding client to family:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error adding client to family:', error);
    return false;
  }
}

export async function removeClientFromFamily(clientId: number, familyId: number): Promise<boolean> {
  try {
    const response = await apiClient.removeClientFromFamily(clientId, familyId);
    if (response.error) {
      console.error('Error removing client from family:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error removing client from family:', error);
    return false;
  }
} 