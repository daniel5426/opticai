import React from "react"
import { Client } from "@/lib/db/schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

// Custom label component with underline
function LabelWithUnderline({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-sm font-medium text-primary pb-0.5 mb-0.5 inline-block">
      {children}
    </Label>
  )
}

interface DateInputProps {
  name: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

function DateInput({ name, value, onChange, className }: DateInputProps) {
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  
  const openDatePicker = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  return (
    <div className="relative mt-0.5">
      <div 
        className={`text-right pr-8 cursor-pointer h-8 rounded-md border px-2 py-1.5 border-input bg-background/50 hover:bg-background/80 flex items-center text-sm ${className || ''}`}
        dir="rtl"
        onClick={openDatePicker}
      >
        {value ? new Date(value).toLocaleDateString('he-IL') : 'לחץ לבחירת תאריך'}
      </div>
      
      <input
        ref={dateInputRef}
        type="date"
        name={name}
        value={value || ''}
        onChange={onChange}
        className="absolute opacity-0 h-0 w-0 overflow-hidden"
      />
      
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg 
          className="h-4 w-4 text-primary/70" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  );
}

interface ClientDetailsTabProps {
  client: Client;
  formData: Client;
  isEditing: boolean;
  mode?: 'view' | 'edit' | 'new';
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (value: string | boolean, name: string) => void;
  formRef: React.RefObject<HTMLFormElement>;
  setIsEditing?: (editing: boolean) => void;
  handleSave?: () => void;
}

export function ClientDetailsTab({ 
  client, 
  formData, 
  isEditing, 
  mode = 'view',
  handleInputChange, 
  handleSelectChange,
  formRef,
  setIsEditing,
  handleSave
}: ClientDetailsTabProps) {
  const isNewMode = mode === 'new'
  const showEditableFields = isEditing || isNewMode

  return (
    <form ref={formRef} className="px-1">
      {mode === 'view' && setIsEditing && handleSave && (
        <div className="flex justify-between items-center mb-4">
          <Button 
            variant={isEditing ? "outline" : "default"} 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          >
            {isEditing ? "שמור שינויים" : "ערוך פרטים"}
          </Button>
          <h2 className="text-xl font-semibold">פרטים אישיים</h2>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="text-right border-primary/10 shadow-sm">
        <CardHeader className="py-3 px-4 bg-gradient-to-l rounded-t-xl from-primary/5 to-transparent border-b-0 -mt-6 pt-4" dir="rtl">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              פרטים אישיים
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 py-2" dir="rtl">
            <div className="space-y-0.5">
              <LabelWithUnderline>שם פרטי</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.first_name}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>שם משפחה</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.last_name}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>מגדר</LabelWithUnderline>
              {showEditableFields ? (
                <Select dir="rtl"
                  value={formData.gender || ''} 
                  onValueChange={(value) => handleSelectChange(value, 'gender')}
                >
                  <SelectTrigger className="mt-0.5 h-8 text-sm w-full">
                    <SelectValue placeholder="בחר מגדר" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="זכר">זכר</SelectItem>
                    <SelectItem value="נקבה">נקבה</SelectItem>
                    <SelectItem value="אחר">אחר</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.gender}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>תעודת זהות</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="national_id"
                  value={formData.national_id || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.national_id}</div>
              )}
            </div>
            <div className="text-right space-y-0.5" dir="rtl">
              <LabelWithUnderline>תאריך לידה</LabelWithUnderline>
              {showEditableFields ? (
                <DateInput
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.date_of_birth}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>תעסוקה</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="occupation"
                  value={formData.occupation || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.occupation}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>סטטוס</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="status"
                  value={formData.status || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.status}</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="text-right border-primary/10 shadow-sm">
        <CardHeader className="py-3 px-4 bg-gradient-to-l rounded-t-xl from-primary/5 to-transparent border-b-0 -mt-6 pt-4" dir="rtl">
        <CardTitle className="text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              פרטי התקשרות
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 py-2" dir="rtl">
            <div className="space-y-0.5">
              <LabelWithUnderline>עיר</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="address_city"
                  value={formData.address_city || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.address_city}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>רחוב</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="address_street"
                  value={formData.address_street || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.address_street}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>מספר</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="address_number"
                  value={formData.address_number || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.address_number}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>מיקוד</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="postal_code"
                  value={formData.postal_code || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.postal_code}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>טלפון נייד</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="tel"
                  name="phone_mobile"
                  value={formData.phone_mobile || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm text-right"
                  dir="rtl"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.phone_mobile}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>טלפון בית</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="tel"
                  name="phone_home"
                  value={formData.phone_home || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm text-right"
                  dir="rtl"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.phone_home}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>טלפון עבודה</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="tel"
                  name="phone_work"
                  value={formData.phone_work || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm text-right"
                  dir="rtl"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.phone_work}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>אימייל</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.email}</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="text-right border-primary/10 shadow-sm">
          <CardHeader className="py-3 px-4 bg-gradient-to-l rounded-t-xl from-primary/5 to-transparent border-b-0 -mt-6 pt-4" dir="rtl">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
              פרטי חברות ושירות
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 py-2" dir="rtl">
            <div className="space-y-0.5">
              <LabelWithUnderline>תאריך פתיחת תיק</LabelWithUnderline>
              {showEditableFields ? (
                <DateInput
                  name="file_creation_date"
                  value={formData.file_creation_date}
                  onChange={handleInputChange}
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.file_creation_date}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>תום חברות</LabelWithUnderline>
              {showEditableFields ? (
                <DateInput
                  name="membership_end"
                  value={formData.membership_end}
                  onChange={handleInputChange}
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.membership_end}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>תום שירות</LabelWithUnderline>
              {showEditableFields ? (
                <DateInput
                  name="service_end"
                  value={formData.service_end}
                  onChange={handleInputChange}
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.service_end}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>מחירון</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="price_list"
                  value={formData.price_list || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.price_list}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>הנחה באחוזים</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="number"
                  name="discount_percent"
                  value={formData.discount_percent || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : (client.discount_percent !== undefined ? `${client.discount_percent}%` : '')}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>קבוצת מיון</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="sorting_group"
                  value={formData.sorting_group || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.sorting_group}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <LabelWithUnderline>גורם מפנה</LabelWithUnderline>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="referring_party"
                  value={formData.referring_party || ''}
                  onChange={handleInputChange}
                  className="mt-0.5 h-8 text-sm"
                />
              ) : (
                <div className="text-sm py-1 px-2 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? '' : client.referring_party}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <LabelWithUnderline>צ'קים חסומים</LabelWithUnderline>
                  {showEditableFields ? (
                    <Select 
                      value={formData.blocked_checks ? 'true' : 'false'} 
                      onValueChange={(value) => handleSelectChange(value === 'true' ? true : false, 'blocked_checks')}
                    >
                      <SelectTrigger className="mt-0.5 h-8 text-xs">
                        <SelectValue placeholder="בחר" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs py-1 px-1 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? 'לא' : (client.blocked_checks ? 'כן' : 'לא')}</div>
                  )}
                </div>
                <div>
                  <LabelWithUnderline>אשראי חסום</LabelWithUnderline>
                  {showEditableFields ? (
                    <Select 
                      value={formData.blocked_credit ? 'true' : 'false'} 
                      onValueChange={(value) => handleSelectChange(value === 'true' ? true : false, 'blocked_credit')}
                    >
                      <SelectTrigger className="mt-0.5 h-8 text-xs">
                        <SelectValue placeholder="בחר" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs py-1 px-1 bg-muted/30 rounded min-h-8 flex items-center">{isNewMode ? 'לא' : (client.blocked_credit ? 'כן' : 'לא')}</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="rounded-md pt-4 mt-4" dir="rtl">
        <label className="block text-base font-semibold mb-2">הערות</label>
        {showEditableFields ? (
          <textarea 
            name="notes"
            value={formData.notes || ''}
            onChange={handleInputChange}
            className="text-sm w-full min-h-[90px] p-3 border shadow-sm rounded-md resize-none"
            rows={4}
          />
        ) : (
          <div className="text-sm border shadow-sm p-3 rounded-md min-h-[106px]">
            {isNewMode ? 'אין הערות' : (client.notes || 'אין הערות')}
          </div>
        )}
      </div>
    </form>
  )
} 