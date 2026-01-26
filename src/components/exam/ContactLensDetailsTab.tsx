import React, { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { LookupSelect } from "@/components/ui/lookup-select"
import { ContactLensDetails } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs"
import { EXAM_FIELDS } from "./data/exam-field-definitions"

interface ContactLensDetailsTabProps {
  contactLensDetailsData: ContactLensDetails;
  onContactLensDetailsChange: (field: keyof ContactLensDetails, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
}

export function ContactLensDetailsTab({
  contactLensDetailsData,
  onContactLensDetailsChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: ContactLensDetailsTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const dataRef = useRef(contactLensDetailsData);
  dataRef.current = contactLensDetailsData;

  const columns = [
    { key: "type", config: EXAM_FIELDS.CONTACT_LENS_TYPE },
    { key: "model", config: EXAM_FIELDS.CONTACT_LENS_MODEL },
    { key: "supplier", config: EXAM_FIELDS.CONTACT_LENS_SUPPLIER },
    { key: "material", config: EXAM_FIELDS.CONTACT_LENS_MATERIAL },
    { key: "color", config: EXAM_FIELDS.CONTACT_LENS_COLOR },
    { key: "quantity", config: EXAM_FIELDS.CONTACT_LENS_QUANTITY },
    { key: "order_quantity", config: EXAM_FIELDS.CONTACT_LENS_ORDER_QUANTITY },
    { key: "dx", config: EXAM_FIELDS.CONTACT_LENS_DX },
  ];

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof ContactLensDetails;
    return contactLensDetailsData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof ContactLensDetails;
    onContactLensDetailsChange(eyeField, value);
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L", f: string) => {
        const eyeField = `${e.toLowerCase()}_${f}` as keyof ContactLensDetails;
        return latestData[eyeField]?.toString() || "";
      };
      const value = getLatestVal(fromEye, key);
      onContactLensDetailsChange(`${toEye.toLowerCase()}_${key}` as keyof ContactLensDetails, value);
    });
  };

  return (
    <Card className="w-full examcard pb-4 pt-3" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Contact Lens Details</h3>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[2fr_2fr_2fr_2fr_2fr_1fr_1fr_1fr]' : 'grid-cols-[20px_2fr_2fr_2fr_2fr_2fr_1fr_1fr_1fr]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, config }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
                  {config.label}
                </span>
              </div>
            ))}

            {!hideEyeLabels && <div className="flex items-center justify-center">
              <span
                className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                onMouseEnter={() => setHoveredEye("R")}
                onMouseLeave={() => setHoveredEye(null)}
                onClick={() => copyFromOtherEye("L")}
                title="Click to copy from L eye"
              >
                {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
              </span>
            </div>}
            {columns.map(({ key, config }) => (
              <React.Fragment key={`r-${key}`}>
                {config.lookupType ? (
                  <LookupSelect
                    disabled={!isEditing}
                    value={getFieldValue("R", key)}
                    onChange={(value) => handleChange("R", key, value)}
                    lookupType={config.lookupType}
                    placeholder=""
                    className="h-8 text-xs bg-white"
                  />
                ) : (
                  <FastInput
                    type={config.type as any}
                    step={config.step}
                    min={config.min}
                    max={config.max}
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </React.Fragment>
            ))}

            {needsMiddleSpacer && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {columns.map(({ key }) => (
                  <div key={`spacer-${key}`} className="h-8" />
                ))}
              </>
            )}

            {!hideEyeLabels && <div className="flex items-center justify-center">
              <span
                className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                onMouseEnter={() => setHoveredEye("L")}
                onMouseLeave={() => setHoveredEye(null)}
                onClick={() => copyFromOtherEye("R")}
                title="Click to copy from R eye"
              >
                {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
              </span>
            </div>}
            {columns.map(({ key, config }) => (
              <React.Fragment key={`l-${key}`}>
                {config.lookupType ? (
                  isEditing ? (
                    <LookupSelect
                      value={getFieldValue("L", key)}
                      onChange={(value) => handleChange("L", key, value)}
                      lookupType={config.lookupType}
                      placeholder=""
                      className="h-8 text-xs bg-white"
                    />
                  ) : (
                    <div className="bg-accent/50 flex h-8 items-center rounded-md border px-2 text-xs">
                      {getFieldValue("L", key) || ""}
                    </div>
                  )
                ) : (
                  <FastInput
                    type={config.type as any}
                    step={config.step}
                    min={config.min}
                    max={config.max}
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}