import { ExamLayout } from "@/lib/db/schema-interface";

export function flattenActiveExamLayouts(layouts: ExamLayout[]): ExamLayout[] {
  return layouts.flatMap((layout) => {
    const children = flattenActiveExamLayouts(layout.children || []);
    if (layout.is_group) return layout.is_active === false ? [] : children;
    return layout.is_active === false || !layout.id
      ? []
      : [{ ...layout, children: undefined }, ...children];
  });
}
