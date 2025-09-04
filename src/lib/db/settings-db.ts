import { Settings } from "./schema-interface";
import { apiClient } from '../api-client';

export async function getSettings(clinicId?: number): Promise<Settings | null> {
  try {
    const response = await apiClient.getSettings(clinicId);
    if (!response.error && response.data) {
      const data: any = response.data as any;
      if (Array.isArray(data)) {
        return data.length > 0 ? (data[0] as Settings) : null;
      }
      return (data as Settings) || null;
    }
    if (!clinicId) {
      console.error('Error getting settings:', response.error || 'No clinicId provided');
      return null;
    }
    const defaultSettings = {
      clinic_id: clinicId,
      clinic_logo_path: '',
      primary_theme_color: '#000000',
      secondary_theme_color: '#000000',
      work_start_time: '08:00',
      work_end_time: '17:00',
      appointment_duration: 30,
      send_email_before_appointment: false,
      email_days_before: 1,
      email_time: '09:00',
      working_days: 'Sunday,Monday,Tuesday,Wednesday,Thursday',
      break_start_time: '12:00',
      break_end_time: '13:00',
      max_appointments_per_day: 20,
      email_provider: '',
      email_smtp_host: '',
      email_smtp_port: 587,
      email_smtp_secure: false,
      email_username: '',
      email_password: '',
      email_from_name: ''
    };
    const createResponse = await apiClient.createSettings(defaultSettings);
    if (createResponse.error) {
      console.error('Error creating default settings:', createResponse.error);
      return null;
    }
    return createResponse.data || null;
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
}

export async function updateSettings(settings: Settings): Promise<Settings | null> {
  try {
    const response = await apiClient.updateSettings(settings);
    if (response.error) {
      console.error('Error updating settings:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating settings:', error);
    return null;
  }
} 