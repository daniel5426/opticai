import { CatalogProductAction } from "@/components/inventory/CatalogProductAction";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";
import { useScanTarget, chooseScan, scanned, provenance, scanMetadata } from "@/lib/scanner";
import { ScanCardActions } from "@/components/scanner/ScanCardActions";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LensCatalogCombobox, lensCatalogSuggestions } from "@/components/inventory/LensCatalogCombobox";
import { apiClient } from "@/lib/api-client";
import { useSupplyRevision } from "@/lib/inventory-events";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { SelectedCatalogProduct } from "@/components/inventory/SelectedCatalogProduct";
import type { CatalogVariant, FulfillmentSource, InventorySelection } from "@/lib/inventory";
import { FastInput } from "@/components/exam/shared/OptimizedInputs";
import { useAppLocale } from "@/localization/use-app-locale";
import { OrderField, OrderSection, OrderSegmented } from "../layout/OrderSheet";
import type { OrderLens } from "./types";

type LensFieldSuffix =
  | "supplier"
  | "material"
  | "model"
  | "coating"
  | "color"
  | "diameter";

type LensSide = "right" | "left";

type LayoutMode = "auto" | "combined" | "split";

const LENS_FIELDS: { key: LensFieldSuffix; lookupType?: string }[] = [
  { key: "supplier", lookupType: "supplier" },
  { key: "material", lookupType: "material" },
  { key: "model", lookupType: "lensModel" },
  { key: "coating", lookupType: "coating" },
  { key: "color", lookupType: "color" },
  { key: "diameter" },
];

const fieldName = (side: LensSide, key: LensFieldSuffix) =>
  `${side}_${key}` as keyof OrderLens;

const normalize = (value: unknown) => String(value ?? "").trim();

const rowsMatch = (lens: OrderLens) =>
  LENS_FIELDS.every(
    ({ key }) =>
      normalize(lens[fieldName("right", key)]) ===
      normalize(lens[fieldName("left", key)]),
  );

interface LensSectionProps {
  clinicId?: number;
  orderId?: number;
  selections?: InventorySelection[];
  onInventorySelect?: (side: LensSide | "both", variant: CatalogVariant, source: FulfillmentSource) => void;
  onInventoryClear?: (side: LensSide | "both") => void;
  onInventoryUnlink?: (side: LensSide | "both") => void;
  lens: OrderLens;
  layoutKey: string;
  isEditing: boolean;
  onLensFieldChange: (field: keyof OrderLens, value: string) => void;
}

