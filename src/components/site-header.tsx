import React, { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Link } from "@tanstack/react-router"
import { ChevronLeft, User, Phone, IdCard, Calendar } from "lucide-react"
import { Client } from "@/lib/db/schema"

interface SiteHeaderProps {
  title: string
  backLink?: string
  parentTitle?: string
  parentLink?: string
  grandparentTitle?: string
  grandparentLink?: string
  clientName?: string
  client?: Client
  clientBackLink?: string
  examInfo?: string
  tabs?: {
    activeTab: string
    onTabChange: (value: string) => void
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

function ClientTooltip({ client }: { client: Client }) {
  const age = calculateAge(client.date_of_birth)
  
  return (
    <div className="space-y-3 p-1" dir="rtl">
      <div className="flex items-center gap-2 text-sm">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{client.gender || 'לא צוין'}</span>
      </div>
      
      {age && (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>גיל {age}</span>
        </div>
      )}
      
      {client.national_id && (
        <div className="flex items-center gap-2 text-sm">
          <IdCard className="h-4 w-4 text-muted-foreground" />
          <span dir="ltr">{client.national_id}</span>
        </div>
      )}
      
      {client.phone_mobile && (
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span dir="ltr">{client.phone_mobile}</span>
        </div>
      )}
    </div>
  )
}

export function SiteHeader({ title, backLink, parentTitle, parentLink, grandparentTitle, grandparentLink, clientName, client, clientBackLink, examInfo, tabs }: SiteHeaderProps) {
  const displayName = client ? `${client.first_name} ${client.last_name}`.trim() : clientName
  const [isHovering, setIsHovering] = useState(false)
  const [headerContainer, setHeaderContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const container = document.getElementById('header-container')
    setHeaderContainer(container)
  }, [])

  const headerContent = (
    <header className=" border-b-[1px] flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)" dir="rtl">
      <div className=" flex w-full items-center justify-between px-4 lg:px-6 py-2">
        {/* Right side - Navigation (in RTL, this appears on the right) */}
        <div className="flex items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-mr-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          {backLink || parentTitle || grandparentTitle ? (
            <div className="flex items-center gap-2">
              {grandparentTitle && grandparentLink && parentTitle && parentLink ? (
                <>
                  <Link to={grandparentLink} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <span>{grandparentTitle}</span>
                  </Link>
                  <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                  <Link to={parentLink} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <span>{parentTitle}</span>
                  </Link>
                  <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                  <h1 className="text-base font-medium">{title}</h1>
                </>
              ) : parentTitle && parentLink ? (
                <>
                  <Link to={parentLink} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <span>{parentTitle}</span>
                  </Link>
                  <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                  <h1 className="text-base font-medium">{title}</h1>
                </>
              ) : backLink ? (
                <Link to={backLink} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <span>{title}</span>
                </Link>
              ) : null}
              {displayName && (
                <>
                  <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                  {client ? (
                    <div className="flex items-center gap-1">
                      <Popover open={isHovering} onOpenChange={setIsHovering}>
                        <PopoverTrigger asChild>
                          <div
                            className="p-1 hover:bg-muted/50 rounded-md cursor-pointer transition-all duration-200"
                            onMouseEnter={() => setIsHovering(true)}
                            onMouseLeave={() => setIsHovering(false)}
                          >
                            <User className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </div>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-64 p-4 shadow-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
                          side="bottom"
                          align="end"
                          sideOffset={0}
                          onMouseEnter={() => setIsHovering(true)}
                          onMouseLeave={() => setIsHovering(false)}
                        >
                          <div className="space-y-2">
                            <div className="font-semibold text-base border-b pb-2 mb-3" dir="rtl">
                              {displayName}
                            </div>
                            <ClientTooltip client={client} />
                          </div>
                        </PopoverContent>
                      </Popover>
                      {clientBackLink ? (
                        <Link 
                          to={clientBackLink} 
                          className="text-muted-foreground hover:text-foreground transition-all duration-200 hover:bg-muted/50 px-2 py-1 rounded-md"
                        >
                          {displayName}
                        </Link>
                      ) : (
                        <div className="text-base font-medium px-2 py-1">
                          {displayName}
                        </div>
                      )}
                    </div>
                  ) : (
                    clientBackLink ? (
                      <Link to={clientBackLink} className="text-muted-foreground hover:text-foreground">
                        {displayName}
                      </Link>
                    ) : (
                      <h1 className="text-base font-medium">{displayName}</h1>
                    )
                  )}
                </>
              )}
              {examInfo && (
                <>
                  <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                  <h1 className="text-base font-medium">{examInfo}</h1>
                </>
              )}
            </div>
          ) : (
            <h1 className="text-base font-medium">{title}</h1>
          )}
        </div>

        {/* Left side - Tabs (in RTL, this appears on the left) */}
        <div className="flex items-center gap-2 text-base">
          {tabs && (
            <Tabs 
              value={tabs.activeTab}
              onValueChange={tabs.onTabChange}
            >
              <TabsList>
                <TabsTrigger value="details">פרטים אישיים</TabsTrigger>
                <TabsTrigger value="exams">בדיקות</TabsTrigger>
                <TabsTrigger value="medical">גליון רפואי</TabsTrigger>
                <TabsTrigger value="orders">הזמנות</TabsTrigger>
                <TabsTrigger value="contact-lenses">עדשות מגע</TabsTrigger>
                <TabsTrigger value="referrals">הפניות</TabsTrigger>
                <TabsTrigger value="appointments">תורים</TabsTrigger>
                <TabsTrigger value="files">קבצים</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>
    </header>
  )

  if (headerContainer) {
    return createPortal(headerContent, headerContainer)
  }

  return headerContent
}
