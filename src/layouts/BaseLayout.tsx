import React, { useState, useEffect } from "react";
import DragWindowRegion from "@/components/DragWindowRegion";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getSettings } from "@/lib/db/settings-db";
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers";
import { Settings } from "@/lib/db/schema";
import { useUser } from "@/contexts/UserContext";
import { SettingsContext } from "@/contexts/SettingsContext";
import UserSelectionPage from "@/pages/UserSelectionPage";
import { ClientSidebarProvider } from "@/contexts/ClientSidebarContext";
import { ClientSidebar } from "@/components/ClientSidebar";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const { currentUser, isLoading: isUserLoading } = useUser();
  
  const updateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };
  
  useEffect(() => {
    const loadInitialSettings = async () => {
      try {
        const dbSettings = await getSettings();
        if (dbSettings) {
          setSettings(dbSettings);
          // Apply current user's theme colors, not clinic settings
          if (currentUser?.id) {
            applyThemeColorsFromSettings(undefined, currentUser.id);
          }
        }
      } finally {
        setIsSettingsLoading(false);
      }
    };
    loadInitialSettings();
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

  const isLoading = isUserLoading || isSettingsLoading;

  return (
    <>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <SettingsContext.Provider value={{ settings, updateSettings }}>
          <ClientSidebarProvider>
            {isLoading ? (
              <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-foreground text-xl">טוען...</div>
              </div>
            ) : !currentUser ? (
              <UserSelectionPage />
            ) : (
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
                        <main id="main-content" className="flex-1 overflow-auto bg-muted/50 grid grid-cols-[1fr_auto]" style={{scrollbarWidth: 'none'}}>
                          <div className="flex-1 overflow-auto min-w-0">
                            {children}
                          </div>
                          <ClientSidebar />
                        </main>
                      </div>
                    </SidebarInset>
                  </SidebarProvider>
                </div>
              </div>
            )}
          </ClientSidebarProvider>
        </SettingsContext.Provider>
        <Toaster />
      </ThemeProvider>
    </>
  );
}
