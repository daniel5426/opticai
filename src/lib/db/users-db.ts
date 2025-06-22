/// <reference path="../../types/electron.d.ts" />
import { User } from './schema'

export async function getAllUsers(): Promise<User[]> {
  try {
    return await window.electronAPI.getAllUsers();
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}

export async function getUserById(userId: number): Promise<User | null> {
  try {
    return await window.electronAPI.getUser(userId);
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    return await window.electronAPI.getUserByUsername(username);
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
}

export async function createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User | null> {
  try {
    return await window.electronAPI.createUser(userData);
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

export async function updateUser(userData: User): Promise<User | null> {
  try {
    return await window.electronAPI.updateUser(userData);
  } catch (error) {
    console.error('Error updating user:', error);
    return null;
  }
}

export async function deleteUser(userId: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteUser(userId);
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

export async function authenticateUser(username: string, password?: string): Promise<User | null> {
  try {
    return await window.electronAPI.authenticateUser(username, password);
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
} 