import { describe, expect, test } from "vitest";
import {
  buildMeterVAOptionsForDistance,
  canonicalizeMeterVAForDistance,
  convertVA,
  displayMeterVAForDistance,
  normalizeVATestDistance,
} from "@/components/exam/shared/VASelect";
import { sortVAOptions } from "@/components/exam/data/exam-constants";

describe("VA test distance conversion", () => {
  test("displays canonical 6m acuity at the configured test distance", () => {
    expect(displayMeterVAForDistance("6/12", 4)).toBe("4/8");
    expect(convertVA("6/12", "meter", 4)).toBe("4/8");
  });

  test("stores displayed meter acuity as canonical 6m acuity", () => {
    expect(canonicalizeMeterVAForDistance("4/12+1")).toBe("6/18+1");
  });

  test("maps rounded display options back to exact canonical options", () => {
    const { options, displayToCanonicalOption } = buildMeterVAOptionsForDistance(["6/190"], 4);

    expect(options).toEqual(["4/126.67"]);
    expect(displayToCanonicalOption.get("4/126.67")).toBe("6/190");
  });

  test("ignores invalid meter options when building display options", () => {
    const { options } = buildMeterVAOptionsForDistance(["6", "6/12"], 4);

    expect(options).toEqual(["4/8"]);
  });

  test("keeps 6m meter display unchanged", () => {
    expect(convertVA("6/12", "meter", 6)).toBe("6/12");
  });

  test("leaves decimal mode independent from test distance", () => {
    expect(convertVA("6/12", "decimal", 4)).toBe("0.9");
    expect(convertVA("6/12", "decimal", 6)).toBe("0.9");
  });

  test("preserves VA modifiers during display conversion", () => {
    expect(convertVA("6/12-2", "meter", 4)).toBe("4/8-2");
  });

  test("falls back to 6m for invalid settings", () => {
    expect(normalizeVATestDistance(1)).toBe(6);
    expect(normalizeVATestDistance(7)).toBe(6);
    expect(normalizeVATestDistance("4")).toBe(4);
  });

  test("sorts lookup-backed VA options in ascending acuity order", () => {
    expect(sortVAOptions(["6/6", "6/120", "6/12", "6/190"])).toEqual([
      "6/190",
      "6/120",
      "6/12",
      "6/6",
    ]);
    expect(sortVAOptions(["1.2", "-0.1", "0.6"])).toEqual(["-0.1", "0.6", "1.2"]);
  });
});
