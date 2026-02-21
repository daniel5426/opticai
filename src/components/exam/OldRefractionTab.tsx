import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal";
import { OldRefractionExam } from "@/lib/db/schema-interface";
import { ChevronUp, ChevronDown, Plus } from "lucide-react";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import { BASE_VALUES } from "./data/exam-constants";
import { VASelect } from "./shared/VASelect";
import { NVJSelect } from "./shared/NVJSelect";
import { cn } from "@/utils/tailwind";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FastInput,
  FastSelect,
  inputSyncManager,
} from "./shared/OptimizedInputs";
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic";
import { CylTitle } from "./shared/CylTitle";
import { useAxisWarning } from "./shared/useAxisWarning";
import { AxisWarningInput } from "./shared/AxisWarningInput";
import { ToggleTextNumberInput } from "./shared/ToggleTextNumberInput";

interface OldRefractionTabProps {
  oldRefractionData: OldRefractionExam;
  onOldRefractionChange: (
    field: keyof OldRefractionExam,
    value: string,
  ) => void;
  isEditing: boolean;
  onMultifocalClick: () => void;
  onVHConfirm: (
    rightPris: number,
    rightBase: number,
    leftPris: number,
    leftBase: number,
  ) => void;
  hideEyeLabels?: boolean;
  tabCount: number;
  activeTab: number;
  onTabChange: (tabIdx: number) => void;
  onAddTab: (type: string) => void;
  onDeleteTab?: (tabIdx: number) => void;
  onDuplicateTab?: (tabIdx: number) => void;
  onUpdateType?: (tabIdx: number, newType: string) => void;
  allTabsData?: OldRefractionExam[];
}

