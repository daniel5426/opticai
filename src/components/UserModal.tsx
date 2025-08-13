import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { User } from '@/lib/db/schema-interface'
import { createUser, updateUser } from '@/lib/db/users-db'
import { CustomModal } from '@/components/ui/custom-modal'

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  editingUser: User | null
  currentUser: User | null
  clinics?: Array<{ id: number; name: string }>
  companyId?: number
  defaultClinicId?: number
  onUserSaved: (user: User) => void
  onUserUpdated: (user: User) => void
}

export function UserModal({
  isOpen,
  onClose,
  editingUser,
  currentUser,
  clinics = [],
  companyId,
  defaultClinicId,
  onUserSaved,
  onUserUpdated
}: UserModalProps) {
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    phone: '',
    hasPassword: false,
    password: '',
    role: 'clinic_worker' as 'clinic_manager' | 'clinic_worker' | 'clinic_viewer' | 'company_ceo',
    clinic_id: ''
  })

  useEffect(() => {
    if (editingUser) {
      setUserForm({
        username: editingUser.username,
        email: editingUser.email || '',
        phone: editingUser.phone || '',
        hasPassword: !!editingUser.password,
        password: '',
        role: editingUser.role,
        clinic_id: editingUser.clinic_id?.toString() || ''
      })
    } else {
      setUserForm({
        username: '',
        email: '',
        phone: '',
        hasPassword: false,
        password: '',
        role: 'clinic_worker',
        clinic_id: defaultClinicId ? String(defaultClinicId) : ''
      })
    }
  }, [editingUser, defaultClinicId])

  const handleUserFormChange = (field: string, value: any) => {
    setUserForm(prev => ({ ...prev, [field]: value }))
  }

  const handleUserSave = async () => {
    try {
      if (!userForm.username.trim()) {
        toast.error('שם המשתמש הוא שדה חובה')
        return
      }

      const userData = {
        username: userForm.username.trim(),
        email: userForm.email.trim() || undefined,
        phone: userForm.phone.trim() || undefined,
        password: userForm.hasPassword ? (userForm.password.trim() || undefined) : null,
        role: userForm.role,
        clinic_id: userForm.clinic_id && userForm.clinic_id !== 'global' ? parseInt(userForm.clinic_id) : undefined,
        company_id: companyId || currentUser?.company_id || undefined,
        is_active: true
      }

      if (editingUser) {
        const updatedUser = await updateUser({ ...userData, id: editingUser.id })
        if (updatedUser) {
          onUserUpdated(updatedUser)
          toast.success('המשתמש עודכן בהצלחה')
          onClose()
        } else {
          toast.error('שגיאה בעדכון המשתמש')
        }
      } else {
        const newUser = await createUser(userData)
        if (newUser) {
          onUserSaved(newUser)
          toast.success('המשתמש נוצר בהצלחה')
          onClose()
        } else {
          toast.error('שגיאה ביצירת המשתמש')
        }
      }
    } catch (error) {
      console.error('Error saving user:', error)
      toast.error('שגיאה בשמירת המשתמש')
    }
  }

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingUser ? 'ערוך משתמש' : 'הוסף משתמש חדש'}
      className="max-w-lg"
    >
      <div className="space-y-4" dir="rtl">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-right block">שם משתמש *</Label>
            <Input
              id="username"
              value={userForm.username}
              onChange={(e) => handleUserFormChange('username', e.target.value)}
              placeholder="הזן שם משתמש"
              className="text-right"
              dir="rtl"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-right block">אימייל</Label>
            <Input
              id="email"
              type="email"
              value={userForm.email}
              onChange={(e) => handleUserFormChange('email', e.target.value)}
              placeholder="example@email.com"
              className="text-right"
              dir="rtl"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role" className="text-right block">תפקיד *</Label>
              {currentUser?.role === 'company_ceo' ? (
                <Select
                  value={userForm.role}
                  onValueChange={(value) => handleUserFormChange('role', value)}
                  dir="rtl"
                >
                  <SelectTrigger className="text-right" dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_ceo">מנכ"ל החברה</SelectItem>
                    <SelectItem value="clinic_manager">מנהל מרפאה</SelectItem>
                    <SelectItem value="clinic_worker">עובד מרפאה</SelectItem>
                    <SelectItem value="clinic_viewer">צופה מרפאה</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="px-3 py-2 bg-muted rounded-md text-right">
                  {userForm.role === 'company_ceo' ? 'מנכ"ל החברה' : 
                   userForm.role === 'clinic_manager' ? 'מנהל מרפאה' : 
                   userForm.role === 'clinic_worker' ? 'עובד מרפאה' : 'צופה מרפאה'}
                  <span className="text-xs text-muted-foreground mr-2">(לא ניתן לשינוי)</span>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-right block">טלפון</Label>
              <Input
                id="phone"
                value={userForm.phone}
                onChange={(e) => handleUserFormChange('phone', e.target.value)}
                placeholder="050-1234567"
                className="text-right"
                dir="rtl"
              />
            </div>
          </div>

          {clinics.length > 0 && userForm.role !== 'company_ceo' && (
            <div className="space-y-2">
              <Label htmlFor="clinic" className="text-right block">מרפאה</Label>
              <Select
                value={userForm.clinic_id}
                onValueChange={(value) => handleUserFormChange('clinic_id', value)}
                dir="rtl"
              >
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="בחר מרפאה (אופציונלי)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">גלובלי</SelectItem>
                  {clinics.map((clinic) => (
                    <SelectItem key={clinic.id} value={clinic.id.toString()}>
                      {clinic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="hasPassword" className="font-medium">הגדר סיסמה</Label>
            <div className="flex items-center justify-between rounded-lg">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">אם לא תוגדר סיסמה, המשתמש יוכל להתחבר ללא סיסמה</p>
              </div>
              <Switch
                dir="ltr"
                className=""
                id="hasPassword"
                checked={userForm.hasPassword}
                onCheckedChange={(checked) => handleUserFormChange('hasPassword', checked)}
              />
            </div>
          </div>
          
          {userForm.hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-right block">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={userForm.password}
                onChange={(e) => handleUserFormChange('password', e.target.value)}
                placeholder="הזן סיסמה"
                className="text-right"
                dir="rtl"
              />
            </div>
          )}
        </div>
        
        <div className="flex justify-start gap-2 pt-4">
          <Button onClick={handleUserSave}>
            {editingUser ? 'עדכן משתמש' : 'צור משתמש'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </div>
    </CustomModal>
  )
} 