import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { LookupSelect } from "@/components/ui/lookup-select";
import { DateInput } from "@/components/ui/date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/contexts/UserContext";
import { apiClient } from "@/lib/api-client";
import type { Clinic, User } from "@/lib/db/schema-interface";
import { ORDER_STATUS_LABEL_KEYS, ORDER_STATUS_OPTIONS } from "@/lib/order-status";
import { useAppLocale } from "@/localization/use-app-locale";
import { OrderField, OrderSection } from "../layout/OrderSheet";
import { SUPPLIED_BY_CUSTOMER, type Frame, type OrderDetails, type OrderLens } from "./types";

const PRIORITY_OPTIONS = [
  { value: "רגיל", label: "priorityNormal" },
  { value: "דחוף", label: "priorityUrgent" },
  { value: "מיידי", label: "priorityImmediate" },
];

const useCompanyClinics = (companyId?: number) => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!companyId) {
      setClinics([]);
      return;
    }
    setLoading(true);
    apiClient
      .getClinicsByCompany(companyId)
      .then((response) => {
        if (mounted) setClinics((response.data || []).filter((clinic) => clinic.is_active !== false));
      })
      .catch((error) => {
        if (mounted) setClinics([]);
        console.error("Failed to load company clinics", error);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [companyId]);

  return { clinics, loading };
};

interface FulfillmentSectionProps {
  details: OrderDetails;
  setDetails: React.Dispatch<React.SetStateAction<OrderDetails>>;
  lens: OrderLens;
  frame: Frame;
  onLensFieldChange: (field: keyof OrderLens, value: string) => void;
  onFrameFieldChange: (field: keyof Frame, value: string) => void;
  users: User[];
  clientOrderIndex?: number | null;
  isEditing: boolean;
}

export function FulfillmentSection({
  details,
  setDetails,
  lens,
  frame,
  onLensFieldChange,
  onFrameFieldChange,
  users,
  clientOrderIndex,
  isEditing,
}: FulfillmentSectionProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const { currentUser, currentClinic } = useUser();
  const { clinics, loading: clinicsLoading } = useCompanyClinics(
    currentUser?.company_id ?? currentClinic?.company_id,
  );
  const update = (patch: Partial<OrderDetails>) =>
    setDetails((previous) => ({ ...previous, ...patch }));
  const statusKey = ORDER_STATUS_LABEL_KEYS[details.order_status as keyof typeof ORDER_STATUS_LABEL_KEYS];
  const summary = [
    statusKey ? t(statusKey) : details.order_status,
    details.bag_number ? `${t("orderWorkspace.bagNumber")} ${details.bag_number}` : "",
    details.advisor,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <OrderSection
      collapsible
      defaultOpen={false}
      storageKey="order-fulfillment-open"
      summary={summary}
      title={t("orderWorkspace.fulfillment")}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <OrderField label={t("orderGroupStatus")}>
          <Select
            dir={direction}
            disabled={!isEditing}
            value={details.order_status || ""}
            onValueChange={(order_status) => update({ order_status })}
          >
            <SelectTrigger aria-label={t("orderGroupStatus")}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(ORDER_STATUS_LABEL_KEYS[status])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </OrderField>

        <OrderField label={t("orderWorkspace.priority")}>
          <Select
            dir={direction}
            disabled={!isEditing}
            value={details.priority || ""}
            onValueChange={(priority) => update({ priority })}
          >
            <SelectTrigger aria-label={t("orderWorkspace.priority")}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(`orderWorkspace.${option.label}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </OrderField>

        <OrderField label={t("orderWorkspace.lab")}>
          <LookupSelect
            ariaLabel={t("orderWorkspace.lab")}
            dir={direction}
            value={details.manufacturing_lab || ""}
            onChange={(manufacturing_lab) => update({ manufacturing_lab })}
            lookupType="manufacturingLab"
            placeholder=""
            disabled={!isEditing}
          />
        </OrderField>

        <OrderField label={t("orderWorkspace.deliveryBranch")}>
          <Select
            dir={direction}
            disabled={!isEditing || clinicsLoading || clinics.length === 0}
            value={details.delivery_clinic_id ? String(details.delivery_clinic_id) : ""}
            onValueChange={(value) =>
              update({
                delivery_clinic_id: Number(value),
                delivery_location:
                  clinics.find((clinic) => String(clinic.id) === value)?.name ||
                  details.delivery_location,
              })
            }
          >
            <SelectTrigger aria-label={t("orderWorkspace.deliveryBranch")}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((clinic) => (
                <SelectItem key={clinic.id ?? clinic.name} value={String(clinic.id)}>
                  {clinic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </OrderField>

        <OrderField label={t("orderWorkspace.bagNumber")}>
          <div className="flex items-center gap-2">
            <Input
              name="bag_number"
              dir="ltr"
              aria-label={t("orderWorkspace.bagNumber")}
              value={details.bag_number || ""}
              readOnly
              disabled
              className="min-w-0 flex-1 font-mono tabular-nums"
            />
            {clientOrderIndex ? (
              <span
                title={t("orderWorkspace.clientOrderIndex", { index: clientOrderIndex })}
                className="bg-muted text-muted-foreground inline-flex h-7 shrink-0 items-center rounded-md px-2 text-xs font-medium tabular-nums"
              >
                #{clientOrderIndex}
              </span>
            ) : null}
          </div>
        </OrderField>

        <OrderField label={t("orderWorkspace.advisor")}>
          <LookupSelect
            ariaLabel={t("orderWorkspace.advisor")}
            dir={direction}
            value={details.advisor || ""}
            onChange={(advisor) => update({ advisor })}
            lookupType="advisor"
            placeholder=""
            disabled={!isEditing}
          />
        </OrderField>

        <OrderField label={t("orderWorkspace.deliveredBy")}>
          <Select
            dir={direction}
            disabled={!isEditing}
            value={details.delivered_by || ""}
            onValueChange={(delivered_by) => update({ delivered_by })}
          >
            <SelectTrigger aria-label={t("orderWorkspace.deliveredBy")}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter((user) => user.id)
                .map((user) => (
                  <SelectItem key={user.id} value={user.full_name || user.username}>
                    {user.full_name || user.username}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </OrderField>

        <OrderField label={t("orderWorkspace.deliveredAt")}>
          <DateInput
            name="delivered_at"
            aria-label={t("orderWorkspace.deliveredAt")}
            value={details.delivered_at}
            onChange={(event) => update({ delivered_at: event.target.value })}
            disabled={!isEditing}
          />
        </OrderField>

        <OrderField label={t("orderWorkspace.lensWarranty")}>
          <DateInput
            name="lens_warranty"
            aria-label={t("orderWorkspace.lensWarranty")}
            value={lens.warranty_expiration}
            onChange={(event) => onLensFieldChange("warranty_expiration", event.target.value)}
            disabled={!isEditing}
          />
        </OrderField>

        <OrderField label={t("orderWorkspace.frameWarranty")}>
          <DateInput
            name="frame_warranty"
            aria-label={t("orderWorkspace.frameWarranty")}
            value={frame.warranty_expiration}
            onChange={(event) => onFrameFieldChange("warranty_expiration", event.target.value)}
            disabled={!isEditing || frame.supplied_by === SUPPLIED_BY_CUSTOMER}
          />
        </OrderField>
      </div>
    </OrderSection>
  );
}
