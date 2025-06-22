import React, { useState, useEffect, createContext, useContext } from "react";
import DragWindowRegion from "@/components/DragWindowRegion";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getSettings } from "@/lib/db/settings-db";
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers";
import { Settings } from "@/lib/db/schema";
import { useUser } from "@/contexts/UserContext";
import UserSelectionPage from "@/pages/UserSelectionPage";

interface SettingsContextType {
  settings: Settings | null;
  updateSettings: (newSettings: Settings) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within BaseLayout');
  }
  return context;
};

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const { currentUser, isLoading } = useUser();
  
  const updateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };
  
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsData = await getSettings();
        setSettings(settingsData);
        
        if (settingsData) {
          await applyThemeColorsFromSettings(settingsData);
        }
      } catch (error) {
        console.error('Error loading settings in BaseLayout:', error);
      }
    };

    loadSettings();
  }, []);

  return (
    <>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <SettingsContext.Provider value={{ settings, updateSettings }}>
          {isLoading ? (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
              <div className="text-white text-xl">טוען...</div>
            </div>
          ) : !currentUser ? (
            <UserSelectionPage />
          ) : (
            <>
              <DragWindowRegion title="" />
              <SidebarProvider dir="rtl">
                <AppSidebar variant="inset" side="right" clinicName={settings?.clinic_name} currentUser={currentUser} />
                <SidebarInset className="flex flex-col h-screen overflow-hidden" style={{scrollbarWidth: 'none'}}>
                  <main className="flex-1 overflow-auto" style={{scrollbarWidth: 'none'}}>
                    {children}
                  </main>
                </SidebarInset>
              </SidebarProvider>
            </>
          )}
        </SettingsContext.Provider>
        <Toaster />
      </ThemeProvider>
    </>
  );
}
