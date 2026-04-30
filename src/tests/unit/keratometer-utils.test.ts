import { describe, expect, test } from "vitest";
import {
  convertKeratometerValue,
  getKeratometerRange,
  getKeratometerStep,
  roundToStep,
} from "@/utils/keratometer-utils";

describe("keratometer utils", () => {
  test("uses unit-specific input steps", () => {
    expect(getKeratometerStep("mm")).toBe("0.01");
    expect(getKeratometerStep("D")).toBe("0.25");
  });

  test("uses equivalent instrument-style ranges for each unit", () => {
    expect(getKeratometerRange("mm")).toEqual({ min: "5.00", max: "10.00" });
    expect(getKeratometerRange("D")).toEqual({ min: "33.75", max: "67.50" });
  });

  test("rounds converted diopters to the nearest quarter diopter", () => {
    expect(convertKeratometerValue("7.80", "D")).toBe("43.25");
    expect(convertKeratometerValue("8.60", "D")).toBe("39.25");
  });

  test("rounds converted millimeters to the nearest hundredth", () => {
    expect(convertKeratometerValue("43.25", "mm")).toBe("7.80");
    expect(convertKeratometerValue("39.25", "mm")).toBe("8.60");
  });

  test("keeps converted values aligned to their target step", () => {
    const convertedD = Number(convertKeratometerValue("7.80", "D"));
    const convertedMm = Number(convertKeratometerValue("43.25", "mm"));

    expect(roundToStep(convertedD, 0.25)).toBe(convertedD);
    expect(roundToStep(convertedMm, 0.01)).toBe(convertedMm);
  });
});
