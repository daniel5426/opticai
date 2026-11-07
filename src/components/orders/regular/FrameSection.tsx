import { ProductBarcodeScan } from "@/components/inventory/BarcodeScanButton";
import { useSupplyRevision } from '@/lib/inventory-events';
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SelectedCatalogProduct } from "@/components/inventory/SelectedCatalogProduct";
import { Input } from "@/components/ui/input";
import { FastInput } from "@/components/exam/shared/OptimizedInputs";
import {
  canCreateFrameCatalogProduct,
  FrameCatalogCombobox,
  type FrameCatalogField,
  hasMatchingFrameCatalogVariant,
} from "@/components/inventory/FrameCatalogCombobox";
import { useUser } from "@/contexts/UserContext";
import { apiClient } from "@/lib/api-client";
import type { CatalogVariant, FulfillmentSource, InventorySelection } from "@/lib/inventory";
import { useAppLocale } from "@/localization/use-app-locale";
import { OrderField, OrderSection, OrderSegmented } from "../layout/OrderSheet";
import { SUPPLIED_BY_CUSTOMER, SUPPLIED_BY_STORE, type Frame } from "./types";

const CATALOG_FIELDS: { field: FrameCatalogField; label: string; lookupType: string; lookupLabel: string }[] = [
  { field: "supplier", label: "supplier", lookupType: "supplier", lookupLabel: "lookupSuppliers" },
  { field: "manufacturer", label: "brand", lookupType: "manufacturer", lookupLabel: "lookupBrands" },
  { field: "model", label: "model", lookupType: "frameModel", lookupLabel: "lookupFrameModels" },
  { field: "color", label: "color", lookupType: "color", lookupLabel: "lookupColors" },
];

const MEASUREMENT_FIELDS: { field: "width" | "bridge" | "height" | "length"; label: string }[] = [
  { field: "width", label: "size" },
  { field: "bridge", label: "bridge" },
  { field: "height", label: "height" },
  { field: "length", label: "temple" },
];

interface FrameSectionProps {
  clinicId?: number;
  orderId?: number;
  frame: Frame;
  price?: number;
  currency?: string;
  onPriceChange?: (value: string) => void;
  isEditing: boolean;
  onFrameFieldChange: (field: keyof Frame, value: string) => void;
  selectedInventory?: InventorySelection | null;
  onInventorySelect: (variant: CatalogVariant, source: FulfillmentSource) => void;
  onInventoryClear: () => void;
}

