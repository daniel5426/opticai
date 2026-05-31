import { describe, expect, test } from "vitest";
import {
  computeCardGridCols,
  computeCardMinGridCols,
  createParsedLayoutCache,
  findCollision,
  findNearestAvailableGridX,
  findNearestAvailableGridPlacement,
  getExamLayoutSizeScale,
  FULL_DATA_NAME,
  clampResizeLeft,
  clampResizeWidth,
  gridItemsToRowsForMetadata,
  legacyRowsToGridItems,
  VIRTUAL_FULL_DATA_TAB_ID,
  isInternalFullDataTab,
  isPersistableLayoutTab,
  parseLayoutData,
  resolveFullDataSourceInstanceId,
  serializeGridLayoutData,
} from "@/pages/exam-detail/utils";
import {
  ensureLayoutDataForRows,
  ensureTabsMetadataForRows,
  getTabsForCard,
  setTabsForCard,
} from "@/lib/exam-ui-metadata";
import { CardRow } from "@/pages/exam-detail/types";

const rows: CardRow[] = [
  {
    id: "row-1",
    cards: [
      { id: "old-refraction-1", type: "old-refraction" },
      { id: "cover-test-1", type: "cover-test" },
    ],
  },
];

describe("exam ui metadata", () => {
  test("derives legacy old-refraction and cover-test tab metadata", () => {
    const legacyData = {
      "old-refraction-old-refraction-1-tab-b": {
        tab_index: 1,
        r_glasses_type: "קרוב",
      },
      "old-refraction-old-refraction-1-tab-a": {
        tab_index: 0,
        r_glasses_type: "רחוק",
      },
      "cover-test-cover-test-1-cover-a": {
        tab_index: 0,
      },
    };

    const normalized = ensureTabsMetadataForRows(legacyData, rows);

    expect(normalized.changed).toBe(true);
    expect(
      getTabsForCard(normalized.examData, "old-refraction", "old-refraction-1"),
    ).toEqual([
      { id: "tab-a", index: 0, type: "רחוק" },
      { id: "tab-b", index: 1, type: "קרוב" },
    ]);
    expect(
      getTabsForCard(normalized.examData, "cover-test", "cover-test-1"),
    ).toEqual([{ id: "cover-a", index: 0 }]);
  });

  test("backfills default old-refraction type into legacy tab data", () => {
    const legacyData = {
      "old-refraction-old-refraction-1-legacy": {
        card_id: "old-refraction-1",
        card_instance_id: "legacy",
        tab_index: 0,
        r_sph: "-1.50",
      },
    };

    const normalized = ensureTabsMetadataForRows(legacyData, rows);

    expect(normalized.changed).toBe(true);
    expect(
      getTabsForCard(normalized.examData, "old-refraction", "old-refraction-1"),
    ).toEqual([{ id: "legacy", index: 0, type: "רחוק" }]);
    expect(
      normalized.examData["old-refraction-old-refraction-1-legacy"],
    ).toMatchObject({
      r_sph: "-1.50",
      r_glasses_type: "רחוק",
      l_glasses_type: "רחוק",
    });
  });

  test("setTabsForCard writes stable __ui metadata without touching values", () => {
    const data = {
      "cover-test-cover-test-1-a": { fv_1: "2" },
    };

    const next = setTabsForCard(data, "cover-test", "cover-test-1", [
      { id: "b", index: 9 },
      { id: "a", index: 2 },
    ]);

    expect(next["cover-test-cover-test-1-a"]).toEqual({ fv_1: "2" });
    expect(next.__ui.tabsByCard["cover-test:cover-test-1"]).toEqual([
      { id: "a", index: 0 },
      { id: "b", index: 1 },
    ]);
  });

  test("backfills missing untouched layout card entries", () => {
    const data = {};
    const layoutRows: CardRow[] = [
      {
        id: "row-1",
        cards: [{ id: "objective-1", type: "objective" }],
      },
    ];

    const normalized = ensureLayoutDataForRows(data, layoutRows, 42);

    expect(normalized.changed).toBe(true);
    expect(data).toEqual({});
    expect(normalized.examData["objective-objective-1"]).toEqual({
      layout_instance_id: 42,
      card_instance_id: "objective-1",
    });
    expect(normalized.examData.objective).toBe(
      normalized.examData["objective-objective-1"],
    );
  });

  test("preserves existing instance-specific layout data", () => {
    const existing = {
      layout_instance_id: 42,
      card_instance_id: "objective-1",
      r_sph: "-1.00",
    };
    const data = {
      "objective-objective-1": existing,
    };
    const layoutRows: CardRow[] = [
      {
        id: "row-1",
        cards: [{ id: "objective-1", type: "objective" }],
      },
    ];

    const normalized = ensureLayoutDataForRows(data, layoutRows, 42);

    expect(normalized.examData["objective-objective-1"]).toBe(existing);
    expect(normalized.examData.objective).toBe(existing);
  });

  test("assigns legacy base data to only the first missing card of a type", () => {
    const legacyBase = {
      layout_instance_id: 42,
      r_sph: "-1.00",
    };
    const data = {
      objective: legacyBase,
    };
    const layoutRows: CardRow[] = [
      {
        id: "row-1",
        cards: [
          { id: "objective-1", type: "objective" },
          { id: "objective-2", type: "objective" },
        ],
      },
    ];

    const normalized = ensureLayoutDataForRows(data, layoutRows, 42);

    expect(normalized.examData["objective-objective-1"]).toEqual({
      layout_instance_id: 42,
      card_instance_id: "objective-1",
      r_sph: "-1.00",
    });
    expect(normalized.examData["objective-objective-2"]).toEqual({
      layout_instance_id: 42,
      card_instance_id: "objective-2",
    });
    expect(normalized.examData.objective).toBe(legacyBase);
  });

  test("creates default old-refraction tab data for untouched cards", () => {
    const data = {};
    const layoutRows: CardRow[] = [
      {
        id: "row-1",
        cards: [{ id: "old-refraction-1", type: "old-refraction" }],
      },
    ];

    const normalized = ensureLayoutDataForRows(data, layoutRows, 42);
    const tabs = getTabsForCard(
      normalized.examData,
      "old-refraction",
      "old-refraction-1",
    );
    const tabId = tabs[0].id;

    expect(tabs).toEqual([
      { id: "old-refraction-1-default", index: 0, type: "רחוק" },
    ]);
    expect(
      normalized.examData[`old-refraction-old-refraction-1-${tabId}`],
    ).toEqual({
      layout_instance_id: 42,
      card_instance_id: "old-refraction-1-default",
      card_id: "old-refraction-1",
      tab_index: 0,
      r_glasses_type: "רחוק",
      l_glasses_type: "רחוק",
    });
  });

  test("preserves legacy old-refraction base values in the default tab", () => {
    const data = {
      "old-refraction": {
        layout_instance_id: 42,
        r_glasses_type: "קרוב",
        l_glasses_type: "קרוב",
        r_sph: "-2.00",
      },
    };
    const layoutRows: CardRow[] = [
      {
        id: "row-1",
        cards: [{ id: "old-refraction-1", type: "old-refraction" }],
      },
    ];

    const normalized = ensureLayoutDataForRows(data, layoutRows, 42);

    expect(
      normalized.examData[
        "old-refraction-old-refraction-1-old-refraction-1-default"
      ],
    ).toMatchObject({
      r_glasses_type: "קרוב",
      l_glasses_type: "קרוב",
      r_sph: "-2.00",
    });
  });
});

