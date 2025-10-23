import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, X, User, Eye, ShoppingCart, FileText, Users, Calendar, Mail, Phone, MapPin, Hash } from 'lucide-react'
import { Client, OpticalExam, MedicalLog, Family, Referral, Appointment, Campaign, Clinic } from '@/lib/db/schema-interface'
import { useUser } from '@/contexts/UserContext'
import { apiClient } from '@/lib/api-client'

interface SearchResult {
  id: string
  type: 'client' | 'exam' | 'medical-log' | 'family' | 'referral' | 'appointment' | 'campaign'
  title: string
  subtitle?: string
  description?: string
  data: any
  matchedFields: string[]
}

interface GlobalSearchProps {
  onClose?: () => void
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  // Safely get user context with error handling
  let currentClinic: Clinic | null = null;
  try {
    const userContext = useUser();
    currentClinic = userContext.currentClinic;
  } catch (error) {
    // UserContext not ready yet, return early
    return null;
  }
  
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 50
  const [allData, setAllData] = useState<{
    clients: Client[]
    exams: OpticalExam[]
    medicalLogs: MedicalLog[]
    families: Family[]
    referrals: Referral[]
    appointments: Appointment[]
    campaigns: Campaign[]
  }>({
    clients: [],
    exams: [],
    medicalLogs: [],
    families: [],
    referrals: [],
    appointments: [],
    campaigns: []
  })
  
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadedClinicIdRef = useRef<number | null>(null)
  const isLoadingAllRef = useRef(false)

  // Debounce query input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      setPage(1)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const run = async () => {
      if (!isOpen) return
      if (!currentClinic?.id) return
      const q = debouncedQuery.trim()
      if (q.length < 2) {
        setResults([])
        setTotal(0)
        return
      }
      setLoading(true)
      try {
        const offset = (page - 1) * pageSize
        const res = await apiClient.unifiedSearch(q, currentClinic.id, { limit: pageSize, offset })
        const data = res.data
        if (data) {
          const mapped: SearchResult[] = data.items.map((it) => ({
            id: `${it.type}-${it.id}`,
            type: it.type as SearchResult['type'],
            title: it.title,
            subtitle: it.subtitle,
            description: it.description,
            data: it,
            matchedFields: []
          }))
          setResults(mapped)
          setTotal(data.total)
        }
      } catch (e) {
        console.error('Unified search error:', e)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [isOpen, currentClinic?.id, debouncedQuery, page])

  const normalizeDate = (dateStr: string): string => {
    return dateStr.replace(/[.-]/g, '-')
  }

  const normalizeSearchDate = (searchTerm: string): { primary: string; alternate: string } => {
    const normalized = searchTerm.replace(/[.-]/g, '-')

    // Handle incomplete partial dates (e.g., "06-")
    if (normalized.endsWith('-')) {
      const numberPart = normalized.slice(0, -1)
      return { primary: numberPart, alternate: '' }
    }

    // Year-first full date: YYYY-MM-DD or YYYY-M-D
    const yearFirstPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    const yearFirstMatch = normalized.match(yearFirstPattern)
    if (yearFirstMatch) {
      const [, year, month, day] = yearFirstMatch
      const primary = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      return { primary, alternate: '' }
    }

    // Day/Month-first full date with year: DD-MM-YYYY or MM-DD-YYYY
    const dayMonthYearPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/
    const dayMonthYearMatch = normalized.match(dayMonthYearPattern)
    if (dayMonthYearMatch) {
      const [, first, second, year] = dayMonthYearMatch
      const firstNum = parseInt(first)
      const secondNum = parseInt(second)

      let month, day
      if (firstNum > 12 && secondNum <= 12) {
        // DD-MM-YYYY
        day = first.padStart(2, '0')
        month = second.padStart(2, '0')
      } else if (firstNum <= 12 && secondNum > 12) {
        // MM-DD-YYYY
        month = first.padStart(2, '0')
        day = second.padStart(2, '0')
      } else {
        // Ambiguous, assume DD-MM-YYYY
        day = first.padStart(2, '0')
        month = second.padStart(2, '0')
      }
      const primary = `${year}-${month}-${day}`
      return { primary, alternate: '' }
    }

    // Partial date: DD-MM or MM-DD
    const partialPattern = /^(\d{1,2})-(\d{1,2})$/
    const partialMatch = normalized.match(partialPattern)
    if (partialMatch) {
      const [, first, second] = partialMatch
      const firstNum = parseInt(first)
      const secondNum = parseInt(second)

      let primary, alternate = ''
      if (firstNum > 12 && secondNum <= 12) {
        // Clearly DD-MM -> normalize to MM-DD
        primary = `${second.padStart(2, '0')}-${first.padStart(2, '0')}`
      } else if (firstNum <= 12 && secondNum > 12) {
        // Clearly MM-DD -> normalize to MM-DD
        primary = `${first.padStart(2, '0')}-${second.padStart(2, '0')}`
      } else {
        // Ambiguous (both <=12), assume DD-MM normalized to MM-DD
        primary = `${second.padStart(2, '0')}-${first.padStart(2, '0')}`
        alternate = `${first.padStart(2, '0')}-${second.padStart(2, '0')}`
      }
      return { primary, alternate }
    }

    // No match, return as is
    return { primary: normalized, alternate: '' }
  }

