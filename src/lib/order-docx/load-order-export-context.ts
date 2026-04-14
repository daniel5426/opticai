import { apiClient } from "@/lib/api-client";
import { getBillingByContactLensId, getBillingByOrderId, getOrderLineItemsByBillingId } from "@/lib/db/billing-db";
import { getClientById } from "@/lib/db/clients-db";
import { getContactLensOrderById, getOrderById } from "@/lib/db/orders-db";
import { getUserById } from "@/lib/db/users-db";
import type { Clinic } from "@/lib/db/schema-interface";
import type { LoadedOrderExportContext, OrderExportKind } from "./types";

async function loadClinic(id?: number | null): Promise<Clinic | null> {
  if (!id) return null;
  const response = await apiClient.getClinic(id);
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
  const order =
    kind === "contact"
      ? await getContactLensOrderById(orderId)
      : await getOrderById(orderId);

  if (!order) {
    throw new Error("ההזמנה לא נמצאה");
  }

  const billing =
    kind === "contact"
      ? await getBillingByContactLensId(orderId)
      : await getBillingByOrderId(orderId);

  const [client, user, lineItems] = await Promise.all([
    order.client_id ? getClientById(order.client_id) : Promise.resolve(undefined),
    order.user_id ? getUserById(order.user_id) : Promise.resolve(null),
    billing?.id ? getOrderLineItemsByBillingId(billing.id) : Promise.resolve([]),
  ]);

  const orderData = (order as any).order_data || {};
  const details = orderData.details || {};
  const clinicIds = new Set<number>();

  if (order.clinic_id) clinicIds.add(order.clinic_id);
  if (details.delivery_clinic_id) clinicIds.add(Number(details.delivery_clinic_id));
  if ((order as any).supply_in_clinic_id) {
    clinicIds.add(Number((order as any).supply_in_clinic_id));
  }

  const clinics = await Promise.all(Array.from(clinicIds).map((clinicId) => loadClinic(clinicId)));
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
