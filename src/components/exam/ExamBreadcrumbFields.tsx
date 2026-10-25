import React, { useLayoutEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserSelect } from "@/components/ui/user-select";
import type { DetailProps } from "@/components/exam/ExamCardRenderer";
import { useAppLocale } from "@/localization/use-app-locale";
import { FastInput } from "./shared/OptimizedInputs";

export function ExamBreadcrumbFields({ detailProps }: { detailProps: DetailProps }) {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const { formData, isEditing, handleInputChange, handleSelectChange, setFormData } = detailProps;
  const [density, setDensity] = useState<"full" | "name" | "menu">("full");
  const densityRef = useRef(density);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const nameWidth = `${Math.min(24, Math.max(10, (formData.test_name || t("examName")).length + 2))}ch`;
  const hideDate = density !== "full";
  const hideName = density === "menu";

  useLayoutEffect(() => {
    const fields = fieldsRef.current;
    const measurement = measurementRef.current;
    const row = fields?.closest<HTMLElement>("[data-header-scroll-row]");
    if (!fields || !measurement || !row) return;

    const measure = () => {
      const rowStyle = getComputedStyle(row);
      const children = Array.from(row.children);
      const occupiedWidth = children.reduce(
        (width, child) => width + child.getBoundingClientRect().width,
        0,
      ) + parseFloat(rowStyle.columnGap || "0") * (children.length - 1)
        + parseFloat(rowStyle.paddingLeft) + parseFloat(rowStyle.paddingRight);
      const otherWidth = occupiedWidth - fields.getBoundingClientRect().width;
      const fullWidth = measurement.getBoundingClientRect().width;
      const measuredChildren = measurement.children;
      const nameOnlyWidth = measuredChildren[0].getBoundingClientRect().width
        + measuredChildren[2].getBoundingClientRect().width
        + parseFloat(getComputedStyle(measurement).columnGap);
      const availableWidth = row.clientWidth + 1;
      const nextDensity = otherWidth + fullWidth <= availableWidth
        ? "full"
        : otherWidth + nameOnlyWidth <= availableWidth ? "name" : "menu";

      if (nextDensity === densityRef.current) return;
      // Commit an in-progress field before moving it between header and popover.
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement
        && ["test_name", "exam_date"].includes(focused.name)
        && (fields.contains(focused) || focused.closest("[data-exam-breadcrumb-popover]"))) {
        focused.blur();
      }
      densityRef.current = nextDensity;
      setDensity(nextDensity);
    };

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    [row, fields, measurement, ...Array.from(row.children)].forEach(
      (element) => observer.observe(element),
    );
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const nameInput = (
    <FastInput
      name="test_name"
      aria-label={t("examName")}
      placeholder={t("examName")}
      value={formData.test_name || ""}
      onChange={isEditing ? (value) => handleSelectChange(value, "test_name") : undefined}
      readOnly={!isEditing}
      disabled={!isEditing}
      dir={direction}
      wrapperClassName={hideName ? undefined : "w-auto shrink-0"}
      className={hideName ? "h-9 w-full text-sm" : "h-8 min-w-0 border-transparent bg-transparent px-2 text-start text-base font-medium shadow-none hover:bg-muted/50 disabled:bg-transparent disabled:opacity-100"}
      style={hideName ? undefined : { width: nameWidth }}
    />
  );
  const dateInput = (
    <DateInput
      name="exam_date"
      aria-label={t("date")}
      dir="ltr"
      value={formData.exam_date}
      onChange={handleInputChange}
      disabled={!isEditing}
      className={`${hideDate ? "h-9 w-full text-sm" : "h-8 border-transparent bg-transparent ps-2 shadow-none hover:bg-muted/50 disabled:bg-transparent"} ${direction === "rtl" ? "text-end" : "text-start"}`}
    />
  );

  return (
    <div ref={fieldsRef} className="flex shrink-0 items-center gap-1" dir={direction} data-exam-breadcrumb-density={density}>
      <div ref={measurementRef} aria-hidden="true" className="pointer-events-none invisible fixed top-0 start-0 flex w-max items-center gap-1">
        <span className="shrink-0 text-base font-medium md:text-sm" style={{ width: nameWidth }} />
        <span className="flex shrink-0 items-center gap-1">
          <span className="px-1">/</span>
          <span className="w-36" />
        </span>
        <span className="w-8 shrink-0" />
      </div>
      {!hideName ? nameInput : null}
      {!hideDate ? (
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-muted-foreground px-1" aria-hidden="true">/</span>
          <div className="w-36">{dateInput}</div>
        </div>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t("examDetails")} title={t("examDetails")}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" dir={direction} className="w-64 space-y-4 text-start" data-exam-breadcrumb-popover="">
          {hideName ? (
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs">{t("examName")}</label>
              {nameInput}
            </div>
          ) : null}
          {hideDate ? (
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs">{t("date")}</label>
              {dateInput}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs" id="exam-practitioner-label">{t("practitioner")}</label>
            <UserSelect
              value={formData.user_id}
              disabled={!isEditing}
              dir={direction}
              aria-labelledby="exam-practitioner-label"
              placeholder={t("practitioner")}
              autoDefaultToCurrentUser={isEditing}
              onValueChange={(userId) => setFormData((prev) => ({ ...prev, user_id: userId }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs" id="exam-dominant-eye-label">{t("dominantEye")}</label>
            <Select dir={direction} disabled={!isEditing} value={formData.dominant_eye || ""} onValueChange={(value) => handleSelectChange(value, "dominant_eye")}>
              <SelectTrigger className="w-full" aria-labelledby="exam-dominant-eye-label">
                <SelectValue placeholder={t("dominantEye")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="R">{t("rightEye")}</SelectItem>
                <SelectItem value="L">{t("leftEye")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
