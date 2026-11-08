export const DEFAULT_HOUR_HEIGHT = 95;
export const MIN_HOUR_HEIGHT = 48;
export const MAX_HOUR_HEIGHT = 320;
// Quarter-hour labels need ~25px between them to stay readable.
export const QUARTER_LABELS_MIN_HOUR_HEIGHT = 100;

const STORAGE_KEY = "calendar.hourHeight";

export const clampHourHeight = (height: number) =>
  Math.round(Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, height)));

export function readStoredHourHeight(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return stored ? clampHourHeight(stored) : DEFAULT_HOUR_HEIGHT;
  } catch {
    return DEFAULT_HOUR_HEIGHT;
  }
}

export function storeHourHeight(height: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(height));
  } catch {
    // Zoom still works for this visit.
  }
}

/** Stretches the hours so the point grabbed at `grabY` (px from the grid top) follows the pointer. */
export function hourHeightForDrag(startHeight: number, grabY: number, deltaY: number) {
  const anchor = Math.max(grabY, startHeight);
  return clampHourHeight(startHeight * (1 + deltaY / anchor));
}
