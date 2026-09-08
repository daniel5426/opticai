import React from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { FastInput } from './shared/OptimizedInputs';
import { OptitechCardData, OptitechCardType, optitechFieldNames, formatOptitechValue } from '@/lib/optitech-cards';

interface Props {
  type: OptitechCardType;
  data: OptitechCardData;
  onChange: (field: string, value: string) => void;
  isEditing: boolean;
  readBinding: (component: string, field: string, cardInstanceId?: string) => unknown;
  writeBinding: (component: string, field: string, value: string, cardInstanceId?: string) => void;
}

export function OptitechMigrationCard({ type, data, onChange, isEditing, readBinding, writeBinding }: Props) {
  const { t, i18n } = useTranslation();
  const fields = optitechFieldNames(data);
  return (
    <Card className="examcard w-full py-3" dir={i18n.dir()}>
      <CardContent className="px-4">
        <h3 className="mb-1 text-center font-medium text-muted-foreground">{t(`optitech.cards.${type}`)}</h3>
        {typeof data.source_section === 'string' && <p className="mb-3 text-center text-xs text-muted-foreground">{t(`optitech.sections.${data.source_section}`)}</p>}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(6rem,1fr)] items-center gap-x-3 gap-y-2">
          {fields.map(field => {
            const binding = data.bindings?.[field];
            const value = binding
              ? binding.cardInstanceId
                ? readBinding(binding.component, binding.field, binding.cardInstanceId)
                : readBinding(binding.component, binding.field)
              : data[field];
            const sourceLabels = data.source_labels as Record<string, string> | undefined;
            const label = sourceLabels?.[field] || t(`optitech.fields.${field}`, { defaultValue: field });
            return (
              <div key={field} className="contents">
                <span className="min-w-0 text-start text-xs text-muted-foreground" title={field}>{label}</span>
                <FastInput
                  type="text"
                  aria-label={label}
                  name={`${type}-${field}`}
                  value={formatOptitechValue(type, field, value)}
                  onChange={value => binding
                    ? binding.cardInstanceId
                      ? writeBinding(binding.component, binding.field, value, binding.cardInstanceId)
                      : writeBinding(binding.component, binding.field, value)
                    : onChange(field, value)}
                  disabled={!isEditing}
                  dir="auto"
                  className="h-8 min-w-0 text-xs disabled:cursor-default disabled:opacity-100"
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
