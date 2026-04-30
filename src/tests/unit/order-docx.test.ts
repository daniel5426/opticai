import { describe, expect, test, vi } from "vitest";
import type { LoadedOrderExportContext } from "@/lib/order-docx";
import {
  buildContactOrderPrintModel,
  buildRegularOrderPrintModel,
} from "@/lib/order-docx";
import { forceRtlDocxXml } from "@/lib/docx-rtl";
import { extractTemplatePlaceholders } from "@/lib/order-docx/template-audit";

const regularTemplateKeys = [
  "advisor_name",
  "amount_paid",
  "approval_date",
  "bag_number",
  "balance_due",
  "client_address",
  "client_id",
  "client_name",
  "clinic_name",
  "clinic_notes",
  "comb_pd",
  "delivered_by",
  "delivered_date",
  "delivery_clinic_name",
  "frame_brand",
  "frame_bridge",
  "frame_color",
  "frame_height",
  "frame_length",
  "frame_model",
  "frame_supplied_by",
  "frame_supplier",
  "frame_width",
  "l_add",
  "l_ax",
  "l_base",
  "l_cyl",
  "l_diam",
  "l_high",
  "l_lens_coating",
  "l_lens_color",
  "l_lens_diameter",
  "l_lens_material",
  "l_lens_model",
  "l_lens_supplier",
  "l_pd",
  "l_pris",
  "l_sph",
  "lens_tab_type",
  "line_items_block",
  "manufacturing_lab",
  "multifocal_block",
  "optician_name",
  "order_date",
  "order_number",
  "order_status",
  "phone_home",
  "phone_mobile",
  "phone_work",
  "priority",
  "promised_date",
  "r_add",
  "r_ax",
  "r_base",
  "r_cyl",
  "r_diam",
  "r_high",
  "r_lens_coating",
  "r_lens_color",
  "r_lens_diameter",
  "r_lens_material",
  "r_lens_model",
  "r_lens_supplier",
  "r_pd",
  "r_pris",
  "r_sph",
  "supplier_notes",
  "total_price",
];

const contactTemplateKeys = [
  "advisor_name",
  "amount_paid",
  "approval_date",
  "balance_due",
  "cleaning_solution",
  "client_address",
  "client_id",
  "client_name",
  "clinic_name",
  "clinic_notes",
  "deliverer_name",
  "delivery_date",
  "disinfection_solution",
  "guaranteed_date",
  "l_ax",
  "l_bc1",
  "l_bc2",
  "l_color",
  "l_cyl",
  "l_diam",
  "l_lens_type",
  "l_material",
  "l_model",
  "l_oz",
  "l_quantity",
  "l_read_add",
  "l_sph",
  "l_supplier",
  "optician_name",
  "order_date",
  "order_number",
  "order_status",
  "phone_home",
  "phone_mobile",
  "phone_work",
  "priority",
  "r_ax",
  "r_bc1",
  "r_bc2",
  "r_color",
  "r_cyl",
  "r_diam",
  "r_lens_type",
  "r_material",
  "r_model",
  "r_oz",
  "r_quantity",
  "r_read_add",
  "r_sph",
  "r_supplier",
  "rinsing_solution",
  "supplier_notes",
  "supply_clinic_name",
  "total_price",
];

