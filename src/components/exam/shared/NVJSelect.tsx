import React, { memo } from "react"
import { NV_J_VALUES } from "../data/exam-constants"
import { EXAM_FIELDS } from "../data/exam-field-definitions"
import { FastSelect } from "./OptimizedInputs"

interface NVJSelectProps {
  value: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
}

export const NVJSelect = memo(function NVJSelect({
  value,
  onChange,
  disabled = false,
  className = ""
}: NVJSelectProps) {
  return (
    <FastSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={NV_J_VALUES}
      size="xs"
      triggerClassName={`h-8 text-xs w-full ${className}`}
      center={EXAM_FIELDS.J.center}
    />
  )
})
