import React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NV_J_VALUES } from "../data/exam-constants"

interface NVJSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function NVJSelect({ 
  value, 
  onChange, 
  disabled = false, 
  className = ""
}: NVJSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger size="xs" className={`h-8 text-xs w-full ${className}`} disabled={disabled}>
        <SelectValue placeholder="" />
      </SelectTrigger>
      <SelectContent>
        {NV_J_VALUES.map(opt => (
          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
