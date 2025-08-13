import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconBuilding, IconSettings, IconChevronDown } from '@tabler/icons-react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { Clinic, Company } from '@/lib/db/schema-interface'
import { useUser } from '@/contexts/UserContext'
import { toast } from 'sonner'
import { cn } from '@/utils/tailwind'
import { apiClient } from '@/lib/api-client';

interface ClinicDropdownProps {
  currentClinic?: Clinic | null
  clinicName?: string
  logoPath?: string | null
  isLogoLoaded?: boolean
  children: React.ReactNode
}

export function ClinicDropdown({ 
  currentClinic, 
  clinicName, 
  logoPath, 
  isLogoLoaded, 
  children
}: ClinicDropdownProps) {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)
  const { currentUser, setCurrentClinic, clinicRefreshTrigger } = useUser()
  const navigate = useNavigate()
  const location = useLocation()

  const isInControlCenter = location.pathname.startsWith('/control-center')

  console.log('ClinicDropdown Debug:', {
    isInControlCenter,
    currentClinic,
    currentUser: currentUser?.role,
    location: location.pathname,
    clinicsCount: clinics.length,
    loading,
    company: company?.name,
    clinicRefreshTrigger
  })

  const loadData = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'company_ceo') {
      return
    }

    setLoading(true)
    try {
      let companyId: number | null = null
      let clinicData = currentClinic

      if (!clinicData && !isInControlCenter) {
    const savedClinicData = localStorage.getItem('selectedClinic')
        if (savedClinicData) {
          try {
            clinicData = JSON.parse(savedClinicData)
            console.log('ClinicDropdown: Loaded clinic from sessionStorage:', clinicData)
          } catch (error) {
            console.error('Error parsing clinic data from sessionStorage:', error)
          }
        }
      }

      if (isInControlCenter) {
    const companyData = localStorage.getItem('controlCenterCompany')
        if (companyData) {
          const parsedCompany = JSON.parse(companyData)
          setCompany(parsedCompany)
          companyId = parsedCompany.id
          console.log('ClinicDropdown: Loaded company from sessionStorage:', parsedCompany.name)
        } else if (clinicData?.company_id) {
          companyId = clinicData.company_id
          const companyResponse = await apiClient.getCompany(clinicData.company_id);
          const companyData = companyResponse.data;
          if (companyData) {
            setCompany(companyData);
            console.log('ClinicDropdown: Loaded company:', companyData.name);
          }
        }
      } else {
        if (clinicData?.company_id) {
          companyId = clinicData.company_id
          const companyResponse = await apiClient.getCompany(clinicData.company_id);
          const companyData = companyResponse.data;
          if (companyData) {
            setCompany(companyData);
            console.log('ClinicDropdown: Loaded company:', companyData.name);
          }
        }
      }

      if (companyId) {
        const companyClinicsResponse = await apiClient.getClinicsByCompany(companyId);
        const companyClinics = companyClinicsResponse.data || [];
        const activeClinics = companyClinics.filter((clinic: Clinic) => clinic.is_active)
        console.log('ClinicDropdown: Loaded clinics:', activeClinics.map((c: Clinic) => c.name))
        setClinics(activeClinics)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('שגיאה בטעינת הנתונים')
    } finally {
      setLoading(false)
    }
  }, [currentUser, currentClinic?.company_id, isInControlCenter, clinicRefreshTrigger])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleClinicSelect = async (clinic: Clinic) => {
    console.log('ClinicDropdown: handleClinicSelect called with clinic:', clinic.name)
    console.log('ClinicDropdown: isInControlCenter:', isInControlCenter)
    console.log('ClinicDropdown: currentClinic?.id:', currentClinic?.id)
    console.log('ClinicDropdown: clinic.id:', clinic.id)
    
    // Only check if we're already in this clinic when NOT in control center
    if (!isInControlCenter && clinic.id === currentClinic?.id) {
      console.log('ClinicDropdown: Already in this clinic, returning')
      return
    }

    try {
      console.log('ClinicDropdown: Switching to clinic:', clinic)
      console.log('ClinicDropdown: Current clinic before switch:', currentClinic?.name)
      
      setCurrentClinic(clinic)
    localStorage.setItem('selectedClinic', JSON.stringify(clinic))
      
      console.log('ClinicDropdown: About to navigate to /dashboard')
      
      // Use setTimeout to ensure navigation happens after dropdown closes
      setTimeout(() => {
        navigate({ to: '/dashboard' })
        console.log('ClinicDropdown: Navigation completed')
      }, 100)
    } catch (error) {
      console.error('Error switching clinic:', error)
      toast.error('שגיאה בהחלפת מרפאה')
    }
  }

  const handleControlCenterClick = async () => {
    try {
      if (!company?.id) {
        toast.error('לא ניתן לגשת למרכז הבקרה')
        return
      }

      console.log('ClinicDropdown: Switching to control center for company:', company)
    localStorage.setItem('controlCenterCompany', JSON.stringify(company))
      
      if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser))
      }
      
      navigate({ 
        to: '/control-center/dashboard',
        search: {
          companyId: company.id.toString(),
          companyName: company.name,
          fromSetup: 'false'
        }
      })
    } catch (error) {
      console.error('Error accessing control center:', error)
      toast.error('שגיאה בגישה למרכז הבקרה')
    }
  }

  if (!currentUser || currentUser.role !== 'company_ceo') {
    console.log('ClinicDropdown: User is not CEO, rendering as link')
    return <>{children}</>
  }

  console.log('ClinicDropdown: User is CEO, rendering dropdown')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="h-auto p-0 hover:bg-transparent data-[state=open]:bg-transparent flex items-center gap-2"
          type="button"
        >
          {children}
          <IconChevronDown className="mr-2 h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-64" 
        align="end"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuItem 
          dir="rtl"
          onClick={(e) => {
            console.log('ClinicDropdown: Control center clicked')
            e.preventDefault()
            e.stopPropagation()
            handleControlCenterClick()
          }}
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            isInControlCenter && "bg-muted/50"
          )}
          disabled={isInControlCenter}
        >
          <IconSettings className="h-4 w-4" />
          <span className="font-medium">מרכז בקרה</span>
          {isInControlCenter && (
            <span className="text-xs text-muted-foreground">(נוכחי)</span>
          )}
        </DropdownMenuItem>
        
        {currentClinic && !isInControlCenter && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              dir="rtl"
              className="flex items-center gap-2 cursor-pointer bg-muted/50" 
              disabled
            >
              <IconBuilding className="h-4 w-4" />
              <span className="font-medium">{currentClinic.name}</span>
              <span className="text-xs text-muted-foreground">(נוכחי)</span>
            </DropdownMenuItem>
          </>
        )}
        
        {(() => {
          const otherClinics = clinics.filter(clinic => !isInControlCenter ? clinic.id !== currentClinic?.id : true);
          return otherClinics.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {loading ? (
                <DropdownMenuItem dir="rtl" disabled>
                  <span>טוען מרפאות...</span>
                </DropdownMenuItem>
              ) : (
                otherClinics.map((clinic, index) => (
                  <DropdownMenuItem 
                    key={clinic.id}
                    onClick={(e) => {
                      console.log('ClinicDropdown: Clinic item clicked:', clinic.name)
                      e.preventDefault()
                      e.stopPropagation()
                      handleClinicSelect(clinic)
                    }}
                    dir="rtl"
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={(e) => {
                      console.log('ClinicDropdown: Clinic item selected:', clinic.name)
                      e.preventDefault()
                    }}
                  >
                    <IconBuilding className="h-4 w-4" />
                    <span>{clinic.name}</span>
                    {clinic.location && (
                      <span className="text-xs text-muted-foreground">({clinic.location})</span>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </>
          );
        })()}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 