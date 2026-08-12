import { createContext } from 'react';
import { Company, Settings } from '@/lib/db/schema-interface';

export interface SettingsContextType {
  settings: Settings | null;
  company: Company | null;
  updateSettings: (newSettings: Settings) => void;
  updateCompany: (newCompany: Company) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
