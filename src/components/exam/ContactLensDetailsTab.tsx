import { useId } from "react";
import { useScanTarget, scanned, provenance } from "@/lib/scanner";
import { ScanCardActions } from "@/components/scanner/ScanCardActions";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { ProductBarcodeScan } from "@/components/inventory/BarcodeScanButton";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";
import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LookupSelect } from "@/components/ui/lookup-select";
import { ContactLensDetails } from "@/lib/db/schema-interface";
import { ChevronUp, ChevronDown } from "lucide-react";
import { FastInput, inputSyncManager } from "./shared/OptimizedInputs";
import { EXAM_FIELDS } from "./data/exam-field-definitions";
import {
  ContactLensCatalogCombobox,
  ContactLensCatalogCreateProduct,
  ContactLensCatalogField,
  ContactLensCatalogValues,
} from "@/components/inventory/ContactLensCatalogCombobox";
import { CatalogVariant, FulfillmentSource } from "@/lib/inventory";

interface ContactLensInventoryCatalogProps {
  onClear?: (side: "right" | "left") => void;
  clinicId?: number;
  orderId?: number;
  variants: CatalogVariant[];
  loading?: boolean;
  rightValues: ContactLensCatalogValues;
  leftValues: ContactLensCatalogValues;
  rightDisabled?: boolean;
  leftDisabled?: boolean;
  rightCreateProduct?: ContactLensCatalogCreateProduct;
  leftCreateProduct?: ContactLensCatalogCreateProduct;
  onSelect: (
    side: "right" | "left",
    variant: CatalogVariant,
    source: FulfillmentSource,
  ) => void;
}

interface ContactLensDetailsTabProps {
  contactLensDetailsData: ContactLensDetails;
  onContactLensDetailsChange: (
    field: keyof ContactLensDetails,
    value: string,
  ) => void;
  isEditing: boolean;
  hideQuantity?: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
  inventoryCatalog?: ContactLensInventoryCatalogProps;
}

