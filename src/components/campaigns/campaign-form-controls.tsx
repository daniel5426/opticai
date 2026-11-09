import React, { type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAppLocale } from '@/localization/use-app-locale';
import { cn } from '@/utils/tailwind';

export const campaignSurfaceClassName = 'rounded-xl border border-border/50 bg-card p-4 shadow-sm sm:p-5';
export const campaignRuleTrackClassName = 'sm:grid-cols-[minmax(0,16rem)_minmax(0,10rem)_6rem_2.25rem]';

export function CampaignField({ id, label, className, children }: { id: string; label: string; className?: string; children: ReactNode }) {
  return <div className={cn('grid min-w-0 content-start gap-1.5', className)}><Label htmlFor={id} className="font-normal">{label}</Label>{children}</div>;
}

export function CampaignChoice({ id, label, value, onValueChange, className, disabled, options, placeholder }: { id?: string; label: string; value: string; onValueChange: (value: string) => void; className?: string; disabled?: boolean; options: { value: string; label: string }[]; placeholder?: string }) {
  const { direction } = useAppLocale();
  return <Select value={value} onValueChange={onValueChange} disabled={disabled} dir={direction} clearable={false}>
    <SelectTrigger id={id} aria-label={label} className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent className="no-scrollbar">{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}

export function CampaignSetting({ id, label, checked, onCheckedChange }: { id: string; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="inline-flex items-center gap-3"><Label htmlFor={id} className="min-w-0 font-normal leading-5">{label}</Label><Switch id={id} checked={checked} onCheckedChange={onCheckedChange} /></div>;
}
