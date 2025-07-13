import React, { useState, useEffect, useCallback } from 'react'
import { useClientSidebar } from '@/contexts/ClientSidebarContext'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { X, User, Phone, Mail, IdCard, Calendar, MapPin, Building2, PanelLeftIcon, FileText, Brain, Loader2, Sparkles } from 'lucide-react'
import { useLocation, useSearch } from '@tanstack/react-router'

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

function detectCurrentPart(pathname: string, searchParams?: any, contextActiveTab?: string | null): string | null {
  if (!pathname.includes('/clients/')) return null
  
  // Check if we're on a specific detail page (e.g., /clients/1/exams/2)
  if (pathname.includes('/exams/')) return 'exam'
  if (pathname.includes('/orders/')) return 'order'
  if (pathname.includes('/referrals/')) return 'referral'
  if (pathname.includes('/contact-lenses/')) return 'contact_lens'
  if (pathname.includes('/appointments/')) return 'appointment'
  if (pathname.includes('/files/')) return 'file'
  if (pathname.includes('/medical/')) return 'medical'
  
  // Check if we're on the main ClientDetailPage with a specific tab
  const clientDetailPageMatch = pathname.match(/^\/clients\/\d+$/)
  if (clientDetailPageMatch) {
    // Use the context active tab first (most reliable)
    if (contextActiveTab) {
      const tabToPart: { [key: string]: string } = {
        'exams': 'exam',
        'orders': 'order',
        'referrals': 'referral',
        'contact-lenses': 'contact_lens',
        'appointments': 'appointment',
        'files': 'file',
        'medical': 'medical'
      }
      
      if (tabToPart[contextActiveTab]) {
        return tabToPart[contextActiveTab]
      }
    }
    
    // Fallback to search params
    if (searchParams?.tab) {
      const tabToPart: { [key: string]: string } = {
        'exams': 'exam',
        'orders': 'order',
        'referrals': 'referral',
        'contact-lenses': 'contact_lens',
        'appointments': 'appointment',
        'files': 'file',
        'medical': 'medical'
      }
      
      if (tabToPart[searchParams.tab]) {
        return tabToPart[searchParams.tab]
      }
    }
    
    // Fallback to localStorage
    const clientId = pathname.split('/').pop()
    if (clientId) {
      const activeTab = localStorage.getItem(`client-${clientId}-last-tab`)
      if (activeTab) {
        const tabToPart: { [key: string]: string } = {
          'exams': 'exam',
          'orders': 'order',
          'referrals': 'referral',
          'contact-lenses': 'contact_lens',
          'appointments': 'appointment',
          'files': 'file',
          'medical': 'medical'
        }
        
        if (tabToPart[activeTab]) {
          return tabToPart[activeTab]
        }
      }
    }
    
    // Default to details if no tab is found
    return null
  }
  
  return null
}

