/// <reference path="../../types/electron.d.ts" />
import { Referral, ReferralEye } from './schema-interface';
import { apiClient } from '../api-client';

export async function getReferralsByClientId(clientId: number): Promise<Referral[]> {
  try {
    const response = await apiClient.getReferralsByClient(clientId);
    if (response.error) {
      console.error('Error getting referrals by client:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting referrals by client:', error);
    return [];
  }
}

export async function getAllReferrals(clinicId?: number): Promise<Referral[]> {
  try {
    const response = await apiClient.getReferrals(clinicId);
    if (response.error) {
      console.error('Error getting all referrals:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting all referrals:', error);
    return [];
  }
}

export async function getPaginatedReferrals(
  clinicId?: number,
  options?: { limit?: number; offset?: number; order?: 'date_desc' | 'date_asc' | 'id_desc' | 'id_asc'; search?: string }
): Promise<{ items: Referral[]; total: number }> {
  try {
    const effectiveOptions = options ?? { limit: 25, offset: 0, order: 'date_desc' as const };
    const response = await apiClient.getReferralsPaginated(clinicId, effectiveOptions);
    if (response.error) {
      console.error('Error getting paginated referrals:', response.error);
      return { items: [], total: 0 };
    }
    return response.data || { items: [], total: 0 };
  } catch (error) {
    console.error('Error getting paginated referrals:', error);
    return { items: [], total: 0 };
  }
}

export async function getReferralById(referralId: number): Promise<Referral | null> {
  try {
    const response = await apiClient.getReferral(referralId);
    if (response.error) {
      console.error('Error getting referral:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting referral:', error);
    return null;
  }
}

export async function createReferral(referralData: Omit<Referral, 'id'>): Promise<Referral | null> {
  try {
    const response = await apiClient.createReferral(referralData);
    if (response.error) {
      console.error('Error creating referral:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating referral:', error);
    return null;
  }
}

export async function updateReferral(referralData: Referral): Promise<Referral | null> {
  try {
    if (!referralData.id) {
      console.error('Error updating referral: No referral ID provided');
      return null;
    }
    const response = await apiClient.updateReferral(referralData.id, referralData);
    if (response.error) {
      console.error('Error updating referral:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating referral:', error);
    return null;
  }
}

export async function deleteReferral(referralId: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteReferral(referralId);
    if (response.error) {
      console.error('Error deleting referral:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting referral:', error);
    return false;
  }
}

export async function getReferralEyesByReferralId(referralId: number): Promise<ReferralEye[]> {
  try {
    const response = await apiClient.getReferralEyes(referralId);
    if (response.error) {
      console.error('Error getting referral eyes:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting referral eyes:', error);
    return [];
  }
}

export async function createReferralEye(referralEyeData: Omit<ReferralEye, 'id'>): Promise<ReferralEye | null> {
  try {
    const response = await apiClient.createReferralEye(referralEyeData);
    if (response.error) {
      console.error('Error creating referral eye:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating referral eye:', error);
    return null;
  }
}

export async function updateReferralEye(referralEyeData: ReferralEye): Promise<ReferralEye | null> {
  try {
    if (!referralEyeData.id) {
      console.error('Error updating referral eye: No ID provided');
      return null;
    }
    const response = await apiClient.updateReferralEye(referralEyeData.id, referralEyeData);
    if (response.error) {
      console.error('Error updating referral eye:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating referral eye:', error);
    return null;
  }
}