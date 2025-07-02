/// <reference path="../../types/electron.d.ts" />
import { Referral, ReferralEye } from './schema'

export async function getReferralsByClientId(clientId: number): Promise<Referral[]> {
  try {
    return await window.electronAPI.db('getReferralsByClientId', clientId);
  } catch (error) {
    console.error('Error getting referrals by client:', error);
    return [];
  }
}

export async function getAllReferrals(): Promise<Referral[]> {
  try {
    return await window.electronAPI.db('getAllReferrals');
  } catch (error) {
    console.error('Error getting all referrals:', error);
    return [];
  }
}

export async function getReferralById(referralId: number): Promise<Referral | null> {
  try {
    return await window.electronAPI.db('getReferralById', referralId);
  } catch (error) {
    console.error('Error getting referral:', error);
    return null;
  }
}

export async function createReferral(referralData: Omit<Referral, 'id'>): Promise<Referral | null> {
  try {
    return await window.electronAPI.db('createReferral', referralData);
  } catch (error) {
    console.error('Error creating referral:', error);
    return null;
  }
}

export async function updateReferral(referralData: Referral): Promise<Referral | null> {
  try {
    return await window.electronAPI.db('updateReferral', referralData);
  } catch (error) {
    console.error('Error updating referral:', error);
    return null;
  }
}

export async function deleteReferral(referralId: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteReferral', referralId);
  } catch (error) {
    console.error('Error deleting referral:', error);
    return false;
  }
}

export async function getReferralEyesByReferralId(referralId: number): Promise<ReferralEye[]> {
  try {
    return await window.electronAPI.db('getReferralEyesByReferralId', referralId);
  } catch (error) {
    console.error('Error getting referral eyes:', error);
    return [];
  }
}

export async function createReferralEye(referralEyeData: Omit<ReferralEye, 'id'>): Promise<ReferralEye | null> {
  try {
    return await window.electronAPI.db('createReferralEye', referralEyeData);
  } catch (error) {
    console.error('Error creating referral eye:', error);
    return null;
  }
}

export async function updateReferralEye(referralEyeData: ReferralEye): Promise<ReferralEye | null> {
  try {
    return await window.electronAPI.db('updateReferralEye', referralEyeData);
  } catch (error) {
    console.error('Error updating referral eye:', error);
    return null;
  }
} 