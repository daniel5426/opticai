import React, { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, PlusCircleIcon, Plus, FolderTree, Loader2 } from "lucide-react"
import type { ExamLayout } from "@/lib/db/schema-interface"


type LayoutSelectorDropdownProps = {
  availableLayouts: ExamLayout[]
  onSelectLayout: (layoutId: number) => void | Promise<void>
  onAddFullData?: () => void | Promise<void>
  onRequestLayouts?: () => void | Promise<void>
  isLoading?: boolean
  disabled?: boolean
  triggerClassName?: string
  triggerLabel?: string
}

const flattenLayouts = (nodes: ExamLayout[]): ExamLayout[] => {
  const collected: ExamLayout[] = []
  const traverse = (items: ExamLayout[]) => {
    items.forEach(item => {
      collected.push(item)
      if (item.children && item.children.length > 0) {
        traverse(item.children)
      }
    })
  }
  traverse(nodes)
  return collected
}

export const LayoutSelectorDropdown = ({
  availableLayouts,
  onSelectLayout,
  onAddFullData,
  onRequestLayouts,
  isLoading,
  disabled,
  triggerClassName,
  triggerLabel = "פריסות"
}: LayoutSelectorDropdownProps) => {
  const flattenedLayouts = useMemo(() => flattenLayouts(availableLayouts), [availableLayouts])
  const hasLeafLayouts = useMemo(
    () => flattenedLayouts.some(layout => !layout.is_group && layout.id != null),
    [flattenedLayouts]
  )

  const handleOpenChange = (open: boolean) => {
    if (open && onRequestLayouts) {
      onRequestLayouts()
    }
  }

  const FULL_DATA_ICON = "/icons/box.png";

  const renderNodes = (nodes: ExamLayout[]): React.ReactNode[] => {
    return nodes.flatMap(node => {
      if (!node.id) {
        return []
      }
      if (node.is_group) {
        return (
          <DropdownMenuSub key={`layout-group-${node.id}`}>
            <DropdownMenuSubTrigger dir="rtl" className="flex items-center justify-between text-sm">
              <span>{node.name}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[220px] text-right">
              <DropdownMenuItem
                onClick={() => onSelectLayout(node.id!)}
                className="text-sm text-primary"
                dir="rtl"
                disabled={isLoading}
              >
                הוסף את כל הקבוצה
              </DropdownMenuItem>
              {renderNodes(node.children || [])}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )
      }
      return (
        <DropdownMenuItem
          key={`layout-${node.id}`}
          dir="rtl"
          className="text-sm"
          onClick={() => onSelectLayout(node.id!)}
          disabled={isLoading}
        >
          {node.name}
        </DropdownMenuItem>
      )
    })
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`h-9 px-4 flex items-center gap-1 ${triggerClassName ?? ""}`}
          disabled={disabled}
        >
          <span>{triggerLabel}</span>
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem dir="rtl" className="text-sm font-bold" disabled>
          הוספת פריסה
        </DropdownMenuItem>
        {onAddFullData ? (
          <DropdownMenuItem
            dir="rtl"
            className="text-sm"
            onClick={onAddFullData}
            disabled={isLoading}
          >
                        <img src={FULL_DATA_ICON} alt="כל הנתונים" style={{ width: "20px", height: "20px", objectFit: "contain" }} />

            כל הנתונים
          </DropdownMenuItem>
        ) : null}
        {isLoading ? (
          <DropdownMenuItem dir="rtl" disabled className="text-sm">
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            טוען...
          </DropdownMenuItem>
        ) : hasLeafLayouts ? (
          renderNodes(availableLayouts)
        ) : (
          <DropdownMenuItem disabled className="text-sm">
            אין פריסות זמינות
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

