import { createContext } from 'react';

export const ImportedClinicalContext = createContext<{
  literalVA?: boolean;
  butOnly?: boolean;
  fields?: string[];
} | null>(null);
