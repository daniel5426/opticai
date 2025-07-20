import { File } from './schema';

export async function createFile(data: Omit<File, 'id'>): Promise<File | null> {
  try {
    const result = await window.electronAPI.db('createFile', data);
    if (result && data.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', data.client_id);
      
    }
    return result;
  } catch (error) {
    console.error('Error creating file:', error);
    return null;
  }
}

export async function getFileById(id: number): Promise<File | null> {
  try {
    return await window.electronAPI.db('getFileById', id);
  } catch (error) {
    console.error('Error getting file:', error);
    return null;
  }
}

export async function getFilesByClientId(clientId: number): Promise<File[]> {
  try {
    return await window.electronAPI.db('getFilesByClientId', clientId);
  } catch (error) {
    console.error('Error getting files by client:', error);
    return [];
  }
}

export async function getAllFiles(): Promise<File[]> {
  try {
    return await window.electronAPI.db('getAllFiles');
  } catch (error) {
    console.error('Error getting all files:', error);
    return [];
  }
}

export async function updateFile(data: File): Promise<File | null> {
  try {
    const result = await window.electronAPI.db('updateFile', data);
    if (result && data.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', data.client_id);
      
    }
    return result;
  } catch (error) {
    console.error('Error updating file:', error);
    return null;
  }
}

export async function deleteFile(id: number): Promise<boolean> {
  try {
    const file = await window.electronAPI.db('getFileById', id);
    const result = await window.electronAPI.db('deleteFile', id);
    if (result && file?.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', file.client_id);
      
    }
    return result;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
} 