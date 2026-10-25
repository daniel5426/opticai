import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LookupSelect } from "@/components/ui/lookup-select";
import { FastInput } from "@/components/exam/shared/OptimizedInputs";
import { useAppLocale } from "@/localization/use-app-locale";
import { OrderField, OrderSection, OrderSegmented } from "../layout/OrderSheet";
import type { OrderLens } from "./types";

type LensFieldSuffix =
  | "supplier"
  | "material"
  | "model"
  | "coating"
  | "color"
  | "diameter";

type LensSide = "right" | "left";

type LayoutMode = "auto" | "combined" | "split";

const LENS_FIELDS: { key: LensFieldSuffix; lookupType?: string }[] = [
  { key: "supplier", lookupType: "supplier" },
  { key: "material", lookupType: "material" },
  { key: "model", lookupType: "lensModel" },
  { key: "coating", lookupType: "coating" },
  { key: "color", lookupType: "color" },
  { key: "diameter" },
];

const fieldName = (side: LensSide, key: LensFieldSuffix) =>
  `${side}_${key}` as keyof OrderLens;

const normalize = (value: unknown) => String(value ?? "").trim();

const rowsMatch = (lens: OrderLens) =>
  LENS_FIELDS.every(
    ({ key }) =>
      normalize(lens[fieldName("right", key)]) ===
      normalize(lens[fieldName("left", key)]),
  );

interface LensSectionProps {
  lens: OrderLens;
  layoutKey: string;
  isEditing: boolean;
  onLensFieldChange: (field: keyof OrderLens, value: string) => void;
}

export function LensSection({
  lens,
  layoutKey,
  isEditing,
  onLensFieldChange,
}: LensSectionProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const [mode, setMode] = useState<LayoutMode>("auto");
  const [mergeError, setMergeError] = useState("");
  const equal = rowsMatch(lens);
  const isSplit = mode === "split" || (mode === "auto" && !equal);

  useEffect(() => {
    setMode("auto");
    setMergeError("");
  }, [layoutKey]);

  const valueOf = (side: LensSide, key: LensFieldSuffix) =>
    String(lens[fieldName(side, key)] ?? "");

  const handleChange = (side: LensSide | "both", key: LensFieldSuffix, value: string) => {
    setMergeError("");
    if (side === "both") {
      onLensFieldChange(fieldName("right", key), value);
      onLensFieldChange(fieldName("left", key), value);
      return;
    }
    onLensFieldChange(fieldName(side, key), value);
  };

  const handleModeChange = (next: string) => {
    setMergeError("");
    if (next === "both") {
      if (!equal) {
        setMergeError(t("orderWorkspace.lensMergeBlocked"));
        return;
      }
      setMode("combined");
      return;
    }
    if (isEditing) {
      LENS_FIELDS.forEach(({ key }) =>
        onLensFieldChange(fieldName("left", key), valueOf("right", key)),
      );
    }
    setMode("split");
  };

  const renderControl = (side: LensSide | "both", key: LensFieldSuffix, lookupType?: string, ariaLabel?: string) => {
    const source = side === "both" ? "right" : side;
    if (!lookupType) {
      return (
        <FastInput
          name={fieldName(source, key)}
          type="number"
          min={0}
          step={1}
          aria-label={ariaLabel}
          value={valueOf(source, key)}
          onInput={(value) => handleChange(side, key, value)}
          disabled={!isEditing}
        />
      );
    }
    return (
      <LookupSelect
        ariaLabel={ariaLabel}
        dir={direction}
        value={valueOf(source, key)}
        onChange={(value) => handleChange(side, key, value)}
        lookupType={lookupType}
        placeholder=""
        disabled={!isEditing}
      />
    );
  };

  const eyeLabel = (side: LensSide) =>
    t(side === "right" ? "orderGroupRightEye" : "orderGroupLeftEye");

  return (
    <OrderSection
      title={t("orderWorkspace.lenses")}
      end={
        <OrderSegmented
          dir={direction}
          ariaLabel={t("orderWorkspace.lensLayout")}
          value={isSplit ? "split" : "both"}
          onValueChange={handleModeChange}
          options={[
            { value: "both", label: t("orderWorkspace.bothEyes") },
            { value: "split", label: t("orderWorkspace.perEye") },
          ]}
        />
      }
      footer={
        mergeError ? (
          <p role="alert" className="text-destructive mt-3 text-xs">
            {mergeError}
          </p>
        ) : null
      }
    >
      {isSplit ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
          <span />
          {(["right", "left"] as LensSide[]).map((side) => (
            <span
              key={side}
              className="text-muted-foreground text-center text-xs font-medium"
            >
              {eyeLabel(side)}
            </span>
          ))}
          {LENS_FIELDS.map(({ key, lookupType }) => (
            <React.Fragment key={key}>
              <span className="text-muted-foreground min-w-14 text-xs">
                {t(`orderWorkspace.${key}`)}
              </span>
              {(["right", "left"] as LensSide[]).map((side) => (
                <div key={side} className="min-w-0">
                  {renderControl(
                    side,
                    key,
                    lookupType,
                    `${t(`orderWorkspace.${key}`)} ${eyeLabel(side)}`,
                  )}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LENS_FIELDS.map(({ key, lookupType }) => (
            <OrderField key={key} label={t(`orderWorkspace.${key}`)}>
              {renderControl("both", key, lookupType, t(`orderWorkspace.${key}`))}
            </OrderField>
          ))}
        </div>
      )}
    </OrderSection>
  );
}