function AIInformationSection({ 
  clientId, 
  currentPart, 
  aiInfo, 
  isGenerating,
  onGenerate 
}: { 
  clientId: number
  currentPart: string | null
  aiInfo: string | null
  isGenerating: boolean
  onGenerate: (forceRegenerate?: boolean) => void
}) {
  if (!currentPart) return null
  
  const partNames = {
    exam: 'בדיקות',
    order: 'הזמנות',
    referral: 'הפניות',
    contact_lens: 'עדשות מגע',
    appointment: 'תורים',
    file: 'קבצים',
    medical: 'רפואי'
  }
  
  const partName = partNames[currentPart as keyof typeof partNames] || 'כללי'
  
  return (
    <>
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm text-muted-foreground">מידע AI - {partName}</h4>
        </div>
        
        <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
          {isGenerating ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-primary">יוצר מידע AI...</span>
            </div>
          ) : aiInfo ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1 mb-2">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-xs text-primary font-medium">המלצות AI</span>
              </div>
              <div className="text-sm whitespace-pre-line leading-relaxed">
                {aiInfo}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onGenerate(true)}
                className="w-full mt-2 h-8 text-xs"
              >
                רענן מידע
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                אין מידע AI זמין עבור {partName}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onGenerate(false)}
                className="h-8 text-xs"
              >
                צור מידע AI
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export function ClientSidebar() {
  const { isOpen, closeSidebar, currentClient, isClientSpacePage, activeTab: contextActiveTab } = useClientSidebar()
  const location = useLocation()
  const [aiInfo, setAiInfo] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentPart, setCurrentPart] = useState<string | null>(null)
  
  // Get search params, but handle potential errors
  let searchParams = null
  try {
    searchParams = useSearch({ strict: false })
  } catch (error) {
    // If we can't get search params, we'll use pathname only
    searchParams = null
  }
  
  useEffect(() => {
    const part = detectCurrentPart(location.pathname, searchParams, contextActiveTab)
    console.log('Detected part:', part, 'for pathname:', location.pathname, 'searchParams:', searchParams, 'contextActiveTab:', contextActiveTab)
    setCurrentPart(part)
  }, [location.pathname, searchParams, contextActiveTab])

  const loadAiInfo = useCallback(async () => {
    if (!currentClient?.id || !currentPart) return
    
    try {
      // Get fresh client data to check current state
      const client = await window.electronAPI.db('getClientById', currentClient.id)
      if (!client) return
      
      const aiPartState = client[`ai_${currentPart}_state` as keyof typeof client] as string
      const aiMainUpdatedDate = client.ai_updated_date
      const partUpdatedDate = client[`${currentPart}_updated_date` as keyof typeof client] as string
      
      // If we have a part state, check if it's still valid
      if (aiPartState) {
        // Part state is valid if:
        // 1. Main AI state exists and was updated
        // 2. Part hasn't been updated since the main AI state was updated
        if (aiMainUpdatedDate && (!partUpdatedDate || new Date(aiMainUpdatedDate) >= new Date(partUpdatedDate))) {
          setAiInfo(aiPartState)
          return
        }
      }
      
      // No valid part state available
      setAiInfo(null)
    } catch (error) {
      console.error('Error loading AI info:', error)
      setAiInfo(null)
    }
  }, [currentClient?.id, currentPart])

  // Separate effect for loading AI info - only when part or client changes
  useEffect(() => {
    if (currentPart && currentClient?.id) {
      loadAiInfo()
    } else {
      setAiInfo(null)
    }
  }, [currentPart, currentClient?.id, loadAiInfo])

  const generateAiInfo = async (forceRegenerate: boolean = false) => {
    if (!currentClient?.id || !currentPart) return
    
    setIsGenerating(true)
    try {
      // Get fresh client data to check current state
      const client = await window.electronAPI.db('getClientById', currentClient.id)
      if (!client) return
      
      if (!forceRegenerate) {
        // Check if we already have valid part state
        const aiPartState = client[`ai_${currentPart}_state` as keyof typeof client] as string
        const aiMainUpdatedDate = client.ai_updated_date
        const partUpdatedDate = client[`${currentPart}_updated_date` as keyof typeof client] as string
        
        if (aiPartState && aiMainUpdatedDate && (!partUpdatedDate || new Date(aiMainUpdatedDate) >= new Date(partUpdatedDate))) {
          setAiInfo(aiPartState)
          return
        }
      }
      
      // Initialize AI agent if not already initialized
      const initResult = await window.electronAPI.aiInitialize()
      if (!initResult.success) {
        console.error('Failed to initialize AI agent:', initResult.error)
        return
      }
      
      // Check if main state needs update (only if client data was updated)
      const needsMainStateUpdate = await checkIfMainStateNeedsUpdate(currentClient.id)
      
      if (needsMainStateUpdate) {
        await window.electronAPI.aiGenerateMainState(currentClient.id)
      }
      
      // Generate part state
      const partState = await window.electronAPI.aiGeneratePartState(currentClient.id, currentPart)
      if (partState) {
        setAiInfo(partState)
      }
    } catch (error) {
      console.error('Error generating AI info:', error)
    } finally {
      setIsGenerating(false)
    }
  }
  
  const checkIfMainStateNeedsUpdate = async (clientId: number): Promise<boolean> => {
    try {
      const client = await window.electronAPI.db('getClientById', clientId)
      if (!client) return true
      
      const aiUpdatedDate = client.ai_updated_date
      const clientUpdatedDate = client.client_updated_date
      
      if (!aiUpdatedDate || !clientUpdatedDate) return true
      
      return new Date(clientUpdatedDate) > new Date(aiUpdatedDate)
    } catch (error) {
      console.error('Error checking main state update:', error)
      return true
    }
  }

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

          <AIInformationSection
            clientId={currentClient.id!}
            currentPart={currentPart}
            aiInfo={aiInfo}
            isGenerating={isGenerating}
            onGenerate={generateAiInfo}
          />

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