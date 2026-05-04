import { buildReferralPrintModel } from "./build-print-model";
import { loadReferralExportContext } from "./load-referral-export-context";
import { printReferralPdf as printRenderedReferralPdf, renderReferralPdf } from "./render-referral-pdf";

export async function exportReferralToPdf({
  referralId,
}: {
  referralId: number;
}) {
  if (!referralId) {
    throw new Error("חסר מזהה הפניה לייצוא");
  }

  const context = await loadReferralExportContext({ referralId });
  const data = buildReferralPrintModel(context);
  return renderReferralPdf(data);
}

export async function printReferralPdf({
  referralId,
}: {
  referralId: number;
}) {
  if (!referralId) {
    throw new Error("חסר מזהה הפניה להדפסה");
  }

  const context = await loadReferralExportContext({ referralId });
  const data = buildReferralPrintModel(context);
  return printRenderedReferralPdf(data);
}
