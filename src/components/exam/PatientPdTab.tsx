import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { PatientPdExam } from "@/lib/db/schema-interface";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { PDCalculationUtils } from "./data/exam-constants";
import { FastInput } from "./shared/OptimizedInputs";

interface PatientPdTabProps {
  data: PatientPdExam;
  onChange: (field: keyof PatientPdExam, value: string) => void;
  isEditing: boolean;
}

export function PatientPdTab({ data, onChange, isEditing }: PatientPdTabProps) {
  const { t } = useTranslation();
  const dataRef = useRef(data);
  dataRef.current = data;

  const handleChange = (eye: "R" | "L" | "C", value: string) => {
    PDCalculationUtils.handlePDChange({
      eye,
      field: "pd",
      value,
      data: dataRef.current,
      onChange,
      getRValue: (d) => Number.parseFloat(String(d.r_pd ?? "0")) || 0,
      getLValue: (d) => Number.parseFloat(String(d.l_pd ?? "0")) || 0,
    });
  };

  const renderInput = (
    eye: "R" | "L" | "C",
    value: string,
    config: typeof EXAM_FIELDS.PD_FAR | typeof EXAM_FIELDS.PD_COMB,
  ) => (
    <FastInput
      type="number"
      step={config.step}
      min={config.min}
      max={config.max}
      value={value}
      onChange={(next) => handleChange(eye, next)}
      disabled={!isEditing}
      dir="ltr"
      suffix={config.suffix}
      className="h-8 w-full min-w-0 text-xs disabled:cursor-default disabled:opacity-100"
    />
  );

  return (
    <Card className="examcard w-full pt-3 pb-4">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-2">
          <div className="text-center">
            <h3 className="text-muted-foreground font-medium">
              {t("patientPd")}
            </h3>
          </div>
          <div className="grid grid-cols-[1.25rem_minmax(4.5rem,1fr)] items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">R</span>
            {renderInput("R", String(data.r_pd ?? ""), EXAM_FIELDS.PD_FAR)}
            <span className="text-muted-foreground text-center text-xs font-medium">
              C
            </span>
            {renderInput("C", String(data.comb_pd ?? ""), EXAM_FIELDS.PD_COMB)}
            <span className="text-muted-foreground text-xs font-medium">L</span>
            {renderInput("L", String(data.l_pd ?? ""), EXAM_FIELDS.PD_FAR)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
