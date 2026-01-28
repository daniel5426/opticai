import { useEffect, useRef, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { getCylNotation, transposePrescription, Prescription } from "@/utils/optometry-utils";

/**
 * A hook to automatically manage cylinder notation and provide transposition handlers.
 * @param data The exam data object
 * @param onChange The change handler function
 * @param isEditing Whether the form is in edit mode
 * @param fields Optional custom field mappings (defaults to standard r_*, l_* keys)
 */
export function usePrescriptionLogic<T>(
  data: T,
  onChange: (field: keyof T, value: string) => void,
  isEditing: boolean,
  fields: Array<{ eye: string; sph: keyof T; cyl: keyof T; ax: keyof T }> = [
    { eye: "R", sph: "r_sph" as keyof T, cyl: "r_cyl" as keyof T, ax: "r_ax" as keyof T },
    { eye: "L", sph: "l_sph" as keyof T, cyl: "l_cyl" as keyof T, ax: "l_ax" as keyof T },
  ]
) {
  const { currentUser } = useUser();
  const preferredNotation = currentUser?.cyl_format || "minus";
  const hasAutoTransposed = useRef(false);

  const transposeRow = useCallback((row: { sph: keyof T; cyl: keyof T; ax: keyof T }) => {
    const currentRx: Prescription = {
      sph: (data[row.sph] as any)?.toString() || "",
      cyl: (data[row.cyl] as any)?.toString() || "",
      ax: (data[row.ax] as any)?.toString() || ""
    };

    if (!currentRx.cyl || parseFloat(currentRx.cyl as string) === 0) return;

    const transposed = transposePrescription(currentRx);
    
    // Update all three fields
    onChange(row.sph, transposed.sph as string);
    onChange(row.cyl, transposed.cyl as string);
    
    // Only update axis if it was not empty
    if (currentRx.ax !== undefined && currentRx.ax !== "" && currentRx.ax !== null) {
      onChange(row.ax, transposed.ax as string);
    }
  }, [data, onChange]);

  const handleManualTranspose = useCallback(() => {
    if (!isEditing) return;
    fields.forEach(transposeRow);
  }, [fields, transposeRow, isEditing]);

  // Handle automatic transposition on mount/load
  useEffect(() => {
    if (!isEditing) {
      hasAutoTransposed.current = false;
      return;
    }

    if (hasAutoTransposed.current || !currentUser) return;

    let needsTransposition = false;
    
    fields.forEach(row => {
      const cylVal = (data[row.cyl] as any)?.toString();
      const currentNotation = getCylNotation(cylVal);
      
      if (currentNotation !== "neutral" && currentNotation !== preferredNotation) {
        needsTransposition = true;
      }
    });

    if (needsTransposition) {
      // Small delay to ensure state is ready if needed, or just execute
      fields.forEach(transposeRow);
    }
    
    // Mark as checked to prevent auto-transposition during active editing
    hasAutoTransposed.current = true;
  }, [currentUser, preferredNotation, fields, transposeRow, isEditing]); // Intentionally omitting 'data' to only run on initial load or when isEditing changes

  return {
    handleManualTranspose,
    preferredNotation
  };
}
