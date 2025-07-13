import React from 'react'
import { useClientSidebar } from '@/contexts/ClientSidebarContext'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { X, User, Phone, Mail, IdCard, Calendar, MapPin, Building2, PanelLeftIcon, FileText } from 'lucide-react'

function calculateAge(dateOfBirth: string | undefined): number | null {
  if (!dateOfBirth) return null
  
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
}

export function ClientSidebar() {
  const { isOpen, closeSidebar, currentClient, isClientSpacePage } = useClientSidebar()

  if (!currentClient || !isClientSpacePage) {
    return <div className="w-0 overflow-hidden" />
  }

  const fullName = `${currentClient.first_name || ''} ${currentClient.last_name || ''}`.trim()
  const age = calculateAge(currentClient.date_of_birth)
  const initials = `${currentClient.first_name?.[0] || ''}${currentClient.last_name?.[0] || ''}`.toUpperCase()

  const shouldShow = isClientSpacePage && currentClient
  const displayWidth = shouldShow && isOpen ? 'w-80 ml-6' : 'w-0'
  const transitionClass = shouldShow ? 'transition-all duration-300 ease-in-out' : ''

  return (
    <Card className={`pt-0 my-6 shadow-md bg-card border-none overflow-hidden h-[calc(100vh-8.5rem)] relative ${displayWidth} ${transitionClass}`}>
      <div className="flex flex-col h-full" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="absolute top-2 left-2 z-1000">
          <Button
            variant="ghost"
            size="sm"
            onClick={closeSidebar}
            className="h-8 w-8 p-0"
          >
            <PanelLeftIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0" style={{scrollbarWidth: 'none'}}>
          <div className="flex flex-col items-center space-y-3">
            <Avatar className="h-20 w-20">
              <AvatarImage src={currentClient.profile_picture} />
              <AvatarFallback className="text-lg font-semibold">
                {initials || <User className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            
            <div className="text-center">
              <h3 className="text-xl font-semibold">{fullName}</h3>
              <p className="text-sm text-muted-foreground">לקוח מס' {currentClient.id}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">מידע אישי</h4>
            
            <div className="flex gap-3">
              <div className="flex items-center p-2 rounded-lg bg-muted/50 flex-1">
                <User className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground px-2">מגדר: </span>
                    {currentClient.gender || 'לא צוין'}
                  </p>
                </div>
              </div>

              {age && (
                <div className="flex items-center p-2 rounded-lg bg-muted/50 flex-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="text-muted-foreground px-2">גיל: </span>
                      {age} שנים
                    </p>
                  </div>
                </div>
              )}
            </div>

            {currentClient.national_id && (
              <div className="flex items-center p-2 rounded-lg bg-muted/50">
                <IdCard className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground px-2">תעודת זהות: </span>
                    {currentClient.national_id}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">פרטי קשר</h4>
            
            {currentClient.phone_mobile && (
              <div className="flex items-center p-2 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground px-2">נייד: </span>
                    {currentClient.phone_mobile}
                  </p>
                </div>
              </div>
            )}

            {currentClient.phone_home && (
              <div className="flex items-center p-2 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground px-2">בית: </span>
                    {currentClient.phone_home}
                  </p>
                </div>
              </div>
            )}

            {currentClient.email && (
              <div className="flex items-start p-2 rounded-lg bg-muted/50">
                <Mail className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm break-all pr-2">
                    {currentClient.email}
                  </p>
                </div>
              </div>
            )}

            {currentClient.address_street && (
              <div className="flex items-center p-2 rounded-lg bg-muted/50">
                <MapPin className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground px-2">כתובת: </span>
                    {currentClient.address_street}{currentClient.address_city ? `, ${currentClient.address_city}` : ''}
                  </p>
                </div>
              </div>
            )}
          </div>



          {currentClient.notes && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">הערות</h4>
                <div className="flex items-center p-2 rounded-lg bg-muted/50">
                                          <p className="text-sm whitespace-pre-line">
                        {currentClient.notes}
                      </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
} 