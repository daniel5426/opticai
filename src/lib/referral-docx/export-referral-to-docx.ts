import { buildReferralPrintModel } from "./build-print-model";
import { loadReferralExportContext } from "./load-referral-export-context";
import { renderReferralDocx } from "./render-referral-docx";

export async function exportReferralToDocx({
  referralId,
}: {
  referralId: number;
}) {
  if (!referralId) {
    throw new Error("חסר מזהה הפניה לייצוא");
  }

  const context = await loadReferralExportContext({ referralId });
  const data = buildReferralPrintModel(context);
  await renderReferralDocx(data);
}
