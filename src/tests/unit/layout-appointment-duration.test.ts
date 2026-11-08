import { describe, expect, test } from "vitest";
import {
  appointmentDurationTargets,
  flattenActiveExamLayouts,
} from "@/components/appointments/exam-layouts";
import { ExamLayout } from "@/lib/db/schema-interface";

const layout = (id: number, extra: Partial<ExamLayout> = {}): ExamLayout => ({
  id,
  name: `layout ${id}`,
  layout_data: "{}",
  ...extra,
});

const tree = [
  layout(1, { appointment_duration: 20 }),
  layout(2, {
    is_group: true,
    appointment_duration: 45,
    children: [layout(3, { parent_layout_id: 2 }), layout(4, { parent_layout_id: 2, is_active: false })],
  }),
  layout(5, { is_group: true, children: [layout(6, { is_active: false })] }),
  layout(7, { is_active: false }),
];

describe("appointment length per exam layout", () => {
  test("lists active layouts and groups by name", () => {
    expect(appointmentDurationTargets(tree).map((item) => item.id)).toEqual([1, 2]);
  });

  test("layouts in a group book with the group's length", () => {
    expect(
      flattenActiveExamLayouts(tree).map((item) => [item.id, item.appointment_duration]),
    ).toEqual([
      [1, 20],
      [3, 45],
    ]);
  });
});
