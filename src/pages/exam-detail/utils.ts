import { ExamLayout } from "@/lib/db/schema-interface";
import { CardItem, getColumnCount } from "@/components/exam/ExamCardRenderer";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import type { CardRow } from "./types";

export const EXAM_LAYOUT_VERSION = 2;
export const EXAM_LAYOUT_GRID_COLUMNS = 24;
export const LEGACY_LAYOUT_COLUMNS = 16;

export interface GridLayoutItem extends CardItem {
  x: number;
  y: number;
  w: number;
}

export interface GridLayoutData {
  version: typeof EXAM_LAYOUT_VERSION;
  grid: {
    columns: number;
  };
  items: GridLayoutItem[];
}

export const flattenExamLayouts = (nodes: ExamLayout[]): ExamLayout[] => {
  const list: ExamLayout[] = [];
  nodes.forEach((node) => {
    list.push(node);
    if (node.children && node.children.length) {
      list.push(...flattenExamLayouts(node.children as ExamLayout[]));
    }
  });
  return list;
};

export const collectLeafLayouts = (node: ExamLayout): ExamLayout[] => {
  if (!node.children || node.children.length === 0) {
    return node.is_group ? [] : [node];
  }
  if (!node.is_group) {
    return [node];
  }
  return node.children.flatMap((child) =>
    collectLeafLayouts(child as ExamLayout),
  );
};

export const sortKeysDeep = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .reduce(
        (acc, key) => {
          const child = sortKeysDeep(value[key]);
          if (child !== undefined) {
            acc[key] = child;
          }
          return acc;
        },
        {} as Record<string, any>,
      );
  }
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return value;
};

export const normalizeFieldValue = (previous: any, rawValue: string) => {
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : rawValue;
  if (trimmed === "") {
    if (previous === null) return null;
    return undefined;
  }
  if (typeof previous === "number") {
    const normalizedNumber = Number(String(trimmed).replace(",", "."));
    return Number.isFinite(normalizedNumber) ? normalizedNumber : rawValue;
  }
  if (typeof previous === "boolean") {
    if (trimmed === "true" || trimmed === "1") return true;
    if (trimmed === "false" || trimmed === "0") return false;
    return rawValue;
  }
  return trimmed;
};

export const shallowEqual = (a: any, b: any) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
};

export const isMeaningfulValue = (v: any) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  return true;
};

export const isNonEmptyComponent = (key: string, value: any) => {
  if (!value || typeof value !== "object") return false;

  // Skip technical keys that aren't components
  if (
    key === "layout_instance_id" ||
    key === "id" ||
    key === "exam_id" ||
    key === "created_at" ||
    key === "updated_at" ||
    key === "__ui"
  ) {
    return false;
  }

  const ignored = new Set([
    "id",
    "layout_instance_id",
    "card_id",
    "card_instance_id",
    "tab_index",
    "__deleted",
    "source_layout_instance_id",
    "title", // title alone isn't content for most things
  ]);

  const specialCover = [
    "deviation_type",
    "deviation_direction",
    "fv_1",
    "fv_2",
    "nv_1",
    "nv_2",
  ];

  const specialOldRefraction = [
    "r_sph",
    "r_cyl",
    "r_ax",
    "r_pris",
    "r_base",
    "r_va",
    "r_ad",
    "r_j",
    "l_sph",
    "l_cyl",
    "l_ax",
    "l_pris",
    "l_base",
    "l_va",
    "l_ad",
    "l_j",
    "comb_va",
    "comb_j",
  ];

  const specialRetinoscop = [
    "r_sph",
    "r_cyl",
    "r_ax",
    "r_reflex",
    "r_pd_far",
    "r_pd_close",
    "l_sph",
    "l_cyl",
    "l_ax",
    "l_reflex",
    "l_pd_far",
    "l_pd_close",
    "comb_pd_far",
    "comb_pd_close",
  ];

  // Notes are special: they MUST have a note or a custom title to be meaningful
  if (key.startsWith("notes-") || key === "notes") {
    const v = value as any;
    const hasNote = isMeaningfulValue(v.note);
    const hasCustomTitle =
      isMeaningfulValue(v.title) && v.title !== "הערות" && v.title !== "Notes";
    return hasNote || hasCustomTitle;
  }

  if (key.startsWith("cover-test-")) {
    return specialCover.some((k) => isMeaningfulValue((value as any)[k]));
  }

  if (key.startsWith("old-refraction-") || key === "old-refraction") {
    return specialOldRefraction.some((k) =>
      isMeaningfulValue((value as any)[k]),
    );
  }

  if (
    key.startsWith("retinoscop-") ||
    key === "retinoscop" ||
    key.startsWith("retinoscop-dilation-") ||
    key === "retinoscop-dilation"
  ) {
    return specialRetinoscop.some((k) => isMeaningfulValue((value as any)[k]));
  }

  // For everything else, check if any non-ignored field has a value
  for (const [k, v] of Object.entries(value)) {
    if (ignored.has(k)) continue;
    if (isMeaningfulValue(v)) return true;
  }
  return false;
};

