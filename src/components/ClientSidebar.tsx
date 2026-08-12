import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useClientSidebar } from '@/contexts/ClientSidebarContext'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { X, User, Phone, Mail, IdCard, Calendar, MapPin, Building2, PanelLeftIcon, FileText, Brain, Loader2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import { useLocation, useSearch } from '@tanstack/react-router'
import { apiClient } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from 'react-i18next'
import { getActiveLocale, getDirection, normalizeLocale } from '@/localization/locale'

const CLIENT_SIDEBAR_WIDTH_KEY = 'client-sidebar-width'
const DEFAULT_CLIENT_SIDEBAR_WIDTH = 320
const MIN_CLIENT_SIDEBAR_WIDTH = 280
const MAX_CLIENT_SIDEBAR_WIDTH = 560

function clampClientSidebarWidth(width: number): number {
  const viewportMaximum =
    typeof window === 'undefined'
      ? MAX_CLIENT_SIDEBAR_WIDTH
      : Math.max(MIN_CLIENT_SIDEBAR_WIDTH, window.innerWidth - 360)

  return Math.round(
    Math.min(Math.max(width, MIN_CLIENT_SIDEBAR_WIDTH), Math.min(MAX_CLIENT_SIDEBAR_WIDTH, viewportMaximum)),
  )
}

function getStoredClientSidebarWidth(): number {
  try {
    const storedWidth = Number(localStorage.getItem(CLIENT_SIDEBAR_WIDTH_KEY))
    return Number.isFinite(storedWidth) && storedWidth > 0
      ? clampClientSidebarWidth(storedWidth)
      : DEFAULT_CLIENT_SIDEBAR_WIDTH
  } catch {
    return DEFAULT_CLIENT_SIDEBAR_WIDTH
  }
}

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
  const clientPathname = pathname.replace(/^\/(?:he|en|fr)(?=\/|$)/, '')
  if (!clientPathname.includes('/clients/')) return null
  
  // Check if we're on a specific detail page (e.g., /clients/1/exams/2)
  if (clientPathname.includes('/exams/')) return 'exam'
  if (clientPathname.includes('/orders/')) return 'order'
  if (clientPathname.includes('/referrals/')) return 'referral'
  if (clientPathname.includes('/appointments/')) return 'appointment'
  if (clientPathname.includes('/files/')) return 'file'
  if (clientPathname.includes('/medical/')) return 'medical'
  
  // Check if we're on the main ClientDetailPage with a specific tab
  const clientDetailPageMatch = clientPathname.match(/^\/clients\/\d+$/)
  if (clientDetailPageMatch) {
    // Use the context active tab first (most reliable)
    if (contextActiveTab) {
      const tabToPart: { [key: string]: string } = {
        'exams': 'exam',
        'orders': 'order',
        'referrals': 'referral',
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
        'appointments': 'appointment',
        'files': 'file',
        'medical': 'medical'
      }
      
      if (tabToPart[searchParams.tab]) {
        return tabToPart[searchParams.tab]
      }
    }
    
    // Fallback to localStorage
    const clientId = clientPathname.split('/').pop()
    if (clientId) {
      const activeTab = localStorage.getItem(`client-${clientId}-last-tab`)
      if (activeTab) {
        const tabToPart: { [key: string]: string } = {
          'exams': 'exam',
          'orders': 'order',
          'referrals': 'referral',
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

const AI_PART_KEYS = ['exam', 'order', 'referral', 'appointment', 'file', 'medical'] as const

function extractAiPartCache(client: any): Record<string, string | null> {
  return AI_PART_KEYS.reduce<Record<string, string | null>>((cache, part) => {
    cache[part] = client?.[`ai_${part}_state`] || null
    return cache
  }, {})
}

export function mergeAiPartCache(
  previous: Record<string, string | null>,
  updates: Record<string, string | null>,
) {
  let changed = false
  const next = { ...previous }

  for (const [part, value] of Object.entries(updates)) {
    if (previous[part] !== value) {
      next[part] = value
      changed = true
    }
  }

  return changed ? next : previous
}

function AIInformationSection({
  currentPart,
  aiInfo,
  isGenerating,
  isLoading,
  hasLoaded,
  isAiBlockOpen,
  onToggleAiBlock
}: {
  currentPart: string | null
  aiInfo: string | null
  isGenerating: boolean
  isLoading: boolean
  hasLoaded: boolean
  isAiBlockOpen: boolean
  onToggleAiBlock: () => void
}) {
  if (!currentPart) return null
  
  const partNames = {
    exam: 'בדיקות',
    order: 'הזמנות',
    referral: 'הפניות',
    appointment: 'תורים',
    file: 'מסמכים',
    medical: 'רפואי'
  }
  
  const partName = partNames[currentPart as keyof typeof partNames] || 'כללי'
  
  return (
    <>
      <Separator />
      <div className="space-y-3 select-none">
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
          onClick={onToggleAiBlock}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Brain className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm text-muted-foreground flex-1">מידע AI - {partName}</h4>
          {isAiBlockOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        
        {isAiBlockOpen && (
          <>
            <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
              {(!hasLoaded) || (!aiInfo && (isGenerating || isLoading)) ? (
                <div className="space-y-2" dir="rtl">
                  <div className="flex items-center gap-1 mb-2">
                    <Skeleton className="h-3 w-3 rounded-full bg-blue-100" />
                    <Skeleton className="h-3 w-24 bg-blue-100" />
                  </div>
                  <Skeleton className="h-3 w-5/6 bg-blue-100" />
                  <Skeleton className="h-3 w-4/6 bg-blue-100" />
                  <Skeleton className="h-3 w-3/6 bg-blue-100" />
                </div>
              ) : aiInfo ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 mb-2">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-xs text-primary font-medium">המלצות AI</span>
                  </div>
                  <div className="break-words whitespace-pre-line text-sm leading-relaxed [overflow-wrap:anywhere]">
                    {aiInfo}
                  </div>
                </div>
              ) : (
                <div className="space-y-2" dir="rtl">
                  <div className="flex items-center gap-1 mb-2">
                    <Skeleton className="h-3 w-3 rounded-full bg-blue-100" />
                    <Skeleton className="h-3 w-24 bg-blue-100" />
                  </div>
                  <Skeleton className="h-3 w-5/6 bg-blue-100" />
                  <Skeleton className="h-3 w-4/6 bg-blue-100" />
                  <Skeleton className="h-3 w-3/6 bg-blue-100" />
                </div>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground px-2">
              המידע מבוסס AI ואינו תחליף לשיקול מקצועי.
            </p>
          </>
        )}
      </div>
    </>
  )
}

export function ClientSidebar() {
  const { isOpen, closeSidebar, currentClient, isClientSpacePage, activeTab: contextActiveTab } = useClientSidebar()
  const { i18n, t } = useTranslation()
  const locale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language) ?? getActiveLocale()
  const direction = getDirection(locale)
  const location = useLocation()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [aiInfo, setAiInfo] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [aiPartCache, setAiPartCache] = useState<Record<string, string | null>>({})
  const requestSeqRef = useRef(0)
  const [mounted, setMounted] = useState(false)
  const [hasAiLoadedOnce, setHasAiLoadedOnce] = useState(false)
  const [currentPart, setCurrentPart] = useState<string | null>(null)
  const [lastClientUpdateDate, setLastClientUpdateDate] = useState<string | null>(null)
  const [isAiBlockOpen, setIsAiBlockOpen] = useState<boolean>(() => {
    // Load initial state from localStorage, default to true (open)
    const saved = localStorage.getItem('client-sidebar-ai-block-open')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [sidebarWidth, setSidebarWidth] = useState(getStoredClientSidebarWidth)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarWidthRef = useRef(sidebarWidth)
  const updateAiPartCache = useCallback((updates: Record<string, string | null>) => {
    setAiPartCache(previous => mergeAiPartCache(previous, updates))
  }, [])

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  const updateSidebarWidth = useCallback((width: number) => {
    setSidebarWidth((previous) => {
      const next = clampClientSidebarWidth(width)
      sidebarWidthRef.current = next
      return previous === next ? previous : next
    })
  }, [])

  const handleResizePointerMove = useCallback((event: PointerEvent) => {
    const sidebar = sidebarRef.current
    if (!sidebar) return

    const bounds = sidebar.getBoundingClientRect()
    const width = direction === 'rtl'
      ? event.clientX - bounds.left
      : bounds.right - event.clientX
    updateSidebarWidth(width)
  }, [direction, updateSidebarWidth])

  const finishResize = useCallback(() => {
    setIsResizing(false)
    try {
      localStorage.setItem(CLIENT_SIDEBAR_WIDTH_KEY, String(sidebarWidthRef.current))
    } catch {
      // Storage can be unavailable in private or restricted environments.
    }
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handleResizePointerMove)
    window.addEventListener('pointerup', finishResize)
    window.addEventListener('pointercancel', finishResize)

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handleResizePointerMove)
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
    }
  }, [finishResize, handleResizePointerMove, isResizing])

  useEffect(() => {
    const constrainSidebarWidth = () => updateSidebarWidth(sidebarWidthRef.current)
    window.addEventListener('resize', constrainSidebarWidth)
    return () => window.removeEventListener('resize', constrainSidebarWidth)
  }, [updateSidebarWidth])

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsResizing(true)
  }

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 16
    const increasesWidth =
      (direction === 'rtl' && event.key === 'ArrowRight') ||
      (direction === 'ltr' && event.key === 'ArrowLeft')
    const decreasesWidth =
      (direction === 'rtl' && event.key === 'ArrowLeft') ||
      (direction === 'ltr' && event.key === 'ArrowRight')

    if (increasesWidth || decreasesWidth) {
      event.preventDefault()
      const nextWidth = sidebarWidthRef.current + (increasesWidth ? step : -step)
      updateSidebarWidth(nextWidth)
      try {
        localStorage.setItem(CLIENT_SIDEBAR_WIDTH_KEY, String(clampClientSidebarWidth(nextWidth)))
      } catch {
        // Storage can be unavailable in private or restricted environments.
      }
    }
  }
  
  // Get search params, but handle potential errors
  let searchParams: any = null
  try {
    searchParams = useSearch({ strict: false })
  } catch (error) {
    // If we can't get search params, we'll use pathname only
    searchParams = null
  }
  
  useEffect(() => {
    const part = detectCurrentPart(location.pathname, searchParams, contextActiveTab)
    setCurrentPart(part)
  }, [location.pathname, searchParams, contextActiveTab])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    requestSeqRef.current += 1
    setAiPartCache(previous => Object.keys(previous).length === 0 ? previous : {})
    setAiInfo(null)
    setIsGenerating(false)
    setIsLoading(false)
    setHasAiLoadedOnce(false)
    setLastClientUpdateDate(null)
  }, [currentClient?.id])

  // Handle AI block toggle
  const handleToggleAiBlock = useCallback(() => {
    const newState = !isAiBlockOpen
    setIsAiBlockOpen(newState)
    // Save state to localStorage
    localStorage.setItem('client-sidebar-ai-block-open', JSON.stringify(newState))
  }, [isAiBlockOpen])

  const checkIfAiStatesNeedUpdate = useCallback(async (clientId: number): Promise<boolean> => {
    try {
      const clientResponse = await apiClient.getClientById(clientId);
      const client = clientResponse.data;
      if (!client) return true
      
      const aiUpdatedDate = client.ai_updated_date
      const clientUpdatedDate = client.client_updated_date
      
      if (!aiUpdatedDate || !clientUpdatedDate) return true
      
      return new Date(clientUpdatedDate) > new Date(aiUpdatedDate)
    } catch (error) {
      console.error('Error checking AI states update:', error)
      return true
    }
  }, [])

  const loadAiInfo = useCallback(async (forceRegenerate = false) => {
    if (!currentClient?.id || !currentPart || !isOpen || !isAiBlockOpen) return
    
    try {
      const mySeq = ++requestSeqRef.current
      if (!aiInfo) {
        setIsLoading(true)
      }
      // Get fresh client data to check current state
      const clientResponse = await apiClient.getClientById(currentClient.id);
      if (mySeq !== requestSeqRef.current) return
      const client = clientResponse.data;
      if (!client) return
      
      const aiPartState = client[`ai_${currentPart}_state` as keyof typeof client] as string
      const aiUpdatedDate = client.ai_updated_date
      const clientUpdatedDate = client.client_updated_date
      
      // If we have a part state and not forcing regeneration, check if it's still valid
      if (aiPartState && !forceRegenerate) {
        // Part state is valid if AI was updated after the client data was last updated
        if (aiUpdatedDate && clientUpdatedDate && new Date(aiUpdatedDate) >= new Date(clientUpdatedDate)) {
          if (mySeq !== requestSeqRef.current) return
          setAiInfo(aiPartState)
          updateAiPartCache(extractAiPartCache(client))
          setIsLoading(false)
          setHasAiLoadedOnce(true)
          return
        }
      }
      
      // No valid part state available, outdated, or forced regeneration - automatically generate
      // Clear old content immediately to prevent flickering
      if (mySeq !== requestSeqRef.current) return
      setAiInfo(null)
      setIsGenerating(true)
      
      // Check if AI states need update (only if client data was updated or forced)
      const needsAiUpdate = forceRegenerate || await checkIfAiStatesNeedUpdate(currentClient.id)
      if (mySeq !== requestSeqRef.current) return
      
      if (needsAiUpdate) {
        await apiClient.aiGenerateAllStates(currentClient.id)
        if (mySeq !== requestSeqRef.current) return
      }
      
      // Get the updated part state
      const updatedClientResponse = await apiClient.getClientById(currentClient.id);
      if (mySeq !== requestSeqRef.current) return
      const updatedClient = updatedClientResponse.data;
      if (updatedClient) {
        const partState = updatedClient[`ai_${currentPart}_state` as keyof typeof updatedClient] as string
        if (mySeq !== requestSeqRef.current) return
        const nextCache = extractAiPartCache(updatedClient)
        if (partState) {
          setAiInfo(partState)
        } else {
          setAiInfo(null)
        }
        updateAiPartCache(nextCache)
      }
      
      setIsGenerating(false)
      setIsLoading(false)
      setHasAiLoadedOnce(true)
    } catch (error) {
      console.error('Error loading AI info:', error)
      if (requestSeqRef.current === 0) return
      setIsGenerating(false)
      setIsLoading(false)
    }
  }, [currentClient?.id, currentPart, isOpen, isAiBlockOpen, checkIfAiStatesNeedUpdate, updateAiPartCache])

  // Separate effect for loading AI info - only when sidebar is open, AI block is open, and part or client changes
  useEffect(() => {
    if (currentPart && currentClient?.id && isOpen && isAiBlockOpen) {
      const cached = aiPartCache[currentPart]
      if (typeof cached !== 'undefined') {
        setAiInfo(cached)
        setIsLoading(false)
        setHasAiLoadedOnce(true)
      } else {
        const snapshot = (currentClient as any)[`ai_${currentPart}_state`]
        if (snapshot) {
          setAiInfo(snapshot as string)
          updateAiPartCache(extractAiPartCache(currentClient))
          setIsLoading(false)
          setHasAiLoadedOnce(true)
        }
      }
      // refresh in background without clearing existing content to avoid flicker
      loadAiInfo()
    } else {
      if (!currentClient?.id || !isOpen) {
        setAiInfo(null)
      }
      setIsLoading(false)
    }
  }, [currentPart, currentClient?.id, isOpen, isAiBlockOpen, loadAiInfo, aiPartCache, updateAiPartCache])

  // Polling effect to detect data changes and trigger immediate loading
  useEffect(() => {
    if (!currentClient?.id || !isOpen || !isAiBlockOpen) return

    const pollForDataChanges = async () => {
      try {
        const clientResponse = await apiClient.getClientById(currentClient.id!);
        const client = clientResponse.data;
        if (!client) return

        const currentUpdateDate = client.client_updated_date
        
        // If this is the first time or the update date has changed
        if (currentUpdateDate && currentUpdateDate !== lastClientUpdateDate) {
          setLastClientUpdateDate(currentUpdateDate)
          
          // If we had a previous update date and it changed, trigger AI regeneration
          if (lastClientUpdateDate && currentPart) {
            console.log('Data change detected, triggering AI regeneration')
            loadAiInfo(true) // Force regeneration
          }
        }
      } catch (error) {
        console.error('Error polling for data changes:', error)
      }
    }

    // Initial check
    pollForDataChanges()

    // Set up polling every 2 seconds when sidebar is open
    const interval = setInterval(pollForDataChanges, 1500)

    return () => clearInterval(interval)
  }, [currentClient?.id, isOpen, isAiBlockOpen, lastClientUpdateDate, currentPart, loadAiInfo])

  if (!isClientSpacePage) {
    return <div className="w-0 overflow-hidden" />
  }

  const fullName = `${currentClient?.first_name || ''} ${currentClient?.last_name || ''}`.trim()
  const age = calculateAge(currentClient?.date_of_birth as any)
  const initials = `${currentClient?.first_name?.[0] || ''}${currentClient?.last_name?.[0] || ''}`.toUpperCase()
  const isClientLoading = !currentClient?.id

  const reserveSpace = isClientSpacePage && isOpen
  const transitionClass = mounted && !isResizing ? 'transition-[width,margin] duration-300 ease-in-out' : ''

  return (
    <Card
      ref={sidebarRef}
      className={`relative my-5 h-[calc(100%-2.5rem)] min-h-0 shrink-0 overflow-hidden bg-card pt-0 ${reserveSpace ? 'me-6' : 'me-0'} ${transitionClass}`}
      style={{ width: reserveSpace ? `${sidebarWidth}px` : 0 }}
    >
      {reserveSpace && (
        <div
          aria-label={t('clientSidebarResize')}
          aria-orientation="vertical"
          aria-valuemax={MAX_CLIENT_SIDEBAR_WIDTH}
          aria-valuemin={MIN_CLIENT_SIDEBAR_WIDTH}
          aria-valuenow={sidebarWidth}
          className={`absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none focus-visible:bg-primary/20 ${direction === 'rtl' ? 'end-0' : 'start-0'}`}
          onKeyDown={handleResizeKeyDown}
          onPointerDown={handleResizePointerDown}
          role="separator"
          tabIndex={0}
        />
      )}
      <div className="flex h-full min-w-0 flex-col" dir={direction} style={{scrollbarWidth: 'none'}}>
        <div className="absolute top-2 start-2 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={closeSidebar}
            className="h-8 w-8 p-0"
          >
            <PanelLeftIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4" style={{scrollbarWidth: 'none'}}>
          <div className="flex flex-col items-center space-y-3">
            {isClientLoading ? (
              <Skeleton className="h-20 w-20 rounded-full" />
            ) : (
              <Avatar className="h-20 w-20">
                <AvatarImage src={currentClient?.profile_picture} />
                <AvatarFallback className="text-lg font-semibold">
                  {initials || <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
            )}
            
            <div className="flex w-full min-w-0 flex-col items-center px-8 text-center">
              {isClientLoading ? (
                <>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24 mt-2" />
                </>
              ) : (
                <>
                  <h3 className="max-w-full break-words text-xl font-semibold [overflow-wrap:anywhere]">{fullName}</h3>
                  {currentClient?.id && (
                    <p className="text-sm text-muted-foreground">לקוח מס' {currentClient.id}</p>
                  )}
                </>
              )}
            </div>
          </div>

          <AIInformationSection
            currentPart={currentPart}
            aiInfo={aiInfo}
            isGenerating={isGenerating}
            isLoading={isLoading}
            hasLoaded={hasAiLoadedOnce}
            isAiBlockOpen={isAiBlockOpen}
            onToggleAiBlock={handleToggleAiBlock}
          />

          <Separator />

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">מידע אישי</h4>
            
            <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
              <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 p-3">
                <User className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  {isClientLoading ? (
                    <Skeleton className="h-4 w-24 ms-2" />
                  ) : (
                    <p className="break-words text-sm [overflow-wrap:anywhere]">
                      <span className="text-muted-foreground">מגדר: </span>
                      {currentClient?.gender || 'לא צוין'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 p-3">
                <Calendar className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  {isClientLoading ? (
                    <Skeleton className="h-4 w-16 ms-2" />
                  ) : age ? (
                    <p className="break-words text-sm [overflow-wrap:anywhere]">
                      <span className="text-muted-foreground">גיל: </span>
                      {age} שנים
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 p-3">
              <IdCard className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                {isClientLoading ? (
                  <Skeleton className="h-4 w-40 ms-2" />
                ) : currentClient?.national_id ? (
                  <p className="break-words text-sm [overflow-wrap:anywhere]">
                    <span className="text-muted-foreground">תעודת זהות: </span>
                    <span dir="ltr">{currentClient?.national_id}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {(isClientLoading || currentClient?.phone_mobile || currentClient?.phone_home || currentClient?.email || currentClient?.address_street) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">פרטי קשר</h4>
                {isClientLoading ? (
                  <>
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-64" />
                  </>
                ) : (
                <>
                {currentClient?.phone_mobile && (
                  <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 p-3">
                    <Phone className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm [overflow-wrap:anywhere]">
                        <span className="text-muted-foreground">נייד: </span>
                        <span dir="ltr">{currentClient?.phone_mobile}</span>
                      </p>
                    </div>
                  </div>
                )}
                {currentClient?.phone_home && (
                  <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 p-3">
                    <Phone className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm [overflow-wrap:anywhere]">
                        <span className="text-muted-foreground">בית: </span>
                        <span dir="ltr">{currentClient?.phone_home}</span>
                      </p>
                    </div>
                  </div>
                )}
                {currentClient?.email && (
                  <div className="flex min-w-0 items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="break-words text-start text-sm [overflow-wrap:anywhere]" dir="ltr">
                        {currentClient?.email}
                      </p>
                    </div>
                  </div>
                )}
                {currentClient?.address_street && (
                  <div className="flex min-w-0 items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm [overflow-wrap:anywhere]">
                        <span className="text-muted-foreground">כתובת: </span>
                        {currentClient?.address_street}{currentClient?.address_city ? `, ${currentClient?.address_city}` : ''}
                      </p>
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
            </>
          )}



          {isClientLoading ? (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">הערות</h4>
                <Skeleton className="h-16 w-full" />
              </div>
            </>
          ) : currentClient?.notes && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">הערות</h4>
                <div className="flex min-w-0 items-start rounded-lg bg-muted/50 p-3">
                  <p className="min-w-0 break-words whitespace-pre-line text-sm [overflow-wrap:anywhere]">
                        {currentClient?.notes}
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
