import { useState } from "react";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const GLASSES_TYPES = ["רחוק", "קרוב", "מולטיפוקל", "ביפוקל"];

interface RefractionTabsHeaderProps {
  title: string;
  tabCount: number;
  activeTab: number;
  tabTypes: Array<string | undefined>;
  isEditing: boolean;
  onTabChange: (index: number) => void;
  onAddTab: (type: string) => void;
  onDeleteTab?: (index: number) => void;
  onDuplicateTab?: (index: number) => void;
  onUpdateType?: (index: number, type: string) => void;
}

export function RefractionTabsHeader({
  title,
  tabCount,
  activeTab,
  tabTypes,
  isEditing,
  onTabChange,
  onAddTab,
  onDeleteTab,
  onDuplicateTab,
  onUpdateType,
}: RefractionTabsHeaderProps) {
  const [menuIndex, setMenuIndex] = useState<number | null>(null);

  return (
    <div className="relative flex items-center" style={{ minHeight: 24 }}>
      <div
        className="bg-accent absolute left-0 flex items-center justify-start gap-0 rounded-md pr-1"
        style={{ direction: "rtl" }}
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
                dir="rtl"
                modal={false}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`rounded border-none px-2 text-xs font-bold transition-all duration-150 ${activeTab === index ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-accent bg-transparent"}`}
                    onClick={() => onTabChange(index)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (isEditing) setMenuIndex(index);
                    }}
                  >
                    {currentType || index + 1}
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
        <DropdownMenu dir="rtl" modal={false}>
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
        <h3 className="text-muted-foreground font-medium">{title}</h3>
      </div>
    </div>
  );
}
