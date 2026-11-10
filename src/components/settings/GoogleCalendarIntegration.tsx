import React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconBrandGoogle, IconRefresh } from '@tabler/icons-react';
import { useUser } from '@/contexts/UserContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export interface CalendarStatus {
  connected: boolean;
  email: string | null;
  enabled: boolean;
  pending: number;
  failed: number;
  reconnect: number;
}

export function GoogleCalendarIntegration() {
  const { t } = useTranslation();
  const { direction, locale } = useAppLocale();
  const { currentUser, setCurrentUser } = useUser();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const revision = useRef(0);
  const switchId = useId();
  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    setStatus(null);
    const load = async () => {
      const requestedRevision = revision.current;
      try {
        const value = await apiClient.googleCalendarRequest<CalendarStatus>('status');
        if (active && requestedRevision === revision.current && !inFlight.current) { setStatus(value); setError(null); }
      } catch { if (active && requestedRevision === revision.current && !inFlight.current) setError('googleCalendar.failed'); }
    };
    void load();
    const timer = setInterval(() => { if (!inFlight.current) void load(); }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [currentUser?.id]);

  const act = async (action: 'connect' | 'disconnect' | 'sync' | 'preferences', enabled?: boolean) => {
    if (inFlight.current || !currentUser) return;
    inFlight.current = true;
    revision.current += 1;
    setBusy(true); setError(null);
    try {
      let body: unknown = {};
      if (action === 'connect') {
        const result = await window.electronAPI.googleOAuthAuthenticate(locale);
        if (result.success === false || !result.tokens?.access_token) throw new Error('googleCalendar.connectionFailed');
        body = { access_token: result.tokens.access_token, refresh_token: result.tokens.refresh_token };
      } else if (action === 'preferences') body = { enabled };
      const value = await apiClient.googleCalendarRequest<CalendarStatus>(action, body);
      setStatus(value);
      setCurrentUser({ ...currentUser, google_account_connected: value.connected,
        google_account_email: value.email || undefined, google_calendar_sync_enabled: value.enabled }, true);
    } catch (failure) {
      const key = failure instanceof Error && failure.message.startsWith('googleCalendar.') ? failure.message : 'googleCalendar.failed';
      setError(key);
    } finally { inFlight.current = false; setBusy(false); }
  };

  const reconnect = !!status?.reconnect;
  return <Card dir={direction}>
    <CardHeader className="text-start">
      <CardTitle>{t('googleCalendar.title')}</CardTitle>
      <p className="text-sm text-muted-foreground">{t('googleCalendar.description')}</p>
    </CardHeader>
    <CardContent className="space-y-4 text-start">
      {!status && !error && <p role="status">{t('googleCalendar.loading')}</p>}
      {status && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{t(status.connected ? 'googleCalendar.connected' : 'googleCalendar.disconnected')}</p>
            {status.connected && status.email && <bdi className="block break-all text-sm text-muted-foreground">{status.email}</bdi>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(!status.connected || reconnect) && <Button disabled={busy} onClick={() => void act('connect')}>
              {t(reconnect ? 'googleCalendar.reconnectButton' : 'googleCalendar.connect')}<IconBrandGoogle className="ms-2 h-4 w-4" />
            </Button>}
            {status.connected && <>
              <Button variant="outline" disabled={busy || reconnect} onClick={() => void act('sync')}>
                {t('googleCalendar.sync')}<IconRefresh className="ms-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void act('disconnect')}>{t('googleCalendar.disconnect')}</Button>
            </>}
          </div>
        </div>
        {status.connected && <div className="flex items-center justify-between gap-4">
          <Label htmlFor={switchId}>{t('googleCalendar.autoSync')}</Label>
          <Switch id={switchId} checked={status.enabled} disabled={busy || reconnect} onCheckedChange={value => void act('preferences', value)} />
        </div>}
        <div role="status" aria-live="polite" className="space-y-1 text-sm">
          {busy && <p>{t('googleCalendar.working')}</p>}
          {reconnect ? <p>{t('googleCalendar.reconnect')}</p> : status.pending > 0 ? <p>{t('googleCalendar.pending', { count: status.pending })}</p> : status.connected && <p>{t('googleCalendar.ready')}</p>}
          {status.failed > 0 && <p className="text-destructive">{t('googleCalendar.failedCount', { count: status.failed })}</p>}
        </div>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      <p className="text-sm text-muted-foreground">{t('googleCalendar.dataHint')}</p>
      <p className="text-sm text-muted-foreground">{t('googleCalendar.disconnectHint')}</p>
    </CardContent>
  </Card>;
}