export const pxToCols = (px: number) => {
  const pxPerCol = 1880 / 16;
  return Math.max(1, Math.min(16, Math.round(px / pxPerCol)));
};

export const computeCardCols = (type: CardItem["type"]): number => {
  const spec = getColumnCount(type, "editor") as any;
  if (typeof spec === "number") return Math.max(1, Math.min(16, spec));
  if (spec && typeof spec === "object" && typeof spec.fixedPx === "number")
    return pxToCols(spec.fixedPx);
  return 1;
};

export const computeCardGridCols = (
  type: CardItem["type"],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
) => {
  const legacyCols = computeCardCols(type);
  return Math.max(
    1,
    Math.min(
      columns,
      Math.round((legacyCols / LEGACY_LAYOUT_COLUMNS) * columns),
    ),
  );
};

const CARD_MIN_GRID_COL_OVERRIDES: Partial<Record<CardItem["type"], number>> = {
  "stereo-test": 4,
  rg: 6,
  "maddox-rod": 8,
  "contact-lens-diameters": 4,
  "schirmer-test": 4,
  "corneal-topography": 8,
  keratometer: 7,
  "diopter-adjustment-panel": 8,
};

const CARD_MIN_GRID_COL_SCALE = 0.75;

const scaleMinGridCols = (cols: number) =>
  Math.max(1, Math.ceil(cols * CARD_MIN_GRID_COL_SCALE));

export const computeCardMinGridCols = (
  type: CardItem["type"],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
) => {
  const baseWidth = scaleMinGridCols(computeCardGridCols(type, columns));
  const overrideWidth = CARD_MIN_GRID_COL_OVERRIDES[type];
  return overrideWidth
    ? Math.max(baseWidth, scaleMinGridCols(overrideWidth))
    : baseWidth;
};

const normalizeGridNumber = (value: unknown, fallback: number) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback;
};

export const normalizeGridItem = (
  item: GridLayoutItem,
  columns = EXAM_LAYOUT_GRID_COLUMNS,
  options: { enforceMinWidth?: boolean } = {},
): GridLayoutItem => {
  const { enforceMinWidth = true } = options;
  const fallbackWidth = computeCardGridCols(item.type, columns);
  const minWidth = computeCardMinGridCols(item.type, columns);
  const rawWidth = Math.min(
    columns,
    normalizeGridNumber(item.w, fallbackWidth),
  );
  const w = enforceMinWidth
    ? Math.max(minWidth, rawWidth)
    : Math.max(1, rawWidth);
  const x = Math.max(0, Math.min(columns - w, normalizeGridNumber(item.x, 0)));
  const y = Math.max(0, normalizeGridNumber(item.y, 0));
  return {
    ...item,
    x,
    y,
    w,
  };
};

export const sortGridItems = (items: GridLayoutItem[]) =>
  [...items].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.id.localeCompare(b.id);
  });

export const gridItemsToRowsForMetadata = (
  items: GridLayoutItem[],
): CardRow[] => {
  const rowsByLane = new Map<number, CardItem[]>();

  sortGridItems(items).forEach((item) => {
    const cards = rowsByLane.get(item.y) || [];
    const { x, y, w, ...card } = item;
    cards.push(card);
    rowsByLane.set(item.y, cards);
  });

  return Array.from(rowsByLane.entries())
    .sort(([a], [b]) => a - b)
    .map(([lane, cards]) => ({
      id: `lane-${lane}`,
      cards,
    }));
};

