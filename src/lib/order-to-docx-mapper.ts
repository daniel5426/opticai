import { Order, User, Client, Billing } from "./db/schema-interface";

/**
 * Maps an Order object to the DOCX template data format
 */
export class OrderToDocxMapper {
  /**
   * Convert order data to template format
   * Returns different data based on order type (contact lens vs regular)
   */
  static mapOrderToTemplateData(
    order: Order | any,
    client?: Client | any,
    user?: User,
    billing?: Billing | null,
    orderLineItems?: any[]
  ): Record<string, any> {
    // Determine if this is a contact lens order
    const isContactOrder = order.type === "עדשות מגע" || Boolean(order.__contact);
    
    if (isContactOrder) {
      return this.mapContactLensOrder(order, client, user, billing, orderLineItems);
    } else {
      return this.mapRegularOrder(order, client, user, billing, orderLineItems);
    }
  }

  /**
   * Map contact lens order to template data
   */
  private static mapContactLensOrder(
    order: Order | any,
    client?: Client | any,
    user?: User,
    billing?: Billing | null,
    orderLineItems?: any[]
  ): Record<string, any> {
    // Get order_data if it exists
    const orderData = order.order_data || {};
    const contactLensDetails = orderData["contact-lens-details"] || {};
    const contactLensExam = orderData["contact-lens-exam"] || {};

    // Format date helper
    const formatDate = (date?: string | Date) => {
      if (!date) return "";
      const d = new Date(date);
      return d.toLocaleDateString("he-IL");
    };

    // Build the template data object for contact lens orders
    const templateData: Record<string, any> = {
      // Order and envelope info
      order_number: order.id?.toString() || "",
      envelope_number: `EN-${new Date().getFullYear()}-${order.id || ""}`,

      // Customer info
      customer_name: client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : "",
      customer_id: client?.id || "",
      customer_address: client 
        ? `${client.address_street || ""} ${client.address_number || ""}, ${client.address_city || ""}`.trim()
        : "",
      phone_home: client?.phone_home || "",
      phone_work: client?.phone_work || "",
      phone_mobile: client?.phone_mobile || "",

      // Order details
      order_priority: order.priority || "רגילה",
      exam_date: formatDate(order.order_date),
      optician_name: user?.username || "",
      branch_name: order.branch || "",
      treatment_type: order.type || "",
      consultant_name: order.advisor || "",

      // Contact lens details
      qty_R: "1",
      qty_L: "1",
      color_R: contactLensDetails.r_color || "",
      color_L: contactLensDetails.l_color || "",
      material_R: contactLensDetails.r_material || "",
      material_L: contactLensDetails.l_material || "",
      model_R: contactLensDetails.r_model || "",
      model_L: contactLensDetails.l_model || "",
      manufacturer_R: contactLensDetails.r_manufacturer || "",
      manufacturer_L: contactLensDetails.l_manufacturer || "",
      type_R: contactLensDetails.r_type || "",
      type_L: contactLensDetails.l_type || "",

      // Prescription values from contact lens exam
      read_R: this.formatNumber(contactLensExam.r_read_ad),
      read_L: this.formatNumber(contactLensExam.l_read_ad),
      ax_R: this.formatAxis(contactLensExam.r_ax),
      ax_L: this.formatAxis(contactLensExam.l_ax),
      cyl_R: this.formatNumber(contactLensExam.r_cyl),
      cyl_L: this.formatNumber(contactLensExam.l_cyl),
      sph_R: this.formatNumber(contactLensExam.r_sph),
      sph_L: this.formatNumber(contactLensExam.l_sph),
      diam_R: this.formatNumber(contactLensExam.r_diam),
      diam_L: this.formatNumber(contactLensExam.l_diam),
      oz_R: this.formatNumber(contactLensExam.r_oz),
      oz_L: this.formatNumber(contactLensExam.l_oz),
      bc1_R: this.formatNumber(contactLensExam.r_bc),
      bc2_R: this.formatNumber(contactLensExam.r_bc),
      bc1_L: this.formatNumber(contactLensExam.l_bc),
      bc2_L: this.formatNumber(contactLensExam.l_bc),

      // Solutions
      sol_cleaning: order.cleaning_solution || "",
      sol_disinfecting: order.disinfection_solution || "",
      sol_rinsing: order.rinsing_solution || "",
      trial_lenses: order.trial_lenses ? "כן" : "לא",

      // Additional fields
      date_promised: formatDate(order.guaranteed_date),
      notes: order.notes || "",
      
      // Financial info
      total_price: billing?.total_after_discount 
        ? `${billing.total_after_discount.toFixed(2)} ש"ח`
        : "",
      amount_paid: billing?.prepayment_amount 
        ? `${billing.prepayment_amount.toFixed(2)} ש"ח`
        : "",
      balance_due: billing?.total_after_discount && billing?.prepayment_amount
        ? `${(billing.total_after_discount - billing.prepayment_amount).toFixed(2)} ש"ח`
        : billing?.total_after_discount
          ? `${billing.total_after_discount.toFixed(2)} ש"ח`
          : "",
    };

    return templateData;
  }

