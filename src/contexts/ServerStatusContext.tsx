import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ServerStatusContextType {
  isServerDown: boolean;
  isClientOffline: boolean;
  isChecking: boolean;
  checkServerHealth: () => Promise<void>;
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(undefined);

export type ConnectionIssue = 'server' | 'client-offline' | null;

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

export async function checkServerConnection(
  baseUrl = getHealthCheckUrl(),
  request: typeof fetch = fetch,
): Promise<ConnectionIssue> {
  try {
    let res: Response;

    try {
      res = await request(`${baseUrl}/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      });
    } catch (primaryError) {
      const fallbackUrl = getFallbackHealthCheckUrl(baseUrl);
      if (!fallbackUrl) throw primaryError;

      res = await request(`${fallbackUrl}/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      });
    }

    return res.ok ? null : 'server';
  } catch (error) {
    console.error('[ServerStatus] Health check failed:', error);
    return isClientOffline() ? 'client-offline' : 'server';
  }
}

interface ServerStatusProviderProps {
  children: ReactNode;
}

export function ServerStatusProvider({ children }: ServerStatusProviderProps) {
  const { t, i18n } = useTranslation();
  const [connectionIssue, setConnectionIssue] = useState<ConnectionIssue>(null);
  const [isChecking, setIsChecking] = useState(true);
  const serverDown = connectionIssue === 'server';
  const clientOffline = connectionIssue === 'client-offline';

  const checkServerHealth = async (showChecking = true) => {
    if (showChecking) setIsChecking(true);

    try {
      setConnectionIssue(await checkServerConnection());
    } finally {
      if (showChecking) setIsChecking(false);
    }
  };

  // Initial health check on mount
  useEffect(() => {
    checkServerHealth();
  }, []);

  // Silent reconnect loop while the app cannot reach the API
  useEffect(() => {
    if (connectionIssue) {
      const interval = setInterval(() => {
        checkServerHealth(false);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [connectionIssue]);

  useEffect(() => {
    const handleOffline = () => {
      void checkServerHealth(false);
    };
    const handleOnline = () => {
      void checkServerHealth();
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
        void checkServerHealth(false);
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
          dir={i18n.dir()}
          style={{ scrollbarWidth: 'none', zIndex: 9999 }}
        >
          <div className={cn('w-full max-w-sm md:max-w-3xl')}>
            <Card className="overflow-hidden p-0">
              <CardContent className="flex h-[360px] flex-col items-center justify-center gap-4 p-8 text-center">
                <AlertTriangle className="h-10 w-10 text-yellow-500" />
                <h1 className="text-2xl font-bold">
                  {clientOffline ? t('offlineTitle') : t('serverUnavailableTitle')}
                </h1>
                <p className="text-muted-foreground">
                  {clientOffline
                    ? t('offlineDescription')
                    : t('serverUnavailableDescription')}
                </p>
                <div className="mt-2">
                  <Button
                    onClick={() => checkServerHealth()}
                    disabled={isChecking}
                    className="bg-general-primary hover:bg-general-primary/80"
                  >
                    {isChecking ? t('checkingConnection') : t('tryAgain')}
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
