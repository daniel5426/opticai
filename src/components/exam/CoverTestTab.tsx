import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CoverTestExam } from "@/lib/db/schema-interface";
import { Triangle, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface CoverTestTabProps {
  coverTestData: CoverTestExam;
  onCoverTestChange: (field: keyof CoverTestExam, value: string) => void;
  isEditing: boolean;
  needsMiddleSpacer?: boolean;
  instanceLabel: string;
  tabCount: number;
  activeTab: number;
  onTabChange: (tabIdx: number) => void;
  onAddTab: () => void;
  onDeleteTab?: (tabIdx: number) => void;
  onDuplicateTab?: (tabIdx: number) => void
}

export function CoverTestTab({
  coverTestData,
  onCoverTestChange,
  isEditing,
  needsMiddleSpacer = false,
  instanceLabel,
  tabCount,
  activeTab,
  onTabChange,
  onAddTab,
  onDeleteTab,
  onDuplicateTab,
}: CoverTestTabProps) {
  const [isHoveringTabs, setIsHoveringTabs] = useState(false);
  const [dropdownTabIdx, setDropdownTabIdx] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Always ensure at least one tab exists
  React.useEffect(() => {
    if (tabCount === 0 && isEditing) {
      onAddTab();
    }
  }, [tabCount, isEditing, onAddTab]);

  const handleTabClick = (revIdx: number) => {
    onTabChange(revIdx);
    setDropdownTabIdx(null);
  };

  const handleTabContextMenu = (revIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    setDropdownTabIdx(revIdx);
  };
  React.useEffect(() => {
    const close = () => setDropdownTabIdx(null);
    if (dropdownTabIdx !== null) {
      window.addEventListener('mousedown', close);
      return () => window.removeEventListener('mousedown', close);
    }
  }, [dropdownTabIdx]);

  const deviationDirections = [
    { value: "Eso", label: "Eso" },
    { value: "Exo", label: "Exo" },
    { value: "Hyper", label: "Hyper" },
  ];

  const deviationTypes = [
    { value: "Phoria", label: "Phoria" },
    { value: "Tropia", label: "Tropia" },
  ];

  const isPhoria = coverTestData.deviation_type === "Phoria";

  // Log on change
  const handleChange = (field: keyof CoverTestExam, value: string) => {
    onCoverTestChange(field, value);
  };
  return (
    <Card className="w-full border-none pt-3 pb-4 shadow-md">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="relative flex items-center" style={{ minHeight: 20 }}>
            {/* Tab bar: absolutely positioned to the right (RTL) */}
            <div
              className="absolute bg-accent left-0 rounded-md flex items-center justify-start gap-0"
              onMouseEnter={() => setIsHoveringTabs(true)}
              onMouseLeave={() => setIsHoveringTabs(false)}
              style={{ direction: "rtl" }}
            >
              {tabCount > 1 && Array.from({ length: tabCount }).map((_, idx) => tabCount - 1 - idx).map((revIdx) => (
                <DropdownMenu key={revIdx} open={dropdownTabIdx === revIdx} onOpenChange={open => { if (!open) setDropdownTabIdx(null); }} dir="rtl">
                  <DropdownMenuTrigger asChild>
                    <button
                      ref={(el) => { tabRefs.current[revIdx] = el; }}
                      type="button"
                      className={`rounded border-none px-2 text-xs font-bold transition-all duration-150 ${activeTab === revIdx ? "bg-secondary text-primary" : "bg-transparent text-muted-foreground hover:bg-accent"}`}
                      onClick={() => handleTabClick(revIdx)}
                      onDoubleClick={e => { e.preventDefault(); setDropdownTabIdx(revIdx); }}
                      onContextMenu={e => handleTabContextMenu(revIdx, e)}
                      style={{ outline: "none" }}
                    >
                      {revIdx + 1}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" sideOffset={4} style={{ zIndex: 1000 }}>
                    <DropdownMenuItem 
                      onClick={() => { if (tabCount > 1 && onDeleteTab) { onDeleteTab(revIdx); setDropdownTabIdx(null); } }} 
                      className={`text-destructive ${tabCount <= 1 ? 'opacity-50 pointer-events-none' : ''}`}
                      disabled={tabCount <= 1}
                    >מחק</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { onDuplicateTab && onDuplicateTab(revIdx); setDropdownTabIdx(null); }}>שכפל</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
              <button
                type="button"
                className="bg-transparent hover:bg-accent flex items-center justify-center rounded-full border-none p-1"
                onClick={onAddTab}
                tabIndex={-1}
                style={{
                  outline: "none",
                  opacity: isEditing && tabCount < 5 ? 1 : 0.5,
                  pointerEvents: isEditing && tabCount < 5 ? "auto" : "none",
                  transition: "opacity 0.2s",
                }}
                title="הוסף טאב"
              >
                <Plus size={16} />
              </button>
            </div>
            {/* Title: always centered */}
            <div className="flex-1 text-center">
              <h3 className="font-medium text-muted-foreground">Cover Test</h3>
            </div>
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            {/* Row 1: Titles */}
            <div className="flex h-4 items-center justify-center">
              <span className="text-muted-foreground text-xs font-medium">
                Deviation
              </span>
            </div>
            <div className="flex h-4 items-center justify-center">
              <span className="text-muted-foreground text-xs font-medium">
                FV
              </span>
            </div>
            <div className="flex h-4 items-center justify-center">
              <span className="text-muted-foreground text-xs font-medium">
                NV
              </span>
            </div>

            {/* Row 2: Direction, fv_1, nv_1 */}
            <Select
              value={coverTestData.deviation_direction || ""}
              onValueChange={(value) =>
                handleChange("deviation_direction", value)
              }
              disabled={!isEditing}
            >
              <SelectTrigger
                size="xs"
                className={`h-8 w-full text-xs disabled:cursor-default disabled:opacity-100`}
                disabled={!isEditing}
              >
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                {deviationDirections.map((direction) => (
                  <SelectItem key={direction.value} value={direction.value}>
                    {direction.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative w-full">
              <Input
                type="number"
                step="0.25"
                value={coverTestData.fv_1?.toString() || ""}
                onChange={(e) => handleChange("fv_1", e.target.value)}
                disabled={!isEditing}
                className={`h-8 w-full text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100 ${isPhoria ? "pr-7" : "pr-1"}`}
              />
              {isPhoria && (
                <Triangle
                  size={16}
                  className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2"
                />
              )}
            </div>

            <div className="relative w-full">
              <Input
                type="number"
                step="0.25"
                value={coverTestData.nv_1?.toString() || ""}
                onChange={(e) => handleChange("nv_1", e.target.value)}
                disabled={!isEditing}
                className={`h-8 w-full text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100 ${isPhoria ? "pr-7" : "pr-1"}`}
              />
              {isPhoria && (
                <Triangle
                  size={16}
                  className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2"
                />
              )}
            </div>

            {/* Spacer Row */}
            {needsMiddleSpacer && (
              <>
                <div className="h-8" />
                <div className="h-8" />
                <div className="h-8" />
              </>
            )}

            {/* Row 3: Type, fv_2, nv_2 */}
            <Select
              value={coverTestData.deviation_type || ""}
              onValueChange={(value) =>
                handleChange("deviation_type", value)
              }
              disabled={!isEditing}
            >
              <SelectTrigger
                size="xs"
                className={`h-8 w-full text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {deviationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              step="0.25"
              value={coverTestData.fv_2?.toString() || ""}
              onChange={(e) => handleChange("fv_2", e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
            />

            <Input
              type="number"
              step="0.25"
              value={coverTestData.nv_2?.toString() || ""}
              onChange={(e) => handleChange("nv_2", e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
