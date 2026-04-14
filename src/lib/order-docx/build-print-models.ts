import type { ContactLensOrderEntity, OrderLineItem } from "@/lib/db/schema-interface";
import {
  formatAddress,
  formatAxis,
  formatCurrency,
  formatDate,
  formatOpticalNumber,
  formatPhone,
  formatPlainNumber,
  joinLines,
  toDisplayString,
} from "./formatters";
import type {
  ContactOrderPrintModel,
  LoadedOrderExportContext,
  RegularOrderPrintLineItem,
  RegularOrderPrintModel,
} from "./types";

function getClientLabel(context: LoadedOrderExportContext) {
  const client = context.client;
  return {
    name: [client?.first_name, client?.last_name].filter(Boolean).join(" ").trim(),
    id: toDisplayString(client?.id),
    address: formatAddress([
      [client?.address_street, client?.address_number].filter(Boolean).join(" ").trim(),
      client?.address_city,
    ]),
    phoneMobile: formatPhone(client?.phone_mobile),
    phoneHome: formatPhone(client?.phone_home),
    phoneWork: formatPhone(client?.phone_work),
  };
}

function getUserLabel(context: LoadedOrderExportContext) {
  return context.user?.full_name || context.user?.username || "";
}

function getClinicName(
  context: LoadedOrderExportContext,
  clinicId?: number | null,
  fallback?: string | null,
) {
  if (clinicId && context.clinicsById[clinicId]) {
    return context.clinicsById[clinicId].name || fallback || "";
  }
  return fallback || "";
}

function getLineItemsBlock(lineItems: OrderLineItem[]) {
  if (lineItems.length === 0) return "";
  const lines = lineItems.map((item, index) => {
    const parts = [
      `${index + 1}.`,
      item.description || "",
      item.sku ? `(מק"ט: ${item.sku})` : "",
      item.quantity ? `כמות: ${formatPlainNumber(item.quantity)}` : "",
      item.price ? `מחיר: ${formatCurrency(item.price)}` : "",
      item.line_total ? `סה"כ שורה: ${formatCurrency(item.line_total)}` : "",
    ].filter(Boolean);
    return parts.join(" | ");
  });
  return lines.join("\n");
}

function getLineItemRows(lineItems: OrderLineItem[]): RegularOrderPrintLineItem[] {
  if (lineItems.length === 0) {
    return [
      {
        line_index: "",
        line_description: "אין פריטי חיוב",
        line_sku: "",
        line_quantity: "",
        line_price: "",
        line_total: "",
      },
    ];
  }

  return lineItems.map((item, index) => ({
    line_index: toDisplayString(index + 1),
    line_description: toDisplayString(item.description),
    line_sku: toDisplayString(item.sku),
    line_quantity: formatPlainNumber(item.quantity),
    line_price: formatCurrency(item.price),
    line_total: formatCurrency(item.line_total),
  }));
}

function getLensValue<T = string>(
  current: unknown,
  legacy: unknown,
): string {
  return toDisplayString(current) || toDisplayString(legacy);
}

function getOperationalMoneyBlock(context: LoadedOrderExportContext) {
  const total = context.billing?.total_after_discount;
  const paid = context.billing?.prepayment_amount;
  const balance =
    total !== undefined && total !== null
      ? total - (paid || 0)
      : undefined;

  return {
    total: formatCurrency(total),
    paid: formatCurrency(paid),
    balance: formatCurrency(balance),
  };
}

function buildMultifocalBlock(finalPrescription: Record<string, unknown>) {
  const values = [
    finalPrescription.pa ? `PA: ${formatPlainNumber(finalPrescription.pa as string | number)}` : "",
    finalPrescription.bvd ? `BVD: ${formatPlainNumber(finalPrescription.bvd as string | number)}` : "",
    finalPrescription.ffa ? `FFA: ${formatPlainNumber(finalPrescription.ffa as string | number)}` : "",
    finalPrescription.df ? `DF: ${formatPlainNumber(finalPrescription.df as string | number)}` : "",
    finalPrescription.dn ? `DN: ${formatPlainNumber(finalPrescription.dn as string | number)}` : "",
  ].filter(Boolean);

  return values.join(" | ");
}

function asContactOrder(order: LoadedOrderExportContext["order"]): ContactLensOrderEntity {
  return order as ContactLensOrderEntity;
}

