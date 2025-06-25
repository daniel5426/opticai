import React from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"

interface SiteHeaderProps {
  title: string
  backLink?: string
  clientName?: string
  clientBackLink?: string
  examInfo?: string
  tabs?: {
    activeTab: string
    onTabChange: (value: string) => void
  }
}

export function SiteHeader({ title, backLink, clientName, clientBackLink, examInfo, tabs }: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)" dir="rtl">
      <div className="flex w-full items-center justify-between px-4 lg:px-6 py-2">
        {/* Right side - Navigation (in RTL, this appears on the right) */}
        <div className="flex items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-mr-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          {backLink ? (
            <div className="flex items-center gap-2">
              <Link to={backLink} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <span>{title}</span>
              </Link>
              {clientName && (
                <>
                  <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                  {clientBackLink ? (
                    <Link to={clientBackLink} className="text-muted-foreground hover:text-foreground">
                      {clientName}
                    </Link>
                  ) : (
                    <h1 className="text-base font-medium">{clientName}</h1>
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
                <TabsTrigger value="medical">רשומות רפואיות</TabsTrigger>
                <TabsTrigger value="orders">הזמנות</TabsTrigger>
                <TabsTrigger value="contact-lenses">עדשות מגע</TabsTrigger>
                <TabsTrigger value="referrals">הפניות</TabsTrigger>
                <TabsTrigger value="appointments">תורים</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>
    </header>
  )
}
