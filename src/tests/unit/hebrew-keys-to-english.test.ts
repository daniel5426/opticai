import { expect, test } from "vitest";
import { hebrewKeysToEnglish } from "@/lib/hebrew-keys-to-english";

test("an email typed with the Hebrew keyboard on becomes the English keys", () => {
  // "dana@gmail.com" typed on the Hebrew layout.
  expect(hebrewKeysToEnglish("גשמש@עצשןך.בםצ")).toBe("dana@gmail.com");
  expect(hebrewKeysToEnglish("dana@gmail.com")).toBe("dana@gmail.com");
  expect(hebrewKeysToEnglish("rשבי1@walla.co.il")).toBe("rach1@walla.co.il");
  expect(hebrewKeysToEnglish("o'connor/sales@example.com")).toBe("o'connor/sales@example.com");
});