export const legacyRowsToGridItems = (
  rows: CardRow[],
  customWidths: Record<string, Record<string, number>> = {},
  columns = EXAM_LAYOUT_GRID_COLUMNS,
): GridLayoutItem[] => {
  const items: GridLayoutItem[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    const rowCustomWidths = customWidths[row.id] || {};

    row.cards.forEach((card, index) => {
      const isLast = index === row.cards.length - 1;
      const customPercent = rowCustomWidths[card.id];
      const rawWidth =
        typeof customPercent === "number"
          ? Math.round((customPercent / 100) * columns)
          : computeCardGridCols(card.type, columns);
      const remaining = columns - x;
      const w = Math.max(1, Math.min(remaining, isLast ? rawWidth : rawWidth));

      items.push(
        normalizeGridItem(
          {
            ...card,
            showEyeLabels: card.showEyeLabels ?? index === 0,
            x,
            y,
            w,
          },
          columns,
          { enforceMinWidth: false },
        ),
      );

      x = Math.min(columns, x + w);
    });
  });

  return items;
};

export const packCardsIntoGridItems = (
  cards: { id: string; type: CardItem["type"]; title?: string }[],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
) => {
  const rows = packCardsIntoRows(cards);
  return legacyRowsToGridItems(rows, {}, columns);
};

export const createGridLayoutData = (
  items: GridLayoutItem[],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
): GridLayoutData => ({
  version: EXAM_LAYOUT_VERSION,
  grid: { columns },
  items: sortGridItems(items.map((item) => normalizeGridItem(item, columns))),
});

export const serializeGridLayoutData = (
  items: GridLayoutItem[],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
) => JSON.stringify(createGridLayoutData(items, columns));

export const findCollision = (
  candidate: GridLayoutItem,
  items: GridLayoutItem[],
  excludeId?: string,
) => {
  const candidateEnd = candidate.x + candidate.w;
  return items.find((item) => {
    if (item.id === excludeId || item.y !== candidate.y) return false;
    const itemEnd = item.x + item.w;
    return candidate.x < itemEnd && candidateEnd > item.x;
  });
};

export const canPlaceGridItem = (
  candidate: GridLayoutItem,
  items: GridLayoutItem[],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
  excludeId?: string,
) => {
  const normalized = normalizeGridItem(candidate, columns);
  if (normalized.x < 0 || normalized.x + normalized.w > columns) return false;
  return !findCollision(normalized, items, excludeId);
};

export const findNearestAvailableGridX = (
  lane: number,
  requestedX: number,
  width: number,
  items: GridLayoutItem[],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
) => {
  const clampedWidth = Math.max(1, Math.min(columns, Math.round(width)));
  const maxX = Math.max(0, columns - clampedWidth);
  const targetX = Math.max(0, Math.min(maxX, Math.round(requestedX)));
  const laneItems = items.filter((item) => item.y === lane);

  let bestX: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let x = 0; x <= maxX; x += 1) {
    const candidateEnd = x + clampedWidth;
    const collides = laneItems.some((item) => {
      const itemEnd = item.x + item.w;
      return x < itemEnd && candidateEnd > item.x;
    });
    if (collides) continue;

    const distance = Math.abs(x - targetX);
    if (
      distance < bestDistance ||
      (distance === bestDistance && x < (bestX ?? x + 1))
    ) {
      bestX = x;
      bestDistance = distance;
    }
  }

  return bestX;
};

export const findNearestAvailableGridPlacement = (
  lane: number,
  requestedX: number,
  preferredWidth: number,
  minWidth: number,
  items: GridLayoutItem[],
  columns = EXAM_LAYOUT_GRID_COLUMNS,
) => {
  const clampedPreferredWidth = Math.max(
    1,
    Math.min(columns, Math.round(preferredWidth)),
  );
  const clampedMinWidth = Math.max(
    1,
    Math.min(clampedPreferredWidth, Math.round(minWidth)),
  );

  for (
    let width = clampedPreferredWidth;
    width >= clampedMinWidth;
    width -= 1
  ) {
    const x = findNearestAvailableGridX(
      lane,
      requestedX,
      width,
      items,
      columns,
    );
    if (x !== null) return { x, w: width };
  }

  return null;
};

