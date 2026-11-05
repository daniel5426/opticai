import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronUp, ChevronDown } from "lucide-react"
import { SchirmerTestExam } from "@/lib/db/schema-interface"
import { EXAM_FIELDS } from "./data/exam-field-definitions"
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"
import { ImportedClinicalContext } from '@/lib/imported-clinical-context'
import { useTranslation } from 'react-i18next'

interface SchirmerTestTabProps {
  schirmerTestData: SchirmerTestExam
  onSchirmerTestChange: (field: keyof SchirmerTestExam, value: string) => void
  isEditing: boolean
  hideEyeLabels?: boolean
  needsMiddleSpacer?: boolean
}

export function SchirmerTestTab({
  schirmerTestData,
  onSchirmerTestChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: SchirmerTestTabProps) {
  const { t } = useTranslation();
  const butOnly = React.useContext(ImportedClinicalContext)?.butOnly === true;
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null)

  const dataRef = useRef(schirmerTestData);
  dataRef.current = schirmerTestData;

  const columns = [
    { key: "mm", ...EXAM_FIELDS.MM },
    { key: "but", ...EXAM_FIELDS.BUT }
  ].filter(column => !butOnly || column.key === 'but')

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof SchirmerTestExam
    return schirmerTestData[eyeField]?.toString() || ""
  }

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof SchirmerTestExam
    onSchirmerTestChange(eyeField, value)
  }

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R"
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L", f: string) => {
        const eyeField = `${e.toLowerCase()}_${f}` as keyof SchirmerTestExam;
        return latestData[eyeField]?.toString() || "";
      };
      const value = getLatestVal(fromEye, key);
      onSchirmerTestChange(`${toEye.toLowerCase()}_${key}` as keyof SchirmerTestExam, value);
    })
  }

  const renderInput = (eye: "R" | "L", col: any) => {
    const { key, step, min, unit, suffix } = col;
    const value = getFieldValue(eye, key);

    return (
      <FastInput
        type="number"
        aria-label={butOnly ? t(`opticplusCards.fields.tb${eye.toLowerCase()}`) : `${eye} ${col.label}`}
        step={step}
        min={min}
        value={value}
        onChange={(val) => handleChange(eye, key, val)}
        disabled={!isEditing}
        suffix={unit || suffix}
        className="h-8 text-xs"
      />
    );
  };


  return (
    <Card className={butOnly ? "w-full examcard py-2" : "w-full examcard pb-4 pt-3"}>
      <CardContent className={butOnly ? "px-3" : "px-4"} style={{ scrollbarWidth: 'none' }}>
        <div className={butOnly ? "space-y-2" : "space-y-3"}>
          <div className="text-center">
            <h3 className={`${butOnly ? "text-sm " : ""}font-medium text-muted-foreground`}>{butOnly ? t('opticplusCards.sections.tearFilm') : 'Schirmer Test'}</h3>
          </div>

          <div className="grid gap-2 items-center" style={{gridTemplateColumns: `${hideEyeLabels ? '' : '20px '}repeat(${columns.length},minmax(0,1fr))`}}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
            ))}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                  onMouseEnter={() => setHoveredEye("R")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("L")}
                >
                  {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
                </span>
              </div>
            )}
            {columns.map(col => <React.Fragment key={`r-${col.key}`}>{renderInput("R", col)}</React.Fragment>)}

            {needsMiddleSpacer && !butOnly && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {columns.map(({ key }) => (
                  <div key={`spacer-${key}`} className="h-8" />
                ))}
              </>
            )}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                  onMouseEnter={() => setHoveredEye("L")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("R")}
                >
                  {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
                </span>
              </div>
            )}
            {columns.map(col => <React.Fragment key={`l-${col.key}`}>{renderInput("L", col)}</React.Fragment>)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