export function LensSection({
  lens,
  clinicId: recordClinicId, orderId, selections = [], onInventorySelect, onInventoryClear, onInventoryUnlink,
  layoutKey,
  isEditing,
  onLensFieldChange,
}: LensSectionProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const { currentClinic, currentUser } = useUser();
  const clinicId = recordClinicId ?? currentClinic?.id;
  const revision = useSupplyRevision();
  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const [loading, setLoading] = useState(Boolean(clinicId));
  useEffect(() => {
    let active = true;
    if (!clinicId) { setVariants([]); setLoading(false); return; }
    setLoading(true);
    void apiClient.getInventoryVariants(clinicId, { category: "spectacle_lens", stockableOnly: true, ...(orderId ? { orderId, orderKind: "regular" as const } : {}) })
      .then(result => { if (result.error) throw new Error(String(result.error)); if (active) setVariants(result.data?.items || []); })
      .catch(() => { if (active) { setVariants([]); toast.error(t("orderWorkspace.catalogLoadError")); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clinicId, orderId, revision, t]);
  const [mode, setMode] = useState<LayoutMode>("auto");
  const [mergeError, setMergeError] = useState("");
  const selection = (side: LensSide) => selections.find(item => item.component === `lens_${side}`);
  const equal = rowsMatch(lens) && (!selection("right") || !selection("left") || selection("right")?.variant_id === selection("left")?.variant_id);
  const isSplit = mode === "split" || (mode === "auto" && !equal);

  useEffect(() => {
    setMode("auto");
    setMergeError("");
  }, [layoutKey]);

  const valueOf = (side: LensSide, key: LensFieldSuffix) =>
    String(lens[fieldName(side, key)] ?? "");

  const handleChange = (side: LensSide | "both", key: LensFieldSuffix, value: string) => {
    setMergeError("");
    if (side === "both") {
      onLensFieldChange(fieldName("right", key), value);
      onLensFieldChange(fieldName("left", key), value);
      return;
    }
    onLensFieldChange(fieldName(side, key), value);
  };

  const handleModeChange = (next: string) => {
    setMergeError("");
    if (next === "both") {
      if (!equal) {
        setMergeError(t("orderWorkspace.lensMergeBlocked"));
        return;
      }
      setMode("combined");
      return;
    }
    setMode("split");
  };

  const clearProduct = (side: LensSide | 'both') => {
    const sides = side === 'both' ? ['right', 'left'] as const : [side];
    if (!isEditing || sides.some(eye => selection(eye)?.lifecycle_state === 'consumed')) return;
    onInventoryClear?.(side);
    const metadata = scanMetadata(lens);
    for (const eye of sides) {
      LENS_FIELDS.forEach(({key}) => onLensFieldChange(fieldName(eye, key), ''));
      delete metadata[eye];
    }
    onLensFieldChange('_scan_provenance' as keyof OrderLens, JSON.stringify(metadata));
  };
  const scanRef = useScanTarget({ id: `lenses:${layoutKey}`, category: 'spectacle_lens', kind: 'order', label: t('orderWorkspace.lenses'),
    canApply: isEditing && !!onInventorySelect && !selections.some(item => item.component.startsWith('lens_') && item.lifecycle_state === 'consumed'),
    edit: !isEditing && !selections.some(item=>item.component.startsWith('lens_')&&item.lifecycle_state==='consumed') ? () => window.dispatchEvent(new Event('prysm:scan-edit-order')) : undefined,
    apply: async (variant, scan) => {
      const side = isSplit ? await chooseScan(t('scanner.choose'), [{label:t('scanner.right'),value:'right'},{label:t('scanner.left'),value:'left'}]) : 'both';
      if (!side) throw new Error('scanner.rejected');
      const sides = side === 'both' ? ['right', 'left'] as const : [side as LensSide];
      if (sides.some(eye => LENS_FIELDS.some(({key}) => valueOf(eye,key)) && selection(eye)?.variant_id !== variant.id)) {
        if (await chooseScan(t('scanner.replace'), [{label:t('scanner.confirm'),value:'yes'}]) !== 'yes') throw new Error('scanner.rejected');
      }
      if (scan.isCurrent && !scan.isCurrent()) throw new Error('scanner.expired');
      const fields: Record<string, unknown> = {};
      for (const eye of sides) Object.assign(fields, {
        [`${eye}_supplier`]: variant.product.preferred_supplier || '', [`${eye}_material`]: variant.product.material || '', [`${eye}_model`]: variant.product.model,
        [`${eye}_coating`]: variant.attributes.coating || '', [`${eye}_color`]: variant.attributes.color || '', [`${eye}_diameter`]: variant.attributes.diameter || '',
      });
      onInventorySelect?.(side as LensSide | 'both', variant, (variant.balance?.available || 0)>0 ? 'inventory' : 'supplier_ordered');
      let metadata = lens;
      for (const eye of sides) metadata = {...metadata, _scan_provenance: provenance(metadata, eye, Object.fromEntries(Object.entries(fields).filter(([key])=>key.startsWith(eye+'_'))), variant, scan)} as OrderLens;
      onLensFieldChange('_scan_provenance' as keyof OrderLens, (metadata as any)._scan_provenance);
    },
  });
  const renderControl = (side: LensSide | "both", key: LensFieldSuffix, lookupType?: string, ariaLabel?: string) => {
    const source = side === "both" ? "right" : side;
    const consumed = side === "both"
      ? selections.some(item => item.component.startsWith("lens_") && item.lifecycle_state === "consumed")
      : selection(source)?.lifecycle_state === "consumed";
    if (!lookupType) {
      return (
        <FastInput
          name={fieldName(source, key)}
          type="number"
          min={0}
          step={1}
          aria-label={ariaLabel}
          value={valueOf(source, key)}
          onInput={(value) => handleChange(side, key, value)}
          disabled={!isEditing || consumed}
        />
      );
    }
    return (
      <LensCatalogCombobox
        field={key}
        ariaLabel={ariaLabel}
        values={Object.fromEntries(LENS_FIELDS.map(({ key }) => [key, valueOf(source, key)]))}
        variants={variants}
        loadingCatalog={loading}
        lookupLabel={t(`orderWorkspace.${key}`)}
        onSelectProduct={(variant, fulfillment) => onInventorySelect?.(side, variant, fulfillment)}
        value={valueOf(source, key)}
        onChange={(value) => handleChange(side, key, value)}
        lookupType={lookupType}
        disabled={!isEditing || consumed}
      />
    );
  };

  const eyeLabel = (side: LensSide) =>
    t(side === "right" ? "orderGroupRightEye" : "orderGroupLeftEye");

  const selectedProduct = (side: LensSide | "both") => {
    const selected = side === "both" ? selection("right") || selection("left") : selection(side);
    if (!selected?.variant) {
      const source = side === 'both' ? 'right' : side;
      const values = Object.fromEntries(LENS_FIELDS.map(({key})=>[key,valueOf(source,key)]));
      const canCreate = isEditing && !loading && !selected && onInventorySelect && Boolean(clinicId) && currentClinic?.id === clinicId &&
        isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.worker) && valueOf(source,'model').trim() && !lensCatalogSuggestions(variants,values).length;
      if (!canCreate) return null;
      return <CatalogProductAction label={t('orderWorkspace.catalogCreateProduct',{name:valueOf(source,'model')})} onAction={async()=>{
        const result = await apiClient.createCatalogEntry({clinic_id:clinicId!,category:'spectacle_lens',
          product:{model:valueOf(source,'model'),material:valueOf(source,'material'),preferred_supplier:valueOf(source,'supplier')},
          variant:{attributes:{coating:valueOf(source,'coating'),color:valueOf(source,'color'),diameter:valueOf(source,'diameter')},is_stockable:true}});
        if (result.error || !result.data) throw new Error('Catalog creation failed');
        setVariants(previous=>[...previous.filter(item=>item.id!==result.data!.id),result.data!]);
        onInventorySelect(side,result.data,'supplier_ordered');
      }}/>;
    }
    const consumed = side === "both"
      ? selections.some(item => item.component.startsWith("lens_") && item.lifecycle_state === "consumed")
      : selected.lifecycle_state === "consumed";
    return <SelectedCatalogProduct variant={selected.variant}
      onClear={isEditing && !consumed ? () => (onInventoryUnlink || onInventoryClear)?.(side) : undefined}
      clearLabel={side === "both" ? undefined : `${t("orderWorkspace.catalogUnlink")} ${eyeLabel(side)}`} />;
  };

  return (
    <div ref={scanRef} className="h-full"><OrderSection
      className="flex h-full flex-col [&>header]:min-h-8"
      bodyClassName="flex-1"
      title={t("orderWorkspace.lenses")}
      start={<ScanCardActions scanned={scanned(lens, 'right') || scanned(lens, 'left')} clear={selection('right') || selection('left') || LENS_FIELDS.some(({key})=>valueOf('right',key)||valueOf('left',key)) ? ()=>clearProduct('both') : undefined} disabled={!isEditing || selections.some(item=>item.component.startsWith('lens_')&&item.lifecycle_state==='consumed')} />}
      end={
        <OrderSegmented
          dir={direction}
          ariaLabel={t("orderWorkspace.lensLayout")}
          value={isSplit ? "split" : "both"}
          onValueChange={handleModeChange}
          options={[
            { value: "both", label: t("orderWorkspace.bothEyes") },
            { value: "split", label: t("orderWorkspace.perEye") },
          ]}
        />
      }
      footer={<>
        {mergeError && <p role="alert" className="text-destructive mt-3 text-xs">{mergeError}</p>}
        <div className="mt-3 min-h-10" data-product-link-row>
          {isSplit ? <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-x-3"><span className="min-w-14" aria-hidden="true" />{(['right','left'] as LensSide[]).map(side=><div key={side} className="min-w-0" role="group" aria-label={eyeLabel(side)}>{selectedProduct(side)}</div>)}</div> : selectedProduct('both')}
        </div>
      </>}
    >
      {isSplit ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
          <span />
          {(["right", "left"] as LensSide[]).map((side) => (
            <span
              key={side}
              className="text-muted-foreground text-center text-xs font-medium"
            >
              {eyeLabel(side)}
            </span>
          ))}
          {LENS_FIELDS.map(({ key, lookupType }) => (
            <React.Fragment key={key}>
              <span className="text-muted-foreground min-w-14 text-xs">
                {t(`orderWorkspace.${key}`)}
              </span>
              {(["right", "left"] as LensSide[]).map((side) => (
                <div key={side} className="min-w-0">
                  {renderControl(
                    side,
                    key,
                    lookupType,
                    `${t(`orderWorkspace.${key}`)} ${eyeLabel(side)}`,
                  )}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LENS_FIELDS.map(({ key, lookupType }) => (
            <OrderField key={key} label={t(`orderWorkspace.${key}`)}>
              {renderControl("both", key, lookupType, t(`orderWorkspace.${key}`))}
            </OrderField>
          ))}
        </div>
        </>
      )}
    </OrderSection></div>
  );
}
