import { ExamLayout } from "@/lib/db/schema-interface";
import { CardItem, getColumnCount } from "@/components/exam/ExamCardRenderer";
import { examComponentRegistry } from "@/lib/exam-component-registry";

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
  if (key === 'layout_instance_id' || key === 'id' || key === 'exam_id' || key === 'created_at' || key === 'updated_at') {
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

  // Notes are special: they MUST have a note or a custom title to be meaningful
  if (key.startsWith("notes-") || key === "notes") {
    const v = value as any;
    const hasNote = isMeaningfulValue(v.note);
    const hasCustomTitle = isMeaningfulValue(v.title) && v.title !== "הערות" && v.title !== "Notes";
    return hasNote || hasCustomTitle;
  }

  if (key.startsWith("cover-test-")) {
    return specialCover.some((k) => isMeaningfulValue((value as any)[k]));
  }

  // For everything else, check if any non-ignored field has a value
  for (const [k, v] of Object.entries(value)) {
    if (ignored.has(k)) continue;
    if (isMeaningfulValue(v)) return true;
  }
  return false;
};

export const pxToCols = (px: number) => {
  const pxPerCol = 1680 / 16;
  return Math.max(1, Math.min(16, Math.round(px / pxPerCol)));
};

export const computeCardCols = (type: CardItem["type"]): number => {
  const spec = getColumnCount(type, "editor") as any;
  if (typeof spec === "number") return Math.max(1, Math.min(16, spec));
  if (spec && typeof spec === "object" && typeof spec.fixedPx === "number")
    return pxToCols(spec.fixedPx);
  return 1;
};

export const packCardsIntoRows = (
  cards: { id: string; type: CardItem["type"] }[],
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
        cards: [{ id: item.id, type: item.type }],
        used: item.cols,
      });
    } else {
      // Place in the best row for balance
      const row = rows[bestIdx];
      row.cards.push({ id: item.id, type: item.type });
      row.used += item.cols;
    }
  });

  return rows.map((r) => ({ id: r.id, cards: r.cards }));
};

export const FULL_DATA_NAME = "כל הנתונים";
