import React from "react";
import { useTranslation } from "react-i18next";
import { LookupSelect } from "@/components/ui/lookup-select";
import { DateInput } from "@/components/ui/date";
import { UserSelect } from "@/components/ui/user-select";
import { useAppLocale } from "@/localization/use-app-locale";
import { cn } from "@/utils/tailwind";
import { OrderField, OrderSegmented } from "./layout/OrderSheet";

export interface OrderMetaValues {
  type?: string;
  order_date?: string;
  user_id?: number;
  dominant_eye?: string;
}

interface OrderMetaStripProps {
  client?: { first_name?: string; last_name?: string } | null;
  caption?: React.ReactNode;
  values: OrderMetaValues;
  editing: boolean;
  onChange: (patch: Partial<OrderMetaValues>) => void;
  className?: string;
}

const getInitials = (client: OrderMetaStripProps["client"]) =>
  `${client?.first_name?.[0] || ""}${client?.last_name?.[0] || ""}`.toLocaleUpperCase();

export function OrderMetaStrip({
  client,
  caption,
  values,
  editing,
  onChange,
  className,
}: OrderMetaStripProps) {
  const { direction } = useAppLocale();
  const fullName = `${client?.first_name || ""} ${client?.last_name || ""}`.trim();

  return (
    <div
      className={cn(
        "bg-card flex flex-wrap items-end gap-x-6 gap-y-3 px-4 py-3",
        className,
      )}
      dir={direction}
    >
      {client && (
        <div className="flex min-w-0 shrink-0 items-center gap-3 self-center">
          <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            {getInitials(client)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{fullName}</div>
            {caption && (
              <div className="text-muted-foreground truncate text-xs">
                {caption}
              </div>
            )}
          </div>
        </div>
      )}
      <OrderMetaFields
        values={values}
        editing={editing}
        onChange={onChange}
        className="min-w-0 flex-1 grid-cols-2 md:grid-cols-4"
      />
    </div>
  );
}

interface OrderMetaFieldsProps {
  values: OrderMetaValues;
  editing: boolean;
  onChange: (patch: Partial<OrderMetaValues>) => void;
  className?: string;
}

export function OrderMetaFields({ values, editing, onChange, className }: OrderMetaFieldsProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();

  return (
    <div className={cn("grid gap-3", className)} dir={direction}>
        <OrderField label={t("orderWorkspace.orderType")}>
          <LookupSelect
            ariaLabel={t("orderWorkspace.orderType")}
            dir={direction}
            lookupType="orderType"
            placeholder=""
            value={values.type || ""}
            disabled={!editing}
            onChange={(type) => onChange({ type })}
          />
        </OrderField>
        <OrderField label={t("orderGroupDate")}>
          <DateInput
            name="order_date"
            aria-label={t("orderGroupDate")}
            value={values.order_date}
            disabled={!editing}
            onChange={(event) => onChange({ order_date: event.target.value })}
          />
        </OrderField>
        <OrderField label={t("orderGroupExaminer")}>
          <UserSelect
            placeholder=""
            dir={direction}
            autoDefaultToCurrentUser={false}
            value={values.user_id}
            disabled={!editing}
            onValueChange={(user_id) => onChange({ user_id })}
          />
        </OrderField>
        <OrderField label={t("orderGroupDominantEye")}>
          <OrderSegmented
            size="field"
            allowEmpty
            dir={direction}
            ariaLabel={t("orderGroupDominantEye")}
            disabled={!editing}
            value={values.dominant_eye || ""}
            onValueChange={(dominant_eye) => onChange({ dominant_eye })}
            options={[
              { value: "R", label: t("orderGroupRightEye") },
              { value: "L", label: t("orderGroupLeftEye") },
            ]}
          />
        </OrderField>
    </div>
  );
}
