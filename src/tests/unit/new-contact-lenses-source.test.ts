import { beforeEach, expect, test, vi } from "vitest";

const db = vi.hoisted(() => ({ exams: [] as any[], pages: {} as Record<number, any> }));
vi.mock("@/lib/db/exams-db", () => ({
  getExamsByClientId: async () => db.exams,
  getExamPageData: async (id: number) => db.pages[id],
}));
import { fillOldContactLenses, findLatestNewContactLenses } from "@/lib/new-contact-lenses-source";

beforeEach(() => {
  db.exams = [{ id: 3 }, { id: 2 }, { id: 1 }]; // newest first
  db.pages = {
    3: { instances: [{ exam_data: { "new-contact-lenses-a": { layout_instance_id: 9, card_instance_id: "a" } } }] }, // empty card
    2: { instances: [{ exam_data: { "new-contact-lenses-b": { r_model: "Air", r_bc: 8.6, l_sph: -2.5 } } }] },
    1: { instances: [{ exam_data: { "new-contact-lenses-c": { r_model: "Older" } } }] },
  };
});

test("takes the new lenses of the latest exam that filled them", async () => {
  expect(await findLatestNewContactLenses(7)).toEqual({ r_model: "Air", r_bc: 8.6, l_sph: -2.5 });
});

test("no exam with new lenses gives nothing", async () => {
  db.exams = [{ id: 3 }];
  expect(await findLatestNewContactLenses(7)).toBeNull();
});

test("fills only the empty fields of every old lenses card", () => {
  const data = {
    "old-contact-lenses-x": { card_instance_id: "x", r_model: "Typed" },
    "old-contact-lenses": { card_instance_id: "x", r_model: "Typed" },
    "objective-y": { r_sph: 1 },
  };
  const next = fillOldContactLenses(data, { r_model: "Air", r_bc: 8.6, l_sph: -2.5 });
  expect(next["old-contact-lenses-x"]).toEqual({ card_instance_id: "x", r_model: "Typed", r_bc: 8.6, l_sph: -2.5 });
  expect(next["objective-y"]).toBe(data["objective-y"]);
  expect(fillOldContactLenses(next, { r_bc: 9 })).toBe(next);
});
