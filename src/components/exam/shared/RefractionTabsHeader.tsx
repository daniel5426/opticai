import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useAppLocale } from "@/localization/use-app-locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { GLASSES_TYPES } from "@/components/exam/data/exam-constants";
import { OrdersHistoryButton } from "./OrdersHistoryButton";

interface RefractionTabsHeaderProps {
  title: string;
  tabCount: number;
  activeTab: number;
  tabTypes: Array<string | undefined>;
  emptyTabLabel?: string;
  isEditing: boolean;
  onTabChange: (index: number) => void;
  onAddTab: (type: string) => void;
  onDeleteTab?: (index: number) => void;
  onDuplicateTab?: (index: number) => void;
  onUpdateType?: (index: number, type: string) => void;
  /** Shows only this card's title, for views where each refraction already has its own page tab. */
  hideTabs?: boolean;
  tabLabel?: string;
  /** Shows the orders button beside the title. */
  onShowOrdersHistory?: () => void;
}

export function RefractionTabsHeader({
  title,
  tabCount,
  activeTab,
  tabTypes,
  emptyTabLabel,
  isEditing,
  onTabChange,
  onAddTab,
  onDeleteTab,
  onDuplicateTab,
  onUpdateType,
  hideTabs = false,
  tabLabel,
  onShowOrdersHistory,
}: RefractionTabsHeaderProps) {
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const { direction } = useAppLocale();

  if (hideTabs) {
    return (
      <div className="text-center">
        <h3 className="text-muted-foreground inline-flex items-center gap-1 font-medium">
          {tabLabel ? `${title} · ${tabLabel}` : title}
          {onShowOrdersHistory && <OrdersHistoryButton onClick={onShowOrdersHistory} />}
        </h3>
      </div>
    );
  }

  return (
    <div className="relative flex items-center" style={{ minHeight: 24 }}>
      <div
        className="bg-accent absolute left-0 flex items-center justify-start gap-0 rounded-md pe-1"
        style={{ direction }}
      >
        {Array.from({ length: tabCount })
          .map((_, index) => tabCount - 1 - index)
          .map((index) => {
            const currentType = tabTypes[index];
            const otherTypes = GLASSES_TYPES.filter(
              (type) => type !== currentType,
            );
            return (
              <DropdownMenu
                key={index}
                open={menuIndex === index}
                onOpenChange={(open) => {
                  if (!open) setMenuIndex(null);
                }}
                dir={direction}
                modal={false}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`rounded border-none px-2 text-xs font-bold transition-all duration-150 ${activeTab === index ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-accent bg-transparent"}`}
                    onClick={() => {
                      onTabChange(index);
                      if (!currentType && emptyTabLabel && isEditing) {
                        setMenuIndex(index);
                      }
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (isEditing) setMenuIndex(index);
                    }}
                  >
                    {currentType || emptyTabLabel || index + 1}
                    {!currentType && emptyTabLabel && isEditing && (
                      <ChevronDown className="ms-1 inline-block" size={12} aria-hidden="true" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={4}>
                  <DropdownMenuItem
                    className="text-destructive"
                    disabled={!isEditing || tabCount <= 1}
                    onClick={() => {
                      onDeleteTab?.(index);
                      setMenuIndex(null);
                    }}
                  >
                    מחק
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!isEditing || tabCount >= 5}
                    onClick={() => {
                      onDuplicateTab?.(index);
                      setMenuIndex(null);
                    }}
                  >
                    שכפל
                  </DropdownMenuItem>
                  {isEditing && otherTypes.length > 0 && (
                    <>
                      <div className="bg-muted my-1 h-px" />
                      <div className="text-muted-foreground px-2 py-1 text-right text-[10px] font-medium">
                        שנה סוג ל:
                      </div>
                      {otherTypes.map((type) => (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => {
                            onUpdateType?.(index, type);
                            setMenuIndex(null);
                          }}
                        >
                          {type}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        <DropdownMenu dir={direction} modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="hover:bg-accent flex items-center justify-center rounded-full border-none bg-transparent p-1 disabled:pointer-events-none disabled:opacity-50"
              disabled={!isEditing || tabCount >= 5}
              title="הוסף טאב"
            >
              <Plus size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" sideOffset={4}>
            <div className="text-muted-foreground px-2 py-1 text-right text-[10px] font-medium">
              בחר סוג רפרקציה:
            </div>
            {GLASSES_TYPES.map((type) => (
              <DropdownMenuItem key={type} onClick={() => onAddTab(type)}>
                {type}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 text-center">
        <h3 className="text-muted-foreground inline-flex items-center gap-1 font-medium">
          {title}
          {onShowOrdersHistory && <OrdersHistoryButton onClick={onShowOrdersHistory} />}
        </h3>
      </div>
    </div>
  );
}
