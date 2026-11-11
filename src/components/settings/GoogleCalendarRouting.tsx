import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconAlertCircle, IconCalendarPlus, IconCheck, IconChevronDown, IconLoader2, IconMapPin, IconRefresh } from '@tabler/icons-react';
import { apiClient } from '@/lib/api-client';
import { useAppLocale } from '@/localization/use-app-locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type Route = { calendar_id?: string; all_workers?: boolean; workers?: number[]; creation_pending?: boolean };
type Action = 'load' | 'save' | 'create';
interface Routing {
  clinics: { id: number; name: string }[];
  workers: { id: number; name: string }[];
  routes: Record<string, Route>;
  can_include_workers: boolean;
}
interface Calendar { id: string; name: string; primary?: boolean }

function routeValues(route: Route, data: Routing | null) {
  const allWorkers = !!data?.can_include_workers && !!route.all_workers;
  return {
    calendar_id: route.calendar_id || 'primary',
    all_workers: allWorkers,
    workers: data?.can_include_workers && !allWorkers
      ? (route.workers || []).filter(id => data.workers.some(worker => worker.id === id)).sort((a, b) => a - b)
      : [],
  };
}

export function GoogleCalendarRouting({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Routing | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [clinic, setClinic] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Route>>({});
  const [action, setAction] = useState<Action | null>(null);
  const inFlight = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [uncertainClinic, setUncertainClinic] = useState<string | null>(null);
  const [savedClinic, setSavedClinic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saved = data?.routes[clinic] || {};
  const draft = drafts[clinic] || saved;
  const values = routeValues(draft, data);
  const dirty = JSON.stringify(values) !== JSON.stringify(routeValues(saved, data));
  const hasDrafts = Object.entries(drafts).some(([key, route]) =>
    JSON.stringify(routeValues(route, data)) !== JSON.stringify(routeValues(data?.routes[key] || {}, data)));
  const busy = disabled || action !== null;
  const destinationUnavailable = values.calendar_id !== 'primary' && !calendars.some(calendar => calendar.id === values.calendar_id);
  const creationUncertain = saved.creation_pending || uncertainClinic === clinic;

  const changeDraft = (changes: Partial<Route>) => {
    setSavedClinic(null);
    setDrafts(current => ({ ...current, [clinic]: { ...draft, ...changes } }));
  };

  const clearDraft = () => {
    setDrafts(current => {
      const next = { ...current };
      delete next[clinic];
      return next;
    });
  };

  const run = async (operation: Action) => {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setAction(operation);
    setError(null);
    setSavedClinic(null);
    let created = false;
    try {
      if (operation === 'load') {
        const [routing, writableCalendars] = await Promise.all([
          apiClient.googleCalendarRequest<Routing>('routing'),
          apiClient.googleCalendarRequest<Calendar[]>('calendars'),
        ]);
        setData(routing);
        setCalendars(writableCalendars);
        setClinic(current => routing.clinics.some(item => String(item.id) === current) ? current : String(routing.clinics[0]?.id || ''));
        setUncertainClinic(null);
      } else if (operation === 'save') {
        const routing = await apiClient.googleCalendarRequest<Routing>('routing', { clinic_id: Number(clinic), ...values }, 'PUT');
        setData(routing);
        clearDraft();
        setSavedClinic(clinic);
        setUncertainClinic(null);
      } else {
        const routing = await apiClient.googleCalendarRequest<Routing>('calendars', { clinic_id: Number(clinic) });
        created = true;
        setData(routing);
        clearDraft();
        setSavedClinic(clinic);
        setCalendars(await apiClient.googleCalendarRequest<Calendar[]>('calendars'));
      }
    } catch (failure) {
      const key = failure instanceof Error && failure.message.startsWith('googleCalendar.') ? failure.message : 'googleCalendar.failed';
      if (operation === 'create' && !created && (key === 'googleCalendar.creationUncertain' || key === 'googleCalendar.failed')) {
        setUncertainClinic(clinic);
      }
      setError(key);
    } finally {
      inFlight.current = false;
      setAction(null);
    }
  };

  return <Collapsible dir={direction} open={open} onOpenChange={value => {
    setOpen(value);
    if (value && !data) void run('load');
  }} className="rounded-lg border border-border/70">
    <CollapsibleTrigger asChild>
      <Button variant="ghost" disabled={disabled} aria-label={t('googleCalendar.routing')} aria-describedby={`${id}-summary`}
        className="group h-auto w-full justify-start gap-3 whitespace-normal rounded-[inherit] px-3.5 py-3 text-start sm:px-4">
        <IconMapPin className="size-4 text-muted-foreground" stroke={1.75} aria-hidden />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block font-semibold leading-snug">{t('googleCalendar.routing')}</span>
          <span id={`${id}-summary`} className="block text-xs font-normal leading-relaxed text-muted-foreground">{t('googleCalendar.routingSummary')}</span>
        </span>
        {!open && hasDrafts && <Badge variant="secondary" className="hidden sm:inline-flex">{t('googleCalendar.unsavedRoutes')}</Badge>}
        <IconChevronDown className="size-4 text-muted-foreground motion-safe:transition-transform group-aria-expanded:rotate-180" aria-hidden />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="border-t border-border/70">
      <div className="space-y-4 p-3.5 sm:p-4">
        {!data && action === 'load' && <div role="status" className="grid gap-3 sm:grid-cols-2">
          <span className="sr-only">{t('googleCalendar.loadingRoutes')}</span>
          <Skeleton className="h-12 rounded-md" /><Skeleton className="h-12 rounded-md" />
        </div>}
        {!data && error && <Button variant="outline" disabled={busy} onClick={() => void run('load')}>{t('googleCalendar.retry')}</Button>}
        {data && !clinic && <p className="text-sm text-muted-foreground">{t('googleCalendar.noClinics')}</p>}
        {data && clinic && <>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-clinic`}>{t('googleCalendar.clinic')}</Label>
              <Select dir={direction} value={clinic} clearable={false} disabled={busy} onValueChange={value => { setClinic(value); setError(null); }}>
                <SelectTrigger id={`${id}-clinic`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{data.clinics.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-destination`}>{t('googleCalendar.destination')}</Label>
              <Select dir={direction} value={values.calendar_id} clearable={false} disabled={busy} onValueChange={value => changeDraft({ calendar_id: value })}>
                <SelectTrigger id={`${id}-destination`} className="w-full" aria-invalid={destinationUnavailable}
                  aria-describedby={destinationUnavailable ? `${id}-unavailable` : undefined}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">{t('googleCalendar.primary')}</SelectItem>
                  {calendars.filter(calendar => !calendar.primary).map(calendar => <SelectItem key={calendar.id} value={calendar.id}>{calendar.name}</SelectItem>)}
                  {destinationUnavailable && <SelectItem value={values.calendar_id} disabled>{t('googleCalendar.unavailableDestination')}</SelectItem>}
                </SelectContent>
              </Select>
              {destinationUnavailable && <p id={`${id}-unavailable`} className="text-xs text-red-700 dark:text-red-300">{t('googleCalendar.calendarUnavailable')}</p>}
              <div className="flex flex-wrap items-center gap-1">
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" disabled={busy || creationUncertain || dirty} className="-ms-2 text-primary hover:text-primary">
                      {t('googleCalendar.createCalendar')}<IconCalendarPlus stroke={2} aria-hidden />
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir={direction} className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>{t('googleCalendar.createCalendar')}</DialogTitle>
                      <DialogDescription>{t('googleCalendar.createCalendarHint')}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">{t('googleCalendar.cancel')}</Button></DialogClose>
                      <Button disabled={busy} onClick={() => { setCreateOpen(false); void run('create'); }}>{t('googleCalendar.createCalendar')}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="icon" disabled={busy} aria-label={t('googleCalendar.refreshCalendars')} title={t('googleCalendar.refreshCalendars')} onClick={() => void run('load')}>
                  <IconRefresh className={action === 'load' ? 'motion-safe:animate-spin' : undefined} stroke={1.75} aria-hidden />
                </Button>
              </div>
            </div>
          </div>
          {creationUncertain && <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/5 p-2.5 text-sm text-red-700 dark:text-red-300">
            <IconAlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{t('googleCalendar.creationUncertain')}
          </p>}
          {data.can_include_workers && <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-semibold">{t('googleCalendar.ownerOverview')}</legend>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('googleCalendar.ownerOverviewHint')}</p>
            <div className="divide-y divide-border/70 rounded-md border border-border/70">
              <div className="flex min-h-9 items-center gap-2.5 px-3">
                <Checkbox id={`${id}-all-workers`} checked={values.all_workers} disabled={busy} onCheckedChange={value => changeDraft({ all_workers: value === true })} />
                <Label htmlFor={`${id}-all-workers`} className="min-h-9 min-w-0 flex-1 cursor-pointer py-2 leading-snug">{t('googleCalendar.allWorkers')}</Label>
              </div>
              {!values.all_workers && (data.workers.length ? <div className="grid max-h-48 gap-x-3 overflow-y-auto p-1.5 sm:grid-cols-2">
                {data.workers.map(worker => <div key={worker.id} className="flex min-h-9 items-center gap-2.5 rounded-sm px-1.5 hover:bg-muted/50">
                  <Checkbox id={`${id}-worker-${worker.id}`} disabled={busy} checked={values.workers.includes(worker.id)} onCheckedChange={value => changeDraft({
                    workers: value === true ? [...values.workers, worker.id] : values.workers.filter(workerId => workerId !== worker.id),
                  })} />
                  <Label htmlFor={`${id}-worker-${worker.id}`} className="min-h-9 min-w-0 flex-1 cursor-pointer break-words py-2 leading-snug">{worker.name}</Label>
                </div>)}
              </div> : <p className="px-3 py-2 text-sm text-muted-foreground">{t('googleCalendar.noWorkers')}</p>)}
            </div>
          </fieldset>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
            <div role="status" className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {action === 'create' ? t('googleCalendar.creatingCalendar') : action === 'save' ? t('googleCalendar.savingRoutes') : action === 'load' ? t('googleCalendar.loadingRoutes') : dirty ? t('googleCalendar.unsavedRoutes') : savedClinic === clinic ? <>
                <IconCheck className="size-3.5" aria-hidden />{t('googleCalendar.savedRoutes')}
              </> : null}
            </div>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {dirty && <Button variant="ghost" disabled={busy} onClick={() => { clearDraft(); setError(null); }}>{t('googleCalendar.discardRoutes')}</Button>}
              <Button disabled={busy || !dirty || destinationUnavailable} onClick={() => void run('save')} className="motion-safe:active:scale-[0.96]">
                {t('googleCalendar.saveRouting')}{action === 'save' && <IconLoader2 className="motion-safe:animate-spin" aria-hidden />}
              </Button>
            </div>
          </div>
        </>}
        {error && error !== 'googleCalendar.creationUncertain' && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t(error)}</p>}
      </div>
    </CollapsibleContent>
  </Collapsible>;
}
