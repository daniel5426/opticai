import React, { useEffect, useState } from "react";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";
import { useClientSidebar } from "@/contexts/ClientSidebarContext";
import { cn } from "@/utils/tailwind";
import { OrderSheet } from "@/components/orders/layout/OrderSheet";
import { OrderNotesRow } from "@/components/orders/layout/OrderNotesRow";
import { OrderMetaStrip } from "@/components/orders/OrderMetaStrip";
import { ContactLensDetailsTab } from "@/components/exam/ContactLensDetailsTab";
import { ContactLensExamTab } from "@/components/exam/ContactLensExamTab";
import { ContactLensOrderTab } from "@/components/exam/ContactLensOrderTab";
import { ExamToolbox } from "@/components/exam/ExamToolbox";
import { User } from "@/lib/db/schema-interface";
import { ExamComponentType, ExamFieldMapper } from "@/lib/exam-field-mappings";
import {
  copyToClipboard,
  getClipboardContentType,
  pasteFromClipboard,
} from "@/lib/exam-clipboard";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import {
  canCreateContactLensCatalogProduct,
  ContactLensCatalogValues,
  hasMatchingContactLensCatalogVariant,
} from "@/components/inventory/ContactLensCatalogCombobox";
import {
  CatalogVariant,
  FulfillmentSource,
  InventorySelection,
} from "@/lib/inventory";

interface ContactOrderTabProps {
  hideMetadata?: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  isEditing: boolean;
  users: User[];
  contactFormData: any;
  setContactFormData: React.Dispatch<React.SetStateAction<any>>;
  contactLensDetailsData: any;
  setContactLensDetailsData: React.Dispatch<React.SetStateAction<any>>;
  contactLensExamData: any;
  setContactLensExamData: React.Dispatch<React.SetStateAction<any>>;
  clinicId?: number;
  rightInventorySelection?: InventorySelection | null;
  leftInventorySelection?: InventorySelection | null;
  onInventorySelect: (
    side: "right" | "left",
    variant: CatalogVariant,
    source: FulfillmentSource,
  ) => void;
  onInventoryClear: (side: "right" | "left") => void;
  onInventoryRelevantFieldChange: (
    field: string,
    value: unknown,
  ) => boolean | void;
  clientOrderIndex?: number | null;
}

const noop = () => {};

