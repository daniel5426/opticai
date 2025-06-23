import { createContext } from 'react';
import { Settings } from '@/lib/db/schema';

export interface SettingsContextType {
  settings: Settings | null;
  updateSettings: (newSettings: Settings) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined); 