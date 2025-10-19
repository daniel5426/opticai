import React, { useState, useEffect } from "react";
import DragWindowRegion from "@/components/DragWindowRegion";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ControlCenterSidebar } from "@/components/control-center-sidebar";
import { getSettings } from "@/lib/db/settings-db";
import { applyCompanyThemeColors, cacheCompanyThemeColors } from "@/helpers/theme_helpers";
import { Settings, User } from "@/lib/db/schema-interface";
import { SettingsContext } from "@/contexts/SettingsContext";
import { ClientSidebarProvider } from "@/contexts/ClientSidebarContext";
import { useUser } from "@/contexts/UserContext";
import { ClientSidebar } from "@/components/ClientSidebar";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { apiClient } from '@/lib/api-client';
import { OctahedronLoader } from "@/components/ui/octahedron-loader";

/**
 * BaseLayoutContent - Main layout wrapper
 * Handles sidebar rendering and settings loading
 * Auth logic is delegated to AuthService - this component just consumes the state
 */
function BaseLayoutContent({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Safe access to user context (handles HMR gracefully)
  let currentUser: User | null = null;
  let currentClinic: any = null;
  let isUserLoading = true;
  
  try {
    const userContext = useUser();
    currentUser = userContext.currentUser;
    currentClinic = userContext.currentClinic;
    isUserLoading = userContext.isLoading;
  } catch (error) {
    // During HMR, UserProvider might be temporarily unavailable
    console.log('[BaseLayout] UserContext temporarily unavailable (likely HMR)')
  }
  
  const updateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };
  
  // Load settings when clinic context is available
  useEffect(() => {
    const loadSettings = async () => {
      if (!currentClinic?.id) return;

      try {
        const dbSettings = await getSettings(currentClinic.id);
        if (dbSettings) {
          setSettings(dbSettings);
          // Apply company theme colors (they're already cached from UserContext)
          applyCompanyThemeColors();
        }
      } catch (error) {
        console.error('[BaseLayout] Error loading settings:', error);
      }
    };

    loadSettings();
  }, [currentClinic?.id, currentUser?.id]);

  // Load company data
  useEffect(() => {
    const loadCompany = async () => {
      const companyData = localStorage.getItem('controlCenterCompany');
      if (companyData) {
        const company = JSON.parse(companyData);
        setCompany(company);
        // Cache company theme colors
        cacheCompanyThemeColors(company);
        applyCompanyThemeColors(company);
      } else if (currentClinic?.company_id) {
        try {
          const resp = await apiClient.getCompany(currentClinic.company_id);
          if (resp.data) {
            setCompany(resp.data);
            // Cache company theme colors
            cacheCompanyThemeColors(resp.data);
            applyCompanyThemeColors(resp.data);
          }
        } catch (error) {
          console.error('[BaseLayout] Error loading company:', error);
        }
      }
    };

    loadCompany();
  }, [currentClinic?.company_id]);

  // Listen for company updates
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail) {
        setCompany(e.detail);
        // Cache and apply updated company theme colors
        cacheCompanyThemeColors(e.detail);
        applyCompanyThemeColors(e.detail);
      }
    }
    window.addEventListener('companyUpdated', handler as EventListener)
    return () => window.removeEventListener('companyUpdated', handler as EventListener)
  }, [])

  // Preload logo
  useEffect(() => {
    if (settings?.clinic_logo_path) {
      setIsLogoLoaded(false);
      const img = new Image();
      img.src = settings.clinic_logo_path;
      img.onload = () => setIsLogoLoaded(true);
      img.onerror = () => setIsLogoLoaded(true);
    } else {
      setIsLogoLoaded(true);
    }
  }, [settings?.clinic_logo_path]);

  // Determine which layout to show
  const noSidebarRoutes = ['/control-center', '/user-selection', '/auth/callback'];
  const shouldShowSidebar = !noSidebarRoutes.some(route =>
    location.pathname.startsWith(route)
  ) && location.pathname !== '/'; // Exclude exact root path

  const controlCenterRoutes = ['/control-center/dashboard', '/control-center/users', '/control-center/clinics', '/control-center/settings'];
  const isControlCenterRoute = controlCenterRoutes.some(route =>
    location.pathname.startsWith(route)
  );

  const canAccessControlCenter = currentUser?.role === 'company_ceo';

  // Don't show loading screen on callback route (OAuth popup)
  const isCallbackRoute = location.pathname === '/auth/callback';

  // Show loading during auth initialization (except on callback route)
  if (isUserLoading && !isCallbackRoute) {
    return (
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <div className="flex flex-col items-center justify-center h-screen bg-background">
          <OctahedronLoader size="3xl" />
        </div>
        <Toaster />
      </ThemeProvider>
    );
  }

  return (
    <>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <SettingsContext.Provider value={{ settings, updateSettings }}>
          <ClientSidebarProvider>
            {isControlCenterRoute && currentUser && !canAccessControlCenter ? (
              // Access denied for non-CEO trying to access control center
              <div className="min-h-screen bg-background flex flex-col gap-4 items-center justify-center">
                <div className="text-foreground text-xl">אין לך הרשאה לגשת למרכז הבקרה</div>
                <Button onClick={() => navigate({ to: '/control-center' })}>למסך התחלה</Button>
              </div>
            ) : isControlCenterRoute && currentUser && canAccessControlCenter ? (
              // Control Center Layout
              <SidebarProvider dir="rtl">
                <div className="flex flex-col h-screen">
                  <DragWindowRegion title="" />
                  <div className="flex-1 flex overflow-hidden">
                    <ControlCenterSidebar
                      variant="inset"
                      side="right"
                      company={company}
                      currentUser={currentUser}
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
            ) : shouldShowSidebar && currentUser ? (
              // Clinic Layout with Sidebar
              <SidebarProvider dir="rtl">
                <div className="flex flex-col h-screen">
                  <DragWindowRegion title="" />
                  <div className="flex-1 flex overflow-hidden">
                    <AppSidebar
                      variant="inset"
                      side="right"
                      clinicName={currentClinic?.name}
                      currentUser={currentUser}
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
              // No Sidebar Layout (Welcome, Control Center login, User Selection)
              <div className="flex flex-col h-screen">
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

/**
 * BaseLayout - Root layout component
 * Note: UserProvider is now in __root.tsx to prevent context loss during navigation
 */
export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <div className="flex items-center justify-center h-screen">
          <OctahedronLoader size="3xl" />
        </div>
        <Toaster />
      </ThemeProvider>
    }>
      <BaseLayoutContent>{children}</BaseLayoutContent>
    </React.Suspense>
  );
}