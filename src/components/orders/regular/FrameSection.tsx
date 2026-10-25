import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
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
  frame: Frame;
  isEditing: boolean;
  onFrameFieldChange: (field: keyof Frame, value: string) => void;
  selectedInventory?: InventorySelection | null;
  onInventorySelect: (variant: CatalogVariant, source: FulfillmentSource) => void;
  onInventoryClear: () => void;
}

const useFrameCatalog = (clinicId?: number) => {
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
      .getInventoryVariants(clinicId, { category: "frame", stockableOnly: true })
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
  }, [clinicId]);

  return { variants, setVariants, loading };
};

export function FrameSection({
  frame,
  isEditing,
  onFrameFieldChange,
  selectedInventory,
  onInventorySelect,
  onInventoryClear,
}: FrameSectionProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const { currentClinic } = useUser();
  const { variants, setVariants, loading } = useFrameCatalog(currentClinic?.id);
  const consumed = selectedInventory?.lifecycle_state === "consumed";
  const catalogValues = {
    supplier: frame.supplier,
    manufacturer: frame.manufacturer,
    model: frame.model,
    color: frame.color,
    width: frame.width,
  };
  const canCreateProduct =
    Boolean(currentClinic?.id) &&
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

  const catalogBadge = selectedInventory?.variant ? (
    <span className="bg-muted inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md ps-2.5 pe-1 text-xs">
      <span className="truncate font-medium">{selectedInventory.variant.display_name}</span>
      <span className="text-muted-foreground shrink-0">
        {selectedInventory.fulfillment_source === "inventory"
          ? t("orderWorkspace.catalogAvailable", {
              count: selectedInventory.variant.balance?.available || 0,
            })
          : t("orderWorkspace.catalogSupplierOrder")}
      </span>
      {isEditing && !consumed ? (
        <button
          type="button"
          onClick={onInventoryClear}
          aria-label={t("orderWorkspace.catalogClear")}
          className="text-muted-foreground hover:bg-card hover:text-foreground focus-visible:ring-ring/50 rounded-sm p-1 outline-none focus-visible:ring-2"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  ) : null;

  return (
    <OrderSection
      title={t("orderWorkspace.frame")}
      start={catalogBadge}
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
      <div className="grid grid-cols-2 gap-3">
        {CATALOG_FIELDS.map(({ field, label, lookupType, lookupLabel }) => (
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
