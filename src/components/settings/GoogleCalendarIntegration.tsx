import { GoogleCalendarRouting } from './GoogleCalendarRouting';
import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconAlertCircle, IconArrowDown, IconArrowUp, IconCalendarEvent, IconCheck, IconClock, IconLoader2, IconPlug, IconRefresh, IconShieldLock } from '@tabler/icons-react';
import { useUser } from '@/contexts/UserContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

export interface CalendarStatus {
  connected: boolean;
  email: string | null;
  enabled: boolean;
  pending: number;
  failed: number;
  reconnect: number;
  import_enabled?: boolean;
  import_failed?: boolean;
  import_rejected?: number;
}

type Action = 'connect' | 'disconnect' | 'sync' | 'preferences';

function SyncSetting({ title, description, icon: Icon, checked, disabled, onChange }: {
  title: string; description: string; icon: typeof IconArrowUp; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return <div className="flex items-center gap-3 px-3.5 py-3 sm:px-4">
    <Icon className="size-4 shrink-0 text-muted-foreground" stroke={1.75} aria-hidden />
    <div className="min-w-0 flex-1 space-y-0.5">
      <Label htmlFor={id} className="block leading-snug">{title}</Label>
      <p id={`${id}-description`} className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
    <Switch id={id} aria-describedby={`${id}-description`} checked={checked} disabled={disabled} onCheckedChange={onChange} />
  </div>;
}

export function GoogleCalendarIntegration() {
  const { t, i18n } = useTranslation();
  const { direction, locale } = useAppLocale();
  const { currentUser } = useUser();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const revision = useRef(0);
  const titleId = useId();
  const busy = action !== null;
  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    setStatus(null);
    const load = async () => {
      const requestedRevision = revision.current;
      try {
        const value = await apiClient.googleCalendarRequest<CalendarStatus>('status');
        if (active && requestedRevision === revision.current && !inFlight.current) {
          setStatus(value);
          setError(previous => previous === 'googleCalendar.failed' ? null : previous);
        }
      } catch { if (active && requestedRevision === revision.current && !inFlight.current) setError('googleCalendar.failed'); }
    };
    void load();
    const timer = setInterval(() => { if (!inFlight.current) void load(); }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [currentUser?.id]);

  const act = async (action: Action, preferences?: { enabled?: boolean; import_enabled?: boolean }) => {
    if (inFlight.current || !currentUser) return;
    inFlight.current = true;
    revision.current += 1;
    setAction(action); setError(null);
    try {
      let body: unknown = {};
      if (action === 'connect') {
        const result = await window.electronAPI.googleOAuthAuthenticate(locale);
        if (result.success === false || !result.tokens?.access_token) {
          const key = result.error;
          setError(key?.startsWith('authLogin.google.') && i18n.exists(key) ? key : 'googleCalendar.connectionFailed');
          return;
        }
        body = { access_token: result.tokens.access_token, refresh_token: result.tokens.refresh_token };
      } else if (action === 'preferences') body = preferences;
      const value = await apiClient.googleCalendarRequest<CalendarStatus>(action, body);
      // Calendar status is independent of the profile. Replacing the user
      // would reinitialize Settings and discard its local drafts.
      setStatus(value);
    } catch (failure) {
      const key = failure instanceof Error && failure.message.startsWith('googleCalendar.') ? failure.message : 'googleCalendar.failed';
      setError(key);
    } finally { inFlight.current = false; setAction(null); }
  };

  const reconnect = !!status?.reconnect;
  const connected = !!status?.connected;
  const ConnectIcon = action === 'connect' ? IconLoader2 : IconPlug;
  const RefreshIcon = action === 'sync' ? IconLoader2 : IconRefresh;
  const hasSyncIssue = !!(reconnect || status?.failed || status?.import_failed || status?.import_rejected);
  return <Card dir={direction} role="region" aria-labelledby={titleId} className="gap-0 py-0 text-start">
    <CardHeader className="flex flex-wrap items-center justify-between gap-x-5 gap-y-4 px-4 py-5 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <IconCalendarEvent className="size-6" stroke={1.75} aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 id={titleId} className="font-semibold leading-tight">{t('googleCalendar.title')}</h3>
            {status && <Badge variant="secondary" className={reconnect ? 'bg-destructive/10 text-red-700 dark:text-red-300' : connected ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground'}>
              {reconnect ? <IconAlertCircle aria-hidden /> : connected ? <IconCheck aria-hidden /> : null}
              {t(reconnect ? 'googleCalendar.needsReconnect' : connected ? 'googleCalendar.connectedBadge' : 'googleCalendar.disconnectedBadge')}
            </Badge>}
          </div>
          {connected && status?.email
            ? <p className="break-all text-sm text-muted-foreground"><bdi>{status.email}</bdi></p>
            : <p className="text-sm text-muted-foreground">{t('googleCalendar.description')}</p>}
        </div>
      </div>
      {status && (!connected || reconnect ? <Button disabled={busy} onClick={() => void act('connect')} className="motion-safe:active:scale-[0.96]">
        {t(reconnect ? 'googleCalendar.reconnectButton' : 'googleCalendar.connect')}
        <ConnectIcon className={action === 'connect' ? 'motion-safe:animate-spin' : undefined} stroke={2} aria-hidden />
      </Button> : <Button variant="outline" disabled={busy} onClick={() => void act('sync')} className="motion-safe:active:scale-[0.96]">
        {t(status.import_enabled ? 'googleCalendar.exportNow' : 'googleCalendar.sync')}
        <RefreshIcon className={action === 'sync' ? 'motion-safe:animate-spin' : undefined} stroke={2} aria-hidden />
      </Button>)}
    </CardHeader>
    <CardContent className="space-y-5 px-4 pb-4 sm:px-6 sm:pb-5">
      {!status && !error && <div role="status" className="space-y-2">
        <span className="sr-only">{t('googleCalendar.loading')}</span>
        <Skeleton className="h-12 rounded-lg" />
      </div>}
      <div role="status" aria-live="polite" className={hasSyncIssue ? 'flex gap-2.5 rounded-lg bg-destructive/5 px-3 py-2.5 text-sm text-red-700 dark:text-red-300' : 'sr-only'}>
        {hasSyncIssue && <IconAlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
        <div className="space-y-1">
          {busy && <p>{t('googleCalendar.working')}</p>}
          {reconnect && <p>{t('googleCalendar.reconnect')}</p>}
          {!!status?.failed && <p>{t('googleCalendar.failedCount', { count: status.failed })}</p>}
          {status?.import_failed && <p>{t('googleCalendar.importFailed')}</p>}
          {!!status?.import_rejected && <p>{t('googleCalendar.importRejected', { count: status.import_rejected })}</p>}
        </div>
      </div>
      {error && <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-destructive/5 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
        <IconAlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /><p>{t(error)}</p>
      </div>}
      {status?.connected && <>
        <section className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">{t('googleCalendar.syncSettings')}</h4>
            <Badge variant="secondary" className="text-muted-foreground">
              {t(reconnect || !status.enabled ? 'googleCalendar.syncPaused' : status.import_enabled ? 'googleCalendar.twoWay' : 'googleCalendar.oneWay')}
            </Badge>
          </div>
          <div className="divide-y divide-border/70 rounded-lg border border-border/70">
            <SyncSetting title={t('googleCalendar.autoSync')} description={t('googleCalendar.autoSyncHint')} icon={IconArrowUp}
              checked={status.enabled} disabled={busy || reconnect} onChange={value => void act('preferences', { enabled: value })} />
            {status.import_enabled !== undefined && <SyncSetting title={t('googleCalendar.importEdits')}
              description={t(status.enabled ? 'googleCalendar.importHint' : 'googleCalendar.enableAutoSync')} icon={IconArrowDown}
              checked={status.import_enabled} disabled={busy || reconnect || !status.enabled} onChange={value => void act('preferences', { import_enabled: value })} />}
          </div>
          {!reconnect && (status.pending > 0 || !hasSyncIssue) && <div role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {status.pending > 0 ? <IconClock className="size-3.5" aria-hidden /> : <IconCheck className="size-3.5" aria-hidden />}
            {t(status.pending > 0 ? 'googleCalendar.pending' : 'googleCalendar.ready', { count: status.pending })}
          </div>}
        </section>
        <GoogleCalendarRouting key={`${currentUser?.id}:${status.email}`} disabled={busy || reconnect} />
      </>}
      {status && <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 border-t border-border/70 pt-3.5">
        <div className="flex min-w-0 flex-1 basis-60 items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <IconShieldLock className="mt-0.5 size-4 shrink-0" stroke={1.75} aria-hidden />
          <p>{t('googleCalendar.dataHint')}</p>
        </div>
        {connected && <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
          <DialogTrigger asChild><Button variant="ghost" disabled={busy} className="-my-1.5 text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200">
            {t('googleCalendar.disconnect')}
          </Button></DialogTrigger>
          <DialogContent dir={direction} className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('googleCalendar.disconnectTitle')}</DialogTitle>
              <DialogDescription>{t('googleCalendar.disconnectHint')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t('googleCalendar.cancel')}</Button></DialogClose>
              <Button variant="destructive" disabled={busy} className="bg-red-700 hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700"
                onClick={() => { setDisconnectOpen(false); void act('disconnect'); }}>
                {t('googleCalendar.disconnect')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}
      </div>}
    </CardContent>
  </Card>;
}