export const OldRefractionTab = React.memo(function OldRefractionTab({
  oldRefractionData,
  onOldRefractionChange,
  isEditing,
  onMultifocalClick,
  onVHConfirm,
  hideEyeLabels = false,
  tabCount,
  activeTab,
  onTabChange,
  onAddTab,
  onDeleteTab,
  onDuplicateTab,
  onUpdateType,
  allTabsData = [],
}: OldRefractionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);
  const [dropdownTabIdx, setDropdownTabIdx] = useState<number | null>(null);
  const [optimisticFieldValues, setOptimisticFieldValues] = useState<
    Record<string, string>
  >({});

  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
    oldRefractionData,
    onOldRefractionChange,
    isEditing,
  );

  const latestValuesRef = useRef(oldRefractionData);
  latestValuesRef.current = oldRefractionData;

  const dataRef = useRef(oldRefractionData);
  dataRef.current = oldRefractionData;

  const { handleManualTranspose } = usePrescriptionLogic(
    oldRefractionData,
    onOldRefractionChange,
    isEditing,
  );

  const handleTranspose = React.useCallback(() => {
    inputSyncManager.flush();
    handleManualTranspose();
  }, [handleManualTranspose]);

  const glassesTypeOptions = ["רחוק", "קרוב", "מולטיפוקל", "ביפוקל"];

  const mainColumns = [
    { key: "sph", ...EXAM_FIELDS.SPH },
    { key: "cyl", ...EXAM_FIELDS.CYL },
    { key: "ax", ...EXAM_FIELDS.AXIS },
    { key: "pris", ...EXAM_FIELDS.PRISM },
    { key: "base", ...EXAM_FIELDS.BASE, type: "select", options: BASE_VALUES },
    { key: "va", ...EXAM_FIELDS.VA, type: "va" },
    { key: "ad", ...EXAM_FIELDS.ADD },
    { key: "j", ...EXAM_FIELDS.J, type: "j" },
  ];

  const getStorageFieldKey = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      if (field === "va" || field === "j") return `comb_${field}`;
      return "";
    }
    return `${eye.toLowerCase()}_${field}`;
  };

  useEffect(() => {
    setOptimisticFieldValues((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;

      let changed = false;
      const next = { ...prev };

      keys.forEach((key) => {
        const persisted =
          (oldRefractionData as Record<string, unknown>)[key]?.toString() || "";
        if (persisted === prev[key]) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [oldRefractionData]);

  const getFieldValue = (
    eye: "R" | "L" | "C",
    field: string,
    data = oldRefractionData,
  ) => {
    const storageKey = getStorageFieldKey(eye, field);
    if (!storageKey) return "";

    if (optimisticFieldValues[storageKey] !== undefined) {
      return optimisticFieldValues[storageKey];
    }

    return (data as Record<string, unknown>)[storageKey]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    const storageKey = getStorageFieldKey(eye, field);
    if (storageKey) {
      setOptimisticFieldValues((prev) => ({ ...prev, [storageKey]: value }));
    }

    if (eye !== "C" && (field === "cyl" || field === "ax")) {
      handleAxisChange(eye as "R" | "L", field as "cyl" | "ax", value);
      return;
    }

    if (eye === "C") {
      const combField = `comb_${field}` as keyof OldRefractionExam;
      onOldRefractionChange(combField, value);
    } else {
      const eyeField =
        `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
      onOldRefractionChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    mainColumns.forEach(({ key }) => {
      const value = getFieldValue(fromEye, key, latestData);
      handleChange(toEye, key, value);
    });
  };

  const renderField = (eye: "R" | "L" | "C", col: any) => {
    const { key, type, options, ...inputProps } = col;
    const value = getFieldValue(eye, key);

    if (type === "select") {
      return (
        <FastSelect
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
          options={options || []}
          size="xs"
          triggerClassName="h-8 text-xs w-full disabled:opacity-100"
          center={col.center}
        />
      );
    }

    if (type === "va") {
      return (
        <VASelect
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
        />
      );
    }

    if (type === "j") {
      return (
        <NVJSelect
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
        />
      );
    }

    // For CYL and AXIS, use AxisWarningInput
    if ((key === "cyl" || key === "ax") && eye !== "C") {
      const eyeWarnings = fieldWarnings[eye as "R" | "L"];
      return (
        <AxisWarningInput
          {...inputProps}
          eye={eye as "R" | "L"}
          field={key as "cyl" | "ax"}
          value={value}
          missingAxis={eyeWarnings.missingAxis}
          missingCyl={eyeWarnings.missingCyl}
          isEditing={isEditing}
          onValueChange={handleAxisChange}
          onBlur={(eye, field, val) =>
            handleAxisBlur(
              eye,
              field,
              val,
              (inputProps as any).min,
              (inputProps as any).max,
            )
          }
        />
      );
    }

    if (key === "sph" && eye !== "C") {
      return (
        <ToggleTextNumberInput
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
          textOptions={(inputProps as any).textOptions}
          textValueAliases={(inputProps as any).textValueAliases}
          numericProps={{
            step: (inputProps as any).step,
            min: (inputProps as any).min,
            max: (inputProps as any).max,
            showPlus: (inputProps as any).showPlus,
            suffix: (inputProps as any).suffix,
            debounceMs: 0,
            className:
              "h-8 text-xs disabled:opacity-100 disabled:cursor-default",
          }}
        />
      );
    }

    // For other fields, keep FastInput for performance
    return (
      <div className="relative">
        <FastInput
          {...inputProps}
          type="number"
          value={value}
          onChange={(val) => handleChange(eye, key, val)}
          disabled={!isEditing}
          className="h-8 text-xs disabled:cursor-default disabled:opacity-100"
        />
      </div>
    );
  };

  const handleTabClick = (idx: number) => {
    onTabChange(idx);
    setDropdownTabIdx(null);
  };

  const handleTabContextMenu = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (isEditing) {
      setDropdownTabIdx(idx);
    }
  };

  return (
    <Card className="examcard w-full pt-3 pb-4">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="relative flex items-center" style={{ minHeight: 24 }}>
            {/* Tab bar: absolutely positioned to the left (same as CoverTest) */}
            <div
              className="bg-accent absolute left-0 flex items-center justify-start gap-0 rounded-md pr-1"
              style={{ direction: "rtl" }}
            >
              {Array.from({ length: tabCount })
                .map((_, idx) => tabCount - 1 - idx)
                .map((revIdx) => {
                  const tabData = allTabsData[revIdx];
                  const currentType = tabData?.r_glasses_type;
                  const typeLabel = currentType || (revIdx + 1).toString();
                  const otherTypes = glassesTypeOptions.filter(
                    (t) => t !== currentType,
                  );

                  return (
                    <DropdownMenu
                      key={revIdx}
                      open={dropdownTabIdx === revIdx}
                      onOpenChange={(open) => {
                        if (!open) setDropdownTabIdx(null);
                      }}
                      dir="rtl"
                      modal={false}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={`rounded border-none px-2 text-xs font-bold transition-all duration-150 ${activeTab === revIdx ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-accent bg-transparent"}`}
                          onClick={() => handleTabClick(revIdx)}
                          onContextMenu={(e) => handleTabContextMenu(revIdx, e)}
                          style={{ outline: "none" }}
                        >
                          {typeLabel}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="center"
                        sideOffset={4}
                        style={{ zIndex: 1000 }}
                      >
                        <DropdownMenuItem
                          onClick={() => {
                            if (isEditing && tabCount > 1 && onDeleteTab) {
                              onDeleteTab(revIdx);
                              setDropdownTabIdx(null);
                            }
                          }}
                          className={`text-destructive ${tabCount <= 1 || !isEditing ? "pointer-events-none opacity-50" : ""}`}
                          disabled={tabCount <= 1 || !isEditing}
                        >
                          מחק
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (isEditing && onDuplicateTab) {
                              onDuplicateTab(revIdx);
                              setDropdownTabIdx(null);
                            }
                          }}
                          disabled={!isEditing}
                        >
                          שכפל
                        </DropdownMenuItem>
                        {otherTypes.length > 0 && isEditing && (
                          <>
                            <div className="bg-muted my-1 h-px" />
                            <div className="text-muted-foreground px-2 py-1 text-right text-[10px] font-medium">
                              שנה סוג ל:
                            </div>
                            {otherTypes.map((type) => (
                              <DropdownMenuItem
                                key={type}
                                onClick={() => {
                                  onUpdateType?.(revIdx, type);
                                  setDropdownTabIdx(null);
                                }}
                              >
                                {type}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
              <DropdownMenu dir="rtl" modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hover:bg-accent flex items-center justify-center rounded-full border-none bg-transparent p-1"
                    disabled={!isEditing || tabCount >= 5}
                    style={{
                      outline: "none",
                      opacity: isEditing && tabCount < 5 ? 1 : 0.5,
                      pointerEvents:
                        isEditing && tabCount < 5 ? "auto" : "none",
                      transition: "opacity 0.2s",
                    }}
                    title="הוסף טאב"
                  >
                    <Plus size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  sideOffset={4}
                  style={{ zIndex: 1000 }}
                >
                  <div className="text-muted-foreground px-2 py-1 text-right text-[10px] font-medium">
                    בחר סוג רפרקציה:
                  </div>
                  {glassesTypeOptions.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => onAddTab(type)}>
                      {type}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Title: centered */}
            <div className="flex-1 text-center">
              <h3 className="text-muted-foreground font-medium">
                Old Refraction
              </h3>
            </div>
          </div>

          <div
            className={`grid ${hideEyeLabels ? "grid-cols-[repeat(8,1fr)]" : "grid-cols-[20px_repeat(8,1fr)]"} items-center gap-2`}
          >
            {!hideEyeLabels && <div></div>}
            {mainColumns.map(({ key, label }) => (
              <div key={key} className="flex h-4 items-center justify-center">
                {key === "cyl" ? (
                  <CylTitle
                    onTranspose={handleTranspose}
                    disabled={!isEditing}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs font-medium">
                    {label}
                  </span>
                )}
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
            {mainColumns.map((col) => (
              <div key={`r-${col.key}`}>{renderField("R", col)}</div>
            ))}

            {!hideEyeLabels && (
              <div className="flex h-8 items-center justify-center"></div>
            )}
            {mainColumns.map(({ key }) => {
              if (key === "pris") {
                return (
                  <div key="c-vh-calculator" className="flex justify-center">
                    <VHCalculatorModal
                      onConfirm={onVHConfirm}
                      disabled={!isEditing}
                    />
                  </div>
                );
              }
              if (key === "va" || key === "j") {
                return (
                  <div key={`c-${key}-input`}>
                    {renderField("C", { key, type: key === "va" ? "va" : "j" })}
                  </div>
                );
              }
              return <div key={`c-spacer-${key}`} />;
            })}

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
            {mainColumns.map((col) => (
              <div key={`l-${col.key}`}>{renderField("L", col)}</div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
