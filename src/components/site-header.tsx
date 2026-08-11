import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { User, Phone, IdCard, Calendar, Hash } from "lucide-react";
import { Client } from "@/lib/db/schema-interface";
import { useClientSidebar } from "@/contexts/ClientSidebarContext";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";

interface SiteHeaderProps {
  title: string;
  backLink?: string;
  parentTitle?: string;
  parentLink?: string;
  grandparentTitle?: string;
  grandparentLink?: string;
  clientBackLink?: string;
  examInfo?: string;
  hasUnsavedChanges?: boolean;
  tabs?: {
    activeTab: string;
    onTabChange: (value: string) => void;
    items?: readonly {
      value: string;
      label: string;
    }[];
  };
}

function calculateAge(dateOfBirth: string | undefined): number | null {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

function ClientTooltip({ client }: { client: Client }) {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const age = calculateAge(client.date_of_birth);

  return (
    <div className="space-y-3 p-1" dir={direction}>
      <div className="flex items-center gap-2 text-sm">
        <User className="text-muted-foreground h-4 w-4" />
        <span className="font-medium">{client.gender || "לא צוין"}</span>
      </div>

      {age && (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <span>{t("age", { count: age })}</span>
        </div>
      )}

      {client.national_id && (
        <div className="flex items-center gap-2 text-sm">
          <IdCard className="text-muted-foreground h-4 w-4" />
          <span dir="ltr">{client.national_id}</span>
        </div>
      )}

      {client.phone_mobile && (
        <div className="flex items-center gap-2 text-sm">
          <Phone className="text-muted-foreground h-4 w-4" />
          <span dir="ltr">{client.phone_mobile}</span>
        </div>
      )}
    </div>
  );
}

function UnsavedHeaderDot() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label="יש שינויים שלא נשמרו"
          className="block h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.16)]"
        />
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        יש שינויים שלא נשמרו
      </TooltipContent>
    </Tooltip>
  );
}