export function ContactLensDetailsTab({
  contactLensDetailsData,
  onContactLensDetailsChange,
  isEditing,
  hideQuantity = false,
  hideEyeLabels = false,
  needsMiddleSpacer = false,
  inventoryCatalog,
}: ContactLensDetailsTabProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const { enabled: scannerEnabled } = useBarcodeScanner();
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const dataRef = useRef(contactLensDetailsData);
  dataRef.current = contactLensDetailsData;

  const scanId = useId();
  const identityFields = ['type', 'model', 'supplier', 'material', 'color'];
  const clearProduct = () => {
    if (!isEditing || inventoryCatalog?.rightDisabled || inventoryCatalog?.leftDisabled) return;
    for (const eye of ['r','l']) identityFields.forEach(field => onContactLensDetailsChange(`${eye}_${field}` as any, ''));
    inventoryCatalog?.onClear?.('right'); inventoryCatalog?.onClear?.('left');
    onContactLensDetailsChange('_scan_provenance' as any, '{}');
  };
  const scanRef = useScanTarget({ id: `contacts:${scanId}`, category: 'contact_lens', kind: inventoryCatalog ? 'order' : 'exam', label: t('scanner.contacts'),
    canApply: isEditing && !inventoryCatalog?.rightDisabled && !inventoryCatalog?.leftDisabled,
    edit: !isEditing && !inventoryCatalog?.rightDisabled && !inventoryCatalog?.leftDisabled ? () => window.dispatchEvent(new Event(inventoryCatalog ? 'prysm:scan-edit-order':'prysm:scan-edit-exam')) : undefined,
    hasValue: ['r','l'].some(eye=>identityFields.some(field=>Boolean((contactLensDetailsData as any)[`${eye}_${field}`]))),
    apply: (variant, scan) => {
      const values = {type:variant.product.product_type || '',model:variant.product.model,supplier:variant.product.preferred_supplier || '',material:variant.product.material || '',color:variant.attributes.color || ''};
      const fields: Record<string, unknown> = {};
      for (const eye of ['r','l']) for (const [key,value] of Object.entries(values)) fields[`${eye}_${key}`] = key === 'supplier' ? variant.product.preferred_supplier || (contactLensDetailsData as any)[`${eye}_supplier`] || '' : value;
      if (inventoryCatalog) {
        const rightQuantity = Number((contactLensDetailsData as any).r_quantity) || 1;
        const leftQuantity = Number((contactLensDetailsData as any).l_quantity) || 1;
        let available = variant.balance?.available || 0;
        const rightSource = available >= rightQuantity ? 'inventory' : 'supplier_ordered';
        if (rightSource === 'inventory') available -= rightQuantity;
        inventoryCatalog.onSelect('right',variant,rightSource);
        inventoryCatalog.onSelect('left',variant,available >= leftQuantity ? 'inventory':'supplier_ordered');
      } else for (const [key,value] of Object.entries(fields)) onContactLensDetailsChange(key as any, String(value));
      onContactLensDetailsChange('_scan_provenance' as any, provenance(contactLensDetailsData,'contacts',fields,variant,scan));
    },
  });
  const columns = [
    { key: "type", config: EXAM_FIELDS.CONTACT_LENS_TYPE },
    { key: "model", config: EXAM_FIELDS.CONTACT_LENS_MODEL },
    { key: "supplier", config: EXAM_FIELDS.CONTACT_LENS_SUPPLIER },
    { key: "material", config: EXAM_FIELDS.CONTACT_LENS_MATERIAL },
    { key: "color", config: EXAM_FIELDS.CONTACT_LENS_COLOR },
    ...(!hideQuantity ? [{ key: "quantity", config: EXAM_FIELDS.CONTACT_LENS_QUANTITY }] : []),
    { key: "dx", config: EXAM_FIELDS.CONTACT_LENS_DX },
  ];

  const getFieldValue = (eye: "R" | "L", field: string) => {
    const eyeField =
      `${eye.toLowerCase()}_${field}` as keyof ContactLensDetails;
    const value = contactLensDetailsData[eyeField];
    if (value != null) return value.toString();
    if (field === "type") {
      const legacyField =
        `${eye.toLowerCase()}_lens_type` as keyof ContactLensDetails;
      return contactLensDetailsData[legacyField]?.toString() || "";
    }
    return "";
  };

  const handleChange = (eye: "R" | "L", field: string, value: string) => {
    const eyeField =
      `${eye.toLowerCase()}_${field}` as keyof ContactLensDetails;
    onContactLensDetailsChange(eyeField, value);
  };

  const lookupLabels: Record<ContactLensCatalogField, string> = {
    type: t("contactLensDetails.type"),
    manufacturer: t("contactLensDetails.manufacturer"),
    model: t("contactLensDetails.model"),
    supplier: t("contactLensDetails.supplier"),
    material: t("contactLensDetails.material"),
    color: t("contactLensDetails.color"),
  };

  const renderLookup = (
    eye: "R" | "L",
    field: ContactLensCatalogField,
    lookupType: string,
  ) => {
    if (!inventoryCatalog) {
      return (
        <LookupSelect
          disabled={!isEditing}
          dir={direction}
          ariaLabel={`${t(`contactLensDetails.${field}`)} ${eye}`}
          value={getFieldValue(eye, field)}
          onChange={(value) => handleChange(eye, field, value)}
          lookupType={lookupType}
          placeholder=""
          className="h-8 bg-white text-xs"
          center={true}
        />
      );
    }

    const side = eye === "R" ? "right" : "left";
    return (
      <ContactLensCatalogCombobox
        placeholder=""
        field={field}
        value={getFieldValue(eye, field)}
        values={
          eye === "R"
            ? inventoryCatalog.rightValues
            : inventoryCatalog.leftValues
        }
        variants={inventoryCatalog.variants}
        loadingCatalog={inventoryCatalog.loading}
        lookupType={lookupType}
        lookupLabel={lookupLabels[field]}
        disabled={
          !isEditing ||
          (eye === "R"
            ? inventoryCatalog.rightDisabled
            : inventoryCatalog.leftDisabled)
        }
        onChange={(value) => handleChange(eye, field, value)}
        onSelectProduct={(variant, source) =>
          inventoryCatalog.onSelect(side, variant, source)
        }
        createProduct={
          eye === "R"
            ? inventoryCatalog.rightCreateProduct
            : inventoryCatalog.leftCreateProduct
        }
      />
    );
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    inputSyncManager.flush();
    const latestData = dataRef.current;

    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const getLatestVal = (e: "R" | "L", f: string) => {
        const eyeField = `${e.toLowerCase()}_${f}` as keyof ContactLensDetails;
        return latestData[eyeField]?.toString() || "";
      };
      const value = getLatestVal(fromEye, key);
      onContactLensDetailsChange(
        `${toEye.toLowerCase()}_${key}` as keyof ContactLensDetails,
        value,
      );
    });
  };

  return (
    <div ref={scanRef}><Card className="examcard w-full pt-3 pb-4" dir="ltr">
      <CardContent className="px-4" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3">
          <div className="flex justify-end"><ScanCardActions scanned={scanned(contactLensDetailsData,'contacts')} clear={['r','l'].some(eye=>identityFields.some(field=>(contactLensDetailsData as any)[`${eye}_${field}`])) ? clearProduct : undefined} disabled={!isEditing || inventoryCatalog?.rightDisabled || inventoryCatalog?.leftDisabled} /></div>
          {inventoryCatalog && scannerEnabled && <div className="flex flex-wrap justify-center gap-2">
            {(["right", "left"] as const).map(side => <ProductBarcodeScan key={side}
              clinicId={inventoryCatalog.clinicId} category="contact_lens" orderId={inventoryCatalog.orderId} orderKind="contact"
              label={t(side === "right" ? "barcode.scanRight" : "barcode.scanLeft")}
              disabled={!isEditing || (side === "right" ? inventoryCatalog.rightDisabled : inventoryCatalog.leftDisabled)}
              onSelect={variant => inventoryCatalog.onSelect(side, variant, (variant.balance?.available || 0) > 0 ? "inventory" : "supplier_ordered")}
            />)}
          </div>}
          <div className="text-center" dir={direction}>
            <h3 className="text-muted-foreground font-medium">{t("contactLensDetails.title")}</h3>
          </div>

          <div
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: `${hideEyeLabels ? "" : "20px "}repeat(5, minmax(0, 2fr)) ${hideQuantity ? "" : "minmax(0, 1fr) "}minmax(0, 1fr)` }}
          >
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key }) => (
              <div key={key} className="flex h-4 items-center justify-center">
                <span dir={direction} className="text-muted-foreground text-xs font-medium">
                  {t(`contactLensDetails.${key}`)}
                </span>
              </div>
            ))}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="hover:bg-accent cursor-pointer rounded-full px-2 text-base font-medium"
                  onMouseEnter={() => setHoveredEye("R")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("L")}
                  title={t("contactLensDetails.copyFromLeft")}
                >
                  {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
                </span>
              </div>
            )}
            {columns.map(({ key, config }) => (
              <React.Fragment key={`r-${key}`}>
                {config.lookupType ? (
                  renderLookup(
                    "R",
                    key as ContactLensCatalogField,
                    config.lookupType,
                  )
                ) : (
                  <FastInput
                    aria-label={`${t(`contactLensDetails.${key}`)} R`}
                    type={config.type as any}
                    step={config.step}
                    min={config.min}
                    max={config.max}
                    value={getFieldValue("R", key)}
                    onChange={(val) => handleChange("R", key, val)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                  />
                )}
              </React.Fragment>
            ))}

            {needsMiddleSpacer && (
              <>
                {!hideEyeLabels && <div className="h-8" />}
                {columns.map(({ key }) => (
                  <div key={`spacer-${key}`} className="h-8" />
                ))}
              </>
            )}

            {!hideEyeLabels && (
              <div className="flex items-center justify-center">
                <span
                  className="hover:bg-accent cursor-pointer rounded-full px-2 text-base font-medium"
                  onMouseEnter={() => setHoveredEye("L")}
                  onMouseLeave={() => setHoveredEye(null)}
                  onClick={() => copyFromOtherEye("R")}
                  title={t("contactLensDetails.copyFromRight")}
                >
                  {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
                </span>
              </div>
            )}
            {columns.map(({ key, config }) => (
              <React.Fragment key={`l-${key}`}>
                {config.lookupType ? (
                  renderLookup(
                    "L",
                    key as ContactLensCatalogField,
                    config.lookupType,
                  )
                ) : (
                  <FastInput
                    aria-label={`${t(`contactLensDetails.${key}`)} L`}
                    type={config.type as any}
                    step={config.step}
                    min={config.min}
                    max={config.max}
                    value={getFieldValue("L", key)}
                    onChange={(val) => handleChange("L", key, val)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card></div>
  );
}
