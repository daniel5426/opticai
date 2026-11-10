import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useAppLocale } from '@/localization/use-app-locale';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Route = { calendar_id?: string; all_workers?: boolean; workers?: number[]; creation_pending?: boolean };
interface Routing { clinics: { id: number; name: string }[]; workers: { id: number; name: string }[]; routes: Record<string, Route>; can_include_workers: boolean }
interface Calendar { id: string; name: string; primary?: boolean }
export function GoogleCalendarRouting() {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const [data, setData] = useState<Routing | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [clinic, setClinic] = useState('');
  const [draft, setDraft] = useState<Route>({});
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: 'load' | 'save' | 'create') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      let routing: Routing;
      if (action === 'load') routing = await apiClient.googleCalendarRequest<Routing>('routing');
      else if (action === 'save') routing = await apiClient.googleCalendarRequest<Routing>('routing', { clinic_id: Number(clinic), calendar_id: draft.calendar_id || 'primary', all_workers: !!draft.all_workers, workers: draft.all_workers ? [] : (draft.workers || []).filter(id => data?.workers.some(w => w.id === id)) }, 'PUT');
      else routing = await apiClient.googleCalendarRequest<Routing>('calendars', { clinic_id: Number(clinic) });
      setData(routing);
      const selected = clinic || String(routing.clinics[0]?.id || '');
      setClinic(selected); setDraft(routing.routes[selected] || {});
      setCalendars(await apiClient.googleCalendarRequest<Calendar[]>('calendars'));
    } catch (e) { setError(e instanceof Error && e.message.startsWith('googleCalendar.') ? e.message : 'googleCalendar.failed'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <div className="space-y-3 border-t pt-4" dir={direction}>
    <Button variant="outline" disabled={busy} onClick={() => void run('load')}>{t('googleCalendar.routing')}</Button>
    {data && <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('googleCalendar.routingHint')}</p>
      <Label htmlFor="calendar-clinic">{t('googleCalendar.clinic')}</Label>
      <Select dir={direction} value={clinic} disabled={busy} onValueChange={value => { setClinic(value); setDraft(data.routes[value] || {}); }}>
        <SelectTrigger id="calendar-clinic"><SelectValue /></SelectTrigger>
        <SelectContent>{data.clinics.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
      </Select>
      {clinic && <>
        <Label htmlFor="calendar-destination">{t('googleCalendar.destination')}</Label>
        <Select dir={direction} value={draft.calendar_id || 'primary'} disabled={busy} onValueChange={value => setDraft({ ...draft, calendar_id: value })}>
          <SelectTrigger id="calendar-destination"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">{t('googleCalendar.primary')}</SelectItem>
            {calendars.filter(c => !c.primary).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            {draft.calendar_id && draft.calendar_id !== 'primary' && !calendars.some(c => c.id === draft.calendar_id) && <SelectItem value={draft.calendar_id}>{t('googleCalendar.calendarUnavailable')}</SelectItem>}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={busy || draft.creation_pending} onClick={() => void run('create')}>{t('googleCalendar.createCalendar')}</Button>
        {draft.creation_pending && <p role="alert" className="text-sm">{t('googleCalendar.creationUncertain')}</p>}
        {data.can_include_workers && <div className="space-y-2">
          <p className="font-medium text-sm">{t('googleCalendar.ownerOverview')}</p>
          <div className="flex items-center gap-2"><Checkbox id="calendar-all-workers" disabled={busy} checked={!!draft.all_workers} onCheckedChange={value => setDraft({ ...draft, all_workers: value === true })} /><Label htmlFor="calendar-all-workers">{t('googleCalendar.allWorkers')}</Label></div>
          {!draft.all_workers && data.workers.map(w => <div className="flex items-center gap-2" key={w.id}>
            <Checkbox id={`calendar-worker-${w.id}`} disabled={busy} checked={(draft.workers || []).includes(w.id)} onCheckedChange={value => setDraft({ ...draft, workers: value ? [...(draft.workers || []), w.id] : (draft.workers || []).filter(id => id !== w.id) })} /><Label htmlFor={`calendar-worker-${w.id}`}>{w.name}</Label>
          </div>)}
        </div>}
        <Button disabled={busy} onClick={() => void run('save')}>{t('googleCalendar.saveRouting')}</Button>
      </>}
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  </div>;
}
