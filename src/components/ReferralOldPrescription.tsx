import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { OldRefractionTab } from "@/components/exam/OldRefractionTab";
import { PrescriptionSourceModal } from "@/components/exam/PrescriptionSourceModal";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import type { OldRefractionExam } from "@/lib/db/schema-interface";
import { oldRefractionFill, type OldPrescription } from "@/lib/old-refraction-source";

interface ReferralOldPrescriptionProps {
  clientId: number;
  data: OldPrescription;
  isEditing: boolean;
  onChange: (changes: OldPrescription) => void;
}

const noop = () => {};

/** A referral's old prescription: one Old Refraction card, filled from the client's orders or exams. */
export function ReferralOldPrescription({ clientId, data, isEditing, onChange }: ReferralOldPrescriptionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div data-clinical-nav-scope="true" data-clinical-nav-card="true" dir="ltr">
      <OldRefractionTab
        oldRefractionData={data as OldRefractionExam}
        onOldRefractionChange={(field, value) => onChange({ [field]: value })}
        isEditing={isEditing}
        hideTabs
        tabCount={1}
        activeTab={0}
        onMultifocalClick={noop}
        onTabChange={noop}
        onAddTab={noop}
        onShowOrdersHistory={isEditing && clientId ? () => setIsOpen(true) : undefined}
      />
      {isOpen && (
        <PrescriptionSourceModal
          isOpen
          onClose={() => setIsOpen(false)}
          clientId={clientId}
          kind="glasses"
          onSelect={(order) => {
            const values = oldRefractionFill(order);
            if (!values) {
              toast.info(t("prescriptionSourceEmpty"));
              return;
            }
            setIsOpen(false);
            inputSyncManager.flush();
            onChange(values);
          }}
        />
      )}
    </div>
  );
}
