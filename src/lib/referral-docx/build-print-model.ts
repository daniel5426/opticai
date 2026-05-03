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

function joinInline(parts: Array<string | undefined | null>) {
  return parts
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join(" | ");
}

function labelValue(label: string, value: string) {
  return value ? `${label}: ${value}` : "";
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
  const companyInfo = joinInline([
    toDisplayString(company?.name),
    toDisplayString(company?.address),
    formatPhone(company?.contact_phone),
    toDisplayString(company?.contact_email),
  ]);
  const clinicAddress = formatAddress([
    clinic?.clinic_address,
    clinic?.clinic_city || clinic?.location,
    clinic?.clinic_postal_code,
  ]);
  const clinicInfo = joinInline([
    clinicName,
    clinicAddress,
    formatPhone(clinic?.phone_number),
    toDisplayString(clinic?.email),
  ]);
  const referralDetails = joinInline([
    labelValue("מס' הפניה", toDisplayString(referral.id)),
    labelValue("תאריך", formatDate(referral.date)),
    labelValue("סוג הפניה", toDisplayString(referral.type)),
    labelValue("דחיפות", getUrgencyLabel(referral.urgency_level)),
  ]);
  const recipientLine = labelValue("לכבוד", toDisplayString(referral.recipient));
  const clientAddress = formatAddress([
    [client?.address_street, client?.address_number].filter(Boolean).join(" ").trim(),
    client?.address_city,
  ]);
  const clientDetails = joinInline([
    labelValue("מטופל", clientName),
    labelValue("ת.ז / מספר לקוח", toDisplayString(client?.national_id || client?.id || referral.client_id)),
    labelValue("תאריך לידה", formatDate(client?.date_of_birth)),
  ]);
  const clientContact = joinInline([
    labelValue("נייד", formatPhone(client?.phone_mobile)),
    labelValue("טלפון בית", formatPhone(client?.phone_home)),
    labelValue("כתובת", clientAddress),
  ]);
  const clinicalFindingsText = joinInline([
    labelValue("הערכה / אבחנה", clinicalImpression),
    labelValue("R-IOP", rIop),
    labelValue("L-IOP", lIop),
  ]);
  const signatureText = joinInline([
    "בברכה",
    examinerName,
    toDisplayString(clinic?.clinic_position),
    labelValue("מ.ר.", toDisplayString(clinic?.license_number)),
  ]);
  const hasClinicalFindings = Boolean(clinicalFindingsText);
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
    clinic_address: clinicAddress,
    clinic_phone: formatPhone(clinic?.phone_number),
    clinic_email: toDisplayString(clinic?.email),
    clinic_website: toDisplayString(clinic?.clinic_website),
    has_company_info: Boolean(companyInfo),
    company_info: companyInfo,
    has_clinic_info: Boolean(clinicInfo),
    clinic_info: clinicInfo,
    referral_number: toDisplayString(referral.id),
    referral_date: formatDate(referral.date),
    referral_type: toDisplayString(referral.type),
    urgency_level: getUrgencyLabel(referral.urgency_level),
    has_referral_details: Boolean(referralDetails),
    referral_details: referralDetails,
    recipient: toDisplayString(referral.recipient),
    has_recipient: Boolean(recipientLine),
    recipient_line: recipientLine,
    client_name: clientName,
    client_id: toDisplayString(client?.national_id || client?.id || referral.client_id),
    client_birth_date: formatDate(client?.date_of_birth),
    client_address: clientAddress,
    phone_mobile: formatPhone(client?.phone_mobile),
    phone_home: formatPhone(client?.phone_home),
    has_client_details: Boolean(clientDetails),
    client_details: clientDetails,
    has_client_contact: Boolean(clientContact),
    client_contact: clientContact,
    examiner_name: examinerName,
    has_referral_notes: Boolean(referralNotes.trim()),
    referral_notes: referralNotes,
    has_clinical_findings: hasClinicalFindings,
    clinical_findings_text: clinicalFindingsText,
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
    has_signature: Boolean(signatureText),
    signature_text: signatureText,
    signer_name: examinerName,
    signer_title: toDisplayString(clinic?.clinic_position),
    license_number: toDisplayString(clinic?.license_number),
  };
}
