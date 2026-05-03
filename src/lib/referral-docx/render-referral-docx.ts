import { docxGenerator } from "@/lib/docx-generator";
import type { ReferralPrintModel } from "./types";

const TEMPLATE_PATH = "/templates/referral.docx";

function buildFileName(data: ReferralPrintModel) {
  const parts = ["הפניה", data.client_name, data.referral_number].filter(Boolean);
  return `${parts.join("_")}.docx`;
}

export async function renderReferralDocx(data: ReferralPrintModel) {
  await docxGenerator.generate(data, buildFileName(data), TEMPLATE_PATH);
}
