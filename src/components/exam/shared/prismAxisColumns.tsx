import type { ReactNode } from "react"
import { Minus, Plus } from "lucide-react"
import { EXAM_FIELDS, FieldConfig } from "@/components/exam/data/exam-field-definitions"

export type PrismAxisColumn = FieldConfig & {
  key: string
  type?: string
  options?: string[]
  headerAccessory?: ReactNode
}

export function buildPrismAxisColumns(options: {
  showVertical: boolean
  showAddVertical: boolean
  compactBase: PrismAxisColumn
  expandedLabels: {
    prismHorizontal: string
    baseHorizontal: string
    prismVertical: string
    baseVertical: string
  }
  addVerticalLabel: string
  onAddVertical: () => void
  showRemoveVertical?: boolean
  removeVerticalLabel?: string
  onRemoveVertical?: () => void
}): PrismAxisColumn[] {
  const {
    showVertical,
    showAddVertical,
    compactBase,
    expandedLabels,
    addVerticalLabel,
    onAddVertical,
    showRemoveVertical,
    removeVerticalLabel,
    onRemoveVertical,
  } = options
  if (!showVertical) {
    return [
      {
        key: "pris",
        ...EXAM_FIELDS.PRISM,
        headerAccessory: showAddVertical ? (
          <button
            type="button"
            onClick={onAddVertical}
            aria-label={addVerticalLabel}
            title={addVerticalLabel}
            className="text-muted-foreground hover:text-foreground inline-flex h-4 w-4 items-center justify-center rounded"
          >
            <Plus size={12} />
          </button>
        ) : undefined,
      } as PrismAxisColumn,
      compactBase,
    ]
  }
  return [
    {
      key: "pris",
      ...EXAM_FIELDS.PRISM,
      label: expandedLabels.prismHorizontal,
      headerAccessory:
        showRemoveVertical && removeVerticalLabel && onRemoveVertical ? (
          <button
            type="button"
            onClick={onRemoveVertical}
            aria-label={removeVerticalLabel}
            title={removeVerticalLabel}
            className="text-muted-foreground hover:text-foreground inline-flex h-4 w-4 items-center justify-center rounded"
          >
            <Minus size={12} />
          </button>
        ) : undefined,
    },
    { ...compactBase, key: "base", label: expandedLabels.baseHorizontal },
    { key: "pr_v", ...EXAM_FIELDS.PRISM, label: expandedLabels.prismVertical },
    { ...compactBase, key: "base_v", label: expandedLabels.baseVertical },
  ]
}
