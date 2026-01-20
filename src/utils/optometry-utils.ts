/**
 * Optometry Utility Functions
 */

export interface Prescription {
  sph: string | number | undefined;
  cyl: string | number | undefined;
  ax: string | number | undefined;
}

/**
 * Detects if a cylinder value is minus or plus oriented.
 */
export function getCylNotation(cyl: string | number | undefined): "minus" | "plus" | "neutral" {
  if (cyl === undefined || cyl === "" || cyl === null) return "neutral";
  const num = typeof cyl === "string" ? parseFloat(cyl) : cyl;
  if (isNaN(num) || num === 0) return "neutral";
  return num < 0 ? "minus" : "plus";
}

/**
 * Transposes a prescription between Minus and Plus cylinder notation.
 * Formula:
 * 1. New Sphere = Old Sphere + Old Cylinder
 * 2. New Cylinder = -Old Cylinder
 * 3. New Axis = (Old Axis + 90) % 180 (handles 180 boundary)
 */
export function transposePrescription(rx: Prescription): Prescription {
  const parseValue = (val: string | number | undefined) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  };

  const sph = parseValue(rx.sph);
  const cyl = parseValue(rx.cyl);
  const ax = parseValue(rx.ax);

  if (isNaN(cyl) || cyl === 0) return { ...rx };

  const newSph = sph + cyl;
  const newCyl = -cyl;
  let newAx = ax + 90;

  if (newAx > 180) {
    newAx -= 180;
  } else if (newAx === 0) {
    // Standard notation usually prefers 180 over 0, but both are valid.
    newAx = 180;
  }

  return {
    sph: formatPrescriptionValue(newSph, true),
    cyl: formatPrescriptionValue(newCyl, true),
    ax: Math.round(newAx).toString()
  };
}

/**
 * Calculates the Spherical Equivalent (SE) of a prescription.
 * Formula: SE = Sphere + (Cylinder / 2)
 */
export function calculateSE(sph: string | number | undefined, cyl: string | number | undefined): string {
  const s = typeof sph === "string" ? parseFloat(sph) : (sph || 0);
  const c = typeof cyl === "string" ? parseFloat(cyl) : (cyl || 0);

  if (isNaN(s) && isNaN(c)) return "";
  
  const valS = isNaN(s) ? 0 : s;
  const valC = isNaN(c) ? 0 : c;
  
  const se = valS + (valC / 2);
  return formatPrescriptionValue(se, true);
}

/**
 * Formats a number for display with 2 decimal places.
 * Note: Does NOT add a '+' sign, as our UI Input components handle sign display.
 */
export function formatPrescriptionValue(val: string | number | undefined, _showPlus: boolean = false): string {
  if (val === undefined || val === "" || val === null) return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  
  return num.toFixed(2);
}
