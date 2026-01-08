import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { LookupSelect } from "@/components/ui/lookup-select"
import { AnamnesisExam } from "@/lib/db/schema-interface"
import { FastTextarea } from "./shared/OptimizedInputs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { IconCalendar } from "@tabler/icons-react"
import { cn } from "@/utils/tailwind"
import type { DateRange } from "react-day-picker"

interface AnamnesisTabProps {
  anamnesisData: AnamnesisExam;
  onAnamnesisChange: (field: keyof AnamnesisExam, value: string | boolean) => void;
  isEditing: boolean;
}

export const AnamnesisTab = React.memo(function AnamnesisTab({
  anamnesisData,
  onAnamnesisChange,
  isEditing,
}: AnamnesisTabProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const from = anamnesisData.started_wearing_since ? new Date(anamnesisData.started_wearing_since) : undefined;
    const to = anamnesisData.stopped_wearing_since ? new Date(anamnesisData.stopped_wearing_since) : undefined;
    
    if (from && !isNaN(from.getTime())) {
      setDateRange({
        from,
        to: to && !isNaN(to.getTime()) ? to : undefined
      });
    } else {
      setDateRange(undefined);
    }
  }, [anamnesisData.started_wearing_since, anamnesisData.stopped_wearing_since]);

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  };

  const formatDateISO = (date: Date | undefined) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    const hasCompleteRange = dateRange?.from && dateRange?.to;
    const isNewSelection = range?.from && !range?.to;
    
    if (hasCompleteRange && isNewSelection) {
      const freshRange: DateRange = {
        from: range.from,
        to: undefined
      };
      setDateRange(freshRange);
      onAnamnesisChange('started_wearing_since', formatDateISO(freshRange.from));
      onAnamnesisChange('stopped_wearing_since', '');
      return;
    }
    
    setDateRange(range);
    
    if (range?.from) {
      onAnamnesisChange('started_wearing_since', formatDateISO(range.from));
    } else {
      onAnamnesisChange('started_wearing_since', '');
    }
    
    if (range?.to) {
      onAnamnesisChange('stopped_wearing_since', formatDateISO(range.to));
    } else {
      onAnamnesisChange('stopped_wearing_since', '');
    }
  };

  const handleCheckboxChange = (field: keyof AnamnesisExam, checked: boolean | string) => {
    const booleanValue = checked === true;
    onAnamnesisChange(field, booleanValue);
  };

  const handleLookupChange = (field: keyof AnamnesisExam, value: string) => {
    onAnamnesisChange(field, value);
  };

  return (
    <Card className="w-full examcard pb-4 pt-2" dir="rtl">
      <CardContent className="px-4 pt-1" style={{ scrollbarWidth: 'none' }}>
        <div className="text-center mb-4">
          <h3 className="font-semibold text-base text-primary/80">היסטוריה רפואית ואופטית (אנמנזה)</h3>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3" style={{ scrollbarWidth: 'none' }}>
          
          <div className="space-y-3">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="medications" className="text-xs font-bold text-muted-foreground/80 pr-1">תרופות</Label>
              <FastTextarea
                id="medications"
                name="medications"
                value={anamnesisData.medications || ''}
                onChange={(val) => onAnamnesisChange('medications', val)}
                disabled={!isEditing}
                showMaximize
                label="תרופות"
                className="min-h-[37px] bg-card/30"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <Label htmlFor="family_history" className="text-xs font-bold text-muted-foreground/80 pr-1">היסטוריה משפחתית</Label>
              <FastTextarea
                id="family_history"
                name="family_history"
                value={anamnesisData.family_history || ''}
                onChange={(val) => onAnamnesisChange('family_history', val)}
                disabled={!isEditing}
                showMaximize
                label="היסטוריה משפחתית"
                className="min-h-[37px] bg-card/30"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <Label htmlFor="lazy_eye" className="text-xs font-bold text-muted-foreground/80 pr-1">עין עצלה</Label>
              <FastTextarea
                id="lazy_eye"
                name="lazy_eye"
                value={anamnesisData.lazy_eye || ''}
                onChange={(val) => onAnamnesisChange('lazy_eye', val)}
                disabled={!isEditing}
                showMaximize
                label="עין עצלה"
                className="min-h-[37px] bg-card/30"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <Label htmlFor="additional_notes" className="text-xs font-bold text-muted-foreground/80 pr-1">הערות נוספות</Label>
              <FastTextarea
                id="additional_notes"
                name="additional_notes"
                value={anamnesisData.additional_notes || ''}
                onChange={(val) => onAnamnesisChange('additional_notes', val)}
                disabled={!isEditing}
                showMaximize
                label="הערות נוספות"
                className="min-h-[37px] bg-card/30"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="allergies" className="text-xs font-bold text-muted-foreground/80 pr-1">אלרגיות</Label>
              <FastTextarea
                id="allergies"
                name="allergies"
                value={anamnesisData.allergies || ''}
                onChange={(val) => onAnamnesisChange('allergies', val)}
                disabled={!isEditing}
                showMaximize
                label="אלרגיות"
                className="min-h-[37px] bg-card/30"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <Label htmlFor="previous_treatments" className="text-xs font-bold text-muted-foreground/80 pr-1">טיפולים קודמים</Label>
              <FastTextarea
                id="previous_treatments"
                name="previous_treatments"
                value={anamnesisData.previous_treatments || ''}
                onChange={(val) => onAnamnesisChange('previous_treatments', val)}
                disabled={!isEditing}
                showMaximize
                label="טיפולים קודמים"
                className="min-h-[37px] bg-card/30"
              />
            </div>

            <div className={cn(
              " dark:bg-muted/10 rounded-xl mt-5 px-2 pt-3.5 pb-1 space-y-2 self-start",
            )}>
              <div className="flex items-center justify-between">
                <Label htmlFor="contact_lens_wear" className="text-xs font-bold">שימוש בעדשות מגע</Label>
                <Switch
                  id="contact_lens_wear"
                  checked={anamnesisData.contact_lens_wear || false}
                  onCheckedChange={(checked) => handleCheckboxChange('contact_lens_wear', checked)}
                  disabled={!isEditing}
                />
              </div>

              <div className={cn("grid grid-cols-2 gap-2 pt-4 border-t border-border/50", !anamnesisData.contact_lens_wear && "opacity-50")}>
                <div className="space-y-1">
                  <Label htmlFor="contact_lens_type" className="text-[10px] font-medium opacity-70">סוג עדשות</Label>
                  <LookupSelect
                    value={anamnesisData.contact_lens_type || ''}
                    onChange={(val) => handleLookupChange('contact_lens_type', val)}
                    lookupType="contactLensType"
                    disabled={!isEditing || !anamnesisData.contact_lens_wear}
                    className="h-8 bg-background"
                    placeholder="בחר סוג..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium opacity-70">תקופת שימוש</Label>
                  <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 shadow-none justify-start text-right font-normal bg-background text-xs px-2 disabled:opacity-100",
                          !dateRange?.from && "text-muted-foreground",
                          !isEditing && "bg-muted/50"
                        )}
                        disabled={!isEditing || !anamnesisData.contact_lens_wear}
                      >
                        <IconCalendar className="ml-2 h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {dateRange?.from ? (
                            dateRange?.to ? (
                              `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
                            ) : (
                              formatDate(dateRange.from)
                            )
                          ) : (
                            <span>בחר טווח...</span>
                          )}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-2">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from || new Date()}
                          selected={dateRange}
                          onSelect={handleRangeSelect}
                          numberOfMonths={2}
                          dir="rtl"
                          captionLayout="dropdown"
                          startMonth={new Date(1900, 0)}
                          endMonth={new Date()}
                        />
                        <div className="flex justify-end gap-2 p-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleRangeSelect(undefined);
                              setIsOpen(false);
                            }}
                          >
                            נקה
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
});
