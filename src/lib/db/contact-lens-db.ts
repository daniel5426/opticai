/// <reference path="../../types/electron.d.ts" />
import { ContactLens, ContactEye, ContactLensOrder } from './schema'

export async function getContactLensesByClientId(clientId: number): Promise<ContactLens[]> {
  try {
    return await window.electronAPI.getContactLensesByClient(clientId);
  } catch (error) {
    console.error('Error getting contact lenses by client:', error);
    return [];
  }
}

export async function getAllContactLenses(): Promise<ContactLens[]> {
  try {
    return await window.electronAPI.getAllContactLenses();
  } catch (error) {
    console.error('Error getting all contact lenses:', error);
    return [];
  }
}

export async function getContactLensById(contactLensId: number): Promise<ContactLens | undefined> {
  try {
    return await window.electronAPI.getContactLens(contactLensId);
  } catch (error) {
    console.error('Error getting contact lens:', error);
    return undefined;
  }
}

export async function getContactEyesByContactLensId(contactLensId: number): Promise<ContactEye[]> {
  try {
    return await window.electronAPI.getContactEyesByContactLens(contactLensId);
  } catch (error) {
    console.error('Error getting contact eyes:', error);
    return [];
  }
}

export async function getContactLensOrderByContactLensId(contactLensId: number): Promise<ContactLensOrder | undefined> {
  try {
    return await window.electronAPI.getContactLensOrderByContactLens(contactLensId);
  } catch (error) {
    console.error('Error getting contact lens order:', error);
    return undefined;
  }
}

export async function createContactLens(contactLens: Omit<ContactLens, 'id'>): Promise<ContactLens | null> {
  try {
    return await window.electronAPI.createContactLens(contactLens);
  } catch (error) {
    console.error('Error creating contact lens:', error);
    return null;
  }
}

export async function createContactEye(contactEye: Omit<ContactEye, 'id'>): Promise<ContactEye | null> {
  try {
    return await window.electronAPI.createContactEye(contactEye);
  } catch (error) {
    console.error('Error creating contact eye:', error);
    return null;
  }
}

export async function createContactLensOrder(contactLensOrder: Omit<ContactLensOrder, 'id'>): Promise<ContactLensOrder | null> {
  try {
    return await window.electronAPI.createContactLensOrder(contactLensOrder);
  } catch (error) {
    console.error('Error creating contact lens order:', error);
    return null;
  }
}

export async function updateContactLens(contactLens: ContactLens): Promise<ContactLens | undefined> {
  try {
    return await window.electronAPI.updateContactLens(contactLens);
  } catch (error) {
    console.error('Error updating contact lens:', error);
    return undefined;
  }
}

export async function updateContactEye(contactEye: ContactEye): Promise<ContactEye | undefined> {
  try {
    return await window.electronAPI.updateContactEye(contactEye);
  } catch (error) {
    console.error('Error updating contact eye:', error);
    return undefined;
  }
}

export async function updateContactLensOrder(contactLensOrder: ContactLensOrder): Promise<ContactLensOrder | undefined> {
  try {
    return await window.electronAPI.updateContactLensOrder(contactLensOrder);
  } catch (error) {
    console.error('Error updating contact lens order:', error);
    return undefined;
  }
}

export async function deleteContactLens(contactLensId: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteContactLens(contactLensId);
  } catch (error) {
    console.error('Error deleting contact lens:', error);
    return false;
  }
}

export async function getBillingByContactLensId(contactLensId: number): Promise<any> {
  try {
    return await window.electronAPI.getBillingByContactLens(contactLensId);
  } catch (error) {
    console.error('Error getting billing by contact lens:', error);
    return null;
  }
}