  const searchClients = (searchTerm: string): SearchResult[] => {
    return allData.clients.filter(client => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      const normalizedQuery = normalizeDate(searchTerm)
      const searchDateQuery = normalizeSearchDate(searchTerm)
      
      if (client.first_name?.toLowerCase().includes(lowerQuery)) matchedFields.push('שם פרטי')
      if (client.last_name?.toLowerCase().includes(lowerQuery)) matchedFields.push('שם משפחה')
      if (client.national_id?.includes(searchTerm)) matchedFields.push('ת.ז.')
      if (client.phone_mobile?.includes(searchTerm)) matchedFields.push('טלפון נייד')
      if (client.phone_home?.includes(searchTerm)) matchedFields.push('טלפון בית')
      if (client.address_city?.toLowerCase().includes(lowerQuery)) matchedFields.push('עיר')
      if (client.address_street?.toLowerCase().includes(lowerQuery)) matchedFields.push('רחוב')
      if (client.date_of_birth) {
        const storedNormalized = normalizeDate(client.date_of_birth)
        const { primary, alternate } = normalizeSearchDate(searchTerm)
        if (storedNormalized.includes(primary) || (alternate && storedNormalized.includes(alternate))) {
          matchedFields.push('תאריך לידה')
        }
      }
      if (client.email?.toLowerCase().includes(lowerQuery)) matchedFields.push('אימייל')
      if (client.postal_code?.includes(searchTerm)) matchedFields.push('מיקוד')
      
      return matchedFields.length > 0
    }).map(client => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      const normalizedQuery = normalizeDate(searchTerm)
      const searchDateQuery = normalizeSearchDate(searchTerm)
      
      if (client.first_name?.toLowerCase().includes(lowerQuery)) matchedFields.push('שם פרטי')
      if (client.last_name?.toLowerCase().includes(lowerQuery)) matchedFields.push('שם משפחה')
      if (client.national_id?.includes(searchTerm)) matchedFields.push('ת.ז.')
      if (client.phone_mobile?.includes(searchTerm)) matchedFields.push('טלפון נייד')
      if (client.phone_home?.includes(searchTerm)) matchedFields.push('טלפון בית')
      if (client.address_city?.toLowerCase().includes(lowerQuery)) matchedFields.push('עיר')
      if (client.address_street?.toLowerCase().includes(lowerQuery)) matchedFields.push('רחוב')
      if (client.date_of_birth) {
        const storedNormalized = normalizeDate(client.date_of_birth)
        const { primary, alternate } = normalizeSearchDate(searchTerm)
        if (storedNormalized.includes(primary) || (alternate && storedNormalized.includes(alternate))) {
          matchedFields.push('תאריך לידה')
        }
      }
      if (client.email?.toLowerCase().includes(lowerQuery)) matchedFields.push('אימייל')
      if (client.postal_code?.includes(searchTerm)) matchedFields.push('מיקוד')
      
      return {
        id: `client-${client.id}`,
        type: 'client' as const,
        title: `${client.first_name} ${client.last_name}`.trim(),
        subtitle: client.national_id || client.phone_mobile,
        description: `${client.address_city || ''} ${client.address_street || ''}`.trim(),
        data: client,
        matchedFields: matchedFields
      }
    })
  }

  const searchExams = (searchTerm: string): SearchResult[] => {
    return allData.exams.filter(exam => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      const normalizedQuery = normalizeDate(searchTerm)
      const searchDateQuery = normalizeSearchDate(searchTerm)
      
      if (exam.exam_date) {
        const storedNormalized = normalizeDate(exam.exam_date)
        const { primary, alternate } = normalizeSearchDate(searchTerm)
        if (storedNormalized.includes(primary) || (alternate && storedNormalized.includes(alternate))) {
          matchedFields.push('תאריך בדיקה')
        }
      }
      
      return matchedFields.length > 0
    }).map(exam => {
      const client = allData.clients.find(c => c.id === exam.client_id)
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      const normalizedQuery = normalizeDate(searchTerm)
      const searchDateQuery = normalizeSearchDate(searchTerm)
      
      if (exam.exam_date) {
        const storedNormalized = normalizeDate(exam.exam_date)
        const { primary, alternate } = normalizeSearchDate(searchTerm)
        if (storedNormalized.includes(primary) || (alternate && storedNormalized.includes(alternate))) {
          matchedFields.push('תאריך בדיקה')
        }
      }
      
      return {
        id: `exam-${exam.id}`,
        type: 'exam' as const,
        title: exam.test_name || 'בדיקה',
        subtitle: client ? `${client.first_name} ${client.last_name}` : 'לקוח לא נמצא',
        description: exam.exam_date,
        data: exam,
        matchedFields: matchedFields
      }
    })
  }

  const searchMedicalLogs = (searchTerm: string): SearchResult[] => {
    return allData.medicalLogs.filter(log => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      
      if (log.log?.toLowerCase().includes(lowerQuery)) matchedFields.push('רישום רפואי')
      
      return matchedFields.length > 0
    }).map(log => {
      const client = allData.clients.find(c => c.id === log.client_id)
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      
      if (log.log?.toLowerCase().includes(lowerQuery)) matchedFields.push('רישום רפואי')
      
      return {
        id: `medical-log-${log.id}`,
        type: 'medical-log' as const,
        title: 'רישום רפואי',
        subtitle: client ? `${client.first_name} ${client.last_name}` : 'לקוח לא נמצא',
        description: log.log?.substring(0, 100) + (log.log && log.log.length > 100 ? '...' : ''),
        data: log,
        matchedFields: matchedFields
      }
    })
  }

  const searchFamilies = (searchTerm: string): SearchResult[] => {
    return allData.families.filter(family => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      
      if (family.name?.toLowerCase().includes(lowerQuery)) matchedFields.push('שם משפחה')
      
      return matchedFields.length > 0
    }).map(family => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      
      if (family.name?.toLowerCase().includes(lowerQuery)) matchedFields.push('שם משפחה')
      
      return {
        id: `family-${family.id}`,
        type: 'family' as const,
        title: family.name,
        subtitle: 'משפחה',
        description: family.notes,
        data: family,
        matchedFields: matchedFields
      }
    })
  }

  const searchReferrals = (searchTerm: string): SearchResult[] => {
    return allData.referrals.filter(referral => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      
      if (referral.referral_notes?.toLowerCase().includes(lowerQuery)) matchedFields.push('הערות הפניה')
      if (referral.prescription_notes?.toLowerCase().includes(lowerQuery)) matchedFields.push('הערות מרשם')
      
      return matchedFields.length > 0
    }).map(referral => {
      const client = allData.clients.find(c => c.id === referral.client_id)
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      
      if (referral.referral_notes?.toLowerCase().includes(lowerQuery)) matchedFields.push('הערות הפניה')
      if (referral.prescription_notes?.toLowerCase().includes(lowerQuery)) matchedFields.push('הערות מרשם')
      
      return {
        id: `referral-${referral.id}`,
        type: 'referral' as const,
        title: 'הפניה',
        subtitle: client ? `${client.first_name} ${client.last_name}` : 'לקוח לא נמצא',
        description: referral.referral_notes?.substring(0, 100) + (referral.referral_notes && referral.referral_notes.length > 100 ? '...' : ''),
        data: referral,
        matchedFields: matchedFields
      }
    })
  }

  const searchAppointments = (searchTerm: string): SearchResult[] => {
    return allData.appointments.filter(appointment => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      const normalizedQuery = normalizeDate(searchTerm)
      const searchDateQuery = normalizeSearchDate(searchTerm)
      
      if (appointment.date) {
        const storedNormalized = normalizeDate(appointment.date)
        const { primary, alternate } = normalizeSearchDate(searchTerm)
        if (storedNormalized.includes(primary) || (alternate && storedNormalized.includes(alternate))) {
          matchedFields.push('תאריך')
        }
      }
      if (appointment.note?.toLowerCase().includes(lowerQuery)) matchedFields.push('הערות')
      
      return matchedFields.length > 0
    }).map(appointment => {
      const client = allData.clients.find(c => c.id === appointment.client_id)
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      const normalizedQuery = normalizeDate(searchTerm)
      const searchDateQuery = normalizeSearchDate(searchTerm)
      
      if (appointment.date) {
        const storedNormalized = normalizeDate(appointment.date)
        const { primary, alternate } = normalizeSearchDate(searchTerm)
        if (storedNormalized.includes(primary) || (alternate && storedNormalized.includes(alternate))) {
          matchedFields.push('תאריך')
        }
      }
      if (appointment.note?.toLowerCase().includes(lowerQuery)) matchedFields.push('הערות')
      
      return {
        id: `appointment-${appointment.id}`,
        type: 'appointment' as const,
        title: appointment.exam_name || 'תור',
        subtitle: client ? `${client.first_name} ${client.last_name}` : 'לקוח לא נמצא',
        description: `${appointment.date} ${appointment.time}`,
        data: appointment,
        matchedFields: matchedFields
      }
    })
  }

  const searchCampaigns = (searchTerm: string): SearchResult[] => {
    return allData.campaigns.filter(campaign => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      
      if (campaign.name?.toLowerCase().includes(lowerQuery)) matchedFields.push('שם קמפיין')
      
      return matchedFields.length > 0
    }).map(campaign => {
      const matchedFields: string[] = []
      const lowerQuery = searchTerm.toLowerCase()
      
      if (campaign.name?.toLowerCase().includes(lowerQuery)) matchedFields.push('שם קמפיין')
      
      return {
        id: `campaign-${campaign.id}`,
        type: 'campaign' as const,
        title: campaign.name,
        subtitle: 'קמפיין',
        description: campaign.active ? 'פעיל' : 'לא פעיל',
        data: campaign,
        matchedFields: matchedFields
      }
    })
  }

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    
    try {
      const clientResults = searchClients(searchTerm)
      const examResults = searchExams(searchTerm)
      const medicalLogResults = searchMedicalLogs(searchTerm)
      const familyResults = searchFamilies(searchTerm)
      const referralResults = searchReferrals(searchTerm)
      const appointmentResults = searchAppointments(searchTerm)
      const campaignResults = searchCampaigns(searchTerm)

      const allResults = [
        ...clientResults,
        ...examResults,
        ...medicalLogResults,
        ...familyResults,
        ...referralResults,
        ...appointmentResults,
        ...campaignResults
      ]

      setResults(allResults.slice(0, 50))
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  // No local filtering; results come from backend now

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'client':
        navigate({
          to: '/clients/$clientId',
          params: { clientId: String(result.data.id) },
          search: { tab: 'details' }
        })
        break
      case 'exam':
        navigate({
          to: '/clients/$clientId/exams/$examId',
          params: { clientId: String(result.data.client_id), examId: String(result.data.id) }
        })
        break
      case 'medical-log':
        navigate({
          to: '/clients/$clientId',
          params: { clientId: String(result.data.client_id) },
          search: { tab: 'medical-record' }
        })
        break
      case 'family':
        navigate({ to: '/clients', search: {} })
        break
      case 'referral':
        navigate({
          to: '/clients/$clientId/referrals/$referralId',
          params: { clientId: String(result.data.client_id), referralId: String(result.data.id) }
        })
        break
      case 'appointment':
        navigate({ to: '/appointments', search: {} })
        setTimeout(() => {
          const event = new CustomEvent('openAppointmentModal', { 
            detail: { appointmentId: result.data.id } 
          })
          window.dispatchEvent(event)
        }, 100)
        break
      case 'campaign':
        navigate({ to: '/campaigns', search: {} })
        setTimeout(() => {
          const event = new CustomEvent('openCampaignModal', { 
            detail: { campaignId: result.data.id } 
          })
          window.dispatchEvent(event)
        }, 100)
        break
    }
    
    setIsOpen(false)
    setQuery('')
    onClose?.()
  }

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'client': return <User className="h-5 w-5" />
      case 'exam': return <Eye className="h-5 w-5" />
      case 'medical-log': return <FileText className="h-5 w-5" />
      case 'family': return <Users className="h-5 w-5" />
      case 'referral': return <FileText className="h-5 w-5" />
      case 'appointment': return <Calendar className="h-5 w-5" />
      case 'campaign': return <Mail className="h-5 w-5" />
      default: return <Search className="h-5 w-5" />
    }
  }

  const getResultTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'client': return 'לקוח'
      case 'exam': return 'בדיקה'
      case 'medical-log': return 'רישום רפואי'
      case 'family': return 'משפחה'
      case 'referral': return 'הפניה'
      case 'appointment': return 'תור'
      case 'campaign': return 'קמפיין'
      default: return ''
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative z-9999 pt-2 pointer-events-auto" ref={containerRef} style={{ pointerEvents: 'auto' }}>
      <div className="relative  pointer-events-auto " style={{ pointerEvents: 'auto' }}>
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-3 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="חיפוש גלובלי..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-lg pr-10 pl-3 text-sm pointer-events-auto h-7 border-1 border-cyan-800/30"
          style={{ direction: 'rtl', pointerEvents: 'auto' }}
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isOpen && (query || results.length > 0) && (
        <Card dir="rtl" className="absolute top-full pb-0 pt-0 left-0 right-0 mt-1 z-50 max-h-96 overflow-hidden shadow-lg">
          <CardContent className="p-0">
            {loading ? (
              <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'none' }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="p-3 border-b last:border-b-0">
                    <div className="flex items-center gap-6 px-4">
                      <div className="flex-shrink-0 py-4 text-muted-foreground">
                        <Skeleton className="h-5 w-5 rounded" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Skeleton className="h-4 w-40 mb-2" />
                        <Skeleton className="h-3 w-24 mb-2" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'none' }}>
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-center gap-6 px-4">
                      <div className="flex-shrink-0 py-4 text-muted-foreground">
                        {getResultIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{result.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getResultTypeLabel(result.type)}
                          </Badge>
                        </div>
                        {result.subtitle && (
                          <div className="text-xs text-muted-foreground mb-1">
                            {result.subtitle}
                          </div>
                        )}
                        {result.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.description}
                          </div>
                        )}
                        {result.matchedFields.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {result.matchedFields.map((field, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {field}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : query ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                לא נמצאו תוצאות עבור "{query}"
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}