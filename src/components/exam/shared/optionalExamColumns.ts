export function hasOptionalEyeField(
  data: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  if (!data) return false;
  return ["r", "l"].some((eye) => {
    const value = data[`${eye}_${key}`];
    return value != null && String(value).trim() !== "";
  });
}