  /**
   * Map regular order to template data
   */
  private static mapRegularOrder(
    order: Order | any,
    client?: Client | any,
    user?: User,
    billing?: Billing | null,
    orderLineItems?: any[]
  ): Record<string, any> {
    // Get order_data
    const orderData = order.order_data || {};
    const finalPrescription = orderData["final-prescription"] || {};
    const lens = orderData.lens || {};
    const frame = orderData.frame || {};
    const details = orderData.details || {};

    // Format date helper
    const formatDate = (date?: string | Date) => {
      if (!date) return "";
      const d = new Date(date);
      return d.toLocaleDateString("he-IL");
    };

    // Map line items (up to 3 for now)
    const items = orderLineItems || [];
    const lineItem1 = items[0] || {};
    const lineItem2 = items[1] || {};
    const lineItem3 = items[2] || {};

    // Build the template data object for regular orders
    const templateData: Record<string, any> = {
      // Order info
      order_number: order.id?.toString() || "",
      envelope_number: `ENV-${new Date().getFullYear()}-${order.id || ""}`,
      
      // Customer info
      customer_name: client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : "",
      customer_id: client?.id || "",
      customer_address: client 
        ? `${client.address_street || ""} ${client.address_number || ""}, ${client.address_city || ""}`.trim()
        : "",
      phone_home: client?.phone_home || "",
      phone_work: client?.phone_work || "",
      phone_mobile: client?.phone_mobile || "",
      
      // Order details
      approval_date: formatDate(details.approval_date),
      branch_name: details.branch || "",
      optician_name: user?.username || "",

      // Prescription - Right eye
      sph_R: this.formatNumber(finalPrescription.r_sph),
      cyl_R: this.formatNumber(finalPrescription.r_cyl),
      ax_R: this.formatAxis(finalPrescription.r_ax),
      pris_R: this.formatNumber(finalPrescription.r_pris),
      base_R: finalPrescription.r_base || "",
      add_R: this.formatNumber(finalPrescription.r_ad),
      diam_R: this.formatNumber(finalPrescription.r_diam),
      high_R: this.formatNumber(finalPrescription.r_high),
      pd_R: this.formatNumber(finalPrescription.r_pd),

      // Prescription - Left eye
      sph_L: this.formatNumber(finalPrescription.l_sph),
      cyl_L: this.formatNumber(finalPrescription.l_cyl),
      ax_L: this.formatAxis(finalPrescription.l_ax),
      pris_L: this.formatNumber(finalPrescription.l_pris),
      base_L: finalPrescription.l_base || "",
      add_L: this.formatNumber(finalPrescription.l_ad),
      diam_L: this.formatNumber(finalPrescription.l_diam),
      high_L: this.formatNumber(finalPrescription.l_high),
      pd_L: this.formatNumber(finalPrescription.l_pd),

      // Combined PD
      pd: this.formatNumber(order.comb_pd || finalPrescription.comb_pd),

      // Multifocal data
      pa: this.formatNumber(finalPrescription.pa),
      bvd: this.formatNumber(finalPrescription.bvd),
      ffa: this.formatNumber(finalPrescription.ffa),
      df: this.formatNumber(finalPrescription.df),
      dn: this.formatNumber(finalPrescription.dn),

      // Lens data
      lens_supplier: lens.supplier || "",
      group: lens.group || "",
      model_R: lens.right_model || "",
      model_L: lens.left_model || "",
      color: lens.color || "",
      material: lens.material || "",
      segment: lens.segment || "",
      coating: lens.coating || "",

      // Frame data
      frame_supplier: frame.supplier || frame.supplied_by || "",
      frame_brand: frame.manufacturer || "",
      frame_model: frame.model || "",
      frame_color: frame.color || "",
      frame_bridge: frame.bridge?.toString() || "",
      frame_height: frame.height?.toString() || "",
      frame_length: frame.length?.toString() || "",

      // Line items
      sku1: lineItem1.sku || "",
      desc1: lineItem1.description || "",
      qty1: lineItem1.quantity || 0,
      sku2: lineItem2.sku || "",
      desc2: lineItem2.description || "",
      qty2: lineItem2.quantity || 0,
      sku3: lineItem3.sku || "",
      desc3: lineItem3.description || "",
      qty3: lineItem3.quantity || 0,

      // Other fields
      consultant: details.advisor || "",
      date_promised: formatDate(details.promised_date),
      
      // Financial info
      total_price: billing?.total_after_discount 
        ? `${billing.total_after_discount.toFixed(2)} ש"ח`
        : "",
      received: billing?.prepayment_amount 
        ? `${billing.prepayment_amount.toFixed(2)} ש"ח`
        : "",
      balance: billing?.total_after_discount && billing?.prepayment_amount
        ? `${(billing.total_after_discount - billing.prepayment_amount).toFixed(2)} ש"ח`
        : billing?.total_after_discount
          ? `${billing.total_after_discount.toFixed(2)} ש"ח`
          : "",

      // Notes
      notes: order.notes || details.notes || "",
    };

    return templateData;
  }

  /**
   * Format number values with sign
   */
  private static formatNumber(value?: number | string): string {
    if (value === undefined || value === null || value === "") return "";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "";
    return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
  }

  /**
   * Format axis values (no sign, 3 digits)
   */
  private static formatAxis(value?: number | string): string {
    if (value === undefined || value === null || value === "") return "";
    const num = typeof value === "string" ? parseInt(value, 10) : value;
    if (isNaN(num)) return "";
    return num.toString().padStart(3, "0");
  }
}

