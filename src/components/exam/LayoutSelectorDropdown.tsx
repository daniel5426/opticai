import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, Plus, Loader2 } from "lucide-react";
import type { ExamLayout } from "@/lib/db/schema-interface";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";

type LayoutSelectorDropdownProps = {
  availableLayouts: ExamLayout[];
  onSelectLayout: (layoutId: number) => void | Promise<void>;
  onRequestLayouts?: () => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  triggerClassName?: string;
  triggerLabel?: string;
  iconOnly?: boolean;
};

const flattenLayouts = (nodes: ExamLayout[]): ExamLayout[] => {
  const collected: ExamLayout[] = [];
  const traverse = (items: ExamLayout[]) => {
    items.forEach((item) => {
      collected.push(item);
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    });
  };
  traverse(nodes);
  return collected;
};

export const LayoutSelectorDropdown = ({
  availableLayouts,
  onSelectLayout,
  onRequestLayouts,
  isLoading,
  disabled,
  triggerClassName,
  triggerLabel,
  iconOnly = false,
}: LayoutSelectorDropdownProps) => {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const resolvedTriggerLabel = triggerLabel ?? t(iconOnly ? "addLayout" : "layouts");
  const flattenedLayouts = useMemo(
    () => flattenLayouts(availableLayouts),
    [availableLayouts],
  );
  const hasLeafLayouts = useMemo(
    () =>
      flattenedLayouts.some((layout) => !layout.is_group && layout.id != null),
    [flattenedLayouts],
  );

  const handleOpenChange = (open: boolean) => {
    if (open && onRequestLayouts) {
      onRequestLayouts();
    }
  };

  const renderNodes = (nodes: ExamLayout[]): React.ReactNode[] => {
    return nodes.flatMap((node) => {
      if (!node.id) {
        return [];
      }
      if (node.is_group) {
        return (
          <DropdownMenuSub key={`layout-group-${node.id}`}>
            <DropdownMenuSubTrigger
              dir={direction}
              className="flex items-center justify-between text-sm"
            >
              <span>{node.name}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[220px] text-start">
              <DropdownMenuItem
                onClick={() => onSelectLayout(node.id!)}
                className="text-primary text-sm"
                dir={direction}
                disabled={isLoading}
              >
                {t("addEntireGroup")}
              </DropdownMenuItem>
              {renderNodes(node.children || [])}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      }
      return (
        <DropdownMenuItem
          key={`layout-${node.id}`}
          dir={direction}
          className="text-sm"
          onClick={() => onSelectLayout(node.id!)}
          disabled={isLoading}
        >
          {node.name}
        </DropdownMenuItem>
      );
    });
  };

  return (
    <DropdownMenu dir={direction} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={iconOnly ? "ghost" : "outline"}
          size={iconOnly ? "icon" : "default"}
          className={
            iconOnly
              ? `mb-1 size-8 shrink-0 ${triggerClassName ?? ""}`
              : `flex h-9 items-center gap-1 px-4 ${triggerClassName ?? ""}`
          }
          disabled={disabled}
          aria-label={resolvedTriggerLabel}
          title={iconOnly ? resolvedTriggerLabel : undefined}
        >
          {iconOnly ? (
            <Plus className="size-4" />
          ) : (
            <>
              <span>{resolvedTriggerLabel}</span>
              <ChevronDownIcon className="h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={iconOnly ? "start" : "end"} className="w-56">
        <DropdownMenuItem
          dir={direction}
          className="text-sm font-bold"
          disabled
        >
          {t("addLayout")}
        </DropdownMenuItem>
        {isLoading ? (
          <DropdownMenuItem dir={direction} disabled className="text-sm">
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            {t("loadingLayouts")}
          </DropdownMenuItem>
        ) : hasLeafLayouts ? (
          renderNodes(availableLayouts)
        ) : (
          <DropdownMenuItem disabled className="text-sm">
            {t("noLayoutsAvailable")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
