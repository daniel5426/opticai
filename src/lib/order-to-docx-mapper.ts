import { Order, User, Client, Billing } from "./db/schema-interface";

/**
 * Maps an Order object to the DOCX template data format
 */
export class OrderToDocxMapper {
  /**
   * Convert order data to template format
   */
  static mapOrderToTemplateData(
    order: Order | any,
    client?: Client | any,
    user?: User,
    billing?: Billing | null
  ): Record<string, any> {
    // Get order_data if it exists
    const orderData = order.order_data || {};
    const finalPrescription = orderData["final-prescription"] || {};
    const lens = orderData.lens || {};
    const frame = orderData.frame || {};
    const details = orderData.details || {};
    const contactLensDetails = orderData["contact-lens-details"] || {};
    const contactLensExam = orderData["contact-lens-exam"] || {};

    // Format date helper
    const formatDate = (date?: string | Date) => {
      if (!date) return "";
      const d = new Date(date);
      return d.toLocaleDateString("he-IL");
    };

    // Determine if this is a contact lens order
    const isContactOrder = order.type === "עדשות מגע" || Boolean(order.__contact);

    // Build the template data object
    const templateData: Record<string, any> = {
      // Order and envelope info
      order_number: order.id?.toString() || "",
      envelope_number: `EN-${new Date().getFullYear()}-${order.id || ""}`,

      // Customer info
      customer_name: client?.full_name || "",
      customer_id: client?.id_number || "",
      customer_address: client?.address || "",
      phone_home: client?.phone || "",
      phone_work: client?.phone || "",
      phone_mobile: client?.mobile_phone || client?.phone || "",

      // Order details
      order_priority: details.priority || "רגילה",
      exam_date: formatDate(order.order_date),
      optician_name: user?.username || "",
      branch_name: details.branch || "",
      treatment_type: order.type || "",
      consultant_name: details.advisor || "",

      // Right side (R) - using final prescription or contact lens exam
      qty_R: "1",
      qty_L: "1",
      
      // For contact lenses
      color_R: isContactOrder ? contactLensDetails.r_color : frame.color || "",
      color_L: isContactOrder ? contactLensDetails.l_color : frame.color || "",
      material_R: isContactOrder ? contactLensDetails.r_material : lens.material || "",
      material_L: isContactOrder ? contactLensDetails.l_material : lens.material || "",
      model_R: isContactOrder ? contactLensDetails.r_model : lens.right_model || "",
      model_L: isContactOrder ? contactLensDetails.l_model : lens.left_model || "",
      manufacturer_R: isContactOrder ? contactLensDetails.r_manufacturer : frame.manufacturer || "",
      manufacturer_L: isContactOrder ? contactLensDetails.l_manufacturer : frame.manufacturer || "",
      type_R: isContactOrder ? contactLensDetails.r_type : "",
      type_L: isContactOrder ? contactLensDetails.l_type : "",

      // Prescription values - use contact lens exam for contact orders, final prescription for regular orders
      read_R: this.formatNumber(
        isContactOrder ? contactLensExam.r_read_ad : finalPrescription.r_ad
      ),
      read_L: this.formatNumber(
        isContactOrder ? contactLensExam.l_read_ad : finalPrescription.l_ad
      ),
      ax_R: this.formatAxis(
        isContactOrder ? contactLensExam.r_ax : finalPrescription.r_ax
      ),
      ax_L: this.formatAxis(
        isContactOrder ? contactLensExam.l_ax : finalPrescription.l_ax
      ),
      cyl_R: this.formatNumber(
        isContactOrder ? contactLensExam.r_cyl : finalPrescription.r_cyl
      ),
      cyl_L: this.formatNumber(
        isContactOrder ? contactLensExam.l_cyl : finalPrescription.l_cyl
      ),
      sph_R: this.formatNumber(
        isContactOrder ? contactLensExam.r_sph : finalPrescription.r_sph
      ),
      sph_L: this.formatNumber(
        isContactOrder ? contactLensExam.l_sph : finalPrescription.l_sph
      ),
      diam_R: this.formatNumber(
        isContactOrder ? contactLensExam.r_diam : finalPrescription.r_diam
      ),
      diam_L: this.formatNumber(
        isContactOrder ? contactLensExam.l_diam : finalPrescription.l_diam
      ),
      oz_R: this.formatNumber(contactLensExam.r_oz),
      oz_L: this.formatNumber(contactLensExam.l_oz),
      bc1_R: this.formatNumber(contactLensExam.r_bc),
      bc2_R: this.formatNumber(contactLensExam.r_bc),
      bc1_L: this.formatNumber(contactLensExam.l_bc),
      bc2_L: this.formatNumber(contactLensExam.l_bc),

      // Solutions (for contact lenses) - these are stored at the order root level
      sol_cleaning: order.cleaning_solution || "",
      sol_disinfecting: order.disinfection_solution || "",
      sol_rinsing: order.rinsing_solution || "",
      trial_lenses: order.trial_lenses ? "כן" : "לא",

      // Additional fields
      date_promised: formatDate(details.promised_date || order.guaranteed_date),
      notes: order.notes || details.notes || "",
      
      // Financial info from billing
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

      // For filename
      fullName: client?.full_name || "",
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

