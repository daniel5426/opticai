import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { canvasSurfaceClassName } from '@/components/ui/canvas-surface';
import type { ExportSnapshot } from '@/lib/table-exports';
import { TableExportDialog } from './TableExportDialog';

export function TableExportButton({ snapshot }: { snapshot: ExportSnapshot }) {
  const { t } = useTranslation();
  const { currentUser, currentClinic } = useUser();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState(snapshot);
  const [version, setVersion] = useState(0);
  const key = `${currentUser?.company_id}:${currentUser?.id}:${snapshot.table}:${snapshot.clinicId ?? 'all'}`;
  return <>
    <Tooltip><TooltipTrigger asChild>
      <Button ref={triggerRef} type="button" variant="outline" size="icon" className={`${canvasSurfaceClassName} h-9 w-9`} aria-haspopup="dialog" aria-expanded={open} aria-label={t('tableExport.export')} onClick={() => { setInitial({ ...snapshot, clinicName: snapshot.clinicId === currentClinic?.id ? currentClinic.name || snapshot.clinicName : snapshot.clinicName }); setVersion(v => v + 1); setOpen(true); }}>
        <Download className="h-4 w-4" aria-hidden="true" />
      </Button>
    </TooltipTrigger><TooltipContent>{t('tableExport.export')}</TooltipContent></Tooltip>
    {open && <TableExportDialog key={`${key}:${version}`} open={open} onOpenChange={setOpen} snapshot={initial} taskKey={key} triggerRef={triggerRef} />}
  </>;
}
