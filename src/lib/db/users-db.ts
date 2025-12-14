/// <reference path="../../types/electron.d.ts" />
import { User } from './schema-interface'
import { apiClient } from '../api-client';

export async function getAllUsers(clinicId?: number): Promise<User[]> {
  try {
    const response = await apiClient.getUsersForSelect({ clinic_id: clinicId, include_ceo: true });
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

export async function getPaginatedUsers(
  options?: { limit?: number; offset?: number; order?: 'id_desc' | 'id_asc' | 'username_asc' | 'username_desc' | 'role_asc' | 'role_desc'; search?: string; clinic_id?: number }
): Promise<{ items: User[]; total: number }> {
  try {
    const effectiveOptions = options ?? { limit: 25, offset: 0, order: 'id_desc' as const };
    const response = await apiClient.getUsersPaginated(effectiveOptions);
    if (response.error) {
      console.error('Error getting paginated users:', response.error);
      return { items: [], total: 0 };
    }
    return response.data || { items: [], total: 0 };
  } catch (error) {
    console.error('Error getting paginated users:', error);
    return { items: [], total: 0 };
  }
}

export async function getUsersByClinic(clinicId: number): Promise<User[]> {
  try {
    const response = await apiClient.getUsersForSelect({ clinic_id: clinicId, include_ceo: true });
    if (response.error) {
      console.error('Error getting users by clinic:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting users by clinic:', error);
    return [];
  }
}

export async function getUsersByCompanyId(companyId: number): Promise<User[]> {
  try {
    const response = await apiClient.getUsersByCompany(companyId);
    if (response.error) {
      console.error('Error getting users by company ID:', response.error);
      return [];
    }
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

export async function createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<any | null> {
  try {
    const response = await apiClient.createUser(userData);
    if (response.error) {
      console.error('Error creating user:', response.error);
      throw new Error(response.error);
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof Error) throw error;
    throw new Error('Unknown error creating user');
  }
}

export async function updateUser(userData: User): Promise<User | null> {
  try {
    if (!userData.id) {
      console.error('Error updating user: No user ID provided');
      return null;
    }
    const { password, ...safeUser } = userData;
    const payload = password === undefined ? safeUser : userData;
    const response = await apiClient.updateUser(userData.id, payload);
    if (response.error) {
      console.error('Error updating user:', response.error);
      throw new Error(response.error);
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating user:', error);
    if (error instanceof Error) throw error;
    throw new Error('Unknown error updating user');
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

export async function authenticateUser(): Promise<User | null> {
  try {
    const userResponse = await apiClient.getCurrentUser();
    if (userResponse.error) {
      console.error('Error getting current user:', userResponse.error);
      return null;
    }
    return (userResponse.data as User) || null;
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}