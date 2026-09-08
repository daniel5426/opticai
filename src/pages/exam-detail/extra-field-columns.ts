import { CardItem } from "@/components/exam/ExamCardRenderer";
import { hasOptionalEyeField } from "@/components/exam/shared/optionalExamColumns";
import { PrismAxisCompatibility } from "@/lib/prism-axis-compatibility";

export type PackableExamCard = {
  id: string;
  type: CardItem["type"];
  title?: string;
  extraFieldColumns?: number;
};

export class ExamCardFieldLayout {
  static countExtraColumns(
    type: CardItem["type"] | string,
    data: Record<string, unknown> | null | undefined,
  ): number {
    if (!data) return 0;

    let extra = 0;
    if (type === "subjective" || type === "final-subjective") {
      if (PrismAxisCompatibility.hasVerticalPrism(data)) extra += 2;
    }
    if (type === "subjective") {
      if (hasOptionalEyeField(data, "ph")) extra += 1;
      if (hasOptionalEyeField(data, "j")) extra += 1;
    }
    return extra;
  }

  static upsert(
    cards: PackableExamCard[],
    indexByKey: Map<string, number>,
    card: PackableExamCard,
    extraFieldColumns: number,
  ) {
    const key = `${card.type}:${card.id}`;
    const existingIndex = indexByKey.get(key);
    if (existingIndex != null) {
      const existing = cards[existingIndex];
      existing.extraFieldColumns = Math.max(
        existing.extraFieldColumns ?? 0,
        extraFieldColumns,
      );
      return;
    }

    indexByKey.set(key, cards.length);
    cards.push({
      id: card.id,
      type: card.type,
      ...(card.title ? { title: card.title } : {}),
      extraFieldColumns,
    });
  }
}
