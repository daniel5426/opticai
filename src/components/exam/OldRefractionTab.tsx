import React, { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VHCalculatorModal } from "@/components/ui/vh-calculator-modal"
import { OldRefractionExam } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown, Plus } from "lucide-react"
import { EXAM_FIELDS } from "./data/exam-field-definitions"
import { BASE_VALUES } from "./data/exam-constants"
import { VASelect } from "./shared/VASelect"
import { NVJSelect } from "./shared/NVJSelect"
import { cn } from "@/utils/tailwind"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FastInput, FastSelect, inputSyncManager } from "./shared/OptimizedInputs"
import { usePrescriptionLogic } from "./shared/usePrescriptionLogic"
import { CylTitle } from "./shared/CylTitle"
import { Input } from "@/components/ui/input"
import { useAxisWarning } from "./shared/useAxisWarning"
import { AxisWarningInput } from "./shared/AxisWarningInput"

interface OldRefractionTabProps {
  oldRefractionData: OldRefractionExam;
  onOldRefractionChange: (field: keyof OldRefractionExam, value: string) => void;
  isEditing: boolean;
  onMultifocalClick: () => void;
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
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
  allTabsData = []
}: OldRefractionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);
  const [dropdownTabIdx, setDropdownTabIdx] = useState<number | null>(null);

  const { fieldWarnings, handleAxisChange, handleAxisBlur } = useAxisWarning(
    oldRefractionData,
    onOldRefractionChange,
    isEditing
  );

  const latestValuesRef = useRef(oldRefractionData);
  latestValuesRef.current = oldRefractionData;

  const dataRef = useRef(oldRefractionData);
  dataRef.current = oldRefractionData;

  const { handleManualTranspose } = usePrescriptionLogic(
    oldRefractionData,
    onOldRefractionChange,
    isEditing
  );

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

  const getFieldValue = (eye: "R" | "L" | "C", field: string, data = oldRefractionData) => {
    if (eye === "C") {
      if (field === "va") return data.comb_va?.toString() || "";
      if (field === "j") return data.comb_j?.toString() || "";
      return "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
    return data[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye !== "C" && (field === "cyl" || field === "ax")) {
      handleAxisChange(eye as "R" | "L", field as "cyl" | "ax", value);
      return;
    }

    // 2. Propagate Change
    if (eye === "C") {
      const combField = `comb_${field}` as keyof OldRefractionExam;
      onOldRefractionChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
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
      return <VASelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
    }

    if (type === "j") {
      return <NVJSelect value={value} onChange={(val) => handleChange(eye, key, val)} disabled={!isEditing} />;
    }

    // For CYL and AXIS, use AxisWarningInput
    if ((key === 'cyl' || key === 'ax') && eye !== 'C') {
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
          onBlur={(eye, field, val) => handleAxisBlur(eye, field, val, (inputProps as any).min, (inputProps as any).max)}
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
          className="h-8 text-xs disabled:opacity-100 disabled:cursor-default"
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
    <Card className="w-full examcard pb-4 pt-3">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-3">
          <div className="relative flex items-center" style={{ minHeight: 24 }}>
            {/* Tab bar: absolutely positioned to the left (same as CoverTest) */}
            <div
              className="absolute bg-accent left-0 pr-1 rounded-md flex items-center justify-start gap-0"
              style={{ direction: "rtl" }}
            >
              {Array.from({ length: tabCount }).map((_, idx) => tabCount - 1 - idx).map((revIdx) => {
                const tabData = allTabsData[revIdx];
                const currentType = tabData?.r_glasses_type;
                const typeLabel = currentType || (revIdx + 1).toString();
                const otherTypes = glassesTypeOptions.filter(t => t !== currentType);

                return (
                  <DropdownMenu key={revIdx} open={dropdownTabIdx === revIdx} onOpenChange={open => { if (!open) setDropdownTabIdx(null); }} dir="rtl">
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={`rounded border-none px-2 text-xs font-bold transition-all duration-150 ${activeTab === revIdx ? "bg-secondary text-primary" : "bg-transparent text-muted-foreground hover:bg-accent"}`}
                        onClick={() => handleTabClick(revIdx)}
                        onContextMenu={e => handleTabContextMenu(revIdx, e)}
                        style={{ outline: "none" }}
                      >
                        {typeLabel}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" sideOffset={4} style={{ zIndex: 1000 }}>
                      <DropdownMenuItem
                        onClick={() => { if (isEditing && tabCount > 1 && onDeleteTab) { onDeleteTab(revIdx); setDropdownTabIdx(null); } }}
                        className={`text-destructive ${(tabCount <= 1 || !isEditing) ? 'opacity-50 pointer-events-none' : ''}`}
                        disabled={tabCount <= 1 || !isEditing}
                      >מחק</DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { if (isEditing && onDuplicateTab) { onDuplicateTab(revIdx); setDropdownTabIdx(null); } }}
                        disabled={!isEditing}
                      >שכפל</DropdownMenuItem>
                      {otherTypes.length > 0 && isEditing && (
                        <>
                          <div className="h-px bg-muted my-1" />
                          <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium text-right">שנה סוג ל:</div>
                          {otherTypes.map(type => (
                            <DropdownMenuItem key={type} onClick={() => { onUpdateType?.(revIdx, type); setDropdownTabIdx(null); }}>
                              {type}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
              <DropdownMenu dir="rtl">
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="bg-transparent hover:bg-accent flex items-center justify-center rounded-full border-none p-1"
                    disabled={!isEditing || tabCount >= 5}
                    style={{
                      outline: "none",
                      opacity: isEditing && tabCount < 5 ? 1 : 0.5,
                      pointerEvents: isEditing && tabCount < 5 ? "auto" : "none",
                      transition: "opacity 0.2s",
                    }}
                    title="הוסף טאב"
                  >
                    <Plus size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={4} style={{ zIndex: 1000 }}>
                  <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium text-right">בחר סוג רפרקציה:</div>
                  {glassesTypeOptions.map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => onAddTab(type)}
                    >
                      {type}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Title: centered */}
            <div className="flex-1 text-center">
              <h3 className="font-medium text-muted-foreground">Old Refraction</h3>
            </div>
          </div>

          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(8,1fr)]' : 'grid-cols-[20px_repeat(8,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {mainColumns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                {key === "cyl" ? (
                  <CylTitle onTranspose={handleManualTranspose} disabled={!isEditing} />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {label}
                  </span>
                )}
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
            {mainColumns.map((col) => (
              <div key={`r-${col.key}`}>
                {renderField("R", col)}
              </div>
            ))}

            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {mainColumns.map(({ key }) => {
              if (key === 'cyl') {
                return (
                  <div key="c-mul-button" className="flex justify-center">
                    <Button
                      type="button" variant="outline" size="sm" className="h-8 text-xs px-2"
                      disabled={!isEditing} onClick={onMultifocalClick}
                    >
                      MUL
                    </Button>
                  </div>
                )
              }
              if (key === 'pris') {
                return (
                  <div key="c-vh-calculator" className="flex justify-center">
                    <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
                  </div>
                )
              }
              if (key === 'va' || key === 'j') {
                return (
                  <div key={`c-${key}-input`}>
                    {renderField("C", { key, type: key === 'va' ? 'va' : 'j' })}
                  </div>
                )
              }
              return <div key={`c-spacer-${key}`} />
            })}

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
            {mainColumns.map((col) => (
              <div key={`l-${col.key}`}>
                {renderField("L", col)}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