export default function ContactOrderTab({
  hideMetadata = false,
  formRef,
  isEditing,
  users,
  contactFormData,
  setContactFormData,
  contactLensDetailsData,
  setContactLensDetailsData,
  contactLensExamData,
  setContactLensExamData,
  clinicId,
  rightInventorySelection,
  leftInventorySelection,
  onInventorySelect,
  onInventoryRelevantFieldChange,
  clientOrderIndex,
}: ContactOrderTabProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const { currentClient } = useClientSidebar();
  const [clipboardSourceType, setClipboardSourceType] =
    useState<ExamComponentType | null>(null);
  const [catalogVariants, setCatalogVariants] = useState<CatalogVariant[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  useEffect(() => {
    setClipboardSourceType(getClipboardContentType());
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!clinicId) {
      setCatalogVariants([]);
      setIsLoadingCatalog(false);
      return;
    }

    setIsLoadingCatalog(true);
    void apiClient
      .getInventoryVariants(clinicId, {
        category: "contact_lens",
      })
      .then((response) => {
        if (isMounted) setCatalogVariants(response.data?.items || []);
      })
      .catch((error) => {
        if (isMounted) setCatalogVariants([]);
        console.error("Failed to load contact-lens catalog", error);
      })
      .finally(() => {
        if (isMounted) setIsLoadingCatalog(false);
      });

    return () => {
      isMounted = false;
    };
  }, [clinicId]);

  const contactLensExamCard = {
    id: "contact-lens-exam-order",
    type: "contact-lens-exam" as ExamComponentType,
  };
  const contactLensDetailsCard = {
    id: "contact-lens-details-order",
    type: "contact-lens-details" as ExamComponentType,
  };

  const applyToContactLensExam = (nextData: Record<string, unknown>) => {
    const allowedEntries = Object.entries(nextData).filter(
      ([key, value]) =>
        key !== "id" &&
        key !== "layout_instance_id" &&
        value !== undefined &&
        onInventoryRelevantFieldChange(key, value) !== false,
    );
    setContactLensExamData((prev: any) => {
      const updated = { ...prev };
      allowedEntries.forEach(([key, value]) => {
        updated[key] = value;
      });
      return updated;
    });
  };

  const applyToContactLensDetails = (nextData: Record<string, unknown>) => {
    const allowedEntries = Object.entries(nextData).filter(
      ([key, value]) =>
        key !== "id" &&
        key !== "layout_instance_id" &&
        value !== undefined &&
        onInventoryRelevantFieldChange(key, value) !== false,
    );
    setContactLensDetailsData((prev: any) => {
      const updated = { ...prev };
      allowedEntries.forEach(([key, value]) => {
        updated[key] = value;
      });
      return updated;
    });
  };

  const catalogValuesFor = (
    side: "right" | "left",
  ): ContactLensCatalogValues => {
    const prefix = side === "right" ? "r" : "l";
    return {
      type:
        contactLensDetailsData[`${prefix}_type`] ??
        contactLensDetailsData[`${prefix}_lens_type`],
      model: contactLensDetailsData[`${prefix}_model`],
      supplier: contactLensDetailsData[`${prefix}_supplier`],
      material: contactLensDetailsData[`${prefix}_material`],
      color: contactLensDetailsData[`${prefix}_color`],
    };
  };

  const createContactLensCatalogProduct = async (side: "right" | "left") => {
    const values = catalogValuesFor(side);
    if (!clinicId || !canCreateContactLensCatalogProduct(values)) {
      throw new Error("Contact-lens catalog product is incomplete");
    }

    const response = await apiClient.createCatalogEntry({
      clinic_id: clinicId,
      category: "contact_lens",
      product: {
        model: values.model,
        product_type: values.type,
        material: values.material,
        preferred_supplier: values.supplier,
      },
      variant: {
        attributes: values.color ? { color: values.color } : {},
        is_stockable: false,
      },
    });
    if (response.error || !response.data) {
      throw new Error(
        String(response.error || "Catalog product creation failed"),
      );
    }

    const createdVariant = response.data;
    setCatalogVariants((current) => {
      const withoutCurrent = current.filter(
        (variant) => variant.id !== createdVariant.id,
      );
      return [...withoutCurrent, createdVariant].sort((left, right) =>
        left.display_name.localeCompare(right.display_name, "he"),
      );
    });
    onInventorySelect(side, createdVariant, "supplier_ordered");
    toast.success(
      t("inventoryProductCreated", { name: createdVariant.display_name }),
    );
  };

  const catalogProductActionFor = (side: "right" | "left") => {
    const values = catalogValuesFor(side);
    if (
      !clinicId ||
      !canCreateContactLensCatalogProduct(values) ||
      hasMatchingContactLensCatalogVariant(catalogVariants, values)
    ) {
      return undefined;
    }
    return {
      name: [values.model, values.type].filter(Boolean).join(" · "),
      onCreate: () => createContactLensCatalogProduct(side),
    };
  };

  const handleToolboxClear = (targetType: ExamComponentType) => {
    inputSyncManager.flush();
    if (targetType === "contact-lens-exam") {
      applyToContactLensExam(
        ExamFieldMapper.clearData(contactLensExamData, targetType) as Record<
          string,
          unknown
        >,
      );
      return;
    }
    applyToContactLensDetails(
      ExamFieldMapper.clearData(contactLensDetailsData, targetType) as Record<
        string,
        unknown
      >,
    );
  };

  const handleToolboxCopy = (sourceType: ExamComponentType) => {
    inputSyncManager.flush();
    const sourceData =
      sourceType === "contact-lens-exam"
        ? contactLensExamData
        : contactLensDetailsData;
    copyToClipboard(sourceType, sourceData);
    setClipboardSourceType(sourceType);
    toast.success("נתונים הועתקו");
  };

  const handleToolboxPaste = (targetType: ExamComponentType) => {
    inputSyncManager.flush();
    const clipboardContent = pasteFromClipboard();
    if (!clipboardContent) {
      toast.error("אין נתונים בלוח ההעתקה");
      return;
    }

    const { type: sourceType, data: sourceData } = clipboardContent;
    const isCompatible =
      sourceType === targetType ||
      ExamFieldMapper.getAvailableTargets(sourceType, [targetType]).includes(
        targetType,
      );

    if (!isCompatible) {
      toast.error("נתונים לא תואמים");
      return;
    }

    const targetData =
      targetType === "contact-lens-exam"
        ? contactLensExamData
        : contactLensDetailsData;

    const copiedData = ExamFieldMapper.copyData(
      sourceData as Record<string, unknown>,
      targetData as Record<string, unknown>,
      sourceType,
      targetType,
    );

    if (targetType === "contact-lens-exam") {
      applyToContactLensExam(copiedData);
    } else {
      applyToContactLensDetails(copiedData);
    }

    setClipboardSourceType(sourceType);
    toast.success("נתונים הודבקו בהצלחה");
  };

  const examCardProps = (card: { id: string; type: ExamComponentType }) => ({
    isEditing,
    mode: "detail" as const,
    currentCard: card as any,
    allRows: [[card as any]],
    currentRowIndex: 0,
    currentCardIndex: 0,
    clipboardSourceType,
    onClearData: () => handleToolboxClear(card.type),
    onCopy: () => handleToolboxCopy(card.type),
    onPaste: () => handleToolboxPaste(card.type),
    onCopyLeft: noop,
    onCopyRight: noop,
    onCopyBelow: noop,
  });

  const guardedChange =
    (setter: React.Dispatch<React.SetStateAction<any>>) =>
    (field: string | number | symbol, value: unknown) => {
      if (onInventoryRelevantFieldChange(String(field), value) === false) return;
      setter((prev: any) => ({ ...prev, [field]: value }));
    };

  return (
    <form
      ref={formRef}
      data-clinical-nav-scope="true"
      className={cn("no-scrollbar", hideMetadata ? "order-group-content" : "pt-4 pb-10")}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <OrderSheet
        className={cn(!hideMetadata && "border-border/50 rounded-xl border shadow-sm")}
      >
        {!hideMetadata && (
          <OrderMetaStrip
            client={currentClient}
            caption={
              clientOrderIndex
                ? t("orderWorkspace.clientOrderIndex", { index: clientOrderIndex })
                : undefined
            }
            values={contactFormData}
            editing={isEditing}
            onChange={(patch) => setContactFormData((prev: any) => ({ ...prev, ...patch }))}
          />
        )}

        <div className="bg-card relative" data-clinical-nav-card="true">
          <ExamToolbox {...examCardProps(contactLensExamCard)} />
          <ContactLensExamTab
            contactLensExamData={contactLensExamData}
            onContactLensExamChange={guardedChange(setContactLensExamData)}
            isEditing={isEditing}
          />
        </div>

        <div className="bg-card relative" data-clinical-nav-card="true">
          <ExamToolbox {...examCardProps(contactLensDetailsCard)} />
          <ContactLensDetailsTab
            contactLensDetailsData={contactLensDetailsData}
            onContactLensDetailsChange={guardedChange(setContactLensDetailsData)}
            isEditing={isEditing}
            inventoryCatalog={
              clinicId
                ? {
                    variants: catalogVariants,
                    loading: isLoadingCatalog,
                    rightValues: catalogValuesFor("right"),
                    leftValues: catalogValuesFor("left"),
                    rightCreateProduct: catalogProductActionFor("right"),
                    leftCreateProduct: catalogProductActionFor("left"),
                    rightDisabled: rightInventorySelection?.lifecycle_state === "consumed",
                    leftDisabled: leftInventorySelection?.lifecycle_state === "consumed",
                    onSelect: onInventorySelect,
                  }
                : undefined
            }
          />
        </div>

        <div className="bg-card" dir={direction} data-clinical-nav-card="true">
          <ContactLensOrderTab
            contactLensOrder={contactFormData}
            onContactLensOrderChange={(field: any, value: any) =>
              setContactFormData((prev: any) => ({ ...prev, [field]: value }))
            }
            isEditing={isEditing}
            users={users}
          />
        </div>

        <OrderNotesRow
          disabled={!isEditing}
          notes={[
            {
              key: "notes",
              title: t("orderWorkspace.notes"),
              value: contactFormData.notes || "",
              onChange: (notes) => setContactFormData((prev: any) => ({ ...prev, notes })),
            },
            {
              key: "supplier_notes",
              title: t("orderWorkspace.supplierNotes"),
              value: contactFormData.supplier_notes || "",
              onChange: (supplier_notes) =>
                setContactFormData((prev: any) => ({ ...prev, supplier_notes })),
            },
          ]}
        />
      </OrderSheet>
    </form>
  );
}