export const clampResizeWidth = (
  item: GridLayoutItem,
  items: GridLayoutItem[],
  requestedWidth: number,
  columns = EXAM_LAYOUT_GRID_COLUMNS,
) => {
  const nextBlockingItem = items
    .filter(
      (other) =>
        other.id !== item.id && other.y === item.y && other.x >= item.x,
    )
    .sort((a, b) => a.x - b.x)[0];
  const maxByNeighbor = nextBlockingItem
    ? nextBlockingItem.x - item.x
    : columns - item.x;
  const minWidth = Math.min(
    computeCardMinGridCols(item.type, columns),
    maxByNeighbor,
  );
  return Math.max(minWidth, Math.min(requestedWidth, maxByNeighbor));
};

export const clampResizeLeft = (
  item: GridLayoutItem,
  items: GridLayoutItem[],
  requestedX: number,
  columns = EXAM_LAYOUT_GRID_COLUMNS,
) => {
  const rightEdge = item.x + item.w;
  const previousBlockingItem = items
    .filter(
      (other) =>
        other.id !== item.id &&
        other.y === item.y &&
        other.x + other.w <= item.x,
    )
    .sort((a, b) => b.x + b.w - (a.x + a.w))[0];
  const minX = previousBlockingItem
    ? previousBlockingItem.x + previousBlockingItem.w
    : 0;
  const maxX =
    Math.min(columns, rightEdge) - computeCardMinGridCols(item.type, columns);
  const x = Math.max(minX, Math.min(requestedX, maxX));
  return {
    x,
    w: rightEdge - x,
  };
};

