import React from "react";
import { useTranslation } from "react-i18next";
import { ExamToolbox } from "@/components/exam/ExamToolbox";
import { OrderFinalPrescriptionTab } from "@/components/orders/OrderFinalPrescriptionTab";
import type { FinalPrescriptionExam, Order, User } from "@/lib/db/schema-interface";
import type { CatalogVariant, FulfillmentSource, InventorySelection } from "@/lib/inventory";
import { useClientSidebar } from "@/contexts/ClientSidebarContext";
import { cn } from "@/utils/tailwind";
import { OrderSheet, OrderSheetRow } from "./layout/OrderSheet";
import { OrderNotesRow } from "./layout/OrderNotesRow";
import { OrderMetaStrip } from "./OrderMetaStrip";
import { LensSection } from "./regular/LensSection";
import { FrameSection } from "./regular/FrameSection";
import { FulfillmentSection } from "./regular/FulfillmentSection";
import type { Frame, LensFrameTab, OrderDetails, OrderLens } from "./regular/types";

interface RegularOrderTabProps {
  hideMetadata?: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  isEditing: boolean;
  users: User[];
  formData: Order;
  setFormData: React.Dispatch<React.SetStateAction<Order>>;
  onSelectChange: (value: string, name: string) => void;
  finalPrescriptionData: FinalPrescriptionExam;
  onFinalPrescriptionChange: (field: keyof FinalPrescriptionExam, value: string) => void;
  currentCard: { id: string; type: any };
  allRows: any;
  clipboardSourceType: any;
  onToolboxClearData: () => void;
  onToolboxCopy: () => void;
  onToolboxPaste: () => void;
  lensFrameTab: LensFrameTab;
  onLensFieldChange: (field: keyof OrderLens, value: string) => void;
  onFrameFieldChange: (field: keyof Frame, value: string) => void;
  selectedFrameInventory?: InventorySelection | null;
  onFrameInventorySelect: (variant: CatalogVariant, source: FulfillmentSource) => void;
  onFrameInventoryClear: () => void;
  orderDetailsFormData: OrderDetails;
  setOrderDetailsFormData: React.Dispatch<React.SetStateAction<OrderDetails>>;
  clientOrderIndex?: number | null;
}

const noop = () => {};

export default function RegularOrderTab({
  hideMetadata = false,
  formRef,
  isEditing,
  users,
  formData,
  setFormData,
  finalPrescriptionData,
  onFinalPrescriptionChange,
  currentCard,
  allRows,
  clipboardSourceType,
  onToolboxClearData,
  onToolboxCopy,
  onToolboxPaste,
  lensFrameTab,
  onLensFieldChange,
  onFrameFieldChange,
  selectedFrameInventory,
  onFrameInventorySelect,
  onFrameInventoryClear,
  orderDetailsFormData,
  setOrderDetailsFormData,
  clientOrderIndex,
}: RegularOrderTabProps) {
  const { t } = useTranslation();
  const { currentClient } = useClientSidebar();
  const lens = lensFrameTab?.lens || ({ order_id: 0 } as OrderLens);
  const frame = lensFrameTab?.frame || ({ order_id: 0 } as Frame);

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
            values={formData}
            editing={isEditing}
            onChange={(patch) => setFormData((previous) => ({ ...previous, ...patch }))}
          />
        )}

        <div className="bg-card relative" data-clinical-nav-card="true">
          {isEditing && (
            <ExamToolbox
              isEditing={isEditing}
              mode="detail"
              currentCard={currentCard}
              allRows={allRows}
              currentRowIndex={0}
              currentCardIndex={0}
              clipboardSourceType={clipboardSourceType}
              onClearData={onToolboxClearData}
              onCopy={onToolboxCopy}
              onPaste={onToolboxPaste}
              onCopyLeft={noop}
              onCopyRight={noop}
              onCopyBelow={noop}
            />
          )}
          <OrderFinalPrescriptionTab
            finalPrescriptionData={finalPrescriptionData}
            onFinalPrescriptionChange={(field, value) =>
              onFinalPrescriptionChange(field as keyof FinalPrescriptionExam, value)
            }
            isEditing={isEditing}
          />
        </div>

        <OrderSheetRow className="lg:grid-cols-2">
          <LensSection
            lens={lens}
            layoutKey={lensFrameTab?.id || ""}
            isEditing={isEditing}
            onLensFieldChange={onLensFieldChange}
          />
          <FrameSection
            frame={frame}
            isEditing={isEditing}
            onFrameFieldChange={onFrameFieldChange}
            selectedInventory={selectedFrameInventory}
            onInventorySelect={onFrameInventorySelect}
            onInventoryClear={onFrameInventoryClear}
          />
        </OrderSheetRow>

        <FulfillmentSection
          details={orderDetailsFormData}
          setDetails={setOrderDetailsFormData}
          lens={lens}
          frame={frame}
          onLensFieldChange={onLensFieldChange}
          onFrameFieldChange={onFrameFieldChange}
          users={users}
          clientOrderIndex={clientOrderIndex}
          isEditing={isEditing}
        />

        <OrderNotesRow
          disabled={!isEditing}
          notes={[
            {
              key: "notes",
              title: t("orderWorkspace.notes"),
              value: orderDetailsFormData.notes || "",
              onChange: (notes) =>
                setOrderDetailsFormData((previous) => ({ ...previous, notes })),
            },
            {
              key: "lens_order_notes",
              title: t("orderWorkspace.supplierNotes"),
              value: orderDetailsFormData.lens_order_notes || "",
              onChange: (lens_order_notes) =>
                setOrderDetailsFormData((previous) => ({ ...previous, lens_order_notes })),
            },
          ]}
        />
      </OrderSheet>
    </form>
  );
}