export function buildRegularOrderPrintModel(
  context: LoadedOrderExportContext,
): RegularOrderPrintModel {
  const order = context.order as any;
  const orderData = order.order_data || {};
  const details = orderData.details || {};
  const finalPrescription = orderData["final-prescription"] || {};
  const lensFrameTabs = Array.isArray(orderData.lens_frame_tabs)
    ? orderData.lens_frame_tabs
    : [];
  const activeLensFrameTab =
    lensFrameTabs.find((tab: any) => tab?.id === orderData.active_lens_frame_tab_id) ||
    lensFrameTabs[0] ||
    null;
  const lens = activeLensFrameTab?.lens || orderData.lens || {};
  const frame = activeLensFrameTab?.frame || orderData.frame || {};
  const client = getClientLabel(context);
  const money = getOperationalMoneyBlock(context);
  const clinicName = getClinicName(context, order.clinic_id, order.clinic?.name || order.clinic_name);
  const deliveryClinicName = getClinicName(
    context,
    details.delivery_clinic_id,
    details.delivery_location,
  );

  return {
    clinic_name: clinicName,
    delivery_clinic_name:
      deliveryClinicName && deliveryClinicName !== clinicName ? deliveryClinicName : "",
    order_number: toDisplayString(order.id),
    bag_number: toDisplayString(details.bag_number),
    order_date: formatDate(order.order_date),
    approval_date: formatDate(details.approval_date),
    order_status: toDisplayString(details.order_status),
    priority: toDisplayString(details.priority),
    client_name: client.name,
    client_id: client.id,
    client_address: client.address,
    phone_mobile: client.phoneMobile,
    phone_home: client.phoneHome,
    phone_work: client.phoneWork,
    optician_name: getUserLabel(context),
    advisor_name: toDisplayString(details.advisor),
    delivered_by: toDisplayString(details.delivered_by),
    delivered_date: formatDate(details.delivered_at),
    manufacturing_lab: toDisplayString(details.manufacturing_lab),
    r_sph: formatOpticalNumber(finalPrescription.r_sph),
    r_cyl: formatOpticalNumber(finalPrescription.r_cyl),
    r_ax: formatAxis(finalPrescription.r_ax),
    r_pris: formatOpticalNumber(finalPrescription.r_pris),
    r_base: toDisplayString(finalPrescription.r_base),
    r_add: formatOpticalNumber(finalPrescription.r_ad),
    r_diam: formatPlainNumber(finalPrescription.r_diam),
    r_high: formatPlainNumber(finalPrescription.r_high),
    r_pd: formatPlainNumber(finalPrescription.r_pd),
    l_sph: formatOpticalNumber(finalPrescription.l_sph),
    l_cyl: formatOpticalNumber(finalPrescription.l_cyl),
    l_ax: formatAxis(finalPrescription.l_ax),
    l_pris: formatOpticalNumber(finalPrescription.l_pris),
    l_base: toDisplayString(finalPrescription.l_base),
    l_add: formatOpticalNumber(finalPrescription.l_ad),
    l_diam: formatPlainNumber(finalPrescription.l_diam),
    l_high: formatPlainNumber(finalPrescription.l_high),
    l_pd: formatPlainNumber(finalPrescription.l_pd),
    comb_pd: formatPlainNumber(order.comb_pd || finalPrescription.comb_pd),
    multifocal_block: buildMultifocalBlock(finalPrescription),
    lens_tab_type: toDisplayString(activeLensFrameTab?.type),
    r_lens_model: getLensValue(lens.right_model, lens.model),
    r_lens_supplier: getLensValue(lens.right_supplier, lens.supplier),
    r_lens_material: getLensValue(lens.right_material, lens.material),
    r_lens_coating: getLensValue(lens.right_coating, lens.coating),
    r_lens_color: getLensValue(lens.right_color, lens.color),
    r_lens_diameter: formatPlainNumber(lens.right_diameter),
    l_lens_model: getLensValue(lens.left_model, lens.model),
    l_lens_supplier: getLensValue(lens.left_supplier, lens.supplier),
    l_lens_material: getLensValue(lens.left_material, lens.material),
    l_lens_coating: getLensValue(lens.left_coating, lens.coating),
    l_lens_color: getLensValue(lens.left_color, lens.color),
    l_lens_diameter: formatPlainNumber(lens.left_diameter),
    frame_supplier: getLensValue(frame.supplier, frame.supplied_by),
    frame_brand: toDisplayString(frame.manufacturer),
    frame_model: toDisplayString(frame.model),
    frame_color: toDisplayString(frame.color),
    frame_width: formatPlainNumber(frame.width),
    frame_bridge: formatPlainNumber(frame.bridge),
    frame_height: formatPlainNumber(frame.height),
    frame_length: formatPlainNumber(frame.length),
    frame_supplied_by: toDisplayString(frame.supplied_by),
    promised_date: formatDate(details.promised_date),
    line_items_block: getLineItemsBlock(context.lineItems),
    line_items_rows: getLineItemRows(context.lineItems),
    total_price: money.total,
    amount_paid: money.paid,
    balance_due: money.balance,
    clinic_notes: toDisplayString(details.notes || order.notes),
    supplier_notes: toDisplayString(details.lens_order_notes),
  };
}

