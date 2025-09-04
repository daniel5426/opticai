import React, { useEffect, useState } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { ControlCenterSidebar } from '@/components/control-center-sidebar';
import DragWindowRegion from '@/components/DragWindowRegion';

interface LayoutPreloaderProps {
  onReady: () => void;
  isControlCenter?: boolean;
  currentUser?: any;
  currentClinic?: any;
  company?: any;
  settings?: any;
}

export function LayoutPreloader({ 
  onReady, 
  isControlCenter, 
  currentUser, 
  currentClinic,
  company,
  settings 
}: LayoutPreloaderProps) {
  const [componentsLoaded, setComponentsLoaded] = useState(false);

  useEffect(() => {
    // Pre-render components off-screen to ensure they're loaded
    const timer = setTimeout(() => {
      setComponentsLoaded(true);
      // Give components time to fully mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onReady();
        });
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [onReady]);

  if (!componentsLoaded) {
    return (
      <div style={{ position: 'absolute', left: '-9999px', visibility: 'hidden' }}>
        <SidebarProvider dir="rtl">
          <DragWindowRegion title="" />
          {isControlCenter ? (
            <ControlCenterSidebar
              variant="inset"
              side="right"
              company={company}
              currentUser={currentUser}
              currentClinic={currentClinic}
            />
          ) : (
            <AppSidebar
              variant="inset"
              side="right"
              clinicName={currentClinic?.name}
              currentUser={currentUser}
              logoPath={settings?.clinic_logo_path || company?.logo_path}
              isLogoLoaded={true}
              currentClinic={currentClinic}
            />
          )}
        </SidebarProvider>
      </div>
    );
  }

  return null;
}
