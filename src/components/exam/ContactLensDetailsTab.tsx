import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LookupSelect } from "@/components/ui/lookup-select"
import { ContactLensDetails } from "@/lib/db/schema-interface"
import { ChevronUp, ChevronDown } from "lucide-react"

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
  
  const columns = [
    { key: "type", label: "TYPE", step: "1", lookupType: "contactLensType" },
    { key: "model", label: "MODEL", step: "1", lookupType: "contactLensModel" },
    { key: "supplier", label: "SUPPLIER", step: "1", lookupType: "supplier" },
    { key: "material", label: "MATERIAL", step: "1", lookupType: "contactEyeMaterial" },
    { key: "color", label: "COLOR", step: "1", lookupType: "color" },
    { key: "quantity", label: "QTY", step: "1" },
    { key: "order_quantity", label: "ORDER QTY", step: "1" },
    { key: "dx", label: "DX", step: "0.25" },
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
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof ContactLensDetails;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof ContactLensDetails;
      const value = contactLensDetailsData[fromField]?.toString() || "";
      onContactLensDetailsChange(toField, value);
    });
  };

  const getInputType = (key: string) => {
    if (key === "dx" || key === "quantity" || key === "order_quantity") {
      return "number";
    }
    return "text";
  };

  const isLookupField = (key: string) => {
    return ["type", "model", "supplier", "material", "color"].includes(key);
  };

  const getLookupType = (key: string) => {
    const column = columns.find(col => col.key === key);
    return column?.lookupType || "";
  };

  return (
    <Card className="w-full shadow-md pb-4 pt-3 border-none" dir="ltr">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Contact Lens Details</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(8,1fr)]' : 'grid-cols-[20px_repeat(8,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
                  {label}
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
            {columns.map(({ key, step }) => (
              <React.Fragment key={`r-${key}`}>
                {isLookupField(key) ? (
                  isEditing ? (
                    <LookupSelect
                      value={getFieldValue("R", key)}
                      onChange={(value) => handleChange("R", key, value)}
                      lookupType={getLookupType(key)}
                      placeholder=""
                      className="h-8 text-xs bg-white"
                    />
                  ) : (
                    <div className="bg-accent/50 flex h-8 items-center rounded-md border px-2 text-xs">
                      {getFieldValue("R", key) || ""}
                    </div>
                  )
                ) : (
                  <Input
                    type={getInputType(key)}
                    step={getInputType(key) === "number" ? step : undefined}
                    value={getFieldValue("R", key)}
                    onChange={(e) => handleChange("R", key, e.target.value)}
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
            {columns.map(({ key, step }) => (
              <React.Fragment key={`l-${key}`}>
                {isLookupField(key) ? (
                  isEditing ? (
                    <LookupSelect
                      value={getFieldValue("L", key)}
                      onChange={(value) => handleChange("L", key, value)}
                      lookupType={getLookupType(key)}
                      placeholder=""
                      className="h-8 text-xs bg-white"
                    />
                  ) : (
                    <div className="bg-accent/50 flex h-8 items-center rounded-md border px-2 text-xs">
                      {getFieldValue("L", key) || ""}
                    </div>
                  )
                ) : (
                  <Input
                    type={getInputType(key)}
                    step={getInputType(key) === "number" ? step : undefined}
                    value={getFieldValue("L", key)}
                    onChange={(e) => handleChange("L", key, e.target.value)}
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