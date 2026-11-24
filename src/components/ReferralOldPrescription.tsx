import React, { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExamToolbox } from "@/components/exam/ExamToolbox";
import { OldRefractionTab } from "@/components/exam/OldRefractionTab";
import { PrescriptionSourceModal } from "@/components/exam/PrescriptionSourceModal";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import { copyToClipboard, pasteFromClipboard } from "@/lib/exam-clipboard";
import { ExamFieldMapper, type ExamComponentType } from "@/lib/exam-field-mappings";
import type { OldRefractionExam } from "@/lib/db/schema-interface";
import { oldRefractionFill, type OldPrescription } from "@/lib/old-refraction-source";

interface ReferralOldPrescriptionProps {
  clientId: number;
  data: OldPrescription;
  isEditing: boolean;
  onChange: (changes: OldPrescription) => void;
  /** What the exam clipboard holds, shared with the page's other card. */
  clipboardSourceType: ExamComponentType | null;
  onCopied: (type: ExamComponentType) => void;
}

const TYPE: ExamComponentType = "old-refraction";
const CARD = { id: TYPE, type: TYPE };
const noop = () => {};

/** A referral's old prescription: one Old Refraction card, filled from the client's orders or exams. */
export function ReferralOldPrescription({ clientId, data, isEditing, onChange, clipboardSourceType, onCopied }: ReferralOldPrescriptionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  // Typing that is still on its way to the page is taken too.
  const dataRef = useRef(data);
  dataRef.current = data;
  const flush = () => flushSync(() => inputSyncManager.flush());

  const copy = () => {
    flush();
    copyToClipboard(TYPE, dataRef.current as Parameters<typeof copyToClipboard>[1]);
    onCopied(TYPE);
    toast.success(t("referralOldCopied"));
  };
  const paste = () => {
    flush();
    const clipboard = pasteFromClipboard();
    if (!clipboard || (clipboard.type !== TYPE && !ExamFieldMapper.getAvailableTargets(clipboard.type, [TYPE]).includes(TYPE))) {
      toast.error(t("referralOldCannotPaste"));
      return;
    }
    const source = clipboard.data as Record<string, unknown>;
    const copied = ExamFieldMapper.copyData(source, {}, clipboard.type, TYPE);
    // The glasses type belongs to the prescription that was there before.
    const type = clipboard.type === TYPE ? String(source.r_glasses_type || "") : "";
    onChange({
      ...Object.fromEntries(Object.entries(copied).map(([field, value]) => [field, String(value ?? "")])),
      r_glasses_type: type,
      l_glasses_type: type,
    });
    toast.success(t("referralOldPasted"));
  };
  const clear = () => {
    flush();
    onChange({ ...ExamFieldMapper.clearData({}, TYPE), r_glasses_type: "", l_glasses_type: "" });
  };

  return (
    <div className="relative" data-clinical-nav-scope="true" data-clinical-nav-card="true" dir="ltr">
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
      <ExamToolbox
        isEditing={isEditing}
        mode="detail"
        currentCard={CARD}
        allRows={[[CARD]]}
        currentRowIndex={0}
        currentCardIndex={0}
        clipboardSourceType={clipboardSourceType}
        onClearData={clear}
        onCopy={copy}
        onPaste={paste}
        onCopyLeft={noop}
        onCopyRight={noop}
        onCopyBelow={noop}
        showClear
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
