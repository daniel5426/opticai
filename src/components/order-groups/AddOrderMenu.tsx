import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { ClientOrdersContext } from '@/lib/db/schema-interface';
import { useAppLocale } from '@/localization/use-app-locale';
import { Button } from '@/components/ui/button';
import { ClientSelectModal } from '@/components/ClientSelectModal';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';

type Selection = { kind: 'regular' | 'contact'; source?: 'order' | 'exam' };

function sourceId(context: ClientOrdersContext, selection: Selection) {
  return selection.source === 'exam' ? context.latest_exam_id
    : selection.kind === 'contact' ? context.latest_contact_order_id : context.latest_regular_order_id;
}

export function AddOrderMenu({ clientId, disabled }: { clientId?: number; disabled?: boolean }) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Selection | null>(null);
  const [creating, setCreating] = useState(false);
  const contextOptions = (id: number) => ({
    queryKey: ['client-orders-context', id],
    queryFn: async () => {
      const response = await apiClient.getClientOrdersContext(id);
      if (response.error || !response.data) throw new Error(response.error || 'Missing order context');
      return response.data;
    },
    staleTime: 0,
  });
  const context = useQuery({ ...contextOptions(clientId || 0), enabled: open && Boolean(clientId), retry: false });

  const create = async (id: number, selection: Selection) => {
    setPending(null);
    setCreating(true);
    try {
      let importId: number | null | undefined;
      if (selection.source) {
        const latest = id === clientId && context.data && !context.isError
          ? context.data : await cache.fetchQuery(contextOptions(id));
        importId = sourceId(latest, selection);
        if (!importId) {
          toast.info(t(selection.source === 'exam' ? 'orderGroupNoLastExam' : 'orderGroupNoLastOrder'));
          return;
        }
      }
      await navigate({
        to: '/clients/$clientId/orders/new',
        params: { clientId: String(id) },
        search: {
          ...(selection.kind === 'contact' ? { type: 'contact' } : {}),
          ...(importId ? {
            importSourceId: String(importId),
            importSourceType: selection.source === 'exam' ? 'exam' : 'order-prescription',
          } : {}),
        },
      });
    } catch {
      toast.error(t('orderGroupSourceLoadError'));
    } finally {
      setCreating(false);
    }
  };
  const select = (selection: Selection) => {
    setOpen(false);
    if (clientId) void create(clientId, selection);
    else setPending(selection);
  };

  return <>
    {/* The flyout opens physically right, including in RTL; its text keeps the active direction. */}
    <DropdownMenu dir="ltr" open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button dir={direction} disabled={disabled || creating}><span>{t('orderGroupAddOrder')}</span><Plus className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" dir={direction}>
        {(['regular', 'contact'] as const).map(kind => <DropdownMenuSub key={kind}>
          <DropdownMenuSubTrigger dir="ltr" hideIcon className="justify-between gap-4" onClick={event => {
            event.preventDefault();
            select({ kind });
          }}>
            <span dir={direction}>{t(kind === 'regular' ? 'orderGroupGlasses' : 'orderGroupContact')}</span>
            <ChevronRight className="size-4" />
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal><DropdownMenuSubContent dir={direction} sideOffset={4}>
            <DropdownMenuItem onSelect={() => select({ kind })}>{t('orderGroupEmptyOrder')}</DropdownMenuItem>
            {(['order', 'exam'] as const).map(source => <DropdownMenuItem key={source}
              disabled={Boolean(clientId) && (context.isFetching || !context.data || !sourceId(context.data, { kind, source }))}
              onSelect={() => select({ kind, source })}>
              {t(source === 'order' ? 'orderGroupLastOrder' : 'orderGroupLastExam')}
            </DropdownMenuItem>)}
          </DropdownMenuSubContent></DropdownMenuPortal>
        </DropdownMenuSub>)}
      </DropdownMenuContent>
    </DropdownMenu>
    <ClientSelectModal isOpen={pending !== null} onClose={() => setPending(null)} onClientSelect={id => {
      if (pending) void create(id, pending);
    }} />
  </>;
}
