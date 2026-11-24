import { apiClient } from "@/lib/api-client";
import { getBillingByContactLensId, getBillingByOrderId, getOrderLineItemsByBillingId } from "@/lib/db/billing-db";
import { getClientById } from "@/lib/db/clients-db";
import { getContactLensOrderById, getOrderById } from "@/lib/db/orders-db";
import { getUserById } from "@/lib/db/users-db";
import type { Clinic } from "@/lib/db/schema-interface";
import type { LoadedOrderExportContext, OrderExportKind } from "./types";

async function loadClinic(id?: number | null): Promise<Clinic | null> {
  if (!id) return null;
  const response = await apiClient.getRecordClinic(id);
  if (response.error) {
    console.error(`Failed to load clinic ${id}:`, response.error);
    return null;
  }
  return response.data || null;
}

export async function loadOrderExportContext({
  orderId,
  kind,
}: {
  orderId: number;
  kind: OrderExportKind;
}): Promise<LoadedOrderExportContext> {
  // Everything that does not depend on an earlier answer is asked at once, so printing starts quickly.
  const [order, { billing, lineItems }] = await Promise.all([
    kind === "contact" ? getContactLensOrderById(orderId) : getOrderById(orderId),
    (async () => {
      const billing = kind === "contact" ? await getBillingByContactLensId(orderId) : await getBillingByOrderId(orderId);
      return { billing, lineItems: billing?.id ? await getOrderLineItemsByBillingId(billing.id) : [] };
    })(),
  ]);

  if (!order) {
    throw new Error("ההזמנה לא נמצאה");
  }

  const details = (order as any).order_data?.details || {};
  const clinicIds = new Set<number>();

  if (order.clinic_id) clinicIds.add(order.clinic_id);
  if (details.delivery_clinic_id) clinicIds.add(Number(details.delivery_clinic_id));
  if ((order as any).supply_in_clinic_id) {
    clinicIds.add(Number((order as any).supply_in_clinic_id));
  }

  const [client, user, clinics] = await Promise.all([
    order.client_id ? getClientById(order.client_id) : Promise.resolve(undefined),
    order.user_id ? apiClient.getRecordStaff().then(response => response.data?.find(user => user.id === order.user_id) ?? null) : Promise.resolve(null),
    Promise.all(Array.from(clinicIds).map((clinicId) => loadClinic(clinicId))),
  ]);
  const clinicsById = clinics.reduce<Record<number, Clinic>>((acc, clinic) => {
    if (clinic?.id) acc[clinic.id] = clinic;
    return acc;
  }, {});

  return {
    kind,
    order,
    client,
    user,
    billing,
    lineItems,
    clinicsById,
  };
}
