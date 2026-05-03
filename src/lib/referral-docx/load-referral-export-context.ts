import { apiClient } from "@/lib/api-client";
import { getClientById } from "@/lib/db/clients-db";
import { getReferralById } from "@/lib/db/referral-db";
import { getUserById } from "@/lib/db/users-db";
import type { Clinic, Company } from "@/lib/db/schema-interface";
import type { LoadedReferralExportContext } from "./types";

async function loadClinic(id?: number | null): Promise<Clinic | null> {
  if (!id) return null;
  const response = await apiClient.getClinic(id);
  if (response.error) {
    console.error(`Failed to load clinic ${id}:`, response.error);
    return null;
  }
  return response.data || null;
}

async function loadCompany(id?: number | null): Promise<Company | null> {
  if (!id) return null;
  const response = await apiClient.getCompany(id);
  if (response.error) {
    console.error(`Failed to load company ${id}:`, response.error);
    return null;
  }
  return response.data || null;
}

export async function loadReferralExportContext({
  referralId,
}: {
  referralId: number;
}): Promise<LoadedReferralExportContext> {
  const referral = await getReferralById(referralId);

  if (!referral) {
    throw new Error("ההפניה לא נמצאה");
  }

  const [client, user] = await Promise.all([
    referral.client_id ? getClientById(referral.client_id) : Promise.resolve(undefined),
    referral.user_id ? getUserById(referral.user_id) : Promise.resolve(null),
  ]);

  const clinic = await loadClinic(referral.clinic_id ?? client?.clinic_id);
  const company = await loadCompany(clinic?.company_id);

  return {
    referral,
    client,
    user,
    clinic,
    company,
  };
}