describe("parsed layout cache", () => {
  test("returns cached parsed objects and invalidates when layout_data changes", () => {
    const cache = createParsedLayoutCache();
    const firstLayout = JSON.stringify({ rows, customWidths: {} });
    const secondLayout = JSON.stringify({
      rows: [{ id: "row-2", cards: [{ id: "notes-1", type: "notes" }] }],
      customWidths: {},
    });

    const first = cache.get(1, firstLayout);
    const second = cache.get(1, firstLayout);
    const changed = cache.get(1, secondLayout);

    expect(second).toBe(first);
    expect(changed).not.toBe(first);
    expect(changed.rows[0].id).toBe("row-2");
  });

  test("parseLayoutData handles legacy array layouts", () => {
    const parsed = parseLayoutData(JSON.stringify(rows));

    expect(parsed.rows).toEqual(rows);
    expect(parsed.customWidths).toEqual({});
    expect(parsed.isLegacy).toBe(true);
    expect(parsed.items).toMatchObject([
      { id: "old-refraction-1", type: "old-refraction", x: 0, y: 0, w: 12 },
      { id: "cover-test-1", type: "cover-test", x: 12, y: 0, w: 6 },
    ]);
  });

  test("parseLayoutData handles v2 grid layouts", () => {
    const layout = {
      version: 2,
      grid: { columns: 24 },
      items: [
        {
          id: "notes-1",
          type: "notes",
          x: 6,
          y: 2,
          w: 8,
          title: "Plan",
          showEyeLabels: false,
        },
      ],
    };

    const parsed = parseLayoutData(JSON.stringify(layout));

    expect(parsed.isLegacy).toBe(false);
    expect(parsed.items).toEqual(layout.items);
    expect(parsed.rows).toEqual([
      {
        id: "lane-2",
        cards: [
          { id: "notes-1", type: "notes", title: "Plan", showEyeLabels: false },
        ],
      },
    ]);
  });

  test("legacyRowsToGridItems preserves custom widths and eye-label defaults", () => {
    const layoutRows: CardRow[] = [
      {
        id: "row-a",
        cards: [
          { id: "objective-1", type: "objective" },
          { id: "notes-1", type: "notes", title: "Notes" },
        ],
      },
    ];

    const items = legacyRowsToGridItems(layoutRows, {
      "row-a": { "objective-1": 25, "notes-1": 75 },
    });

    expect(items).toMatchObject([
      { id: "objective-1", x: 0, y: 0, w: 6, showEyeLabels: true },
      {
        id: "notes-1",
        x: 6,
        y: 0,
        w: 18,
        title: "Notes",
        showEyeLabels: false,
      },
    ]);
  });

  test("legacy undersized layout widths are preserved until save", () => {
    const layoutRows: CardRow[] = [
      {
        id: "row-a",
        cards: [{ id: "objective-1", type: "objective" }],
      },
    ];

    const items = legacyRowsToGridItems(layoutRows, {
      "row-a": { "objective-1": 8 },
    });

    expect(items[0]).toMatchObject({ id: "objective-1", w: 2 });

    const savedLayout = JSON.parse(serializeGridLayoutData(items));
    expect(savedLayout.items[0].w).toBeGreaterThan(items[0].w);
  });

  test("grid collision and resize helpers enforce no overlap", () => {
    const items = [
      { id: "a", type: "objective", x: 0, y: 0, w: 6 },
      { id: "b", type: "notes", x: 8, y: 0, w: 6 },
    ] as any;

    expect(
      findCollision(
        { id: "c", type: "addition", x: 5, y: 0, w: 4 },
        items as any,
      )?.id,
    ).toBe("a");
    expect(
      findCollision(
        { id: "c", type: "addition", x: 6, y: 0, w: 2 },
        items as any,
      ),
    ).toBeUndefined();
    expect(clampResizeWidth(items[0], items as any, 20)).toBe(8);
    expect(clampResizeLeft(items[1], items as any, 2)).toEqual({
      x: 6,
      w: 8,
    });
    expect(clampResizeLeft(items[1], items as any, 7)).toEqual({
      x: 6,
      w: 8,
    });
  });

  test("findNearestAvailableGridX finds the closest opening in the lane", () => {
    const items = [
      { id: "a", type: "objective", x: 0, y: 0, w: 6 },
      { id: "b", type: "notes", x: 12, y: 0, w: 6 },
    ] as any;

    expect(findNearestAvailableGridX(0, 4, 4, items as any)).toBe(6);
    expect(findNearestAvailableGridX(0, 10, 4, items as any)).toBe(8);
    expect(findNearestAvailableGridX(0, 22, 4, items as any)).toBe(20);
    expect(findNearestAvailableGridX(0, 4, 8, items as any)).toBeNull();
  });

  test("findNearestAvailableGridPlacement prefers default width before shrinking", () => {
    const items = [
      { id: "a", type: "objective", x: 0, y: 0, w: 6 },
      { id: "b", type: "notes", x: 15, y: 0, w: 9 },
    ] as any;

    expect(findNearestAvailableGridPlacement(0, 6, 8, 4, items as any)).toEqual(
      { x: 6, w: 8 },
    );
    expect(
      findNearestAvailableGridPlacement(0, 8, 12, 4, items as any),
    ).toEqual({ x: 6, w: 9 });
    expect(
      findNearestAvailableGridPlacement(0, 8, 12, 10, items as any),
    ).toBeNull();
  });

  test("card default and minimum columns scale down on wider screens", () => {
    const scale = getExamLayoutSizeScale(1920);

    expect(scale).toBeCloseTo(2 / 3);
    expect(computeCardGridCols("subjective", 24, scale)).toBeLessThan(
      computeCardGridCols("subjective"),
    );
    expect(computeCardMinGridCols("keratometer", 24, scale)).toBeLessThan(
      computeCardMinGridCols("keratometer"),
    );
  });

  test("serializeGridLayoutData preserves widths below unscaled default when saving with screen scale", () => {
    const scale = getExamLayoutSizeScale(1920);
    const width = computeCardMinGridCols("subjective", 24, scale);
    const savedLayout = JSON.parse(
      serializeGridLayoutData(
        [{ id: "subjective-1", type: "subjective", x: 0, y: 0, w: width }],
        24,
        { sizeScale: scale },
      ),
    );

    expect(width).toBeLessThan(computeCardGridCols("subjective"));
    expect(savedLayout.items[0].w).toBe(width);
  });

  test("gridItemsToRowsForMetadata sorts by lane and column", () => {
    const rowsFromGrid = gridItemsToRowsForMetadata([
      { id: "b", type: "notes", x: 8, y: 1, w: 4 },
      { id: "a", type: "objective", x: 2, y: 1, w: 4 },
      { id: "c", type: "addition", x: 0, y: 2, w: 4 },
    ] as any);

    expect(rowsFromGrid.map((row) => row.cards.map((card) => card.id))).toEqual(
      [["a", "b"], ["c"]],
    );
  });
});