export function SiteHeader({
  title,
  backLink,
  parentTitle,
  parentLink,
  grandparentTitle,
  grandparentLink,
  clientBackLink,
  examInfo,
  hasUnsavedChanges,
  tabs,
}: SiteHeaderProps) {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const clientHeaderTabs = [
    { value: "details", label: t("clientDetails") },
    { value: "medical", label: t("medicalRecord") },
    { value: "exams", label: t("exams") },
    { value: "orders", label: t("orders") },
    { value: "referrals", label: t("referrals") },
    { value: "appointments", label: t("appointments") },
    { value: "files", label: t("files") },
  ];
  const { currentClient, toggleSidebar } = useClientSidebar();
  const displayName = currentClient
    ? `${currentClient.first_name} ${currentClient.last_name}`.trim()
    : "";
  const [isHovering, setIsHovering] = useState(false);
  const [headerContainer, setHeaderContainer] = useState<HTMLElement | null>(
    null,
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { runGuard } = useNavigationGuard();
  const clientIdFromPath = location.pathname.match(/^\/clients\/([^/]+)/)?.[1];

  // Check if we're on the main ClientDetailPage or a sub-route
  const isOnClientDetailPage =
    currentClient && location.pathname === `/clients/${currentClient.id}`;
  const isOnClientSubRoute =
    currentClient &&
    location.pathname.startsWith(`/clients/${currentClient.id}/`) &&
    !isOnClientDetailPage;

  // Check if we're in a sidebar context
  let isInSidebarContext = false;
  try {
    useSidebar();
    isInSidebarContext = true;
  } catch (error) {
    isInSidebarContext = false;
  }

  const handleClientNameClick = () => {
    if (currentClient && isOnClientSubRoute) {
      // Get the last tab from localStorage
      const lastTab =
        localStorage.getItem(`client-${currentClient.id}-last-tab`) ||
        "details";
      navigate({
        to: "/clients/$clientId",
        params: { clientId: String(currentClient.id) },
        search: { tab: lastTab },
      });
    }
  };

  const handleTabClick = (value: string) => {
    const clientId = currentClient?.id
      ? String(currentClient.id)
      : clientIdFromPath;
    const isActiveClientSubRoute =
      tabs?.activeTab === value &&
      clientId &&
      location.pathname.startsWith(`/clients/${clientId}/`);

    if (!isActiveClientSubRoute) return;

    runGuard(() => {
      navigate({
        to: "/clients/$clientId",
        params: { clientId },
        search: { tab: value },
      });
    });
  };

  useEffect(() => {
    const container = document.getElementById("header-container");
    setHeaderContainer(container);
  }, []);

  const headerContent = (
    <header
      className="flex h-(--header-height) shrink-0 items-center gap-2 border-b-[1px] transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
      dir={direction}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        className={`flex w-full items-center justify-between px-4 lg:px-6 ${
          tabs ? "py-1" : "py-2"
        }`}
      >
        {/* Right side - Navigation (in RTL, this appears on the right) */}
        <div
          className="flex items-center gap-1 lg:gap-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {isInSidebarContext && <SidebarTrigger className="-mr-1" />}
          {isInSidebarContext && (
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
          )}
          {backLink || parentTitle || grandparentTitle ? (
            <div className="flex items-center gap-2">
              {grandparentTitle &&
              grandparentLink &&
              parentTitle &&
              parentLink ? (
                <>
                  <Link
                    to={grandparentLink}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <span>{grandparentTitle}</span>
                  </Link>
                  <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                  />
                  <Link
                    to={parentLink}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <span>{parentTitle}</span>
                  </Link>
                  <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                  />
                  <h1 className="text-base font-medium">{title}</h1>
                </>
              ) : parentTitle && parentLink ? (
                <>
                  <Link
                    to={parentLink}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <span>{parentTitle}</span>
                  </Link>
                  <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                  />
                  <h1 className="text-base font-medium">{title}</h1>
                </>
              ) : backLink ? (
                <Link
                  to={backLink}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <span>{title}</span>
                </Link>
              ) : null}
              {displayName && (
                <>
                  <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                  />
                  {currentClient ? (
                    <div className="flex items-center gap-1">
                      <Popover open={isHovering} onOpenChange={setIsHovering}>
                        <PopoverTrigger asChild>
                          <div
                            className="hover:bg-muted/50 cursor-pointer rounded-md p-1 transition-all duration-200"
                            onMouseEnter={() => setIsHovering(true)}
                            onMouseLeave={() => setIsHovering(false)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsHovering(false);
                              toggleSidebar();
                            }}
                          >
                            <User className="text-muted-foreground hover:text-foreground h-4 w-4" />
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          className="bg-background/95 supports-[backdrop-filter]:bg-background/60 w-64 border p-4 shadow-lg backdrop-blur"
                          side="bottom"
                          align="end"
                          sideOffset={0}
                          onMouseEnter={() => setIsHovering(true)}
                          onMouseLeave={() => setIsHovering(false)}
                        >
                          <div className="space-y-2">
                            <div
                              className="mb-3 flex items-center justify-between border-b pb-2 text-base font-semibold"
                              dir={direction}
                            >
                              {displayName}
                              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                                {currentClient.id}
                              </span>
                            </div>
                            <ClientTooltip client={currentClient} />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <div
                        className={`rounded-md px-2 py-1 text-base font-medium transition-all duration-200 ${
                          isOnClientSubRoute
                            ? "text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                            : ""
                        }`}
                        onClick={
                          isOnClientSubRoute ? handleClientNameClick : undefined
                        }
                      >
                        {displayName}
                      </div>
                    </div>
                  ) : clientBackLink ? (
                    <Link
                      to={clientBackLink}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {displayName}
                    </Link>
                  ) : (
                    <h1 className="text-base font-medium">{displayName}</h1>
                  )}
                </>
              )}
              {examInfo && (
                <>
                  <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                  />
                  <h1 className="text-base font-medium">{examInfo}</h1>
                </>
              )}
            </div>
          ) : (
            <h1 className="text-base font-medium">{title}</h1>
          )}
          {hasUnsavedChanges && <UnsavedHeaderDot />}
        </div>

        {/* Left side - Tabs (in RTL, this appears on the left) */}
        <div
          className="flex items-center gap-2 text-base"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {tabs && (
            <Tabs
              value={tabs.activeTab}
              onValueChange={tabs.onTabChange}
              dir={direction}
            >
              <TabsList className="bg-transparent">
                {(tabs.items || clientHeaderTabs).map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    className="data-[state=active]:text-foreground data-[state=active]:bg-accent data-[state=inactive]:text-muted-foreground flex-none whitespace-nowrap data-[state=inactive]:bg-transparent"
                    value={tab.value}
                    onClick={() => handleTabClick(tab.value)}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>
    </header>
  );

  if (headerContainer) {
    return createPortal(headerContent, headerContainer);
  }

  return headerContent;
}
