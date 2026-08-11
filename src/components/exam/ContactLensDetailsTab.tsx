import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LookupSelect } from "@/components/ui/lookup-select";
import { ContactLensDetails } from "@/lib/db/schema-interface";
import { ChevronUp, ChevronDown } from "lucide-react";
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import {
  ContactLensCatalogCombobox,
  ContactLensCatalogField,
  ContactLensCatalogValues,
} from "@/components/inventory/ContactLensCatalogCombobox";
import { CatalogVariant, FulfillmentSource } from "@/lib/inventory";

interface ContactLensInventoryCatalogProps {
  variants: CatalogVariant[];
  loading?: boolean;
  rightValues: ContactLensCatalogValues;
  leftValues: ContactLensCatalogValues;
  rightDisabled?: boolean;
  leftDisabled?: boolean;
  onSelect: (
    side: "right" | "left",
    variant: CatalogVariant,
    source: FulfillmentSource,
  ) => void;
}

interface ContactLensDetailsTabProps {
  contactLensDetailsData: ContactLensDetails;
  onContactLensDetailsChange: (
    field: keyof ContactLensDetails,
    value: string,
  ) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
  inventoryCatalog?: ContactLensInventoryCatalogProps;
}

export function ContactLensDetailsTab({
  contactLensDetailsData,
  onContactLensDetailsChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false,
  inventoryCatalog,
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
    { key: "dx", config: EXAM_FIELDS.CONTACT_LENS_DX },
  ];

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField =
      `${eye.toLowerCase()}_${field}` as keyof ContactLensDetails;
    const value = contactLensDetailsData[eyeField];
    if (value != null) return value.toString();
    if (field === "type") {
      const legacyField =
        `${eye.toLowerCase()}_lens_type` as keyof ContactLensDetails;
      return contactLensDetailsData[legacyField]?.toString() || "";
    }
    return "";
  };

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    const eyeField =
      `${eye.toLowerCase()}_${field}` as keyof ContactLensDetails;
    onContactLensDetailsChange(eyeField, value);
  };

  const lookupLabels: Record<ContactLensCatalogField, string> = {
    type: "סוגי עדשות",
    manufacturer: "יצרנים",
    model: "דגמי עדשות מגע",
    supplier: "ספקים",
    material: "חומרים",
    color: "צבעים",
  };

  const renderLookup = (
    eye: "R" | "L",
    field: ContactLensCatalogField,
    lookupType: string,
  ) => {
    if (!inventoryCatalog) {
      return (
        <LookupSelect
          disabled={!isEditing}
          value={getFieldValue(eye, field)}
          onChange={(value) => handleChange(eye, field, value)}
          lookupType={lookupType}
          placeholder=""
          className="h-8 bg-white text-xs"
          center={true}
        />
      );
    }

    const side = eye === "R" ? "right" : "left";
    return (
      <ContactLensCatalogCombobox
        field={field}
        value={getFieldValue(eye, field)}
        values={
          eye === "R"
            ? inventoryCatalog.rightValues
            : inventoryCatalog.leftValues
        }
        variants={inventoryCatalog.variants}
        loadingCatalog={inventoryCatalog.loading}
        lookupType={lookupType}
        lookupLabel={lookupLabels[field]}
        disabled={
          !isEditing ||
          (eye === "R"
            ? inventoryCatalog.rightDisabled
            : inventoryCatalog.leftDisabled)
        }
        onChange={(value) => handleChange(eye, field, value)}
        onSelectProduct={(variant, source) =>
          inventoryCatalog.onSelect(side, variant, source)
        }
      />
    );
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
      onContactLensDetailsChange(
        `${toEye.toLowerCase()}_${key}` as keyof ContactLensDetails,
        value,
      );
    });
  };

  return (
    <Card className="examcard w-full pt-3 pb-4" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-muted-foreground font-medium">פרטי ההזמנה</h3>
          </div>

          <div
            className={`grid ${hideEyeLabels ? "grid-cols-[2fr_2fr_2fr_2fr_2fr_1fr_1fr]" : "grid-cols-[20px_2fr_2fr_2fr_2fr_2fr_1fr_1fr]"} items-center gap-2`}
          >
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, config }) => (
              <div key={key} className="flex h-4 items-center justify-center">
                <span className="text-muted-foreground text-xs font-medium">
                  {config.label}
                </span>
              </div>
            ))}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="hover:bg-accent cursor-pointer rounded-full px-2 text-base font-medium"
                  onMouseEnter={() => setHoveredEye("R")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("L")}
                  title="Click to copy from L eye"
                >
                  {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
                </span>
              </div>
            )}
            {columns.map(({ key, config }) => (
              <React.Fragment key={`r-${key}`}>
                {config.lookupType ? (
                  renderLookup(
                    "R",
                    key as ContactLensCatalogField,
                    config.lookupType,
                  )
                ) : (
                  <FastInput
                    type={config.type as any}
                    step={config.step}
                    min={config.min}
                    max={config.max}
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
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

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="hover:bg-accent cursor-pointer rounded-full px-2 text-base font-medium"
                  onMouseEnter={() => setHoveredEye("L")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("R")}
                  title="Click to copy from R eye"
                >
                  {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
                </span>
              </div>
            )}
            {columns.map(({ key, config }) => (
              <React.Fragment key={`l-${key}`}>
                {config.lookupType ? (
                  isEditing ? (
                    renderLookup(
                      "L",
                      key as ContactLensCatalogField,
                      config.lookupType,
                    )
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
                    className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
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
