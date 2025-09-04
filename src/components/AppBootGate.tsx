import React, { useState, useEffect } from 'react';
import { OctahedronLoader } from '@/components/ui/octahedron-loader';
import { apiClient } from '@/lib/api-client';

interface AppBootGateProps {
  children: React.ReactNode;
}

export function AppBootGate({ children }: AppBootGateProps) {
  const [isBooted, setIsBooted] = useState(false);

  useEffect(() => {
    const bootApp = async () => {
      try {
        // 1. Apply theme from localStorage FIRST
        const savedUserData = localStorage.getItem('currentUser');
        if (savedUserData) {
          const user = JSON.parse(savedUserData);
          const root = document.documentElement;
          
          // Apply theme preference
          const themeKey = user.id ? `user_theme_${user.id}` : 'theme';
          const themePref = localStorage.getItem(themeKey) || user.theme_preference || 'system';
          
          const themeMode = (window as any).themeMode;
          if (themeMode) {
            if (themePref === 'dark') {
              await themeMode.dark();
              root.classList.add('dark');
            } else if (themePref === 'light') {
              await themeMode.light();
              root.classList.remove('dark');
            } else {
              const isDark = await themeMode.system();
              root.classList.toggle('dark', isDark);
            }
          }
          
          // Apply colors if in light mode
          if (!root.classList.contains('dark') && (user.primary_theme_color || user.secondary_theme_color)) {
            if (user.primary_theme_color) {
              const primaryHsl = hexToHsl(user.primary_theme_color);
              root.style.setProperty('--primary', primaryHsl);
            }
            
            if (user.secondary_theme_color) {
              const secondaryHsl = hexToHsl(user.secondary_theme_color);
              root.style.setProperty('--secondary', secondaryHsl);
            }
          }
        }

        // 2. Check companies to determine app state
        const companiesResponse = await apiClient.getCompaniesPublic();
        const hasCompanies = (companiesResponse.data || []).length > 0;
        
        // Store this for BaseLayout to use
        sessionStorage.setItem('hasCompanies', String(hasCompanies));
        
        // Small delay to ensure CSS is applied
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Mark body as ready to show content
        document.body.classList.add('app-ready');
        
      } catch (error) {
        console.error('Boot error:', error);
        // Even on error, show the app
        document.body.classList.add('app-ready');
      } finally {
        setIsBooted(true);
      }
    };

    bootApp();
  }, []);

  // Show loader until boot is complete
  if (!isBooted) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <OctahedronLoader size="3xl" />
      </div>
    );
  }

  return <>{children}</>;
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