export const packCardsIntoRows = (
  cards: { id: string; type: CardItem["type"]; title?: string }[],
) => {
  const items = cards.map((c) => ({ ...c, cols: computeCardCols(c.type) }));

  // Calculate ideal target columns per row
  const totalCols = items.reduce((sum, item) => sum + item.cols, 0);
  const minRowsNeeded = Math.ceil(totalCols / 16);
  const targetColsPerRow = Math.ceil(totalCols / minRowsNeeded);

  // Sort descending by size
  items.sort((a, b) => b.cols - a.cols);

  const rows: {
    id: string;
    cards: { id: string; type: CardItem["type"]; title?: string }[];
    used: number;
  }[] = [];

  items.forEach((item) => {
    let bestIdx = -1;
    let bestScore = -Infinity;

    rows.forEach((row, idx) => {
      if (row.cards.length < 3 && row.used + item.cols <= 16) {
        // Calculate how close this placement gets us to the target balance
        const newUsed = row.used + item.cols;

        // Score based on how close to target this row would be
        const distanceFromTarget = Math.abs(targetColsPerRow - newUsed);

        // Also consider overall variance reduction
        const currentVariance = rows.reduce(
          (sum, r) => sum + Math.pow(r.used - targetColsPerRow, 2),
          0,
        );
        const newVariance = rows.reduce((sum, r, i) => {
          const used = i === idx ? newUsed : r.used;
          return sum + Math.pow(used - targetColsPerRow, 2);
        }, 0);

        // Higher score is better: prefer placements that reduce variance and get close to target
        const score =
          (currentVariance - newVariance) * 100 - distanceFromTarget;

        if (score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      }
    });

    if (bestIdx === -1) {
      // No suitable row, create a new one
      rows.push({
        id: `row-${rows.length + 1}`,
        cards: [
          {
            id: item.id,
            type: item.type,
            ...(item.title ? { title: item.title } : {}),
          },
        ],
        used: item.cols,
      });
    } else {
      // Place in the best row for balance
      const row = rows[bestIdx];
      row.cards.push({
        id: item.id,
        type: item.type,
        ...(item.title ? { title: item.title } : {}),
      });
      row.used += item.cols;
    }
  });

  return rows.map((r) => ({ id: r.id, cards: r.cards }));
};

export interface ParsedLayoutData {
  rows: CardRow[];
  customWidths: Record<string, Record<string, number>>;
  grid: GridLayoutData;
  items: GridLayoutItem[];
  isLegacy: boolean;
}

export const parseLayoutData = (layoutData?: string): ParsedLayoutData => {
  if (!layoutData) {
    const grid = createGridLayoutData([]);
    return { rows: [], customWidths: {}, grid, items: [], isLegacy: false };
  }

  try {
    const parsed = JSON.parse(layoutData);
    if (Array.isArray(parsed)) {
      const items = legacyRowsToGridItems(parsed, {});
      return {
        rows: parsed,
        customWidths: {},
        grid: createGridLayoutData(items),
        items,
        isLegacy: true,
      };
    }

    if (
      parsed?.version === EXAM_LAYOUT_VERSION &&
      Array.isArray(parsed.items)
    ) {
      const columns = Number(parsed.grid?.columns) || EXAM_LAYOUT_GRID_COLUMNS;
      const items = sortGridItems(
        parsed.items.map((item: GridLayoutItem) =>
          normalizeGridItem(item, columns, { enforceMinWidth: false }),
        ),
      );
      return {
        rows: gridItemsToRowsForMetadata(items),
        customWidths: {},
        grid: createGridLayoutData(items, columns),
        items,
        isLegacy: false,
      };
    }

    const rows = parsed.rows || [];
    const customWidths = parsed.customWidths || {};
    const items = legacyRowsToGridItems(rows, customWidths);
    return {
      rows,
      customWidths,
      grid: createGridLayoutData(items),
      items,
      isLegacy: true,
    };
  } catch (error) {
    console.error("Error parsing layout structure:", error);
    const grid = createGridLayoutData([]);
    return { rows: [], customWidths: {}, grid, items: [], isLegacy: false };
  }
};

export const createParsedLayoutCache = () => {
  const cache = new Map<
    string,
    { layoutData: string | undefined; parsed: ParsedLayoutData }
  >();

  return {
    get(instanceId: number | string, layoutData?: string): ParsedLayoutData {
      const key = String(instanceId);
      const cached = cache.get(key);
      if (cached && cached.layoutData === layoutData) {
        return cached.parsed;
      }
      const parsed = parseLayoutData(layoutData);
      cache.set(key, { layoutData, parsed });
      return parsed;
    },
    clear(instanceId?: number | string) {
      if (instanceId == null) {
        cache.clear();
        return;
      }
      cache.delete(String(instanceId));
    },
  };
};

export const FULL_DATA_NAME = "כל הנתונים";
export const VIRTUAL_FULL_DATA_TAB_ID = -1;

export const isVirtualFullDataTabId = (
  id: number | string | null | undefined,
) =>
  id === VIRTUAL_FULL_DATA_TAB_ID ||
  String(id) === String(VIRTUAL_FULL_DATA_TAB_ID);

export type LayoutTabLike = {
  id: number | string | null | undefined;
  layout_id?: number | string | null;
};

export const isInternalFullDataTab = (tab: LayoutTabLike | null | undefined) =>
  !!tab && isVirtualFullDataTabId(tab.id) && tab.layout_id == null;

export const isPersistableLayoutTab = (tab: LayoutTabLike | null | undefined) =>
  !!tab && tab.layout_id != null && !isVirtualFullDataTabId(tab.id);

export const resolveFullDataSourceInstanceId = (
  componentKey: string,
  value: any,
  sources: Record<string, number | string | null>,
) => {
  const direct =
    sources[componentKey] ??
    (value && typeof value === "object"
      ? (value as any).source_layout_instance_id
      : null);
  if (direct != null) return direct;

  const cardId =
    value && typeof value === "object" ? (value as any).card_id : undefined;
  const prefixes: string[] = [];
  if (componentKey.startsWith("cover-test-")) {
    const fallbackId =
      cardId || componentKey.slice("cover-test-".length).split("-")[0];
    if (fallbackId) prefixes.push(`cover-test-${fallbackId}-`);
  } else if (componentKey.startsWith("old-refraction-")) {
    const fallbackId =
      cardId || componentKey.slice("old-refraction-".length).split("-")[0];
    if (fallbackId) prefixes.push(`old-refraction-${fallbackId}-`);
  }

  for (const prefix of prefixes) {
    const sourceKey = Object.keys(sources).find(
      (key) => key === prefix.slice(0, -1) || key.startsWith(prefix),
    );
    if (sourceKey && sources[sourceKey] != null) return sources[sourceKey];
  }

  return null;
};
