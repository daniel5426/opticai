import { ChevronLeft, ChevronRight, Mail, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppLocale } from '@/localization/use-app-locale';
import type { CampaignDraft } from '@/lib/campaigns';

export function CampaignCardsGrid({items,loading,emptyMessage,onOpen}:{items:CampaignDraft[];loading:boolean;emptyMessage:string;onOpen:(campaign:CampaignDraft)=>void}) {
  const {t}=useTranslation();
  const {direction,locale}=useAppLocale();
  const tr=(key:string)=>t(`campaign.${key}`);
  const GoIcon=direction==='rtl'?ChevronLeft:ChevronRight;
  return <div dir={direction} className="min-h-0 overflow-y-auto overscroll-contain p-0.5" aria-busy={loading}>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
      {loading?Array.from({length:6},(_,index)=><div key={index} className="space-y-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm"><Skeleton className="h-5 w-2/3"/><Skeleton className="h-4 w-1/3"/><Skeleton className="h-12 w-full"/></div>):items.map(campaign=><button
        key={campaign.id} type="button" onClick={()=>onOpen(campaign)}
        aria-labelledby={`campaign-card-${campaign.id}-name`}
        className="group flex min-w-0 flex-col gap-4 rounded-xl border border-border/50 bg-card p-4 text-start shadow-sm transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex w-full min-w-0 items-start justify-between gap-3"><span id={`campaign-card-${campaign.id}-name`} title={campaign.name} className="line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold leading-snug"><bdi>{campaign.name}</bdi></span><Badge variant="secondary" className="shrink-0">{tr(campaign.status||'needs_review')}</Badge></span>
        <span className="flex flex-wrap gap-3 text-sm text-muted-foreground">{campaign.email_enabled&&<span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" aria-hidden="true"/>{tr('email')}</span>}{campaign.sms_enabled&&<span className="inline-flex items-center gap-1.5"><MessageSquare className="size-3.5" aria-hidden="true"/>{tr('sms')}</span>}</span>
        <span className="line-clamp-3 whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">{campaign.email_enabled?campaign.email_content:campaign.sms_content}</span>
        <span className="mt-auto flex w-full flex-wrap items-end justify-between gap-3 border-t border-border/50 pt-3">
          <span className="min-w-0 text-xs leading-5 text-muted-foreground"><span className="block">{tr('next_run')}</span><bdi>{campaign.next_run?new Date(campaign.next_run).toLocaleString(locale):'—'}</bdi></span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">{tr('open')}<GoIcon className="size-4" aria-hidden="true"/></span>
        </span>
      </button>)}
    </div>
    {!loading&&!items.length&&<p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">{emptyMessage}</p>}
  </div>;
}
