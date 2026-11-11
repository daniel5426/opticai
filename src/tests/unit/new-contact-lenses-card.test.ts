import { expect, test } from "vitest"
import { examComponentRegistry } from "@/lib/exam-component-registry"
import { ExamFieldMapper } from "@/lib/exam-field-mappings"

test("the new contact lenses card is in the layout editor and copies like the old lenses one", () => {
  const config = examComponentRegistry.get("new-contact-lenses")
  expect(config?.name).toBe("עדשות מגע חדשות")
  expect(config?.showInLayoutEditor).toBe(true)
  const copied = ExamFieldMapper.copyData({ r_sph: "-2.00", r_bc: "8.6", l_model: "Air" } as any, {} as any, "old-contact-lenses", "new-contact-lenses") as any
  expect(copied).toMatchObject({ r_sph: "-2.00", r_bc: "8.6", l_model: "Air" })
})
