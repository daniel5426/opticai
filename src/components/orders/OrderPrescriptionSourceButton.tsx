import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { OrdersHistoryButton } from "@/components/exam/shared/OrdersHistoryButton";
import { PrescriptionSourceModal } from "@/components/exam/PrescriptionSourceModal";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import { orderCardFill, type PrescriptionKind } from "@/lib/prescription-sources";

export interface OrderPrescriptionSource {
  clientId: number;
  /** The order being edited, left out of the list. */
  orderId?: number;
}

/** Beside an order's prescription title: fills the card from the client's earlier orders or exam prescriptions. */
export function OrderPrescriptionSourceButton({
  source,
  kind,
  onChange,
}: {
  source: OrderPrescriptionSource;
  kind: PrescriptionKind;
  onChange: (field: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <OrdersHistoryButton onClick={() => setIsOpen(true)} />
      {isOpen && (
        <PrescriptionSourceModal
          isOpen
          onClose={() => setIsOpen(false)}
          clientId={source.clientId}
          excludeOrderId={source.orderId}
          kind={kind}
          onSelect={(order) => {
            const values = orderCardFill(order, kind);
            if (!values) {
              toast.info(t("prescriptionSourceEmpty"));
              return;
            }
            setIsOpen(false);
            inputSyncManager.flush();
            Object.entries(values).forEach(([field, value]) => onChange(field, value));
          }}
        />
      )}
    </>
  );
}
