import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { DateInput } from "@/components/ui/date"
import { AnamnesisExam } from "@/lib/db/schema-interface"

interface AnamnesisTabProps {
  anamnesisData: AnamnesisExam;
  onAnamnesisChange: (field: keyof AnamnesisExam, value: string | boolean) => void;
  isEditing: boolean;
}

export function AnamnesisTab({
  anamnesisData,
  onAnamnesisChange,
  isEditing,
}: AnamnesisTabProps) {

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onAnamnesisChange(name as keyof AnamnesisExam, value);
  };

  const handleCheckboxChange = (field: keyof AnamnesisExam, checked: boolean | string) => {
    const booleanValue = checked === true;
    onAnamnesisChange(field, booleanValue);
  };

  const handleDateChange = (field: keyof AnamnesisExam, date: string) => {
    onAnamnesisChange(field, date);
  };

  return (
    <Card className="w-full examcard pb-8 pt-3" dir="rtl">
      <CardContent className="px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="text-center mb-4">
          <h3 className="font-medium text-muted-foreground">היסטוריה רפואית ואופטית (אנמנזה)</h3>
        </div>
        
        <div className="grid grid-cols-[3fr_1fr] gap-x-8" style={{ scrollbarWidth: 'none' }}>

          {/* Right Column for Text Inputs */}
          <div className="grid grid-cols-1 gap-y-4">
            <div className="flex items-center space-x-1 rtl:space-x-reverse">
              <Label htmlFor="medications" className="text-sm font-semibold min-w-[90px]">תרופות</Label>
              <Input
                id="medications"
                name="medications"
                value={anamnesisData.medications || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`h-9 pr-2 text-sm flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </div>

            <div className="flex items-center space-x-1 rtl:space-x-reverse">
              <Label htmlFor="allergies" className="text-sm font-semibold min-w-[90px]">אלרגיות</Label>
              <Input
                id="allergies"
                name="allergies"
                value={anamnesisData.allergies || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`h-9 pr-2 text-sm flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </div>

            <div className="flex items-center space-x-1 rtl:space-x-reverse">
              <Label htmlFor="family_history" className="text-sm font-semibold min-w-[160px]">היסטוריה משפחתית</Label>
              <Input
                id="family_history"
                name="family_history"
                value={anamnesisData.family_history || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`h-9 pr-2 text-sm flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </div>

            <div className="flex items-center space-x-1 rtl:space-x-reverse">
              <Label htmlFor="previous_treatments" className="text-sm font-semibold min-w-[130px]">טיפולים קודמים</Label>
              <Input
                id="previous_treatments"
                name="previous_treatments"
                value={anamnesisData.previous_treatments || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`h-9 pr-2 text-sm flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </div>

            <div className="flex items-center space-x-1 rtl:space-x-reverse">
              <Label htmlFor="lazy_eye" className="text-sm font-semibold min-w-[90px]">עין עצלה</Label>
              <Input
                id="lazy_eye"
                name="lazy_eye"
                value={anamnesisData.lazy_eye || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`h-9 pr-2 text-sm flex-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
              />
            </div>
          </div>

          {/* Left Column for Contact Lens Section */}
          <div className="space-y-4  rounded-lg flex flex-col justify-start">
            <div className="flex flex-col items-center justify-center space-y-2 p-3 bg-background rounded-md border w-full">
              <Label htmlFor="contact_lens_wear" className="text-sm font-semibold text-center">שימוש בעדשות מגע</Label>
              <Switch
                id="contact_lens_wear"
                checked={anamnesisData.contact_lens_wear || false}
                onCheckedChange={(checked) => handleCheckboxChange('contact_lens_wear', checked)}
                disabled={!isEditing}
                className="scale-110"
              />
            </div>

            {Boolean(anamnesisData.contact_lens_wear) && (
              <>
                <div className="flex flex-col space-y-2  bg-background  w-full">
                  <Label htmlFor="started_wearing_since" className="text-sm font-semibold text-center">התחיל להרכיב מאז</Label>
                  <DateInput
                    name="started_wearing_since"
                    className="h-9 text-center"
                    value={anamnesisData.started_wearing_since || ''}
                    onChange={(e) => handleDateChange('started_wearing_since', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="flex flex-col space-y-2 w-full">
                  <Label htmlFor="stopped_wearing_since" className="text-sm font-semibold text-center">הפסיק להרכיב מאז</Label>
                  <DateInput
                    name="stopped_wearing_since"
                    className="h-9 text-center"
                    value={anamnesisData.stopped_wearing_since || ''}
                    onChange={(e) => handleDateChange('stopped_wearing_since', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 