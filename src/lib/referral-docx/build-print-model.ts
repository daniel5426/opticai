import {
  formatAddress,
  formatAxis,
  formatDate,
  formatOpticalNumber,
  formatPhone,
  formatPlainNumber,
  toDisplayString,
} from "@/lib/order-docx/formatters";
import type { CompactPrescriptionExam } from "@/lib/db/schema-interface";
import type { LoadedReferralExportContext, ReferralPrintModel } from "./types";

function getClientName(context: LoadedReferralExportContext) {
  const client = context.client;
  const fromReferral = context.referral.client_full_name || "";
  return (
    [client?.first_name, client?.last_name].filter(Boolean).join(" ").trim() ||
    fromReferral
  );
}

function getUrgencyLabel(value?: string | null) {
  switch (value) {
    case "routine":
      return "שגרתי";
    case "urgent":
      return "דחוף";
    case "emergency":
      return "חירום";
    default:
      return toDisplayString(value);
  }
}

function getClinicName(context: LoadedReferralExportContext) {
  return (
    context.clinic?.clinic_name ||
    context.clinic?.name ||
    context.company?.name ||
    ""
  );
}

function getExaminerName(context: LoadedReferralExportContext) {
  return (
    context.referral.examiner_name ||
    context.user?.full_name ||
    context.user?.username ||
    context.clinic?.manager_name ||
    ""
  );
}

function formatIop(value: unknown) {
  const formatted = formatPlainNumber(value as string | number | null);
  return formatted ? `${formatted} mmHg` : "";
}

export function buildReferralPrintModel(
  context: LoadedReferralExportContext,
): ReferralPrintModel {
  const referral = context.referral;
  const client = context.client;
  const clinic = context.clinic;
  const company = context.company;
  const referralData = referral.referral_data || {};
  const clinicalFindings = (referralData["clinical-findings"] || {}) as Record<string, unknown>;
  const compactPrescription = (referralData["compact-prescription"] || {}) as CompactPrescriptionExam & Record<string, unknown>;

  const clientName = getClientName(context);
  const clinicName = getClinicName(context);
  const examinerName = getExaminerName(context);
  const referralNotes = toDisplayString(referral.referral_notes);
  const clinicalImpression = toDisplayString(clinicalFindings.clinical_impression);
  const rIop = formatIop(clinicalFindings.r_iop);
  const lIop = formatIop(clinicalFindings.l_iop);

  const rSph = formatOpticalNumber(compactPrescription.r_sph);
  const rCyl = formatOpticalNumber(compactPrescription.r_cyl);
  const rAx = formatAxis(compactPrescription.r_ax);
  const rPris = formatOpticalNumber(compactPrescription.r_pris);
  const rBase = toDisplayString(compactPrescription.r_base);
  const rVa = formatPlainNumber(compactPrescription.r_va);
  const rAdd = formatOpticalNumber(compactPrescription.r_ad);
  const rPd = formatPlainNumber(compactPrescription.r_pd);
  const lSph = formatOpticalNumber(compactPrescription.l_sph);
  const lCyl = formatOpticalNumber(compactPrescription.l_cyl);
  const lAx = formatAxis(compactPrescription.l_ax);
  const lPris = formatOpticalNumber(compactPrescription.l_pris);
  const lBase = toDisplayString(compactPrescription.l_base);
  const lVa = formatPlainNumber(compactPrescription.l_va);
  const lAdd = formatOpticalNumber(compactPrescription.l_ad);
  const lPd = formatPlainNumber(compactPrescription.l_pd);
  const combVa = formatPlainNumber(compactPrescription.comb_va);
  const combPd = formatPlainNumber(compactPrescription.comb_pd);
  const hasClinicalFindings = [clinicalImpression, rIop, lIop].some(Boolean);
  const hasCompactPrescription = [
    rSph,
    rCyl,
    rAx,
    rPris,
    rBase,
    rVa,
    rAdd,
    rPd,
    lSph,
    lCyl,
    lAx,
    lPris,
    lBase,
    lVa,
    lAdd,
    lPd,
    combVa,
    combPd,
  ].some(Boolean);

  return {
    company_name: toDisplayString(company?.name),
    company_address: toDisplayString(company?.address),
    company_phone: formatPhone(company?.contact_phone),
    company_email: toDisplayString(company?.contact_email),
    clinic_name: clinicName,
    clinic_address: formatAddress([
      clinic?.clinic_address,
      clinic?.clinic_city || clinic?.location,
      clinic?.clinic_postal_code,
    ]),
    clinic_phone: formatPhone(clinic?.phone_number),
    clinic_email: toDisplayString(clinic?.email),
    clinic_website: toDisplayString(clinic?.clinic_website),
    referral_number: toDisplayString(referral.id),
    referral_date: formatDate(referral.date),
    referral_type: toDisplayString(referral.type),
    urgency_level: getUrgencyLabel(referral.urgency_level),
    recipient: toDisplayString(referral.recipient),
    client_name: clientName,
    client_id: toDisplayString(client?.national_id || client?.id || referral.client_id),
    client_birth_date: formatDate(client?.date_of_birth),
    client_address: formatAddress([
      [client?.address_street, client?.address_number].filter(Boolean).join(" ").trim(),
      client?.address_city,
    ]),
    phone_mobile: formatPhone(client?.phone_mobile),
    phone_home: formatPhone(client?.phone_home),
    examiner_name: examinerName,
    has_referral_notes: Boolean(referralNotes.trim()),
    referral_notes: referralNotes,
    has_clinical_findings: hasClinicalFindings,
    clinical_impression: clinicalImpression,
    r_iop: rIop,
    l_iop: lIop,
    has_compact_prescription: hasCompactPrescription,
    r_sph: rSph,
    r_cyl: rCyl,
    r_ax: rAx,
    r_pris: rPris,
    r_base: rBase,
    r_va: rVa,
    r_add: rAdd,
    r_pd: rPd,
    l_sph: lSph,
    l_cyl: lCyl,
    l_ax: lAx,
    l_pris: lPris,
    l_base: lBase,
    l_va: lVa,
    l_add: lAdd,
    l_pd: lPd,
    comb_va: combVa,
    comb_pd: combPd,
    signer_name: examinerName,
    signer_title: toDisplayString(clinic?.clinic_position),
    license_number: toDisplayString(clinic?.license_number),
  };
}
