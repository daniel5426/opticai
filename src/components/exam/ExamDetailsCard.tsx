import React from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserSelect } from "@/components/ui/user-select"
import type { DetailProps } from "@/components/exam/ExamCardRenderer"
import type { OpticalExam } from "@/lib/db/schema-interface"

type Exam = OpticalExam

interface ExamDetailsCardProps {
  mode: "editor" | "detail"
  detailProps?: DetailProps
  className?: string
  actions?: React.ReactNode
}

import { FastInput } from "./shared/OptimizedInputs"

export const ExamDetailsCard = ({ mode, detailProps, className, actions }: ExamDetailsCardProps) => {
  const isEditing = mode === "editor" ? false : !!detailProps?.isEditing
  const testNameValue =
    mode === "editor"
      ? "דוגמה"
      : detailProps?.isNewMode
        ? detailProps?.formData.test_name
        : detailProps?.exam?.test_name || detailProps?.formData.test_name
  return (
    <Card
      className={`w-full examcard rounded-xl px-4 py-3 bg-background ${className ?? ""}`}
    >
      <div
        className="flex items-center gap-2 w-full whitespace-nowrap overflow-x-auto no-scrollbar text-sm"
        dir="rtl"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="min-w-[80px]">
          {mode === "editor" ? (
            <span className="px-3 py-1 rounded-lg bg-accent/50 w-full text-center">{testNameValue}</span>
          ) : (
            <FastInput
              type="text"
              name="test_name"
              placeholder="שם הבדיקה"
              value={detailProps?.formData.test_name || ""}
              onChange={isEditing ? (val) => detailProps?.handleInputChange({ target: { name: 'test_name', value: val } } as any) : undefined}
              className="h-9 w-full text-sm"
              readOnly={!isEditing}
              disabled={!isEditing}
            />
          )}
        </div>
        <div className="min-w-[20px] max-w-[130px]">
          <DateInput
            name="exam_date"
            className="h-9 w-full text-sm"
            value={mode === "editor" ? new Date().toISOString().split("T")[0] : detailProps?.formData.exam_date}
            disabled={!isEditing}
            onChange={detailProps?.handleInputChange || (() => { })}
          />
        </div>
        <div className="min-w-[60px]">
          <UserSelect
            value={mode === "editor" ? 0 : detailProps?.formData.user_id}
            disabled={!isEditing && mode !== "editor"}
            onValueChange={(userId) =>
              mode === "editor"
                ? () => { }
                : detailProps?.setFormData((prev: Partial<Exam>) => ({ ...prev, user_id: userId }))
            }
          />
        </div>
        <div className="min-w-[30px]">
          <Select
            dir="rtl"
            disabled={!isEditing && mode !== "editor"}
            value={mode === "editor" ? "R" : detailProps?.formData.dominant_eye || ""}
            onValueChange={(value) =>
              mode === "editor" ? () => { } : detailProps?.handleSelectChange(value, "dominant_eye")
            }
          >
            <SelectTrigger className="h-9 w-full" disabled={!isEditing && mode !== "editor"}>
              <SelectValue placeholder="עין דומיננטית" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="R" className="text-sm">
                עין ימין
              </SelectItem>
              <SelectItem value="L" className="text-sm">
                עין שמאל
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        {actions ? <div className="flex items-center gap-2 min-w-fit">{actions}</div> : null}
      </div>
    </Card>
  )
}


