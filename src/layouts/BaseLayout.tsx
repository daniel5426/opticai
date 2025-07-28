import React, { useState, useEffect } from "react";
import DragWindowRegion from "@/components/DragWindowRegion";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ControlCenterSidebar } from "@/components/control-center-sidebar";
import { getSettings } from "@/lib/db/settings-db";
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers";
import { Settings } from "@/lib/db/schema";
import { useUser } from "@/contexts/UserContext";
import { SettingsContext } from "@/contexts/SettingsContext";
import UserSelectionPage from "@/pages/UserSelectionPage";
import { ClientSidebarProvider } from "@/contexts/ClientSidebarContext";
import { ClientSidebar } from "@/components/ClientSidebar";
import { useLocation } from "@tanstack/react-router";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const [hasCompanies, setHasCompanies] = useState<boolean | null>(null);
  const [company, setCompany] = useState<any>(null);
  const { currentUser, isLoading: isUserLoading } = useUser();
  const location = useLocation();
  
  const updateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };
  
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Check if there are any companies in the system
        const companies = await window.electronAPI.db('getAllCompanies');
        setHasCompanies(companies.length > 0);

        // Load company data for control center
        const companyData = sessionStorage.getItem('controlCenterCompany');
        if (companyData) {
          setCompany(JSON.parse(companyData));
        }

        // Load settings only if we have companies
        if (companies.length > 0) {
          const dbSettings = await getSettings();
          if (dbSettings) {
            setSettings(dbSettings);
            // Apply current user's theme colors, not clinic settings
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
    if (settings?.clinic_logo_path) {
      const img = new Image();
      img.src = settings.clinic_logo_path;
      img.onload = () => setIsLogoLoaded(true);
      img.onerror = () => setIsLogoLoaded(true); // Treat error as loaded to not block UI
    } else {
      setIsLogoLoaded(true); // No logo to load
    }
  }, [settings]);

  const isLoading = isUserLoading || isSettingsLoading || hasCompanies === null;

  // Routes that should not show sidebar (welcome screen, setup wizard, clinic entrance, user selection)
  const noSidebarRoutes = ['/', '/setup-wizard', '/clinic-entrance', '/user-selection'];
  const shouldShowSidebar = !noSidebarRoutes.some(route =>
    location.pathname === route || location.pathname.startsWith(route)
  );

  // Control center routes
  const controlCenterRoutes = ['/control-center/dashboard', '/control-center/users', '/control-center/clinics'];
  const isControlCenterRoute = controlCenterRoutes.some(route =>
    location.pathname.startsWith(route)
  );

  // Routes that require user authentication (clinic-specific routes)
  const clinicRoutes = ['/dashboard', '/clients', '/exams', '/orders', '/appointments', '/settings', '/campaigns'];
  const requiresUser = clinicRoutes.some(route =>
    location.pathname.startsWith(route)
  );

  return (
    <>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <SettingsContext.Provider value={{ settings, updateSettings }}>
          <ClientSidebarProvider>
            {isLoading ? (
              <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-foreground text-xl">טוען...</div>
              </div>
            ) : hasCompanies === false && !['/', '/control-center', '/setup-wizard', '/clinic-entrance', '/user-selection'].includes(location.pathname) ? (
              // If no companies exist and not on allowed routes, redirect to welcome
              <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-foreground text-xl">מפנה למסך הבית...</div>
                {setTimeout(() => window.location.href = '/', 100)}
              </div>
            ) : isControlCenterRoute && !currentUser ? (
              // For control center routes, redirect to control center login if no user
              <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-foreground text-xl">מפנה למרכז הבקרה...</div>
                {setTimeout(() => window.location.href = '/control-center', 100)}
              </div>
            ) : requiresUser && !currentUser ? (
              // Show user selection only for clinic routes that require authentication
              <UserSelectionPage />
            ) : isControlCenterRoute && currentUser ? (
              // Show control center sidebar layout
              <div className="flex flex-col h-screen">
                <DragWindowRegion title="" />
                <div className="flex-1 flex overflow-hidden">
                  <SidebarProvider dir="rtl">
                    <ControlCenterSidebar
                      variant="inset"
                      side="right"
                      company={company}
                      currentUser={currentUser}
                    />
                    <SidebarInset className="flex flex-col flex-1 overflow-hidden" style={{scrollbarWidth: 'none'}}>
                      <div className="flex flex-col h-full">
                        <div className="sticky top-0 bg-background">
                          <div id="header-container" />
                        </div>
                        <main className="flex-1 overflow-auto bg-muted/50 flex" style={{scrollbarWidth: 'none'}}>
                          <div className="flex-1 overflow-auto">
                            {children}
                          </div>
                        </main>
                      </div>
                    </SidebarInset>
                  </SidebarProvider>
                </div>
              </div>
            ) : shouldShowSidebar && currentUser ? (
              // Show clinic sidebar layout for clinic routes with authenticated user
              <div className="flex flex-col h-screen">
                <DragWindowRegion title="" />
                <div className="flex-1 flex overflow-hidden">
                  <SidebarProvider dir="rtl">
                    <AppSidebar
                      variant="inset"
                      side="right"
                      clinicName={settings?.clinic_name}
                      currentUser={currentUser}
                      logoPath={settings?.clinic_logo_path}
                      isLogoLoaded={isLogoLoaded}
                    />
                    <SidebarInset className="flex flex-col flex-1 overflow-hidden" style={{scrollbarWidth: 'none'}}>
                      <div className="flex flex-col h-full">
                        <div className="sticky top-0 bg-background">
                          <div id="header-container" />
                        </div>
                        <main className="flex-1 overflow-auto bg-muted/50 flex" style={{scrollbarWidth: 'none'}}>
                          <div className="flex-1 overflow-auto">
                            {children}
                          </div>
                          <ClientSidebar />
                        </main>
                      </div>
                    </SidebarInset>
                  </SidebarProvider>
                </div>
              </div>
            ) : (
              // Show simple layout without sidebar for welcome screen, setup wizard
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