describe("virtual full data source resolution", () => {
  test("resolves direct and nested tab sources", () => {
    const sources = {
      "old-refraction-old-refraction-1-tab-a": 12,
    };

    expect(
      resolveFullDataSourceInstanceId(
        "old-refraction-old-refraction-1-tab-a",
        {},
        sources,
      ),
    ).toBe(12);
    expect(
      resolveFullDataSourceInstanceId(
        "old-refraction-old-refraction-1-tab-b",
        { card_id: "old-refraction-1" },
        sources,
      ),
    ).toBe(12);
  });
});

describe("internal full data tab helpers", () => {
  test("classifies hidden Full Data as internal and unsaved", () => {
    const fullDataTab = {
      id: VIRTUAL_FULL_DATA_TAB_ID,
      layout_id: null,
      name: FULL_DATA_NAME,
      layout_data: "[]",
      isActive: true,
    };

    expect(isInternalFullDataTab(fullDataTab)).toBe(true);
    expect(isPersistableLayoutTab(fullDataTab)).toBe(false);
  });

  test("keeps normal real layout tabs persistable", () => {
    const realTab = {
      id: 453995,
      layout_id: 42,
      name: "Objective",
      layout_data: "[]",
      isActive: false,
    };

    expect(isInternalFullDataTab(realTab)).toBe(false);
    expect(isPersistableLayoutTab(realTab)).toBe(true);
  });
});
