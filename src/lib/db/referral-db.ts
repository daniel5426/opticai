/// <reference path="../../types/electron.d.ts" />
import { Referral, ReferralEye } from './schema'

export async function getReferralsByClientId(clientId: number): Promise<Referral[]> {
  try {
    return await window.electronAPI.getReferralsByClient(clientId);
  } catch (error) {
    console.error('Error getting referrals by client:', error);
    return [];
  }
}

export async function getAllReferrals(): Promise<Referral[]> {
  try {
    return await window.electronAPI.getAllReferrals();
  } catch (error) {
    console.error('Error getting all referrals:', error);
    return [];
  }
}

export async function getReferralById(referralId: number): Promise<Referral | null> {
  try {
    return await window.electronAPI.getReferral(referralId);
  } catch (error) {
    console.error('Error getting referral:', error);
    return null;
  }
}

export async function createReferral(referralData: Omit<Referral, 'id'>): Promise<Referral | null> {
  try {
    return await window.electronAPI.createReferral(referralData);
  } catch (error) {
    console.error('Error creating referral:', error);
    return null;
  }
}

export async function updateReferral(referralData: Referral): Promise<Referral | null> {
  try {
    return await window.electronAPI.updateReferral(referralData);
  } catch (error) {
    console.error('Error updating referral:', error);
    return null;
  }
}

export async function deleteReferral(referralId: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteReferral(referralId);
  } catch (error) {
    console.error('Error deleting referral:', error);
    return false;
  }
}

export async function getReferralEyesByReferralId(referralId: number): Promise<ReferralEye[]> {
  try {
    return await window.electronAPI.getReferralEyesByReferral(referralId);
  } catch (error) {
    console.error('Error getting referral eyes:', error);
    return [];
  }
}

export async function createReferralEye(referralEyeData: Omit<ReferralEye, 'id'>): Promise<ReferralEye | null> {
  try {
    return await window.electronAPI.createReferralEye(referralEyeData);
  } catch (error) {
    console.error('Error creating referral eye:', error);
    return null;
  }
}

export async function updateReferralEye(referralEyeData: ReferralEye): Promise<ReferralEye | null> {
  try {
    return await window.electronAPI.updateReferralEye(referralEyeData);
  } catch (error) {
    console.error('Error updating referral eye:', error);
    return null;
  }
} 