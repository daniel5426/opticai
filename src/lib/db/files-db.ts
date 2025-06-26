import { File } from './schema';

export async function createFile(data: Omit<File, 'id'>): Promise<File | null> {
  try {
    return await window.electronAPI.createFile(data);
  } catch (error) {
    console.error('Error creating file:', error);
    return null;
  }
}

export async function getFileById(id: number): Promise<File | null> {
  try {
    return await window.electronAPI.getFile(id);
  } catch (error) {
    console.error('Error getting file:', error);
    return null;
  }
}

export async function getFilesByClientId(clientId: number): Promise<File[]> {
  try {
    return await window.electronAPI.getFilesByClient(clientId);
  } catch (error) {
    console.error('Error getting files by client:', error);
    return [];
  }
}

export async function getAllFiles(): Promise<File[]> {
  try {
    return await window.electronAPI.getAllFiles();
  } catch (error) {
    console.error('Error getting all files:', error);
    return [];
  }
}

export async function updateFile(data: File): Promise<File | null> {
  try {
    return await window.electronAPI.updateFile(data);
  } catch (error) {
    console.error('Error updating file:', error);
    return null;
  }
}

export async function deleteFile(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteFile(id);
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
} 