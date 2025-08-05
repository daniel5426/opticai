/// <reference path="../../types/electron.d.ts" />
import { User } from './schema-interface'
import { apiClient } from '../api-client';

export async function getAllUsers(clinicId?: number): Promise<User[]> {
  try {
    const response = await apiClient.getUsers();
    if (response.error) {
      console.error('Error getting all users:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}

export async function getUsersByCompanyId(companyId: number): Promise<User[]> {
  try {
    const response = await apiClient.getUsers();
    if (response.error) {
      console.error('Error getting users by company ID:', response.error);
      return [];
    }
    // Filter by company ID if needed (API should handle this automatically)
    return response.data || [];
  } catch (error) {
    console.error('Error getting users by company ID:', error);
    return [];
  }
}

export async function getUserById(userId: number): Promise<User | null> {
  try {
    const response = await apiClient.getUser(userId);
    if (response.error) {
      console.error('Error getting user:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const response = await apiClient.getUserByUsername(username);
    if (response.error) {
      console.error('Error getting user by username:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
}

export async function createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User | null> {
  try {
    const response = await apiClient.createUser(userData);
    if (response.error) {
      console.error('Error creating user:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

export async function updateUser(userData: User): Promise<User | null> {
  try {
    if (!userData.id) {
      console.error('Error updating user: No user ID provided');
      return null;
    }
    const response = await apiClient.updateUser(userData.id, userData);
    if (response.error) {
      console.error('Error updating user:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating user:', error);
    return null;
  }
}

export async function deleteUser(userId: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteUser(userId);
    if (response.error) {
      console.error('Error deleting user:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

export async function authenticateUser(username: string, password?: string): Promise<User | null> {
  try {
    if (!password) {
      // No password provided, try to get user by username
      const response = await apiClient.getUserByUsername(username);
      if (response.error) {
        console.error('Error authenticating user:', response.error);
        return null;
      }
      return response.data || null;
    }

    // Login with password
    const loginResponse = await apiClient.login(username, password);
    if (loginResponse.error) {
      console.error('Error logging in:', loginResponse.error);
      return null;
    }

    // Get current user after successful login
    const userResponse = await apiClient.getCurrentUser();
    if (userResponse.error) {
      console.error('Error getting current user:', userResponse.error);
      return null;
    }
    return userResponse.data as User || null;
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
} 