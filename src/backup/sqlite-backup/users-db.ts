/// <reference path="../../types/electron.d.ts" />
import { User } from './schema-interface'
import { connectionManager } from './connection-manager';

export async function getAllUsers(clinicId?: number): Promise<User[]> {
  try {
    if (clinicId) {
      return await connectionManager.getUsersByClinicId(clinicId);
    } else {
      return await connectionManager.getAllUsers();
    }
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}

export async function getUsersByCompanyId(companyId: number): Promise<User[]> {
  try {
    return await connectionManager.getUsersByCompanyId(companyId);
  } catch (error) {
    console.error('Error getting users by company ID:', error);
    return [];
  }
}

export async function getUserById(userId: number): Promise<User | null> {
  try {
    return await connectionManager.getUserById(userId);
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    return await connectionManager.getUserByUsername(username);
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
}

export async function createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User | null> {
  try {
    return await connectionManager.createUser(userData);
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

export async function updateUser(userData: User): Promise<User | null> {
  try {
    return await connectionManager.updateUser(userData);
  } catch (error) {
    console.error('Error updating user:', error);
    return null;
  }
}

export async function deleteUser(userId: number): Promise<boolean> {
  try {
    return await connectionManager.deleteUser(userId);
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

export async function authenticateUser(username: string, password?: string): Promise<User | null> {
  try {
    const result = await connectionManager.authenticateUser(username, password);
    
    // Handle different return formats:
    // Local mode returns User | null directly
    // Remote mode returns { success: boolean, user?: User }
    if (result && typeof result === 'object' && 'success' in result) {
      // Remote mode format
      return result.success ? result.user : null;
    } else {
      // Local mode format (User | null)
      return result;
    }
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
} 