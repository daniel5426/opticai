import React, { useState, useEffect } from "react";
import DragWindowRegion from "@/components/DragWindowRegion";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ControlCenterSidebar } from "@/components/control-center-sidebar";
import { getSettings } from "@/lib/db/settings-db";
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers";
import { Settings } from "@/lib/db/schema-interface";
import { SettingsContext } from "@/contexts/SettingsContext";
import { ClientSidebarProvider } from "@/contexts/ClientSidebarContext";
import { useUser } from "@/contexts/UserContext";
import { ClientSidebar } from "@/components/ClientSidebar";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { User, Clinic } from "@/lib/db/schema-interface";
import { apiClient } from '@/lib/api-client';
import { OctahedronLoader } from "@/components/ui/octahedron-loader";
import { LayoutPreloader } from "@/components/LayoutPreloader";

// Create a wrapper component that safely uses UserContext
function BaseLayoutContent({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const [hasCompanies, setHasCompanies] = useState<boolean | null>(
    sessionStorage.getItem('hasCompanies') ? sessionStorage.getItem('hasCompanies') === 'true' : null
  );
  const [company, setCompany] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Use the imported useUser hook
  const { currentUser, currentClinic, isLoading: isUserLoading } = useUser()
  
  const updateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };
  
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const companiesResponse = await apiClient.getCompaniesPublic();
        const companies = companiesResponse.data || [];
        const hasCompaniesResult = companies.length > 0;
        setHasCompanies(hasCompaniesResult);

        const companyData = localStorage.getItem('controlCenterCompany');
        if (companyData) {
          setCompany(JSON.parse(companyData));
        } else if (currentClinic?.company_id) {
          try {
            const resp = await apiClient.getCompany(currentClinic.company_id);
            if (resp.data) setCompany(resp.data);
          } catch {}
        }

        if (hasCompaniesResult) {
          const clinicIdToLoad = currentClinic?.id;
          const dbSettings = await getSettings(clinicIdToLoad);
          if (dbSettings) {
            setSettings(dbSettings);
            if (currentUser?.id) {
              applyThemeColorsFromSettings(undefined, currentUser.id);
            }
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        setHasCompanies(false);
      } finally {
        setIsSettingsLoading(false);
      }
    };
    loadInitialData();
  }, [currentUser?.id]);

  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail) {
        setCompany(e.detail)
      }
    }
    window.addEventListener('companyUpdated', handler as EventListener)
    return () => window.removeEventListener('companyUpdated', handler as EventListener)
  }, [])

  useEffect(() => {
    if (settings?.clinic_logo_path) {
      const img = new Image();
      img.src = settings.clinic_logo_path;
      img.onload = () => setIsLogoLoaded(true);
      img.onerror = () => setIsLogoLoaded(true);
    } else {
      setIsLogoLoaded(true);
    }
  }, [settings]);

  // Route definitions
  const noSidebarRoutes = ['/', '/control-center', '/setup-wizard', '/clinic-entrance', '/user-selection'];
  const controlCenterRoutes = ['/control-center/dashboard', '/control-center/users', '/control-center/clinics', '/control-center/settings'];
  const clinicRoutes = ['/dashboard', '/clients', '/exams', '/orders', '/appointments', '/settings', '/campaigns', '/files', '/referrals', '/contact-lenses', '/ai-assistant', '/exam-layouts', '/worker-stats', '/second-page'];

  const isControlCenterRoute = controlCenterRoutes.some(route => location.pathname.startsWith(route));
  const requiresUser = clinicRoutes.some(route => location.pathname.startsWith(route));
  const shouldShowSidebar = !noSidebarRoutes.some(route => location.pathname === route || location.pathname.startsWith(route));
  const canAccessControlCenter = currentUser?.role === 'company_ceo';

  // Consolidated loading state
  const isBaseLoading = isUserLoading || isSettingsLoading || hasCompanies === null;

  // Determine if we need a logged-in user (clinic routes)
  const needsUser = clinicRoutes.some(route => location.pathname.startsWith(route));

  // App is ready ONLY when:
  // 1) base async data finished AND
  // 2) If route needs a user, we have one (currentUser)
  // 3) If route is control-center, we validated access (currentUser & role)
  const isAppReady = !isBaseLoading &&
    (!needsUser || !!currentUser) &&
    (!isControlCenterRoute || (currentUser && canAccessControlCenter));

  const shouldShowSidebarLayout = currentUser && isAppReady && (shouldShowSidebar || requiresUser);

  // Handle redirects only when fully loaded
  useEffect(() => {
    if (isAppReady) {
      if (requiresUser && !currentUser) {
        const hasClinic = !!localStorage.getItem('selectedClinic')
        navigate({ to: hasClinic ? '/user-selection' : '/clinic-entrance' })
      } else if (isControlCenterRoute && !currentUser) {
        navigate({ to: '/control-center' });
      }
    }
  }, [isAppReady, requiresUser, currentUser, isControlCenterRoute, navigate]);

  // Debug logging

  // Add a small delay to ensure sidebar components are ready
  const [layoutReady, setLayoutReady] = useState(false);
  
  const handleLayoutReady = () => {
    setLayoutReady(true);
  };

  // Single clean render decision - either show loader or final layout
  if (!isAppReady || !layoutReady || !currentUser) {
    return (
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <div className="flex items-center justify-center h-screen bg-background">
          <OctahedronLoader size="3xl" />
          {isAppReady && currentUser && (
            <LayoutPreloader
              onReady={handleLayoutReady}
              isControlCenter={isControlCenterRoute && canAccessControlCenter}
              currentUser={currentUser ?? undefined}
              currentClinic={currentClinic}
              company={company}
              settings={settings}
            />
          )}
        </div>
        <Toaster />
      </ThemeProvider>
    );
  }

  // Render final layout only when everything is ready
  return (
    <>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <SettingsContext.Provider value={{ settings, updateSettings }}>
          <ClientSidebarProvider>
            {/* Special redirect states */}
            {hasCompanies === false && !currentUser && !noSidebarRoutes.includes(location.pathname) && !location.pathname.startsWith('/control-center/') ? (
              <div className="min-h-screen bg-background flex-row flex items-center justify-center">
                <div className="text-foreground text-xl">מפנה למסך הבית...</div>
              </div>
            ) : isControlCenterRoute && !currentUser ? (
              <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-foreground text-xl">מפנה למרכז הבקרה...</div>
              </div>
            ) : isControlCenterRoute && currentUser && !canAccessControlCenter ? (
              <div className="min-h-screen bg-background flex flex-col gap-4 items-center justify-center">
                <div className="text-foreground text-xl">אין לך הרשאה לגשת למרכז הבקרה</div>
                <Button onClick={() => navigate({ to: '/control-center' })}>למסך התחלה</Button>
              </div>
            ) : isControlCenterRoute && currentUser && canAccessControlCenter ? (
              <SidebarProvider dir="rtl">
                <div className="flex flex-col h-screen">
                  {layoutReady && <DragWindowRegion title="" />}
                  <div className="flex-1 flex overflow-hidden">
                    <ControlCenterSidebar
                      variant="inset"
                      side="right"
                      company={company}
                      currentUser={currentUser ?? undefined}
                      currentClinic={currentClinic}
                    />
                    <SidebarInset className="flex flex-col flex-1 overflow-hidden no-scrollbar" style={{scrollbarWidth: 'none'}}>
                      <div className="flex flex-col h-full">
                        <div className="sticky top-0 bg-background">
                          <div id="header-container" />
                        </div>
                        <main className="flex-1 overflow-auto bg-muted/50 flex no-scrollbar" style={{scrollbarWidth: 'none'}}>
                          <div className="flex-1 overflow-auto no-scrollbar">
                            {children}
                          </div>
                        </main>
                      </div>
                    </SidebarInset>
                  </div>
                </div>
              </SidebarProvider>
            ) : shouldShowSidebarLayout ? (
              <SidebarProvider dir="rtl">
                <div className="flex flex-col h-screen">
                  {layoutReady && <DragWindowRegion title="" />}
                  <div className="flex-1 flex overflow-hidden">
                    <AppSidebar
                      variant="inset"
                      side="right"
                      clinicName={currentClinic?.name}
                      currentUser={currentUser ?? undefined}
                      logoPath={settings?.clinic_logo_path || company?.logo_path}
                      isLogoLoaded={isLogoLoaded}
                      currentClinic={currentClinic}
                    />
                    <SidebarInset className="flex flex-col flex-1 overflow-hidden no-scrollbar" style={{scrollbarWidth: 'none'}}>
                      <div className="flex flex-col h-full">
                        <div className="sticky top-0 bg-background">
                          <div id="header-container" />
                        </div>
                        <main className="flex-1 overflow-auto bg-muted/50 flex no-scrollbar" style={{scrollbarWidth: 'none'}}>
                          <div className="flex-1 overflow-auto no-scrollbar">
                            {children}
                          </div>
                          <ClientSidebar />
                        </main>
                      </div>
                    </SidebarInset>
                  </div>
                </div>
              </SidebarProvider>
            ) : (
              <div className="flex flex-col h-screen" dir="rtl">
                <main className="flex-1 overflow-auto">
                  {children}
                </main>
              </div>
            )}
          </ClientSidebarProvider>
        </SettingsContext.Provider>
        <Toaster />
      </ThemeProvider>
    </>
  );
}

// Main BaseLayout component with error boundary for UserContext
export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BaseLayoutContent>{children}</BaseLayoutContent>;
}
