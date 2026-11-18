// The English letter on the same key as each Hebrew one (standard Israeli layout), for fields that are always English.
const HEBREW_KEY_TO_ENGLISH: Record<string, string> = {
  "/": "q", "'": "w", "ק": "e", "ר": "r", "א": "t", "ט": "y", "ו": "u", "ן": "i", "ם": "o", "פ": "p",
  "ש": "a", "ד": "s", "ג": "d", "כ": "f", "ע": "g", "י": "h", "ח": "j", "ל": "k", "ך": "l", "ף": ";",
  "ז": "z", "ס": "x", "ב": "c", "ה": "v", "נ": "b", "מ": "n", "צ": "m", "ת": ",", "ץ": ".",
};

/** Typing an email with the Hebrew keyboard on gives what the same keys would type in English. */
export function hebrewKeysToEnglish(value: string): string {
  return value.replace(/[/'א-ת]/g, (char) => HEBREW_KEY_TO_ENGLISH[char] ?? char);
}
