import React from "react"
import { Client } from "@/lib/db/schema"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

// Custom label component
function ModernLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
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
    <div className="relative">
      <div 
        className={`text-right pr-10 cursor-pointer h-10 rounded-lg border-2 px-3 py-2 border-input bg-background hover:bg-background/80 focus-within:border-blue-400 transition-colors flex items-center text-sm ${className || ''}`}
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
      
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg 
          className="h-4 w-4 text-muted-foreground" 
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
    <form ref={formRef} className="px-1 max-w-7xl self-center justify-center mx-auto">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6" dir="rtl">
            <div className="p-2 bg-muted rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <h3 className="text-lg font-semibold">פרטים אישיים</h3>
          </div>
          <div className="grid grid-cols-2 gap-4" dir="rtl">
            <div className="space-y-2">
              <ModernLabel>
                שם פרטי
                {isNewMode && <span className="text-red-500 mr-1">*</span>}
              </ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס שם פרטי"
                  required={isNewMode}
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.first_name || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>
                שם משפחה
                {isNewMode && <span className="text-red-500 mr-1">*</span>}
              </ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס שם משפחה"
                  required={isNewMode}
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.last_name || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>מגדר</ModernLabel>
              {showEditableFields ? (
                <Select dir="rtl"
                  value={formData.gender || ''} 
                  onValueChange={(value) => handleSelectChange(value, 'gender')}
                >
                  <SelectTrigger className="h-10 border-2 focus:border-primary transition-colors">
                    <SelectValue placeholder="בחר מגדר" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="זכר">זכר</SelectItem>
                    <SelectItem value="נקבה">נקבה</SelectItem>
                    <SelectItem value="אחר">אחר</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא נבחר' : client.gender || 'לא נבחר'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>תעודת זהות</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="national_id"
                  value={formData.national_id || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס תעודת זהות"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.national_id || 'לא הוזן'}</div>
              )}
            </div>
            <div className="text-right space-y-2" dir="rtl">
              <ModernLabel>תאריך לידה</ModernLabel>
              {showEditableFields ? (
                <DateInput
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.date_of_birth || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>תעסוקה</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="occupation"
                  value={formData.occupation || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס תעסוקה"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.occupation || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>סטטוס</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="status"
                  value={formData.status || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס סטטוס"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.status || 'לא הוזן'}</div>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6" dir="rtl">
            <div className="p-2 bg-muted rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold">פרטי התקשרות</h3>
          </div>
          <div className="grid grid-cols-2 gap-4" dir="rtl">
            <div className="space-y-2">
              <ModernLabel>עיר</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="address_city"
                  value={formData.address_city || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס עיר"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.address_city || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>רחוב</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="address_street"
                  value={formData.address_street || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס רחוב"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.address_street || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>מספר</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="address_number"
                  value={formData.address_number || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס מספר"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.address_number || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>מיקוד</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="postal_code"
                  value={formData.postal_code || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס מיקוד"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.postal_code || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>טלפון נייד</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="tel"
                  name="phone_mobile"
                  value={formData.phone_mobile || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors text-right"
                  dir="rtl"
                  placeholder="הכנס טלפון נייד"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.phone_mobile || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>טלפון בית</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="tel"
                  name="phone_home"
                  value={formData.phone_home || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors text-right"
                  dir="rtl"
                  placeholder="הכנס טלפון בית"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.phone_home || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>טלפון עבודה</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="tel"
                  name="phone_work"
                  value={formData.phone_work || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors text-right"
                  dir="rtl"
                  placeholder="הכנס טלפון עבודה"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.phone_work || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>אימייל</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס אימייל"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.email || 'לא הוזן'}</div>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6" dir="rtl">
            <div className="p-2 bg-muted rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </div>
            <h3 className="text-lg font-semibold">פרטי חברות ושירות</h3>
          </div>
          <div className="grid grid-cols-2 gap-4" dir="rtl">
            <div className="space-y-2">
              <ModernLabel>תאריך פתיחת תיק</ModernLabel>
              {showEditableFields ? (
                <DateInput
                  name="file_creation_date"
                  value={formData.file_creation_date}
                  onChange={handleInputChange}
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.file_creation_date || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>תום חברות</ModernLabel>
              {showEditableFields ? (
                <DateInput
                  name="membership_end"
                  value={formData.membership_end}
                  onChange={handleInputChange}
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.membership_end || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>תום שירות</ModernLabel>
              {showEditableFields ? (
                <DateInput
                  name="service_end"
                  value={formData.service_end}
                  onChange={handleInputChange}
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.service_end || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>מחירון</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="price_list"
                  value={formData.price_list || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס מחירון"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.price_list || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>הנחה באחוזים</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="number"
                  name="discount_percent"
                  value={formData.discount_percent || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס אחוז הנחה"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? '0%' : (client.discount_percent !== undefined ? `${client.discount_percent}%` : '0%')}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>קבוצת מיון</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="sorting_group"
                  value={formData.sorting_group || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס קבוצת מיון"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.sorting_group || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <ModernLabel>גורם מפנה</ModernLabel>
              {showEditableFields ? (
                <Input 
                  type="text"
                  name="referring_party"
                  value={formData.referring_party || ''}
                  onChange={handleInputChange}
                  className="h-10 border-2 focus:border-primary transition-colors"
                  placeholder="הכנס גורם מפנה"
                />
              ) : (
                <div className="text-sm py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא הוזן' : client.referring_party || 'לא הוזן'}</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <ModernLabel>צ'קים חסומים</ModernLabel>
                  {showEditableFields ? (
                    <Select 
                      value={formData.blocked_checks ? 'true' : 'false'} 
                      onValueChange={(value) => handleSelectChange(value === 'true' ? true : false, 'blocked_checks')}
                    >
                      <SelectTrigger className="h-10 border-2 focus:border-primary transition-colors text-xs">
                        <SelectValue placeholder="בחר" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs py-2.5 px-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא' : (client.blocked_checks ? 'כן' : 'לא')}</div>
                  )}
                </div>
                <div>
                  <ModernLabel>אשראי חסום</ModernLabel>
                  {showEditableFields ? (
                    <Select 
                      value={formData.blocked_credit ? 'true' : 'false'} 
                      onValueChange={(value) => handleSelectChange(value === 'true' ? true : false, 'blocked_credit')}
                    >
                      <SelectTrigger className="h-10 border-2 focus:border-primary transition-colors text-xs">
                        <SelectValue placeholder="בחר" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs py-2.5 px-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border min-h-10 flex items-center font-medium">{isNewMode ? 'לא' : (client.blocked_credit ? 'כן' : 'לא')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8" dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-muted rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
          </div>
          <h3 className="text-base font-medium text-muted-foreground">הערות</h3>
        </div>
        <div>
          {showEditableFields ? (
            <textarea 
              name="notes"
              value={formData.notes || ''}
              onChange={handleInputChange}
              className="w-full min-h-[120px] p-4 border-2 focus:border-primary transition-colors rounded-lg resize-none text-sm bg-background placeholder:text-muted-foreground"
              rows={5}
              placeholder="הכנס הערות כלליות על הלקוח..."
            />
          ) : (
            <div className="text-sm p-4 bg-muted/30 rounded-lg border min-h-[120px] leading-relaxed">
              {isNewMode ? 'אין הערות' : (client.notes || 'אין הערות')}
            </div>
          )}
        </div>
      </div>
    </form>
  )
} 