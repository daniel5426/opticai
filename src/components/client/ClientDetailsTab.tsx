import React from "react"
import { Client } from "@/lib/db/schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Custom label component with underline
function LabelWithUnderline({ children }: { children: React.ReactNode }) {
  return (
    <Label className="border-none pb-1 mb-1 inline-block border-black ">
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
  // Reference to the hidden date input
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  
  // Function to open the date picker
  const openDatePicker = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  return (
    <div className="relative mt-1">
      {/* Visible text input - just for display */}
      <div 
        className={`text-right pr-10 cursor-pointer h-9 rounded-md border px-3 py-2 border-input bg-transparent flex items-center ${className || ''}`}
        dir="rtl"
        onClick={openDatePicker}
      >
        {value ? new Date(value).toLocaleDateString('he-IL') : 'לחץ לבחירת תאריך'}
      </div>
      
      {/* Hidden native date input */}
      <input
        ref={dateInputRef}
        type="date"
        name={name}
        value={value || ''}
        onChange={onChange}
        className="absolute opacity-0 h-0 w-0 overflow-hidden"
      />
      
      {/* Calendar icon */}
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg 
          className="h-5 w-5 text-gray-400" 
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
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (value: string | boolean, name: string) => void;
  formRef: React.RefObject<HTMLFormElement>;
}

export function ClientDetailsTab({ 
  client, 
  formData, 
  isEditing, 
  handleInputChange, 
  handleSelectChange,
  formRef
}: ClientDetailsTabProps) {
  return (
    <form ref={formRef}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="text-right">
          <CardHeader>
            <CardTitle>פרטים אישיים</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4" dir="rtl">
            <div>
              <LabelWithUnderline>שם פרטי</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.first_name}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>שם משפחה</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.last_name}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>מגדר</LabelWithUnderline>
              {isEditing ? (
                <Select 
                  value={formData.gender || ''} 
                  onValueChange={(value) => handleSelectChange(value, 'gender')}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="בחר מגדר" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="זכר">זכר</SelectItem>
                    <SelectItem value="נקבה">נקבה</SelectItem>
                    <SelectItem value="אחר">אחר</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div>{client.gender}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>תעודת זהות</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="national_id"
                  value={formData.national_id || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.national_id}</div>
              )}
            </div>
            <div className="text-right" dir="rtl">
              <LabelWithUnderline>תאריך לידה</LabelWithUnderline>
              {isEditing ? (
                <DateInput
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                />
              ) : (
                <div>{client.date_of_birth}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>תעסוקה</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="occupation"
                  value={formData.occupation || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.occupation}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>סטטוס</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="status"
                  value={formData.status || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.status}</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="text-right">
          <CardHeader>
            <CardTitle>פרטי התקשרות</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4" dir="rtl">
            <div>
              <LabelWithUnderline>עיר</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="address_city"
                  value={formData.address_city || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.address_city}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>רחוב</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="address_street"
                  value={formData.address_street || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.address_street}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>מספר</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="address_number"
                  value={formData.address_number || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.address_number}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>מיקוד</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="postal_code"
                  value={formData.postal_code || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.postal_code}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>טלפון נייד</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="tel"
                  name="phone_mobile"
                  value={formData.phone_mobile || ''}
                  onChange={handleInputChange}
                  className="mt-1 text-right"
                  dir="rtl"
                />
              ) : (
                <div>{client.phone_mobile}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>טלפון בית</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="tel"
                  name="phone_home"
                  value={formData.phone_home || ''}
                  onChange={handleInputChange}
                  className="mt-1 text-right"
                  dir="rtl"
                />
              ) : (
                <div>{client.phone_home}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>טלפון עבודה</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="tel"
                  name="phone_work"
                  value={formData.phone_work || ''}
                  onChange={handleInputChange}
                  className="mt-1 text-right"
                  dir="rtl"
                />
              ) : (
                <div>{client.phone_work}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>אימייל</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.email}</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="text-right md:col-span-2">
          <CardHeader>
            <CardTitle>פרטי חברות ושירות</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4" dir="rtl">
            <div>
              <LabelWithUnderline>תאריך פתיחת תיק</LabelWithUnderline>
              {isEditing ? (
                <DateInput
                  name="file_creation_date"
                  value={formData.file_creation_date}
                  onChange={handleInputChange}
                />
              ) : (
                <div>{client.file_creation_date}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>תום חברות</LabelWithUnderline>
              {isEditing ? (
                <DateInput
                  name="membership_end"
                  value={formData.membership_end}
                  onChange={handleInputChange}
                />
              ) : (
                <div>{client.membership_end}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>תום שירות</LabelWithUnderline>
              {isEditing ? (
                <DateInput
                  name="service_end"
                  value={formData.service_end}
                  onChange={handleInputChange}
                />
              ) : (
                <div>{client.service_end}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>מחירון</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="price_list"
                  value={formData.price_list || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.price_list}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>הנחה באחוזים</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="number"
                  name="discount_percent"
                  value={formData.discount_percent || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.discount_percent !== undefined ? `${client.discount_percent}%` : ''}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>קבוצת מיון</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="sorting_group"
                  value={formData.sorting_group || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.sorting_group}</div>
              )}
            </div>
            <div>
              <LabelWithUnderline>גורם מפנה</LabelWithUnderline>
              {isEditing ? (
                <Input 
                  type="text"
                  name="referring_party"
                  value={formData.referring_party || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              ) : (
                <div>{client.referring_party}</div>
              )}
            </div>

            <div>
              <div className="flex gap-2 justify-between">
                <div className="w-[48%]">
                  <LabelWithUnderline>צ'קים חסומים</LabelWithUnderline>
                  {isEditing ? (
                    <Select 
                      value={formData.blocked_checks ? 'true' : 'false'} 
                      onValueChange={(value) => handleSelectChange(value === 'true' ? true : false, 'blocked_checks')}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="בחר" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div>{client.blocked_checks ? 'כן' : 'לא'}</div>
                  )}
                </div>
                <div className="w-[48%]">
                  <LabelWithUnderline>אשראי חסום</LabelWithUnderline>
                  {isEditing ? (
                    <Select 
                      value={formData.blocked_credit ? 'true' : 'false'} 
                      onValueChange={(value) => handleSelectChange(value === 'true' ? true : false, 'blocked_credit')}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="בחר" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div>{client.blocked_credit ? 'כן' : 'לא'}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-2 md:col-span-4">
              <LabelWithUnderline>הערות</LabelWithUnderline>
              {isEditing ? (
                <textarea 
                  name="notes"
                  value={formData.notes || ''}
                  onChange={handleInputChange}
                  className="w-full min-h-[70px] mt-1 p-2 border rounded-md resize-y"
                  rows={4}
                />
              ) : (
                <div className="whitespace-pre-wrap">{client.notes}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  )
} 