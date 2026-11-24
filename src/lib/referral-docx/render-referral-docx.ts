import { saveAs } from "file-saver";
import { buildReferralWord } from "./render-referral-word";
import type { ReferralPrintModel } from "./types";

function buildFileName(data: ReferralPrintModel) {
  const parts = ["הפניה", data.client_name, data.referral_number].filter(Boolean);
  return `${parts.join("_")}.docx`;
}

export async function renderReferralDocx(data: ReferralPrintModel) {
  const blob = buildReferralWord(data).generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
  saveAs(blob, buildFileName(data));
}