function createRegularContext(): LoadedOrderExportContext {
  return {
    kind: "regular",
    order: {
      id: 12,
      client_id: 7,
      clinic_id: 1,
      order_date: "2026-04-10",
      user_id: 5,
      comb_pd: 61,
      order_data: {
        details: {
          bag_number: "332",
          approval_date: "2026-04-11",
          order_status: "הוזמן",
          priority: "דחוף",
          advisor: "דנה",
          delivered_by: "נועם",
          delivered_at: "2026-04-13",
          delivery_clinic_id: 2,
          delivery_location: "תל אביב",
          manufacturing_lab: "מעבדת על",
          promised_date: "2026-04-20",
          notes: "הערת קליניקה",
          lens_order_notes: "הערה לספק",
        },
        "final-prescription": {
          r_sph: 1.25,
          r_cyl: -0.5,
          r_ax: 90,
          r_pris: 0.5,
          r_base: "IN",
          r_ad: 1.25,
          r_diam: 63,
          r_high: 18,
          r_pd: 30.5,
          l_sph: -1,
          l_cyl: -1.25,
          l_ax: 80,
          l_pris: 0.25,
          l_base: "OUT",
          l_ad: 1.5,
          l_diam: 64,
          l_high: 19,
          l_pd: 30.5,
          pa: 8,
          bvd: 12,
        },
        lens_frame_tabs: [
          {
            id: "lf-1",
            type: "רחוק",
            lens: {
              right_model: "RX1",
              left_model: "LX1",
              right_supplier: "ספק ימין",
              left_supplier: "ספק שמאל",
              right_material: "חומר ימין",
              left_material: "חומר שמאל",
              right_coating: "ציפוי ימין",
              left_coating: "ציפוי שמאל",
              right_color: "כחול",
              left_color: "ירוק",
              right_diameter: 70,
              left_diameter: 71,
            },
            frame: {
              supplier: "ספק מסגרת",
              manufacturer: "מותג",
              model: "M-12",
              color: "שחור",
              width: 52,
              bridge: 18,
              height: 36,
              length: 145,
              supplied_by: "חנות",
            },
          },
        ],
        active_lens_frame_tab_id: "lf-1",
      },
    } as any,
    client: {
      id: 7,
      first_name: "רון",
      last_name: "כהן",
      address_street: "הרצל",
      address_number: "12",
      address_city: "חיפה",
      phone_mobile: "050-0000000",
      phone_home: "04-1111111",
      phone_work: "03-2222222",
    },
    user: {
      id: 5,
      full_name: "אורן לוי",
      username: "oren",
    } as any,
    billing: {
      total_after_discount: 1200,
      prepayment_amount: 300,
    },
    lineItems: [
      { description: "עדשה ימין", sku: "R1", quantity: 1, price: 300, line_total: 300, billings_id: 1 },
      { description: "עדשה שמאל", sku: "L1", quantity: 1, price: 300, line_total: 300, billings_id: 1 },
      { description: "מסגרת", sku: "F1", quantity: 1, price: 600, line_total: 600, billings_id: 1 },
      { description: "נרתיק", sku: "C1", quantity: 1, price: 0, line_total: 0, billings_id: 1 },
    ],
    clinicsById: {
      1: { id: 1, name: 'ירושלים' } as any,
      2: { id: 2, name: 'תל אביב' } as any,
    },
  };
}

function createContactContext(): LoadedOrderExportContext {
  return {
    kind: "contact",
    order: {
      id: 88,
      client_id: 7,
      clinic_id: 1,
      user_id: 5,
      order_date: "2026-04-10",
      order_status: "ממתין",
      priority: "רגיל",
      guaranteed_date: "2026-04-18",
      approval_date: "2026-04-11",
      delivery_date: "2026-04-15",
      advisor: "מיכל",
      deliverer: "רועי",
      supply_in_clinic_id: 2,
      cleaning_solution: "A",
      disinfection_solution: "B",
      rinsing_solution: "C",
      notes: "הערה קלינית",
      supplier_notes: "הערה לספק",
      order_data: {
        "contact-lens-details": {
          r_type: "יומית",
          r_model: "R-Model",
          r_supplier: "R-Supplier",
          r_material: "Hydro",
          r_color: "Blue",
          r_quantity: 2,
          l_type: "חודשית",
          l_model: "L-Model",
          l_supplier: "L-Supplier",
          l_material: "Silicone",
          l_color: "Green",
          l_quantity: 1,
        },
        "contact-lens-exam": {
          r_bc: 8.5,
          r_bc_2: 8.7,
          r_oz: 14.2,
          r_diam: 14.1,
          r_sph: -1.25,
          r_cyl: -0.75,
          r_ax: 80,
          r_read_ad: 1.5,
          l_bc: 8.6,
          l_oz: 14.1,
          l_diam: 14.0,
          l_sph: -1,
          l_cyl: -0.5,
          l_ax: 90,
          l_read_ad: 1.25,
        },
      },
    } as any,
    client: {
      id: 7,
      first_name: "רון",
      last_name: "כהן",
      address_street: "הרצל",
      address_number: "12",
      address_city: "חיפה",
      phone_mobile: "050-0000000",
      phone_home: "04-1111111",
      phone_work: "03-2222222",
    },
    user: {
      id: 5,
      full_name: "אורן לוי",
      username: "oren",
    } as any,
    billing: {
      total_after_discount: 450,
      prepayment_amount: 150,
    },
    lineItems: [],
    clinicsById: {
      1: { id: 1, name: "ירושלים" } as any,
      2: { id: 2, name: "תל אביב" } as any,
    },
  };
}

