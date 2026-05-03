import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import { describe, expect, test, vi } from "vitest";
import type { LoadedReferralExportContext } from "@/lib/referral-docx";
import { buildReferralPrintModel } from "@/lib/referral-docx";

const referralTemplateKeys = [
  "client_address",
  "client_birth_date",
  "client_id",
  "client_name",
  "clinic_address",
  "clinic_email",
  "clinic_name",
  "clinic_phone",
  "clinical_impression",
  "comb_pd",
  "comb_va",
  "company_address",
  "company_email",
  "company_name",
  "company_phone",
  "examiner_name",
  "l_add",
  "l_ax",
  "l_base",
  "l_cyl",
  "l_iop",
  "l_pd",
  "l_pris",
  "l_sph",
  "l_va",
  "license_number",
  "phone_home",
  "phone_mobile",
  "r_add",
  "r_ax",
  "r_base",
  "r_cyl",
  "r_iop",
  "r_pd",
  "r_pris",
  "r_sph",
  "r_va",
  "recipient",
  "referral_date",
  "referral_notes",
  "referral_number",
  "referral_type",
  "signer_name",
  "signer_title",
  "urgency_level",
];

function createReferralContext(): LoadedReferralExportContext {
  return {
    referral: {
      id: 44,
      client_id: 7,
      clinic_id: 2,
      user_id: 9,
      date: "2026-04-30",
      type: "בדיקת עיניים",
      urgency_level: "urgent",
      recipient: "הרופא המטפל",
      referral_notes: "נא בדיקת המשך.",
      prescription_notes: "מרשם לבדיקה בלבד.",
      referral_data: {
        "clinical-findings": {
          r_iop: 17,
          l_iop: 18,
          clinical_impression: "חשד ליובש משמעותי",
        },
        "compact-prescription": {
          r_sph: -5,
          r_cyl: -0.75,
          r_ax: 158,
          r_va: 6,
          r_pd: 31,
          l_sph: -4.75,
          l_cyl: -1.5,
          l_ax: 145,
          l_va: 6,
          l_pd: 31,
          comb_pd: 62,
        },
      },
    },
    client: {
      id: 7,
      first_name: "הראל",
      last_name: "שלומי",
      national_id: "123456789",
      date_of_birth: "1990-01-02",
      address_street: "נשרים",
      address_number: "24",
      address_city: "גבעת שאול",
      phone_mobile: "050-0000000",
      phone_home: "02-1111111",
    },
    user: {
      id: 9,
      full_name: "שלומי הראל",
      username: "shlomi",
    } as any,
    clinic: {
      id: 2,
      company_id: 1,
      name: "ירושלים",
      location: "ירושלים",
      phone_number: "02-2222222",
      email: "clinic@example.com",
      clinic_address: "כנפי נשרים 24",
      clinic_city: "ירושלים",
      clinic_position: "אופטומטריסט מורשה",
      license_number: "0610",
      unique_id: "jerusalem",
    },
    company: {
      id: 1,
      name: "אופטיקה הראל",
      owner_full_name: "שלומי הראל",
      contact_email: "office@example.com",
      contact_phone: "02-3333333",
      address: "ירושלים",
    },
  };
}

function extractReferralTemplatePlaceholders() {
  const filePath = path.resolve(process.cwd(), "public", "templates", "referral.docx");
  const zip = new PizZip(fs.readFileSync(filePath));
  const xml = zip.file("word/document.xml")?.asText() || "";
  return Array.from(new Set(xml.match(/\{([A-Za-z0-9_]+)\}/g)?.map((token) => token.slice(1, -1)) || [])).sort();
}

describe("referral-docx print model", () => {
  test("buildReferralPrintModel maps referral text and compact prescription data", () => {
    const model = buildReferralPrintModel(createReferralContext());

    expect(model.company_name).toBe("אופטיקה הראל");
    expect(model.clinic_name).toBe("ירושלים");
    expect(model.referral_date).toBe("30.4.2026");
    expect(model.urgency_level).toBe("דחוף");
    expect(model.client_name).toBe("הראל שלומי");
    expect(model.clinical_impression).toBe("חשד ליובש משמעותי");
    expect(model.r_iop).toBe("17 mmHg");
    expect(model.r_sph).toBe("-5.00");
    expect(model.l_ax).toBe("145");
    expect(model.comb_pd).toBe("62");
    expect(model.has_referral_notes).toBe(true);
    expect(model.referral_notes).toBe("נא בדיקת המשך.");
    expect(model.has_clinical_findings).toBe(true);
    expect(model.has_compact_prescription).toBe(true);
  });

  test("buildReferralPrintModel marks empty optional sections as hidden", () => {
    const context = createReferralContext();
    context.referral.referral_notes = "";
    context.referral.referral_data = {};

    const model = buildReferralPrintModel(context);

    expect(model.has_referral_notes).toBe(false);
    expect(model.has_clinical_findings).toBe(false);
    expect(model.has_compact_prescription).toBe(false);
  });
});

describe("referral-docx template audit", () => {
  test("referral template placeholders match the referral print model contract", () => {
    expect(extractReferralTemplatePlaceholders()).toEqual(referralTemplateKeys);
  });
});

vi.mock("@/lib/referral-docx/load-referral-export-context", () => ({
  loadReferralExportContext: vi.fn(async () => createReferralContext()),
}));

vi.mock("@/lib/referral-docx/render-referral-docx", () => ({
  renderReferralDocx: vi.fn(async () => undefined),
}));

describe("exportReferralToDocx", () => {
  test("loads referral context and renders the referral model", async () => {
    const { exportReferralToDocx } = await import("@/lib/referral-docx/export-referral-to-docx");
    const { loadReferralExportContext } = await import("@/lib/referral-docx/load-referral-export-context");
    const { renderReferralDocx } = await import("@/lib/referral-docx/render-referral-docx");

    await exportReferralToDocx({ referralId: 44 });

    expect(loadReferralExportContext).toHaveBeenCalledWith({ referralId: 44 });
    expect(renderReferralDocx).toHaveBeenCalledWith(
      expect.objectContaining({
        referral_number: "44",
        clinic_name: "ירושלים",
        client_name: "הראל שלומי",
      }),
    );
  });
});
