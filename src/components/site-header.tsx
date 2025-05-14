import React from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"

interface SiteHeaderProps {
  title: string
  backLink?: string
  clientName?: string
}

export function SiteHeader({ title, backLink, clientName }: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 py-2">
        <SidebarTrigger className="-ml-1" />
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
                <h1 className="text-base font-medium">{clientName}</h1>
              </>
            )}
          </div>
        ) : (
          <h1 className="text-base font-medium">{title}</h1>
        )}
      </div>
    </header>
  )
}