describe("order-docx print models", () => {
  test("buildRegularOrderPrintModel maps current regular-order data", () => {
    const model = buildRegularOrderPrintModel(createRegularContext());

    expect(model.clinic_name).toBe("ירושלים");
    expect(model.delivery_clinic_name).toBe("תל אביב");
    expect(model.optician_name).toBe("אורן לוי");
    expect(model.r_lens_supplier).toBe("ספק ימין");
    expect(model.l_lens_supplier).toBe("ספק שמאל");
    expect(model.frame_width).toBe("52");
    expect(model.total_price).toContain('1,200.00');
    expect(model.balance_due).toContain('900.00');
    expect(model.line_items_block).toContain("1.");
    expect(model.line_items_block).toContain("4.");
    expect(model.multifocal_block).toContain("PA:");
  });

  test("buildRegularOrderPrintModel falls back to legacy generic lens fields", () => {
    const context = createRegularContext();
    const order = context.order as any;
    order.order_data.lens_frame_tabs[0].lens = {
      model: "GENERIC",
      supplier: "LEGACY SUPPLIER",
      material: "LEGACY MATERIAL",
      coating: "LEGACY COATING",
      color: "LEGACY COLOR",
    };

    const model = buildRegularOrderPrintModel(context);

    expect(model.r_lens_supplier).toBe("LEGACY SUPPLIER");
    expect(model.l_lens_supplier).toBe("LEGACY SUPPLIER");
    expect(model.r_lens_model).toBe("GENERIC");
    expect(model.l_lens_color).toBe("LEGACY COLOR");
  });

  test("buildContactOrderPrintModel maps current contact-order data", () => {
    const model = buildContactOrderPrintModel(createContactContext());

    expect(model.clinic_name).toBe("ירושלים");
    expect(model.supply_clinic_name).toBe("תל אביב");
    expect(model.r_lens_type).toBe("יומית");
    expect(model.l_quantity).toBe("1");
    expect(model.r_bc2).toBe("8.7");
    expect(model.l_bc2).toBe("");
    expect(model.amount_paid).toContain("150.00");
  });

  test("buildContactOrderPrintModel falls back to legacy top-level fields", () => {
    const context = createContactContext();
    const order = context.order as any;
    order.order_data["contact-lens-details"] = {};
    order.r_lens_type = "Legacy Right";
    order.r_supplier = "Legacy Supplier";
    order.r_quantity = 4;

    const model = buildContactOrderPrintModel(context);

    expect(model.r_lens_type).toBe("Legacy Right");
    expect(model.r_supplier).toBe("Legacy Supplier");
    expect(model.r_quantity).toBe("4");
  });
});

describe("order-docx template audit", () => {
  test("regular template placeholders match the regular print model contract", () => {
    expect(extractTemplatePlaceholders("regular")).toEqual(regularTemplateKeys);
  });

  test("contact template placeholders match the contact print model contract", () => {
    expect(extractTemplatePlaceholders("contact")).toEqual(contactTemplateKeys);
  });
});

describe("forceRtlDocxXml", () => {
  test("forces RTL paragraph direction without changing table direction or run direction", () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
      '<w:tbl><w:tblPr><w:jc w:val="right"/></w:tblPr></w:tbl>',
      '<w:p><w:r><w:t>{client_name}</w:t></w:r></w:p>',
      '<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:rtl/></w:rPr><w:t>בדיקה</w:t></w:r></w:p>',
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>',
      "</w:body></w:document>",
    ].join("");

    const result = forceRtlDocxXml(xml);

    expect(result).not.toContain("bidiVisual");
    expect(result).toContain('<w:tblPr><w:jc w:val="right"/></w:tblPr>');
    expect(result.match(/<w:jc w:val="left"\/>/g)).toHaveLength(2);
    expect(result.match(/<w:jc w:val="right"\/>/g)).toHaveLength(1);
    expect(result.match(/<w:bidi w:val="1"\/>/g)).toHaveLength(3);
    expect(result).toContain("<w:rPr><w:b/><w:rtl/></w:rPr>");
  });
});

vi.mock("@/lib/order-docx/load-order-export-context", () => ({
  loadOrderExportContext: vi.fn(async () => createRegularContext()),
}));

vi.mock("@/lib/order-docx/render-order-docx", () => ({
  renderOrderDocx: vi.fn(async () => undefined),
}));

describe("exportOrderToDocx", () => {
  test("loads full context and renders the correct kind", async () => {
    const { exportOrderToDocx } = await import("@/lib/order-docx/export-order-to-docx");
    const { loadOrderExportContext } = await import("@/lib/order-docx/load-order-export-context");
    const { renderOrderDocx } = await import("@/lib/order-docx/render-order-docx");

    await exportOrderToDocx({ orderId: 12, kind: "regular" });

    expect(loadOrderExportContext).toHaveBeenCalledWith({
      orderId: 12,
      kind: "regular",
    });
    expect(renderOrderDocx).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "regular",
        data: expect.objectContaining({
          order_number: "12",
          clinic_name: "ירושלים",
        }),
      }),
    );
  });
});
