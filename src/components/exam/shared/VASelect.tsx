import React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VA_METER_VALUES, VA_DECIMAL_VALUES } from "../data/exam-constants"

interface VASelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  mode?: "meter" | "decimal" // Which VA system to use
}

export function VASelect({ 
  value, 
  onChange, 
  disabled = false, 
  className = "",
  mode = "meter" // Default to meter method (6/6, 6/9, etc.)
}: VASelectProps) {
  const options = mode === "meter" ? VA_METER_VALUES : VA_DECIMAL_VALUES

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger size="xs" className={`h-8 text-xs w-full ${className}`} disabled={disabled}>
        <SelectValue placeholder="" />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
