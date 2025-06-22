import { Settings } from "./schema";

export async function getSettings(): Promise<Settings | null> {
  try {
    return await window.electronAPI.getSettings();
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
}

export async function updateSettings(settings: Settings): Promise<Settings | null> {
  try {
    return await window.electronAPI.updateSettings(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return null;
  }
} 