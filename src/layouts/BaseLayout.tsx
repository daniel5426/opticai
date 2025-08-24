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

// Create a wrapper component that safely uses UserContext
function BaseLayoutContent({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const [hasCompanies, setHasCompanies] = useState<boolean | null>(null);
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

  const isLoading = isUserLoading || isSettingsLoading || hasCompanies === null;

  const noSidebarRoutes = ['/', '/control-center', '/setup-wizard', '/clinic-entrance', '/user-selection'];
  const shouldShowSidebar = !noSidebarRoutes.some(route =>
    location.pathname === route || location.pathname.startsWith(route)
  );

  const controlCenterRoutes = ['/control-center/dashboard', '/control-center/users', '/control-center/clinics', '/control-center/settings'];
  const isControlCenterRoute = controlCenterRoutes.some(route =>
    location.pathname.startsWith(route)
  );

  // Check if user has access to control center (only company_ceo can access)
  const canAccessControlCenter = currentUser?.role === 'company_ceo';

  const clinicRoutes = [
    '/dashboard', 
    '/clients', 
    '/exams', 
    '/orders', 
    '/appointments', 
    '/settings', 
    '/campaigns',
    '/files',
    '/referrals',
    '/contact-lenses',
    '/ai-assistant',
    '/exam-layouts',
    '/worker-stats',
    '/second-page'
  ];
  const requiresUser = clinicRoutes.some(route =>
    location.pathname.startsWith(route)
  );

  // Redirect to clinic entrance or user selection based on stored clinic when a clinic-auth route is accessed
  useEffect(() => {
    if (!isLoading && !isUserLoading && requiresUser && !currentUser) {
      const hasClinic = !!localStorage.getItem('selectedClinic')
      navigate({ to: hasClinic ? '/user-selection' : '/clinic-entrance' })
    }
  }, [isLoading, isUserLoading, requiresUser, currentUser, navigate]);

  // Redirect to control center if user is not authenticated for control center routes
  useEffect(() => {
    if (isControlCenterRoute && !currentUser && !isLoading) {
      navigate({ to: '/control-center' });
    }
  }, [isControlCenterRoute, currentUser, isLoading, navigate]);

  // Determine if we should show the sidebar layout
  const shouldShowSidebarLayout = currentUser && !isLoading && !isUserLoading && 
                                 (shouldShowSidebar || requiresUser);

  // Debug logging

  return (
    <>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <SettingsContext.Provider value={{ settings, updateSettings }}>
          <ClientSidebarProvider>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <OctahedronLoader size="3xl" />
              </div>
            ) : hasCompanies === false && !currentUser && !['/', '/control-center', '/setup-wizard', '/clinic-entrance', '/user-selection'].includes(location.pathname) && !location.pathname.startsWith('/control-center/') ? (
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
                  <DragWindowRegion title="" />
                  <div className="flex-1 flex overflow-hidden">
                    <ControlCenterSidebar
                      variant="inset"
                      side="right"
                      company={company}
                      currentUser={currentUser || undefined}
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
                  <DragWindowRegion title="" />
                  <div className="flex-1 flex overflow-hidden">
                    <AppSidebar
                      variant="inset"
                      side="right"
                      clinicName={currentClinic?.name}
                      currentUser={currentUser || undefined}
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
              <div className="flex flex-col h-screen">
                <DragWindowRegion title="" />
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
  return (
    <React.Suspense fallback={
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <div className="flex items-center justify-center h-full">
          <OctahedronLoader size="3xl" />
        </div>
        <Toaster />
      </ThemeProvider>
    }>
      <BaseLayoutContent>{children}</BaseLayoutContent>
    </React.Suspense>
  );
}
