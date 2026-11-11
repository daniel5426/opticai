import React from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '@/localization/use-app-locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function OrderPrescriptionTitle({ contact = false }: { contact?: boolean }) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  return <h3 className="font-medium text-primary" dir={direction}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex items-center gap-1.5 cursor-help rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t(contact ? 'orderPrescriptionContactTitle' : 'orderPrescriptionFinalTitle')}
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent dir={direction} className="max-w-64 text-center" sideOffset={6}>
        {t(contact ? 'orderPrescriptionContactSourceHint' : 'orderPrescriptionSourceHint')}
      </TooltipContent>
    </Tooltip>
  </h3>;
}
