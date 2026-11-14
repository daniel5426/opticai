import { beforeEach, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({ getLookupTable: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: api }));

import { lookupTables } from "@/lib/db/lookup-db";
import { EXAM_FIELDS } from "@/components/exam/data/exam-field-definitions";

const lists: Record<string, string[]> = { suppliers: ["Hoya"], "frame-suppliers": ["Safilo"], colors: ["Brown"] };

beforeEach(() => {
  api.getLookupTable.mockReset();
  api.getLookupTable.mockImplementation(async (table: string) =>
    lists[table] ? { data: lists[table].map((name) => ({ name })) } : { error: "Not found" },
  );
});

test("frames and contact lenses read their own supplier and color lists", () => {
  expect(EXAM_FIELDS.CONTACT_LENS_SUPPLIER.lookupType).toBe("contactLensSupplier");
  expect(EXAM_FIELDS.CONTACT_LENS_COLOR.lookupType).toBe("contactLensColor");
  for (const key of ["frameSupplier", "contactLensSupplier", "frameColor", "contactLensColor"]) {
    expect(lookupTables).toHaveProperty(key);
  }
});

test("a split list reads its own table, and the shared one until the server has it", async () => {
  expect(await lookupTables.frameSupplier.getAll(1)).toEqual([{ name: "Safilo" }]);
  expect(api.getLookupTable).toHaveBeenCalledWith("frame-suppliers", 1);
  // Before migration 0069 the server has no contact lens supplier or frame color list.
  expect(await lookupTables.contactLensSupplier.getAll(1)).toEqual([{ name: "Hoya" }]);
  expect(await lookupTables.frameColor.getAll(1)).toEqual([{ name: "Brown" }]);
});
