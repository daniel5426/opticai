import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CoverTestExam } from "@/lib/db/schema"
import { Triangle } from "lucide-react"

interface CoverTestTabProps {
  coverTestData: CoverTestExam;
  onCoverTestChange: (field: keyof CoverTestExam, value: string) => void;
  isEditing: boolean;
  needsMiddleSpacer?: boolean;
}

export function CoverTestTab({
  coverTestData,
  onCoverTestChange,
  isEditing,
  needsMiddleSpacer = false
}: CoverTestTabProps) {
  const deviationDirections = [
    { value: "Eso", label: "Eso" },
    { value: "Exo", label: "Exo" },
    { value: "Hyper", label: "Hyper" }
  ];

  const deviationTypes = [
    { value: "Phoria", label: "Phoria" },
    { value: "Tropia", label: "Tropia" }
  ];

  const isPhoria = coverTestData.deviation_type === "Phoria";

  return (
    <Card className="w-full shadow-md border-[1px] pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Cover Test</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-2 items-center">
            {/* Row 1: Titles */}
            <div className="h-4 flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">Deviation</span>
            </div>
            <div className="h-4 flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">FV</span>
            </div>
            <div className="h-4 flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">NV</span>
            </div>

            {/* Row 2: Direction, fv_1, nv_1 */}
            <Select
              value={coverTestData.deviation_direction || ""}
              onValueChange={(value) => onCoverTestChange("deviation_direction", value)}
              disabled={!isEditing}
            >
              <SelectTrigger size="xs" className={`h-8 w-full text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
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
                onChange={(e) => onCoverTestChange("fv_1", e.target.value)}
                disabled={!isEditing}
                className={`h-8 w-full text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${isPhoria ? 'pr-7' : 'pr-1'}`}
              />
              {isPhoria && (
                <Triangle size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              )}
            </div>
            
            <div className="relative w-full">
              <Input
                type="number"
                step="0.25"
                value={coverTestData.nv_1?.toString() || ""}
                onChange={(e) => onCoverTestChange("nv_1", e.target.value)}
                disabled={!isEditing}
                className={`h-8 w-full text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${isPhoria ? 'pr-7' : 'pr-1'}`}
              />
              {isPhoria && (
                <Triangle size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
              onValueChange={(value) => onCoverTestChange("deviation_type", value)}
              disabled={!isEditing}
            >
              <SelectTrigger size="xs" className={`h-8 w-full text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
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
              onChange={(e) => onCoverTestChange("fv_2", e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
            />

            <Input
              type="number"
              step="0.25"
              value={coverTestData.nv_2?.toString() || ""}
              onChange={(e) => onCoverTestChange("nv_2", e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 