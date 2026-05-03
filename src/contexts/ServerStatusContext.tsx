import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServerStatusContextType {
  isServerDown: boolean;
  isClientOffline: boolean;
  isChecking: boolean;
  checkServerHealth: () => Promise<void>;
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(undefined);

type ConnectionIssue = 'server' | 'client-offline' | null;

const getHealthCheckUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';

  try {
    const url = new URL(apiUrl);
    if (url.hostname === '0.0.0.0') {
      url.hostname = 'localhost';
    }
    return url.toString().replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  } catch {
    return apiUrl
      .replace('://0.0.0.0', '://localhost')
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/$/, '');
  }
};

const getFallbackHealthCheckUrl = (baseUrl: string) => {
  try {
    const url = new URL(baseUrl);
    if (url.hostname !== 'localhost') return null;
    if (url.port === '8000') {
      url.port = '8001';
      return url.toString().replace(/\/$/, '');
    }
    if (url.port === '8001') {
      url.port = '8000';
      return url.toString().replace(/\/$/, '');
    }
    return null;
  } catch {
    if (baseUrl.includes('localhost:8000')) {
      return baseUrl.replace('localhost:8000', 'localhost:8001');
    }
    if (baseUrl.includes('localhost:8001')) {
      return baseUrl.replace('localhost:8001', 'localhost:8000');
    }
    return null;
  }
};

const isClientOffline = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

interface ServerStatusProviderProps {
  children: ReactNode;
}

export function ServerStatusProvider({ children }: ServerStatusProviderProps) {
  const [connectionIssue, setConnectionIssue] = useState<ConnectionIssue>(null);
  const [isChecking, setIsChecking] = useState(true);
  const serverDown = connectionIssue === 'server';
  const clientOffline = connectionIssue === 'client-offline';

  const checkServerHealth = async () => {
    setIsChecking(true);
    if (isClientOffline()) {
      setConnectionIssue('client-offline');
      setIsChecking(false);
      return;
    }

    try {
      const baseUrl = getHealthCheckUrl();
      let res: Response;

      try {
        res = await fetch(`${baseUrl}/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000)
        });
      } catch (primaryError) {
        const fallbackUrl = getFallbackHealthCheckUrl(baseUrl);
        if (!fallbackUrl) throw primaryError;

        res = await fetch(`${fallbackUrl}/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000)
        });
      }

      setConnectionIssue(res.ok ? null : 'server');
    } catch (error) {
      console.error('[ServerStatus] Health check failed:', error);
      setConnectionIssue(isClientOffline() ? 'client-offline' : 'server');
    } finally {
      setIsChecking(false);
    }
  };

  // Initial health check on mount
  useEffect(() => {
    checkServerHealth();
  }, []);

  // Periodic health check every 30 seconds while the app cannot reach the API
  useEffect(() => {
    if (connectionIssue) {
      const interval = setInterval(checkServerHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [connectionIssue]);

  useEffect(() => {
    const handleOffline = () => {
      setConnectionIssue('client-offline');
      setIsChecking(false);
    };
    const handleOnline = () => {
      checkServerHealth();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Listen for API client errors (network failures)
  useEffect(() => {
    const handleApiError = (event: CustomEvent) => {
      if (event.detail?.isNetworkError) {
        setConnectionIssue(isClientOffline() ? 'client-offline' : 'server');
      }
    };

    window.addEventListener('api:network-error' as any, handleApiError);
    return () => window.removeEventListener('api:network-error' as any, handleApiError);
  }, []);

  return (
    <ServerStatusContext.Provider
      value={{
        isServerDown: serverDown,
        isClientOffline: clientOffline,
        isChecking,
        checkServerHealth
      }}
    >
      {children}
      {connectionIssue && (
        <div
          className="fixed inset-0 bg-muted flex flex-col items-center justify-center p-6 md:p-10"
          dir="rtl"
          style={{ scrollbarWidth: 'none', zIndex: 9999 }}
        >
          <div className={cn('w-full max-w-sm md:max-w-3xl')}>
            <Card className="overflow-hidden p-0">
              <CardContent className="flex h-[360px] flex-col items-center justify-center gap-4 p-8 text-center">
                <AlertTriangle className="h-10 w-10 text-yellow-500" />
                <h1 className="text-2xl font-bold">
                  {clientOffline ? 'אין חיבור לאינטרנט' : 'הפלטפורמה אינה זמינה כרגע'}
                </h1>
                <p className="text-muted-foreground">
                  {clientOffline
                    ? 'נראה שהמחשב לא מחובר לאינטרנט. בדקו את ה-Wi-Fi ונסו שוב'
                    : 'אנחנו מקווים לחזור לפעילות ממש בקרוב'}
                </p>
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
