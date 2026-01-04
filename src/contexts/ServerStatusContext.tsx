import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServerStatusContextType {
  isServerDown: boolean;
  isChecking: boolean;
  checkServerHealth: () => Promise<void>;
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(undefined);

const getHealthCheckUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';
  return apiUrl.replace(/\/api\/v1$/, '');
};

interface ServerStatusProviderProps {
  children: ReactNode;
}

export function ServerStatusProvider({ children }: ServerStatusProviderProps) {
  const [isServerDown, setIsServerDown] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkServerHealth = async () => {
    setIsChecking(true);
    try {
      const baseUrl = getHealthCheckUrl();
      const res = await fetch(`${baseUrl}/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      setIsServerDown(!res.ok);
    } catch (error) {
      console.error('[ServerStatus] Health check failed:', error);
      setIsServerDown(true);
    } finally {
      setIsChecking(false);
    }
  };

  // Initial health check on mount
  useEffect(() => {
    checkServerHealth();
  }, []);

  // Periodic health check every 30 seconds when server is down
  useEffect(() => {
    if (isServerDown) {
      const interval = setInterval(checkServerHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [isServerDown]);

  // Listen for API client errors (network failures)
  useEffect(() => {
    const handleApiError = (event: CustomEvent) => {
      if (event.detail?.isNetworkError) {
        setIsServerDown(true);
      }
    };

    window.addEventListener('api:network-error' as any, handleApiError);
    return () => window.removeEventListener('api:network-error' as any, handleApiError);
  }, []);

  return (
    <ServerStatusContext.Provider value={{ isServerDown, isChecking, checkServerHealth }}>
      {children}
      {isServerDown && (
        <div
          className="fixed inset-0 bg-muted flex flex-col items-center justify-center p-6 md:p-10"
          dir="rtl"
          style={{ scrollbarWidth: 'none', zIndex: 9999 }}
        >
          <div className={cn('w-full max-w-sm md:max-w-3xl')}>
            <Card className="overflow-hidden p-0">
              <CardContent className="flex h-[360px] flex-col items-center justify-center gap-4 p-8 text-center">
                <AlertTriangle className="h-10 w-10 text-yellow-500" />
                <h1 className="text-2xl font-bold">הפלטפורמה אינה זמינה כרגע</h1>
                <p className="text-muted-foreground">אנחנו מקווים לחזור לפעילות ממש בקרוב</p>
                <div className="mt-2">
                  <Button
                    onClick={checkServerHealth}
                    disabled={isChecking}
                    className="bg-general-primary hover:bg-general-primary/80"
                  >
                    {isChecking ? 'בודק...' : 'נסה שוב'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </ServerStatusContext.Provider>
  );
}

export const useServerStatus = () => {
  const context = useContext(ServerStatusContext);
  if (context === undefined) {
    throw new Error('useServerStatus must be used within a ServerStatusProvider');
  }
  return context;
};

