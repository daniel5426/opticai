import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { opticPlusLabel, opticPlusDisplayValue } from '@/lib/opticplus-cards';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function ImportedProfileHistory({clientId}: {clientId: number}) {
  const {t, i18n} = useTranslation();
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setValues(null); setOpen(false);
    if (clientId) apiClient.getImportedProfileHistory(clientId).then(result => {
      if (!cancelled && result.data?.available) setValues(result.data.values);
    }).catch(() => { /* The ordinary client details remain usable if reference data is unavailable. */ });
    return () => {cancelled = true;};
  }, [clientId]);
  if (!values) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" className="gap-2">
      {t('opticplusCards.profileHistory.button')}<History className="h-4 w-4" />
    </Button></PopoverTrigger>
    <PopoverContent dir={i18n.dir()} align="end" sideOffset={6} className="w-80 max-w-[calc(100vw-2rem)] p-3 text-start text-xs">
      <p className="mb-2 font-medium">{t('opticplusCards.profileHistory.title')}</p>
      <dl className="max-h-64 space-y-2 overflow-y-auto">
        {Object.entries(values).map(([field, value]) => <div key={field} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-x-3">
          <dt className="break-words text-muted-foreground">{i18n.exists(`opticplusCards.tableFields.cust_list.${field}`) || i18n.exists(`opticplusCards.fields.${field}`) ? opticPlusLabel(t, field, 'cust_list') : field}</dt>
          <dd className="whitespace-pre-wrap break-words">{value == null || value === '' ? '—' : opticPlusDisplayValue(t, value, i18n.language)}</dd>
        </div>)}
      </dl>
      <p className="mt-2 text-muted-foreground">{t('opticplusCards.profileHistory.hint')}</p>
    </PopoverContent>
  </Popover>;
}
