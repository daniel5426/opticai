import React from 'react'
import { Button } from '@/components/ui/button'
import { CustomModal } from '@/components/ui/custom-modal'
import { Client } from '@/lib/db/schema'

interface ClientWarningModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  warningType: 'name' | 'phone' | 'email' | 'multiple'
  onUseExistingClient: (client: Client) => void
  onCreateNewAnyway: () => void
}

export function ClientWarningModal({
  isOpen,
  onClose,
  clients,
  warningType,
  onUseExistingClient,
  onCreateNewAnyway
}: ClientWarningModalProps) {
  const getWarningMessage = () => {
    switch (warningType) {
      case 'name':
        return 'נמצא לקוח עם שם דומה'
      case 'phone':
        return 'נמצא לקוח עם מספר טלפון זהה'
      case 'email':
        return 'נמצא לקוח עם כתובת אימייל זהה'
      case 'multiple':
        return 'נמצא לקוח עם פרטים דומים (שם, טלפון או אימייל)'
      default:
        return 'נמצא לקוח עם פרטים דומים'
    }
  }

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="לקוח קיים נמצא"
      className="sm:max-w-[500px]"
    >
      <div className="space-y-4" dir="rtl">
        <div className="text-orange-800 dark:text-orange-200 font-medium text-sm">
          {getWarningMessage()}
        </div>
        
        <div className="space-y-2">
          {clients.map((client) => (
            <div key={client.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded border text-sm">
              <div className="text-right">
                <div className="font-medium">{client.first_name} {client.last_name}</div>
                <div className="text-muted-foreground text-xs">
                  {client.phone_mobile && <div>טלפון: {client.phone_mobile}</div>}
                  {client.email && <div>אימייל: {client.email}</div>}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUseExistingClient(client)}
                  className="text-xs"
                >
                  השתמש בלקוח זה
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            ביטול
          </Button>
          <Button
            onClick={onCreateNewAnyway}
            className="flex-1"
          >
            צור לקוח חדש בכל זאת
          </Button>
        </div>
      </div>
    </CustomModal>
  )
} 