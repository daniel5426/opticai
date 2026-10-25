export interface CanvasGradient {
  type?: "solid" | "gradient";
  colorOne: string;
  colorTwo: string;
  angle: number;
  strength: number;
  grain: number;
}

export const DEFAULT_CANVAS_GRADIENT: CanvasGradient = {
  colorOne: "#2389dc", colorTwo: "#ffffff", angle: 45, strength: 50, grain: 35,
};
export const getCanvasGradientKey = (userId?: number) => userId === undefined
  ? "appearance_canvas_gradient" : `user_canvas_gradient_${userId}`;

export function isCanvasGradient(value: unknown): value is CanvasGradient {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const color = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  const range = (value: unknown, max: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
  return (candidate.type === undefined || candidate.type === "solid" || candidate.type === "gradient")
    && color(candidate.colorOne) && color(candidate.colorTwo) && range(candidate.angle, 360)
    && range(candidate.strength, 100) && range(candidate.grain, 100);
}

export function readCanvasGradient(storage: Pick<Storage, "getItem">, userId?: number): CanvasGradient | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(getCanvasGradientKey(userId)) ?? "null");
    return isCanvasGradient(value) ? value : null;
  } catch { return null; }
}

function noise(frequency: number, opacity: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="${opacity}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Shared by the live page and editor preview so they render the same recipe. */
export function canvasGradientVariables(value: CanvasGradient): Record<string, string> {
  const strength = value.strength / 100;
  if (value.type === "solid") {
    return { "--canvas-gradient-base": value.colorOne, "--canvas-gradient-image": "none" };
  }
  if (value.type === "gradient") {
    return {
      "--canvas-gradient-base": value.colorOne,
      "--canvas-gradient-image": [
        noise(.8, value.grain / 1000), noise(.9, value.grain / 100 * .43),
        `linear-gradient(${value.angle}deg, ${value.colorOne}, color-mix(in srgb, ${value.colorTwo} ${value.strength}%, ${value.colorOne}))`,
      ].join(", "),
    };
  }
  const radians = value.angle * Math.PI / 180;
  const x = 50 + Math.sin(radians) * 50;
  const y = 50 - Math.cos(radians) * 50;
  const first = (amount: number) => `color-mix(in srgb, ${value.colorOne} ${amount * strength * 100}%, transparent)`;
  const second = (amount: number) => `color-mix(in srgb, ${value.colorTwo} ${amount * strength * 100}%, transparent)`;
  return {
    "--canvas-gradient-base": `color-mix(in srgb, ${value.colorOne} ${strength * 6}%, var(--canvas-gradient-surface, var(--appearance-canvas)))`,
    "--canvas-gradient-image": [
      noise(.8, value.grain / 1000), noise(.9, value.grain / 100 * .43),
      `radial-gradient(circle at ${100 - x}% ${100 - y}%, ${second(.5)} 0%, transparent 67%)`,
      `radial-gradient(circle at ${x}% ${y}%, ${first(.38)} 0%, transparent 85%)`,
      `radial-gradient(circle at 45% 35%, ${second(.28)} 0%, transparent 67%)`,
      `linear-gradient(${value.angle}deg, ${first(.16)}, ${second(.16)})`,
    ].join(", "),
  };
}
