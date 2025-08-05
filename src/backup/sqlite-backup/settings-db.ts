import { Settings } from "./schema-interface";

export async function getSettings(clinicId?: number): Promise<Settings | null> {
  try {
    return await window.electronAPI.db('getSettingsByClinicId', clinicId);
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
}

export async function updateSettings(settings: Settings): Promise<Settings | null> {
  try {
    return await window.electronAPI.db('updateSettings', settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return null;
  }
} 