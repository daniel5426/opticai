import React from "react"
import { Client, Family } from "@/lib/db/schema-interface"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getAllFamilies, getFamilyById, createFamily, addClientToFamily, removeClientFromFamily } from "@/lib/db/family-db"
import { SaveIcon, XIcon, ChevronDownIcon, CheckIcon } from "lucide-react"

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
  disabled?: boolean;
}

function DateInput({ name, value, onChange, className, disabled = false }: DateInputProps) {
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  
  const openDatePicker = () => {
    if (dateInputRef.current && !disabled) {
      dateInputRef.current.showPicker();
    }
  };

  return (
    <div className="relative dark:bg-card">
      <div 
        className={`text-right pr-10 h-9 rounded-lg px-3 py-2 border text-sm flex items-center ${disabled ? 'bg-accent/50 dark:bg-accent/50 cursor-default' : 'bg-card cursor-pointer hover:bg-background/80'} ${className || ''}`}
        dir="rtl"
        onClick={openDatePicker}
      >
        {value ? new Date(value).toLocaleDateString('he-IL') : (disabled ? '' : '')}
      </div>
      
      <input
        ref={dateInputRef}
        type="date"
        name={name}
        value={value || ''}
        onChange={onChange}
        className="absolute dark:bg-card opacity-0 h-0 w-0 overflow-hidden"
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
  onClientUpdate?: (client: Client) => void;
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
  handleSave,
  onClientUpdate
}: ClientDetailsTabProps) {
  const isNewMode = mode === 'new'
  const showEditableFields = isEditing || isNewMode

  const [families, setFamilies] = React.useState<Family[]>([])
  const [filteredFamilies, setFilteredFamilies] = React.useState<Family[]>([])
  const [familySearchTerm, setFamilySearchTerm] = React.useState('')
  const [isFamilySelectOpen, setIsFamilySelectOpen] = React.useState(false)
  const [selectedFamily, setSelectedFamily] = React.useState<Family | null>(null)
  const [isCreatingFamily, setIsCreatingFamily] = React.useState(false)
  const [newFamilyName, setNewFamilyName] = React.useState('')
  const [newFamilyRole, setNewFamilyRole] = React.useState('אחר')

  React.useEffect(() => {
    loadFamilies()
  }, [])

  React.useEffect(() => {
    if (formData.family_id) {
      loadSelectedFamily(formData.family_id)
    } else {
      setSelectedFamily(null)
    }
  }, [formData.family_id])

  React.useEffect(() => {
    if (familySearchTerm.trim() === '') {
      setFilteredFamilies(families)
    } else {
      const filtered = families.filter(family =>
        family.name.toLowerCase().includes(familySearchTerm.toLowerCase())
      )
      setFilteredFamilies(filtered)
    }
  }, [families, familySearchTerm])

  const loadFamilies = async () => {
    try {
      const familiesData = await getAllFamilies()
      setFamilies(familiesData)
    } catch (error) {
      console.error('Error loading families:', error)
    }
  }

  const loadSelectedFamily = async (familyId: number) => {
    try {
      const family = await getFamilyById(familyId)
      setSelectedFamily(family || null)
    } catch (error) {
      console.error('Error loading selected family:', error)
    }
  }

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim()) return

    try {
      const newFamily = await createFamily({ name: newFamilyName.trim() })
      if (newFamily && newFamily.id) {
        setFamilies(prev => [...prev, newFamily])
        
        if (client.id) {
          const success = await addClientToFamily(client.id, newFamily.id, newFamilyRole)
          if (success) {
            handleSelectChange(newFamily.id.toString(), 'family_id')
            handleSelectChange(newFamilyRole, 'family_role')
            
            if (onClientUpdate) {
              const updatedClient = { ...client, family_id: newFamily.id, family_role: newFamilyRole }
              onClientUpdate(updatedClient)
            }
          } else {
            console.error('Failed to add client to family')
          }
        } else {
          handleSelectChange(newFamily.id.toString(), 'family_id')
          handleSelectChange(newFamilyRole, 'family_role')
        }
        
        setNewFamilyName('')
        setNewFamilyRole('אחר')
        setIsCreatingFamily(false)
      }
    } catch (error) {
      console.error('Error creating family:', error)
    }
  }

  const handleFamilyChange = async (familyId: string) => {
    if (familyId === 'none') {
      if (client.id) {
        const success = await removeClientFromFamily(client.id)
        if (success) {
          handleSelectChange('', 'family_id')
          handleSelectChange('', 'family_role')
        }
      } else {
        handleSelectChange('', 'family_id')
        handleSelectChange('', 'family_role')
      }
    } else {
      handleSelectChange(familyId, 'family_id')
    }
    setIsFamilySelectOpen(false)
    setFamilySearchTerm('')
  }

  const handleRoleChange = async (role: string) => {
    handleSelectChange(role, 'family_role')
    
    if (client.id && formData.family_id && role) {
      const success = await addClientToFamily(client.id, formData.family_id, role)
      if (!success) {
        console.error('Failed to add client to family with role')
      }
    }
  }

  const getSelectedFamilyName = () => {
    if (!formData.family_id) return 'בחר משפחה'
    const family = families.find(f => f.id === formData.family_id)
    return family ? family.name : 'בחר משפחה'
  }

  return (
    <form ref={formRef} className="no-scrollbar" style={{containerType: 'inline-size', scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
      {mode === 'view' && setIsEditing && handleSave && (
        <div className="flex justify-between items-center mb-4">
          <Button 
            type="button"
            variant={isEditing ? "outline" : "default"} 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          >
            {isEditing ? "שמור שינויים" : "ערוך פרטים"}
          </Button>
          <h2 className="text-xl font-semibold">פרטים אישיים</h2>
        </div>
      )}
      <div className="space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-6" dir="rtl">
              <div className="p-2 bg-muted rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <h3 className="text-lg font-semibold">פרטי התקשרות</h3>
            </div>
            <div className="grid grid-cols-1 @[900px]:grid-cols-2 gap-4" dir="rtl">
              <div className="space-y-2">
                <ModernLabel>עיר</ModernLabel>
                <Input 
                  type="text"
                  name="address_city"
                  value={formData.address_city || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס עיר" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>רחוב</ModernLabel>
                <Input 
                  type="text"
                  name="address_street"
                  value={formData.address_street || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס רחוב" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>מספר</ModernLabel>
                <Input 
                  type="text"
                  name="address_number"
                  value={formData.address_number || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס מספר" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>מיקוד</ModernLabel>
                <Input 
                  type="text"
                  name="postal_code"
                  value={formData.postal_code || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס מיקוד" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>טלפון נייד</ModernLabel>
                <Input 
                  type="tel"
                  name="phone_mobile"
                  value={formData.phone_mobile || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 text-right disabled:opacity-100 disabled:cursor-default`}
                  dir="rtl"
                  placeholder={showEditableFields ? "הכנס טלפון נייד" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>טלפון בית</ModernLabel>
                <Input 
                  type="tel"
                  name="phone_home"
                  value={formData.phone_home || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 text-right disabled:opacity-100 disabled:cursor-default`}
                  dir="rtl"
                  placeholder={showEditableFields ? "הכנס טלפון בית" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>טלפון עבודה</ModernLabel>
                <Input 
                  type="tel"
                  name="phone_work"
                  value={formData.phone_work || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 text-right disabled:opacity-100 disabled:cursor-default`}
                  dir="rtl"
                  placeholder={showEditableFields ? "הכנס טלפון עבודה" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>אימייל</ModernLabel>
                <Input 
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס אימייל" : ""}
                />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-6" dir="rtl">
              <div className="p-2 bg-muted rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
              </div>
              <h3 className="text-lg font-semibold">פרטי חברות ושירות</h3>
            </div>
            <div className="grid grid-cols-1 @[900px]:grid-cols-2 gap-4" dir="rtl">
              <div className="space-y-2">
                <ModernLabel>תאריך פתיחת תיק</ModernLabel>
                <DateInput
                  name="file_creation_date"
                  value={formData.file_creation_date}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>תום חברות</ModernLabel>
                <DateInput
                  name="membership_end"
                  value={formData.membership_end}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>תום שירות</ModernLabel>
                <DateInput
                  name="service_end"
                  value={formData.service_end}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>מחירון</ModernLabel>
                <Input 
                  type="text"
                  name="price_list"
                  value={formData.price_list || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס מחירון" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>הנחה באחוזים</ModernLabel>
                <Input 
                  type="number"
                  name="discount_percent"
                  value={formData.discount_percent || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס אחוז הנחה" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>קבוצת מיון</ModernLabel>
                <Input 
                  type="text"
                  name="sorting_group"
                  value={formData.sorting_group || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס קבוצת מיון" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>גורם מפנה</ModernLabel>
                <Input 
                  type="text"
                  name="referring_party"
                  value={formData.referring_party || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס גורם מפנה" : ""}
                />
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-1 @[400px]:grid-cols-2 gap-3">
                  <div>
                    <ModernLabel>צ'קים חסומים</ModernLabel>
                    <Select 
                      disabled={!showEditableFields}
                      value={formData.blocked_checks ? 'true' : 'false'} 
                      onValueChange={(value) => handleSelectChange(value === 'true' ? true : false, 'blocked_checks')}
                    >
                      <SelectTrigger dir="rtl" disabled={!showEditableFields}>
                        <SelectValue placeholder="בחר" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <ModernLabel>אשראי חסום</ModernLabel>
                    <Select 
                      disabled={!showEditableFields}
                      value={formData.blocked_credit ? 'true' : 'false'} 
                      onValueChange={(value) => handleSelectChange(value === 'true' ? true : false, 'blocked_credit')}
                    >
                      <SelectTrigger dir="rtl" disabled={!showEditableFields}>
                        <SelectValue placeholder="בחר" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-6" dir="rtl">
              <div className="p-2 bg-muted rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <h3 className="text-lg font-semibold">פרטים אישיים</h3>
            </div>
            <div className="grid grid-cols-1 @[900px]:grid-cols-2 gap-4" dir="rtl">
              <div className="space-y-2">
                <ModernLabel>
                  שם פרטי
                  {isNewMode && <span className="text-red-500 mr-1">*</span>}
                </ModernLabel>
                <Input 
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס שם פרטי" : ""}
                  required={isNewMode}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>
                  שם משפחה
                  {isNewMode && <span className="text-red-500 mr-1">*</span>}
                </ModernLabel>
                <Input 
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס שם משפחה" : ""}
                  required={isNewMode}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>מגדר</ModernLabel>
                <Select dir="rtl"
                  disabled={!showEditableFields}
                  value={formData.gender || ''} 
                  onValueChange={(value) => handleSelectChange(value, 'gender')}
                >
                  <SelectTrigger  disabled={!showEditableFields}>
                    <SelectValue placeholder="בחר מגדר" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="זכר">זכר</SelectItem>
                    <SelectItem value="נקבה">נקבה</SelectItem>
                    <SelectItem value="אחר">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <ModernLabel>תעודת זהות</ModernLabel>
                <Input 
                  type="text"
                  name="national_id"
                  value={formData.national_id || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס תעודת זהות" : ""}
                />
              </div>
              <div className="text-right space-y-2" dir="rtl">
                <ModernLabel>תאריך לידה</ModernLabel>
                <DateInput
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>קופת חולים</ModernLabel>
                <Select dir="rtl"
                  disabled={!showEditableFields}
                  value={formData.health_fund || ''} 
                  onValueChange={(value) => handleSelectChange(value, 'health_fund')}
                >
                  <SelectTrigger  disabled={!showEditableFields}>
                    <SelectValue placeholder="בחר קופת חולים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="כללית">כללית</SelectItem>
                    <SelectItem value="מכבי">מכבי</SelectItem>
                    <SelectItem value="מאוחדת">מאוחדת</SelectItem>
                    <SelectItem value="לאומית">לאומית</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <ModernLabel>תעסוקה</ModernLabel>
                <Input 
                  type="text"
                  name="occupation"
                  value={formData.occupation || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס תעסוקה" : ""}
                />
              </div>
              <div className="space-y-2">
                <ModernLabel>סטטוס</ModernLabel>
                <Input 
                  type="text"
                  name="status"
                  value={formData.status || ''}
                  onChange={handleInputChange}
                  disabled={!showEditableFields}
                  className={`text-sm h-9 disabled:opacity-100 disabled:cursor-default`}
                  placeholder={showEditableFields ? "הכנס סטטוס" : ""}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2 bg-card rounded-lg shadow-md p-5" dir="rtl">
            <div className="flex items-center gap-3 mb-4 justify-between">
              <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3 className="text-base font-medium text-muted-foreground">משפחה</h3>
              </div>
              {showEditableFields && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="bg-card "
                  size="sm" 
                  onClick={() => setIsCreatingFamily(true)}
                >
                  +
                </Button>
              )}

            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 @[500px]:grid-cols-3 gap-3">
                <div className="col-span-1 @[500px]:col-span-2 space-y-2">
                  <ModernLabel>משפחה</ModernLabel>
                  <div className="flex gap-2">
                    <Popover open={isFamilySelectOpen} onOpenChange={setIsFamilySelectOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isFamilySelectOpen}
                          className="w-full justify-between h-9 text-sm font-normal"
                          disabled={!showEditableFields}
                          dir="rtl"
                        >
                          {getSelectedFamilyName()}
                          <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <div className="p-2">
                          <Input
                            placeholder="חפש משפחה..."
                            value={familySearchTerm}
                            onChange={(e) => setFamilySearchTerm(e.target.value)}
                            className="text-right"
                            dir="rtl"
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto" style={{scrollbarWidth: 'none'}}>
                          <div dir="rtl"
                            className="flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm hover:bg-accent hover:text-accent-foreground"
                            onClick={() => handleFamilyChange('none')}
                          >
                            {!formData.family_id && (
                              <CheckIcon className="absolute right-2 h-4 w-4" />
                            )}
                            ללא משפחה
                          </div>
                          {filteredFamilies.map(family => (
                            <div
                              dir="rtl"
                              key={family.id}
                              className="text-right rtl relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm hover:bg-accent hover:text-accent-foreground"
                              onClick={() => handleFamilyChange(family.id!.toString())}
                            >
                              {formData.family_id === family.id && (
                                <CheckIcon className="absolute right-2 h-4 w-4" />
                              )}
                              {family.name}
                            </div>
                          ))}
                          {filteredFamilies.length === 0 && familySearchTerm && (
                            <div className="py-2 px-4 text-sm text-muted-foreground text-center">
                              לא נמצאו משפחות
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                {formData.family_id && (
                  <div className="space-y-2">
                    <ModernLabel>תפקיד במשפחה</ModernLabel>
                    <Select 
                      disabled={!showEditableFields}
                      value={formData.family_role || ''} 
                      onValueChange={handleRoleChange}
                    >
                      <SelectTrigger dir="rtl" disabled={!showEditableFields}>
                        <SelectValue placeholder="בחר תפקיד" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="אב">אב</SelectItem>
                        <SelectItem value="אם">אם</SelectItem>
                        <SelectItem value="ילד">ילד</SelectItem>
                        <SelectItem value="אחר">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {isCreatingFamily && (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                  <div className="grid grid-cols-1 @[600px]:grid-cols-6 gap-3 items-end">
                    <div className="col-span-1 @[600px]:col-span-3 space-y-2">
                      <ModernLabel>שם משפחה חדשה</ModernLabel>
                      <Input 
                        value={newFamilyName}
                        onChange={(e) => setNewFamilyName(e.target.value)}
                        placeholder="הכנס שם משפחה"
                        className="text-sm"
                      />
                    </div>
                    <div className="col-span-1 @[600px]:col-span-2 space-y-2">
                      <ModernLabel>תפקיד במשפחה</ModernLabel>
                      <Select 
                        value={newFamilyRole} 
                        onValueChange={setNewFamilyRole}
                      >
                        <SelectTrigger dir="rtl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="אב">אב</SelectItem>
                          <SelectItem value="אם">אם</SelectItem>
                          <SelectItem value="ילד">ילד</SelectItem>
                          <SelectItem value="אחר">אחר</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                                         <div className="flex gap-1 items-center">
                       <button 
                         type="button" 
                         className="p-1 hover:bg-muted rounded-sm transition-colors"
                         onClick={() => {
                           setIsCreatingFamily(false)
                           setNewFamilyName('')
                           setNewFamilyRole('אחר')
                         }}
                       >
                         <XIcon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                       </button>
                       <button 
                         type="button" 
                         className="p-1 hover:bg-muted rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                         onClick={handleCreateFamily}
                         disabled={!newFamilyName.trim()}
                       >
                         <SaveIcon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                       </button>
                     </div>
                  </div>
                </div>
              )}

              {selectedFamily && (
                <div className="text-sm text-muted-foreground">
                  <p>נוצר בתאריך: {selectedFamily.created_date ? new Date(selectedFamily.created_date).toLocaleDateString('he-IL') : 'לא זמין'}</p>
                </div>
              )}
              {!selectedFamily && !isCreatingFamily && (
                <div className="text-sm h-[1.2586rem] text-muted-foreground">
                </div>
              )}


            </div>
          </div>

          <div className="lg:col-span-2 bg-card rounded-lg shadow-md p-6" dir="rtl">
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
            <Textarea
              name="notes"
              disabled={!showEditableFields}
              value={formData.notes || ''}
              onChange={handleInputChange}
              className={`text-sm w-full p-3 border rounded-lg disabled:opacity-100 disabled:cursor-default min-h-[60px]`}
              style={{scrollbarWidth: 'none'}}
              rows={3}
              placeholder={showEditableFields ? "הכנס הערות כלליות על הלקוח..." : ""}
            />
          </div>

          <div className="bg-card p-[35px] rounded-lg shadow-md flex justify-center items-center ">
            
            <div className="flex justify-center items-center">
              <div className="relative">
                <div className="w-28 h-28 rounded-lg bg-muted overflow-hidden border-2 border-border">
                  {formData.profile_picture ? (
                    <img 
                      src={formData.profile_picture} 
                      alt="תמונת פרופיל" 
                      className="w-28 h-28 object-cover"
                    />
                  ) : (
                    <div className="w-28 h-28 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  )}
                </div>
                {showEditableFields && (
                  <>
                    <label className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full cursor-pointer flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17,8 12,3 7,8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <input 
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result as string;
                              handleSelectChange(result, 'profile_picture');
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {formData.profile_picture && (
                      <button
                        type="button"
                        onClick={() => handleSelectChange('', 'profile_picture')}
                        className="absolute bottom-0 left-0 w-6 h-6 bg-destructive rounded-full cursor-pointer flex items-center justify-center hover:bg-destructive/90 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive-foreground">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
      
    </form>
  )
} 