const useFrameCatalog = (clinicId?: number, orderId?: number) => {
  const supplyRevision = useSupplyRevision();
  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!clinicId) {
      setVariants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void apiClient
      .getInventoryVariants(clinicId, { category: "frame", stockableOnly: true, ...(orderId ? { orderId, orderKind: "regular" as const } : {}) })
      .then((response) => {
        if (mounted) setVariants(response.data?.items || []);
      })
      .catch((error) => {
        if (mounted) setVariants([]);
        console.error("Failed to load frame catalog", error);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [clinicId, orderId, supplyRevision]);

  return { variants, setVariants, loading };
};

export function FrameSection({
  frame, price, currency, onPriceChange,
  clinicId: recordClinicId,
  orderId,
  isEditing,
  onFrameFieldChange,
  selectedInventory,
  onInventorySelect,
  onInventoryClear,
}: FrameSectionProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const { currentClinic } = useUser();
  const clinicId = recordClinicId ?? currentClinic?.id;
  const { variants, setVariants, loading } = useFrameCatalog(clinicId, orderId);
  const consumed = selectedInventory?.lifecycle_state === "consumed";
  const catalogValues = {
    supplier: frame.supplier,
    manufacturer: frame.manufacturer,
    model: frame.model,
    color: frame.color,
    width: frame.width,
  };
  const canCreateProduct =
    Boolean(currentClinic?.id) && clinicId === currentClinic?.id &&
    canCreateFrameCatalogProduct(catalogValues) &&
    !hasMatchingFrameCatalogVariant(variants, catalogValues);

  const createProduct = async () => {
    const clinicId = currentClinic?.id;
    if (!clinicId || !canCreateFrameCatalogProduct(catalogValues)) {
      throw new Error("Frame catalog product is incomplete");
    }
    const response = await apiClient.createCatalogEntry({
      clinic_id: clinicId,
      category: "frame",
      product: {
        brand: frame.manufacturer,
        model: frame.model,
        preferred_supplier: frame.supplier,
      },
      variant: {
        attributes: {
          color: frame.color,
          eye_size: frame.width,
          bridge: frame.bridge,
          temple_length: frame.length,
          height: frame.height,
        },
        is_stockable: true,
        default_retail: price,
        currency,
      },
    });
    if (response.error || !response.data) {
      throw new Error(String(response.error || "Catalog product creation failed"));
    }
    const created = response.data;
    setVariants((current) =>
      [...current.filter((variant) => variant.id !== created.id), created].sort(
        (left, right) => left.display_name.localeCompare(right.display_name, "he"),
      ),
    );
    onInventorySelect(created, "supplier_ordered");
    toast.success(t("inventoryProductCreated", { name: created.display_name }));
  };

  const productAction = canCreateProduct
    ? {
        name: [frame.manufacturer, frame.model].filter(Boolean).join(" "),
        onCreate: createProduct,
      }
    : undefined;


  return (
    <OrderSection
      title={t("orderWorkspace.frame")}
      start={<ProductBarcodeScan
        clinicId={clinicId} category="frame" orderId={orderId} orderKind="regular" stockableOnly
        disabled={!isEditing || consumed || frame.supplied_by === SUPPLIED_BY_CUSTOMER}
        onSelect={variant => onInventorySelect(variant, (variant.balance?.available || 0) > 0 ? "inventory" : "supplier_ordered")}
      />}
      end={
        <OrderSegmented
          dir={direction}
          ariaLabel={t("orderWorkspace.suppliedBy")}
          disabled={!isEditing}
          value={frame.supplied_by || SUPPLIED_BY_STORE}
          onValueChange={(value) => onFrameFieldChange("supplied_by", value)}
          options={[
            { value: SUPPLIED_BY_STORE, label: t("orderWorkspace.store") },
            { value: SUPPLIED_BY_CUSTOMER, label: t("orderWorkspace.customer") },
          ]}
        />
      }
    >
      {selectedInventory?.variant && <div className="mb-3 min-w-0">
        <SelectedCatalogProduct variant={selectedInventory.variant} onClear={isEditing && !consumed ? onInventoryClear : undefined} />
      </div>}
      <div className="grid grid-cols-2 gap-3">
        {CATALOG_FIELDS.slice(0, 2).map(({ field, label, lookupType, lookupLabel }) => (
          <OrderField key={field} label={t(`orderWorkspace.${label}`)}>
            <FrameCatalogCombobox
              field={field}
              value={frame[field] || ""}
              values={frame}
              variants={variants}
              loadingCatalog={loading}
              onChange={(value) => onFrameFieldChange(field, value)}
              lookupType={lookupType}
              lookupLabel={t(`orderWorkspace.${lookupLabel}`)}
              placeholder=""
              disabled={!isEditing || consumed}
              onSelectProduct={onInventorySelect}
              createProduct={productAction}
            />
          </OrderField>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem] gap-3" dir={direction}>
        {CATALOG_FIELDS.slice(2).map(({ field, label, lookupType, lookupLabel }) => (
          <OrderField key={field} label={t(`orderWorkspace.${label}`)}>
            <FrameCatalogCombobox field={field} value={frame[field] || ""} values={frame}
              variants={variants} loadingCatalog={loading} onChange={value => onFrameFieldChange(field, value)}
              lookupType={lookupType} lookupLabel={t(`orderWorkspace.${lookupLabel}`)} placeholder=""
              disabled={!isEditing || consumed} onSelectProduct={onInventorySelect} createProduct={productAction} />
          </OrderField>
        ))}
        <OrderField label={`${t("orderGroupPrice")} (${currency || "ILS"})`}>
          <Input name="frame_price" aria-label={t("orderWorkspace.framePrice")} type="number" dir="ltr" min={0} step={0.01}
            value={price == null ? "" : String(price)} onChange={event => onPriceChange?.(event.target.value)}
            disabled={!isEditing || frame.supplied_by === SUPPLIED_BY_CUSTOMER} />
        </OrderField>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3" dir={direction}>
        {MEASUREMENT_FIELDS.map(({ field, label }) => (
          <OrderField key={field} label={t(`orderWorkspace.${label}`)}>
            <FastInput
              name={`frame_${field}`}
              type="number"
              min={0}
              step={1}
              value={String(frame[field] ?? "")}
              onInput={(value) => onFrameFieldChange(field, value)}
              disabled={!isEditing}
            />
          </OrderField>
        ))}
      </div>
    </OrderSection>
  );
}
