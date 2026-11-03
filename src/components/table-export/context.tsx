import { createContext } from 'react';
import type { ExportConfig } from '@/lib/table-exports';

export const TableExportContext = createContext<ExportConfig | null>(null);
export const TableExportProvider = TableExportContext.Provider;
