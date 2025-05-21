import React, { useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema"
import { toast } from "sonner"

// Custom label component with underline
function LabelWithUnderline({ children }: { children: React.ReactNode }) {
  return (
    <Label className="border-none pb-1 mb-1 inline-block border-black">
      {children}
    </Label>
  )
}

interface DateInputProps {
  name: string;
  value: string | number | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

function DateInput({ name, value, onChange, className }: DateInputProps) {
  // Reference to the hidden date input
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Function to open the date picker
  const openDatePicker = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  // Convert value to string for display
  const stringValue = typeof value === 'string' ? value : '';

  return (
    <div className="relative mt-1">
      {/* Visible text input - just for display */}
      <div 
        className={`text-right pr-10 cursor-pointer h-9 rounded-md border px-3 py-2 border-input bg-transparent flex items-center ${className || ''}`}
        dir="rtl"
        onClick={openDatePicker}
      >
        {stringValue ? new Date(stringValue).toLocaleDateString('he-IL') : 'לחץ לבחירת תאריך'}
      </div>
      
      {/* Hidden native date input */}
      <input
        ref={dateInputRef}
        type="date"
        name={name}
        value={stringValue}
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

export default function NewClientPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = React.useState<Partial<Client>>({
    gender: "זכר",
    blocked_checks: false,
    blocked_credit: false,
    discount_percent: 0
  })
  const formRef = useRef<HTMLFormElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string | boolean, name: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newClient = createClient(formData as Client)
    if (newClient) {
      toast.success("לקוח נוצר בהצלחה")
      navigate({ to: "/clients/$clientId", params: { clientId: String(newClient.id) } })
    } else {
      toast.error("שגיאה ביצירת לקוח חדש")
    }
  }

  return (
    <SidebarProvider dir="rtl" className="h-full">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset>
        <SiteHeader title="לקוחות" backLink="/clients" clientName="לקוח חדש" />
        <div className="flex flex-col flex-1 p-4 lg:p-6 mb-40" dir="rtl">
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">              
              <Card className="text-right">
                <CardHeader>
                  <CardTitle>פרטי התקשרות</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4" dir="rtl">
                  <div>
                    <LabelWithUnderline>עיר</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="address_city"
                      value={formData.address_city || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>רחוב</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="address_street"
                      value={formData.address_street || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>מספר</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="address_number"
                      value={formData.address_number || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>מיקוד</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="postal_code"
                      value={formData.postal_code || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>טלפון נייד</LabelWithUnderline>
                    <Input 
                      type="tel"
                      name="phone_mobile"
                      value={formData.phone_mobile || ''}
                      onChange={handleInputChange}
                      className="mt-1 text-right"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>טלפון בית</LabelWithUnderline>
                    <Input 
                      type="tel"
                      name="phone_home"
                      value={formData.phone_home || ''}
                      onChange={handleInputChange}
                      className="mt-1 text-right"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>טלפון עבודה</LabelWithUnderline>
                    <Input 
                      type="tel"
                      name="phone_work"
                      value={formData.phone_work || ''}
                      onChange={handleInputChange}
                      className="mt-1 text-right"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>אימייל</LabelWithUnderline>
                    <Input 
                      type="email"
                      name="email"
                      value={formData.email || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
              <Card className="text-right">
                <CardHeader>
                  <CardTitle>פרטים אישיים</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4" dir="rtl">
                  <div>
                    <LabelWithUnderline>שם פרטי</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="first_name"
                      value={formData.first_name || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>שם משפחה</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="last_name"
                      value={formData.last_name || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>מגדר</LabelWithUnderline>
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
                  </div>
                  <div>
                    <LabelWithUnderline>תעודת זהות</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="national_id"
                      value={formData.national_id || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div className="text-right" dir="rtl">
                    <LabelWithUnderline>תאריך לידה</LabelWithUnderline>
                    <DateInput
                      name="date_of_birth"
                      value={formData.date_of_birth}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>תעסוקה</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="occupation"
                      value={formData.occupation || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>סטטוס</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="status"
                      value={formData.status || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
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
                    <DateInput
                      name="file_creation_date"
                      value={formData.file_creation_date}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>תום חברות</LabelWithUnderline>
                    <DateInput
                      name="membership_end"
                      value={formData.membership_end}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>תום שירות</LabelWithUnderline>
                    <DateInput
                      name="service_end"
                      value={formData.service_end}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>מחירון</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="price_list"
                      value={formData.price_list || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>הנחה באחוזים</LabelWithUnderline>
                    <Input 
                      type="number"
                      name="discount_percent"
                      value={formData.discount_percent?.toString() || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>קבוצת מיון</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="sorting_group"
                      value={formData.sorting_group || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <LabelWithUnderline>גורם מפנה</LabelWithUnderline>
                    <Input 
                      type="text"
                      name="referring_party"
                      value={formData.referring_party || ''}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <div className="flex gap-2 justify-between">
                      <div className="w-[48%]">
                        <LabelWithUnderline>צ'קים חסומים</LabelWithUnderline>
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
                      </div>
                      <div className="w-[48%]">
                        <LabelWithUnderline>אשראי חסום</LabelWithUnderline>
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
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-span-1 md:col-span-2">
                    <LabelWithUnderline>הערות</LabelWithUnderline>
                    <textarea 
                      name="notes"
                      value={formData.notes || ''}
                      onChange={handleInputChange}
                      className="w-full min-h-[10px] mt-1 p-2 border rounded-md resize-y"
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex justify-start mt-6">
              <Button 
                type="button" 
                variant="outline" 
                className="ml-2"
                onClick={() => navigate({ to: "/clients" })}
              >
                ביטול
              </Button>
              <Button type="submit">שמירה</Button>
            </div>
          </form>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 