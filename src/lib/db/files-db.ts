import { File } from './schema-interface';
import { apiClient } from '../api-client';

export async function createFile(data: Omit<File, 'id'> | FormData): Promise<File | null> {
  try {
    const response = await apiClient.createFile(data);
    if (response.error) {
      console.error('Error creating file:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating file:', error);
    return null;
  }
}

export async function getFileById(id: number): Promise<File | null> {
  try {
    const response = await apiClient.getFile(id);
    if (response.error) {
      console.error('Error getting file:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting file:', error);
    return null;
  }
}

export async function getFilesByClientId(clientId: number): Promise<File[]> {
  try {
    const response = await apiClient.getFilesByClient(clientId);
    if (response.error) {
      console.error('Error getting files by client:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting files by client:', error);
    return [];
  }
}

export async function getAllFiles(clinicId?: number): Promise<File[]> {
  try {
    const response = await apiClient.getFiles(clinicId);
    if (response.error) {
      console.error('Error getting all files:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting all files:', error);
    return [];
  }
}

export async function getPaginatedFiles(
  clinicId?: number,
  options?: { limit?: number; offset?: number; order?: 'upload_date_desc' | 'upload_date_asc' | 'id_desc' | 'id_asc' }
): Promise<{ items: File[]; total: number }> {
  try {
    const effectiveOptions = options ?? { limit: 25, offset: 0, order: 'upload_date_desc' as const };
    const response = await apiClient.getFilesPaginated(clinicId, effectiveOptions);
    if (response.error) {
      console.error('Error getting paginated files:', response.error);
      return { items: [], total: 0 };
    }
    return response.data || { items: [], total: 0 };
  } catch (error) {
    console.error('Error getting paginated files:', error);
    return { items: [], total: 0 };
  }
}

export async function updateFile(data: File): Promise<File | null> {
  try {
    if (!data.id) {
      console.error('Error updating file: No file ID provided');
      return null;
    }
    const response = await apiClient.updateFile(data.id, data);
    if (response.error) {
      console.error('Error updating file:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating file:', error);
    return null;
  }
}

export async function deleteFile(id: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteFile(id);
    if (response.error) {
      console.error('Error deleting file:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
} 