import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SensationVisionStabilityExam } from "@/lib/db/schema-interface"

interface ObservationTabProps {
  data: SensationVisionStabilityExam
  onChange: (field: keyof SensationVisionStabilityExam, value: string) => void
  isEditing: boolean
}

const fieldLabels = [
  { key: "sensation", label: "תחושה" },
  { key: "vision", label: "ראיה" },
  { key: "stability", label: "יציבות" },
  { key: "movement", label: "תנועה" },
  { key: "recommendations", label: "המלצות" },
]

export function ObservationTab({ data, onChange, isEditing }: ObservationTabProps) {
  const handleInput = (field: keyof SensationVisionStabilityExam, value: string) => {
    onChange(field, value)
  }

  return (
    <Card className="w-full shadow-md pb-8 pt-3 border-none" dir="rtl">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="text-center mb-4">
          <h3 className="font-semibold text-muted-foreground">Observation</h3>
        </div>
        <div className="grid grid-cols-[50px_1fr_1fr] gap-x-6 gap-y-2 items-center" style={{ scrollbarWidth: 'none' }}>
          <div></div>
          <div className="text-center  text-muted-foreground">ימין</div>
          <div className="text-center  text-muted-foreground">שמאל</div>
          {fieldLabels.map(({ key, label }) => (
            <React.Fragment key={key}>
              <Label className="text-sm font-medium text-right ">{label}</Label>
              <Input
                name={`r_${key}`}
                value={data[`r_${key}` as keyof SensationVisionStabilityExam] || ''}
                onChange={e => handleInput(`r_${key}` as keyof SensationVisionStabilityExam, e.target.value)}
                disabled={!isEditing}
                className={`h-9 pr-2 text-sm flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
              <Input
                name={`l_${key}`}
                value={data[`l_${key}` as keyof SensationVisionStabilityExam] || ''}
                onChange={e => handleInput(`l_${key}` as keyof SensationVisionStabilityExam, e.target.value)}
                disabled={!isEditing}
                className={`h-9 pr-2 text-sm flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 