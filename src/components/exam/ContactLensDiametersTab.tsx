import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ContactLensDiameters } from "@/lib/db/schema"

interface ContactLensDiametersTabProps {
  contactLensDiametersData: ContactLensDiameters;
  onContactLensDiametersChange: (field: keyof ContactLensDiameters, value: string) => void;
  isEditing: boolean;
}

export function ContactLensDiametersTab({
  contactLensDiametersData,
  onContactLensDiametersChange,
  isEditing
}: ContactLensDiametersTabProps) {
  
  const fields = [
    { key: "pupil_diameter", label: "קוטר אישון", step: "0.1" },
    { key: "corneal_diameter", label: "קוטר קרנית", step: "0.1" },
    { key: "eyelid_aperture", label: "פתח עפעף", step: "0.1" }
  ];

  const getFieldValue = (field: string) => {
    const fieldKey = field as keyof ContactLensDiameters;
    return contactLensDiametersData[fieldKey]?.toString() || "";
  };

  const handleChange = (field: string, value: string) => {
    const fieldKey = field as keyof ContactLensDiameters;
    onContactLensDiametersChange(fieldKey, value);
  };

  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Diameters</h3>
          </div>
          
          <div className="grid grid-cols-[2fr_auto] gap-2 gap-x-4 items-center">
            {/* Header row - matches ContactLensExam spacing */}
            <div className="h-4 flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">
                Value
              </span>
            </div>
            <div className="h-4 flex items-center justify-center">
            </div>
            
            {/* First row - matches ContactLensExam R eye row */}
            <Input
              type="number"
              step={fields[0].step}
              value={getFieldValue(fields[0].key)}
              onChange={(e) => handleChange(fields[0].key, e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
            />
            <div className="flex items-center justify-end">
              <span className="text-xs font-medium text-muted-foreground">
                {fields[0].label}
              </span>
            </div>
            
            {/* Second row - matches ContactLensExam middle row */}
            <Input
              type="number"
              step={fields[1].step}
              value={getFieldValue(fields[1].key)}
              onChange={(e) => handleChange(fields[1].key, e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
            />
            <div className="flex items-center justify-end">
              <span className="text-xs font-medium text-muted-foreground">
                {fields[1].label}
              </span>
            </div>
            
            {/* Third row - matches ContactLensExam L eye row */}
            <Input
              type="number"
              step={fields[2].step}
              value={getFieldValue(fields[2].key)}
              onChange={(e) => handleChange(fields[2].key, e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
            />
            <div className="flex items-center justify-end">
              <span className="text-xs font-medium text-muted-foreground">
                {fields[2].label}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}