import { describe, expect, it } from "vitest";
import { canvasGradientVariables, DEFAULT_CANVAS_GRADIENT, isCanvasGradient, readCanvasGradient } from "@/lib/canvas-gradient";

describe("canvas gradient rendering and validation", () => {
  it("accepts only complete colors and bounded finite controls", () => {
    expect(isCanvasGradient(DEFAULT_CANVAS_GRADIENT)).toBe(true);
    for (const patch of [{ type: "unknown" }, { colorOne: "#fff" }, { colorTwo: "var(--primary)" }, { angle: 361 }, { strength: -1 }, { grain: NaN }, { angle: "90" }]) {
      expect(isCanvasGradient({ ...DEFAULT_CANVAS_GRADIENT, ...patch })).toBe(false);
    }
    expect(readCanvasGradient({ getItem: () => "broken JSON" })).toBeNull();
    expect(readCanvasGradient({ getItem: () => { throw new Error("restricted"); } })).toBeNull();
  });
  it("renders exact solid colors and optional gradients while preserving saved legacy gradients", () => {
    const solid = { ...DEFAULT_CANVAS_GRADIENT, type: "solid" as const, colorOne: "#123456" };
    expect(isCanvasGradient(solid)).toBe(true);
    expect(readCanvasGradient({ getItem: () => JSON.stringify(solid) })).toEqual(solid);
    expect(canvasGradientVariables(solid)).toEqual({ "--canvas-gradient-base": "#123456", "--canvas-gradient-image": "none" });
    const gradient = { ...solid, type: "gradient" as const, colorTwo: "#abcdef", strength: 100, grain: 0 };
    expect(isCanvasGradient(gradient)).toBe(true);
    expect(canvasGradientVariables(gradient)["--canvas-gradient-image"]).toContain("linear-gradient(45deg, #123456, color-mix(in srgb, #abcdef 100%, #123456))");
    expect(readCanvasGradient({ getItem: () => JSON.stringify(DEFAULT_CANVAS_GRADIENT) })).toEqual(DEFAULT_CANVAS_GRADIENT);
    expect(canvasGradientVariables(DEFAULT_CANVAS_GRADIENT)["--canvas-gradient-image"]).toContain("radial-gradient");
  });
  it("turns the direction into physical focal points and can remove color and grain", () => {
    const up = canvasGradientVariables({ ...DEFAULT_CANVAS_GRADIENT, angle: 0 });
    const right = canvasGradientVariables({ ...DEFAULT_CANVAS_GRADIENT, angle: 90 });
    expect(up["--canvas-gradient-image"]).toContain("circle at 50% 0%");
    expect(right["--canvas-gradient-image"]).toContain("circle at 100% 50%");
    const zero = canvasGradientVariables({ ...DEFAULT_CANVAS_GRADIENT, strength: 0, grain: 0 });
    expect(zero["--canvas-gradient-image"]).toContain('opacity%3D%220%22');
    expect(zero["--canvas-gradient-base"]).toContain("0%");
  });
});
