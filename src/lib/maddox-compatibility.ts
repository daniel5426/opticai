const MADDOX_COMPONENT_TYPE = "maddox-rod";

const HORIZONTAL_DIRECTION_ALIASES: Record<string, string> = {
  X: "EXO",
  EXO: "EXO",
  XT: "EXO",
  EXOTROPIA: "EXO",
  E: "ESO",
  ESO: "ESO",
  ET: "ESO",
  ESOTROPIA: "ESO",
};

const VERTICAL_DIRECTION_ALIASES: Record<string, string> = {
  R: "R/L",
  "R/L": "R/L",
  RL: "R/L",
  "RHYPER": "R/L",
  L: "L/R",
  "L/R": "L/R",
  LR: "L/R",
  "LHYPER": "L/R",
};

const firstPresent = (...values: unknown[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

export const normalizeMaddoxDirection = (
  value: unknown,
  axis: "horizontal" | "vertical",
) => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const aliases =
    axis === "horizontal"
      ? HORIZONTAL_DIRECTION_ALIASES
      : VERTICAL_DIRECTION_ALIASES;
  return aliases[raw.toUpperCase().replace(/\s+/g, "")] ?? raw;
};

const isMaddoxRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const normalizeMaddoxRodExam = <T extends Record<string, unknown>>(
  data: T,
): T => {
  const withHorizontalPrism = firstPresent(
    data.with_horizontal_prism,
    data.c_r_h,
    data.c_l_h,
  );
  const withVerticalPrism = firstPresent(
    data.with_vertical_prism,
    data.c_r_v,
    data.c_l_v,
  );
  const withoutHorizontalPrism = firstPresent(
    data.without_horizontal_prism,
    data.wc_r_h,
    data.wc_l_h,
  );
  const withoutVerticalPrism = firstPresent(
    data.without_vertical_prism,
    data.wc_r_v,
    data.wc_l_v,
  );

  const next: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (
      key === "schema_version" ||
      key === "c_r_h" ||
      key === "c_r_v" ||
      key === "c_l_h" ||
      key === "c_l_v" ||
      key === "wc_r_h" ||
      key === "wc_r_v" ||
      key === "wc_l_h" ||
      key === "wc_l_v"
    ) {
      return;
    }
    next[key] = value;
  });

  next.schema_version = 2;
  next.with_horizontal_prism = withHorizontalPrism;
  next.with_vertical_prism = withVerticalPrism;
  next.without_horizontal_prism = withoutHorizontalPrism;
  next.without_vertical_prism = withoutVerticalPrism;
  next.with_horizontal_direction = normalizeMaddoxDirection(
    data.with_horizontal_direction,
    "horizontal",
  );
  next.with_vertical_direction = normalizeMaddoxDirection(
    data.with_vertical_direction,
    "vertical",
  );
  next.without_horizontal_direction = normalizeMaddoxDirection(
    data.without_horizontal_direction,
    "horizontal",
  );
  next.without_vertical_direction = normalizeMaddoxDirection(
    data.without_vertical_direction,
    "vertical",
  );

  return next as T;
};

const isMaddoxKey = (key: string) =>
  key === MADDOX_COMPONENT_TYPE || key.startsWith(`${MADDOX_COMPONENT_TYPE}-`);

export const normalizeMaddoxRodExamData = <T extends Record<string, unknown>>(
  data: T,
): T => {
  const normalized: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (isMaddoxKey(key) && isMaddoxRecord(value)) {
      normalized[key] = normalizeMaddoxRodExam(value);
      return;
    }
    normalized[key] = value;
  });
  return normalized as T;
};
