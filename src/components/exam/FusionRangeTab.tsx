import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface FusionRangeData {
  fv_base_in?: string
  fv_base_in_recovery?: string
  nv_base_in?: string
  nv_base_in_recovery?: string
  fv_base_out?: string
  fv_base_out_recovery?: string
  nv_base_out?: string
  nv_base_out_recovery?: string
}

interface FusionRangeTabProps {
  fusionRangeData: FusionRangeData
  onFusionRangeChange: (field: keyof FusionRangeData, value: string) => void
  isEditing: boolean,
  needsMiddleSpacer?: boolean
}

const columns = [
  { key: "fv_base_in", label: "B (FV)" },
  { key: "fv_base_in_recovery", label: "R (FV)" },
  { key: "nv_base_in", label: "B (NV)" },
  { key: "nv_base_in_recovery", label: "R (NV)" },
]

export function FusionRangeTab({ fusionRangeData, onFusionRangeChange, isEditing , needsMiddleSpacer = false}: FusionRangeTabProps) {
  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3" >
      <CardContent className="px-4" style={{ scrollbarWidth: 'none', direction: 'ltr' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Fusion Range</h3>
          </div>
          <div className="grid grid-cols-[70px_repeat(4,1fr)] gap-2 items-center rtl">
            <div></div>
            {columns.map(col => (
              <div key={col.key} className="text-center text-xs font-medium text-muted-foreground">{col.label}</div>
            ))}
            <div className="text-sm font-medium text-right">Base In</div>
            {columns.map(col => (
              <Input
                key={col.key + '-in'}
                type="text"
                value={fusionRangeData[col.key as keyof FusionRangeData] || ""}
                onChange={e => onFusionRangeChange(col.key as keyof FusionRangeData, e.target.value)}
                disabled={!isEditing}
                className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            ))}
            {needsMiddleSpacer && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {columns.map(({ key }) => (
                  <div key={`spacer-${key}`} className="h-8" />
                ))}
              </>
            )}

            <div className="text-sm font-medium text-right">Base Out</div>
            {columns.map(col => {
              const outKey = col.key.replace('in', 'out') as keyof FusionRangeData
              return (
                <Input
                  key={col.key + '-out'}
                  type="text"
                  value={fusionRangeData[outKey] || ""}
                  onChange={e => onFusionRangeChange(outKey, e.target.value)}
                  disabled={!isEditing}
                  className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                />
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 