export type ImportDiagnostic = { key: string; field?: string };
export type InventoryImportRow = {
  row_number: number;
  worksheet?: string;
  status: 'valid' | 'invalid';
  errors: string[];
  error_details: ImportDiagnostic[];
  source_values: Record<string, string | number | boolean | null>;
  data: Record<string, unknown> | null;
};
export type InventoryImportPreview = {
  worksheets: string[];
  selected_worksheet: string;
  rows: InventoryImportRow[];
  total: number;
  valid: number;
  invalid: number;
  file_error?: string;
};
