import { describe, test, expect } from "vitest";
import { transposePrescription, getCylNotation, calculateSE } from "@/utils/optometry-utils";

describe('Optometry Utils', () => {
  describe('transposePrescription', () => {
    test('transposes minus cylinder to plus cylinder', () => {
      const result = transposePrescription({ sph: 2, cyl: -1, ax: 90 });
      expect(result).toEqual({ sph: "1.00", cyl: "1.00", ax: "180" });
    });

    test('transposes plus cylinder to minus cylinder', () => {
      const result = transposePrescription({ sph: 1, cyl: 1, ax: 180 });
      expect(result).toEqual({ sph: "2.00", cyl: "-1.00", ax: "90" });
    });

    test('handles axis wrapping (180 to 90)', () => {
      const result = transposePrescription({ sph: -1, cyl: -0.5, ax: 180 });
      expect(result).toEqual({ sph: "-1.50", cyl: "0.50", ax: "90" });
    });

    test('handles axis wrapping (over 180)', () => {
      const result = transposePrescription({ sph: 0, cyl: -2, ax: 100 });
      expect(result).toEqual({ sph: "-2.00", cyl: "2.00", ax: "10" });
    });

    test('handles neutral cylinder (0)', () => {
      const result = transposePrescription({ sph: 5, cyl: 0, ax: 90 });
      expect(result).toEqual({ sph: 5, cyl: 0, ax: 90 }); // Neutral doesn't change
    });

    test('maintains precision', () => {
      const result = transposePrescription({ sph: 1.25, cyl: -0.75, ax: 45 });
      expect(result).toEqual({ sph: "0.50", cyl: "0.75", ax: "135" });
    });

    test('handles empty sphere correctly', () => {
      // SE = 0 + (-1.00) = -1.00, cyl = -(-1.00) = +1.00
      const result = transposePrescription({ sph: "", cyl: -1, ax: 90 });
      expect(result).toEqual({ sph: "-1.00", cyl: "1.00", ax: "180" });
    });
  });

  describe('getCylNotation', () => {
    test('identifies minus notation', () => {
      expect(getCylNotation(-0.25)).toBe('minus');
      expect(getCylNotation(-3.00)).toBe('minus');
    });

    test('identifies plus notation', () => {
      expect(getCylNotation(0.25)).toBe('plus');
      expect(getCylNotation(3.00)).toBe('plus');
    });

    test('identifies neutral notation', () => {
      expect(getCylNotation(0)).toBe('neutral');
    });
  });

  describe('calculateSE', () => {
    test('calculates SE correctly for plus sphere and minus cylinder', () => {
      // SE = +0.25 + (-0.50 / 2) = +0.25 - 0.25 = 0.00
      expect(calculateSE(0.25, -0.50)).toBe('0.00');
    });

    test('calculates SE correctly for minus sphere and minus cylinder', () => {
      // SE = -1.00 + (-0.50 / 2) = -1.00 - 0.25 = -1.25
      expect(calculateSE(-1.00, -0.50)).toBe('-1.25');
    });

    test('calculates SE correctly for plus sphere and plus cylinder', () => {
      // SE = +1.00 + (+1.00 / 2) = +1.00 + 0.50 = +1.50
      expect(calculateSE(1.00, 1.00)).toBe('1.50');
    });

    test('handles string inputs', () => {
      expect(calculateSE("+2.00", "-1.00")).toBe('1.50');
    });

    test('handles empty inputs as 0', () => {
      expect(calculateSE("", -1.00)).toBe('-0.50');
      expect(calculateSE(2.00, "")).toBe('2.00');
      expect(calculateSE("", "")).toBe('');
    });
  });
});