export function buildContactOrderPrintModel(
  context: LoadedOrderExportContext,
): ContactOrderPrintModel {
  const order = asContactOrder(context.order);
  const orderData = (order as any).order_data || {};
  const contactDetails = orderData["contact-lens-details"] || {};
  const contactExam = orderData["contact-lens-exam"] || {};
  const client = getClientLabel(context);
  const money = getOperationalMoneyBlock(context);

  return {
    clinic_name: getClinicName(context, order.clinic_id, ""),
    supply_clinic_name: getClinicName(
      context,
      order.supply_in_clinic_id,
      "",
    ),
    order_number: toDisplayString(order.id),
    order_date: formatDate(order.order_date),
    order_status: toDisplayString(order.order_status),
    priority: toDisplayString(order.priority),
    guaranteed_date: formatDate(order.guaranteed_date),
    approval_date: formatDate(order.approval_date),
    delivery_date: formatDate(order.delivery_date),
    client_name: client.name,
    client_id: client.id,
    client_address: client.address,
    phone_mobile: client.phoneMobile,
    phone_home: client.phoneHome,
    phone_work: client.phoneWork,
    optician_name: getUserLabel(context),
    advisor_name: toDisplayString(order.advisor),
    deliverer_name: toDisplayString(order.deliverer),
    r_lens_type: getLensValue(contactDetails.r_type, order.r_lens_type),
    r_model: getLensValue(contactDetails.r_model, order.r_model),
    r_supplier: getLensValue(contactDetails.r_supplier, order.r_supplier),
    r_material: getLensValue(contactDetails.r_material, order.r_material),
    r_color: getLensValue(contactDetails.r_color, order.r_color),
    r_quantity: formatPlainNumber(contactDetails.r_quantity ?? order.r_quantity ?? order.r_order_quantity),
    l_lens_type: getLensValue(contactDetails.l_type, order.l_lens_type),
    l_model: getLensValue(contactDetails.l_model, order.l_model),
    l_supplier: getLensValue(contactDetails.l_supplier, order.l_supplier),
    l_material: getLensValue(contactDetails.l_material, order.l_material),
    l_color: getLensValue(contactDetails.l_color, order.l_color),
    l_quantity: formatPlainNumber(contactDetails.l_quantity ?? order.l_quantity ?? order.l_order_quantity),
    r_bc1: formatPlainNumber(contactExam.r_bc),
    r_bc2: formatPlainNumber(contactExam.r_bc_2 ?? contactExam.r_bc2),
    r_oz: formatPlainNumber(contactExam.r_oz),
    r_diam: formatPlainNumber(contactExam.r_diam),
    r_sph: formatOpticalNumber(contactExam.r_sph),
    r_cyl: formatOpticalNumber(contactExam.r_cyl),
    r_ax: formatAxis(contactExam.r_ax),
    r_read_add: formatOpticalNumber(contactExam.r_read_ad),
    l_bc1: formatPlainNumber(contactExam.l_bc),
    l_bc2: formatPlainNumber(contactExam.l_bc_2 ?? contactExam.l_bc2),
    l_oz: formatPlainNumber(contactExam.l_oz),
    l_diam: formatPlainNumber(contactExam.l_diam),
    l_sph: formatOpticalNumber(contactExam.l_sph),
    l_cyl: formatOpticalNumber(contactExam.l_cyl),
    l_ax: formatAxis(contactExam.l_ax),
    l_read_add: formatOpticalNumber(contactExam.l_read_ad),
    cleaning_solution: toDisplayString(order.cleaning_solution),
    disinfection_solution: toDisplayString(order.disinfection_solution),
    rinsing_solution: toDisplayString(order.rinsing_solution),
    total_price: money.total,
    amount_paid: money.paid,
    balance_due: money.balance,
    clinic_notes: toDisplayString(order.notes),
    supplier_notes: toDisplayString(order.supplier_notes),
  };
}
