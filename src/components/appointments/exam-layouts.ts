import { ExamLayout } from "@/lib/db/schema-interface";

export function flattenActiveExamLayouts(layouts: ExamLayout[]): ExamLayout[] {
  return layouts.flatMap((layout) => {
    const children = flattenActiveExamLayouts(layout.children || []);
    if (layout.is_group) {
      if (layout.is_active === false) return [];
      // A group's appointment length applies to every layout inside it.
      return children.map((child) => ({
        ...child,
        appointment_duration: layout.appointment_duration ?? child.appointment_duration,
      }));
    }
    return layout.is_active === false || !layout.id
      ? []
      : [{ ...layout, children: undefined }, ...children];
  });
}

/** The layouts and groups an appointment length is set on: active top-level layouts, and groups by name. */
export function appointmentDurationTargets(layouts: ExamLayout[]): ExamLayout[] {
  return layouts.filter((layout) =>
    layout.is_active !== false &&
    (layout.is_group ? flattenActiveExamLayouts([layout]).length > 0 : !!layout.id),
  );
}
