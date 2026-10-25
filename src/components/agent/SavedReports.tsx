import React from 'react';
import { Bookmark, Play, Pencil, Trash2, Check, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { agentJson } from '@/services/agent-client';

type Saved = { id: string; title: string; revision: number };
export function SavedReports({ compact }: { compact?: boolean }) {
  const workspace = usePrysmAgent();
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const client = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const scope = workspace?.scope;
  const query = useQuery({ queryKey: ['agent-saved-reports', scope?.userId, scope?.clinicId, scope?.patientId],
    enabled: open && Boolean(scope), queryFn: () => agentJson<{ items: Saved[] }>(scope!, '/saved-reports'), retry: false });
  React.useEffect(() => { setOpen(false); setEditing(null); setDeleting(null); setFailed(false); }, [scope?.userId, scope?.clinicId, scope?.patientId]);
  const change = async (action: 'rename' | 'delete', row: Saved) => {
    if (!scope) return;
    setBusy(true); setFailed(false);
    try {
      await agentJson(scope, '/saved-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, report_id: row.id, revision: row.revision, ...(action === 'rename' ? { title } : {}) }) });
      setEditing(null); setDeleting(null); await client.invalidateQueries({ queryKey: ['agent-saved-reports'] });
    } catch { setFailed(true); } finally { setBusy(false); }
  };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button size={compact ? 'icon' : 'sm'} variant="ghost" className="agent-chat-actions__button" aria-label={t('agent.data.savedReports')}>
      {!compact && <span className="hidden md:inline">{t('agent.data.savedReports')}</span>}<Bookmark className="size-4" />
    </Button></PopoverTrigger>
    <PopoverContent dir={direction} align="end" className="w-96 max-w-[calc(100vw-2rem)] p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('agent.data.savedReports')}</p>
      {(failed || query.isError) && <p role="alert" className="mb-2 text-xs text-destructive">{t('agent.operationFailed')}</p>}
      {query.isLoading && <p role="status" className="text-xs text-muted-foreground">{t('loading')}</p>}
      {!query.isLoading && !query.isError && !query.data?.items.length && <p className="py-4 text-sm text-muted-foreground">{t('agent.data.noSavedReports')}</p>}
      <ul className="max-h-80 space-y-1 overflow-y-auto">{query.data?.items.map(row => <li key={row.id} className="rounded-lg p-2 hover:bg-muted">
        {editing === row.id ? <form className="flex items-center gap-1" onSubmit={event => { event.preventDefault(); void change('rename', row); }}>
          <Input aria-label={t('agent.data.reportTitle')} value={title} maxLength={200} onChange={event => setTitle(event.target.value)} autoFocus />
          <Button type="submit" variant="ghost" size="icon" disabled={busy || !title.trim()} aria-label={t('agent.data.save')}><Check className="size-4" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(null)} aria-label={t('agent.cancel')}><X className="size-4" /></Button>
        </form> : <div className="flex items-center gap-1"><span className="min-w-0 flex-1 truncate text-sm" title={row.title}>{row.title}</span>
          <Button variant="ghost" size="icon" aria-label={t('agent.data.run')} disabled={busy || !workspace?.runtime || Boolean(workspace.runtime.controller.activeRunId)} onClick={() => {
            setOpen(false); void workspace?.runtime?.submit({ text: t('agent.data.runSavedPrompt', { id: row.id }), files: [] });
          }}><Play className="size-3.5" /></Button>
          <Button variant="ghost" size="icon" disabled={busy} aria-label={t('agent.data.rename')} onClick={() => { setEditing(row.id); setTitle(row.title); }}><Pencil className="size-3.5" /></Button>
          <Button variant="ghost" size="icon" disabled={busy} aria-label={t('agent.data.delete')} onClick={() => setDeleting(row.id)}><Trash2 className="size-3.5" /></Button>
        </div>}
        {deleting === row.id && <div className="mt-2 flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>{t('agent.cancel')}</Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => void change('delete', row)}>{t('agent.data.delete')}</Button></div>}
      </li>)}</ul>
    </PopoverContent>
  </Popover>;
}
