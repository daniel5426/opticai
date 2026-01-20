import { useState, useRef, useEffect, useCallback } from "react";

export interface FieldWarnings {
  missingAxis: boolean;
  missingCyl: boolean;
}

export interface EyeWarnings {
  R: FieldWarnings;
  L: FieldWarnings;
}

const DEFAULT_FIELD_MAPPING = {
  R: { cyl: "r_cyl", ax: "r_ax" },
  L: { cyl: "l_cyl", ax: "l_ax" },
};

/**
 * Hook to manage axis and cylinder missing warnings.
 * Follows the "Hybrid Responsiveness" pattern for instant feedback.
 */
export function useAxisWarning<T>(
  data: T,
  onChange: (field: keyof T, value: string) => void,
  isEditing: boolean,
  fieldMapping: {
    R: { cyl: keyof T; ax: keyof T };
    L: { cyl: keyof T; ax: keyof T };
  } = DEFAULT_FIELD_MAPPING as any
) {
  const [fieldWarnings, setFieldWarnings] = useState<EyeWarnings>({
    R: { missingAxis: false, missingCyl: false },
    L: { missingAxis: false, missingCyl: false },
  });

  const latestValuesRef = useRef(data);

  // Helper to check warning logic based on a data object
  const checkWarningsInData = useCallback((eye: "R" | "L", currentData: T) => {
    const mapping = fieldMapping[eye];
    const cyl = currentData[mapping.cyl]?.toString() || "";
    const ax = currentData[mapping.ax]?.toString() || "";

    // Logic 1: Has Cyl but missing Axis
    const missingAxis = !!(cyl && cyl !== "0" && cyl !== "0.00" && !ax);
    // Logic 2: Has Axis but missing Cyl
    const missingCyl = !!(ax && ax !== "0" && (!cyl || cyl === "0" || cyl === "0.00"));

    return { missingAxis, missingCyl };
  }, [fieldMapping]);

  // Sync ref with props and update warnings when props change
  useEffect(() => {
    latestValuesRef.current = data;
    
    const newR = checkWarningsInData("R", data);
    const newL = checkWarningsInData("L", data);

    // Only update state if warnings actually changed to prevent loops
    setFieldWarnings(prev => {
      if (prev.R.missingAxis === newR.missingAxis && 
          prev.R.missingCyl === newR.missingCyl &&
          prev.L.missingAxis === newL.missingAxis &&
          prev.L.missingCyl === newL.missingCyl) {
        return prev;
      }
      return { R: newR, L: newL };
    });
  }, [data, checkWarningsInData]);

  const handleAxisChange = useCallback((eye: "R" | "L", field: "cyl" | "ax", value: string) => {
    const mapping = fieldMapping[eye];
    const targetField = mapping[field];

    // 1. Optimistic Update for Warning
    const updatedData = { ...latestValuesRef.current, [targetField]: value };
    latestValuesRef.current = updatedData;

    const warnings = checkWarningsInData(eye, updatedData);
    setFieldWarnings(prev => {
      const currentEye = prev[eye];
      if (currentEye.missingAxis === warnings.missingAxis && currentEye.missingCyl === warnings.missingCyl) {
        return prev;
      }
      return { ...prev, [eye]: warnings };
    });

    // 2. Propagate Change
    onChange(targetField, value);
  }, [fieldMapping, checkWarningsInData, onChange]);

  return {
    fieldWarnings,
    handleAxisChange,
  };
}
