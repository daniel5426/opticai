import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserSelect } from "@/components/ui/user-select";
import type { DetailProps } from "@/components/exam/ExamCardRenderer";
import type { OpticalExam } from "@/lib/db/schema-interface";

type Exam = OpticalExam;

interface ExamDetailsCardProps {
  mode: "editor" | "detail";
  detailProps?: DetailProps;
  className?: string;
  actions?: React.ReactNode;
}

import { FastInput } from "./shared/OptimizedInputs";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";

export const ExamDetailsCard = ({
  mode,
  detailProps,
  className,
  actions,
}: ExamDetailsCardProps) => {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const isEditing = mode === "editor" ? false : !!detailProps?.isEditing;
  const testNameValue =
    mode === "editor"
      ? t("sample")
      : detailProps?.isNewMode
        ? detailProps?.formData.test_name
        : detailProps?.exam?.test_name || detailProps?.formData.test_name;
  return (
    <Card
      className={`examcard bg-background w-full rounded-xl px-4 py-3 ${className ?? ""}`}
    >
      <div
        className="no-scrollbar flex w-full items-end gap-2 overflow-x-auto text-sm whitespace-nowrap"
        dir={direction}
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex min-w-[80px] flex-col gap-1">
          <label className="text-muted-foreground text-xs">
            {t("examName")}
          </label>
          {mode === "editor" ? (
            <span className="bg-accent/50 w-full rounded-lg px-3 py-1 text-center">
              {testNameValue}
            </span>
          ) : (
            <FastInput
              type="text"
              name="test_name"
              placeholder={t("examName")}
              value={detailProps?.formData.test_name || ""}
              onChange={
                isEditing
                  ? (val) =>
                      detailProps?.handleInputChange({
                        target: { name: "test_name", value: val },
                      } as any)
                  : undefined
              }
              className="h-9 w-full text-sm"
              readOnly={!isEditing}
              disabled={!isEditing}
            />
          )}
        </div>
        <div className="flex max-w-[130px] min-w-[20px] flex-col gap-1">
          <label className="text-muted-foreground text-xs">{t("date")}</label>
          <DateInput
            name="exam_date"
            className="h-9 w-full text-sm"
            value={
              mode === "editor"
                ? new Date().toISOString().split("T")[0]
                : detailProps?.formData.exam_date
            }
            disabled={!isEditing}
            onChange={detailProps?.handleInputChange || (() => {})}
          />
        </div>
        <div className="flex min-w-[60px] flex-col gap-1">
          <label className="text-muted-foreground text-xs">
            {t("practitioner")}
          </label>
          <UserSelect
            value={mode === "editor" ? 0 : detailProps?.formData.user_id}
            disabled={!isEditing && mode !== "editor"}
            onValueChange={(userId) =>
              mode === "editor"
                ? () => {}
                : detailProps?.setFormData((prev: Partial<Exam>) => ({
                    ...prev,
                    user_id: userId,
                  }))
            }
          />
        </div>
        <div className="flex min-w-[30px] flex-col gap-1">
          <label className="text-muted-foreground text-xs">
            {t("dominantEye")}
          </label>
          <Select
            dir={direction}
            disabled={!isEditing && mode !== "editor"}
            value={
              mode === "editor" ? "R" : detailProps?.formData.dominant_eye || ""
            }
            onValueChange={(value) =>
              mode === "editor"
                ? () => {}
                : detailProps?.handleSelectChange(value, "dominant_eye")
            }
          >
            <SelectTrigger
              className="h-9 w-full"
              disabled={!isEditing && mode !== "editor"}
            >
              <SelectValue placeholder={t("dominantEye")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="R" className="text-sm">
                {t("rightEye")}
              </SelectItem>
              <SelectItem value="L" className="text-sm">
                {t("leftEye")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        {actions ? (
          <div className="flex min-w-fit items-center gap-2 self-center">
            {actions}
          </div>
        ) : null}
      </div>
    </Card>
  );
};
