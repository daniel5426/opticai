import {
  renderContactOrderPdfHtml,
  renderRegularOrderPdfHtml,
} from "../../src/lib/order-docx/render-order-pdf";

const { writeFile } = process.getBuiltinModule("fs").promises;
const { chromium } = await import("playwright");

const common = {
  clinic_info: "ירושלים | יפו 12, ירושלים | 02-2222222",
  clinic_name: "ירושלים",
  order_number: "2026-001",
  order_date: "10/04/2026",
  order_status: "מוכן",
  priority: "רגיל",
  approval_date: "11/04/2026",
  client_name: "רון כהן",
  client_id: "123456789",
  phone_mobile: "050-1234567",
  phone_home: "02-2222222",
  phone_work: "03-5550101",
  client_address: "רחוב יפו 12, ירושלים",
  optician_name: "אורן לוי",
  advisor_name: "דנה ישראלי",
  total_price: '1,200.00 ש"ח',
  amount_paid: '300.00 ש"ח',
  balance_due: '900.00 ש"ח',
  payment_status: "שולם חלקית",
  clinic_notes: "יש לוודא התאמה מלאה לפני המסירה.",
  supplier_notes: "נא לארוז עם מטלית ניקוי.",
};

const regular = {
  ...common,
  bag_number: "B-204", delivery_clinic_name: "תל אביב", promised_date: "17/04/2026",
  delivered_by: "מאיה לוי", delivered_date: "17/04/2026", manufacturing_lab: "אופטיקה לייב", lens_tab_type: "רב מוקדי",
  r_high: "18", r_pd: "31", r_add: "‎+1.50‎", r_base: "IN", r_pris: "0.00", r_ax: "090", r_cyl: "‎-0.50‎", r_sph: "‎+1.25‎",
  l_high: "18", l_pd: "31", l_add: "‎+1.50‎", l_base: "IN", l_pris: "0.00", l_ax: "080", l_cyl: "‎-0.25‎", l_sph: "‎-1.00‎",
  comb_pd: "62", multifocal_block: "PA: 14 מ״מ",
  r_lens_model: "ClearView Pro", r_lens_supplier: "VisionLab", r_lens_material: "1.67", r_lens_coating: "Blue Guard", r_lens_color: "שקוף", r_lens_diameter: "70",
  l_lens_model: "ClearView Pro", l_lens_supplier: "VisionLab", l_lens_material: "1.67", l_lens_coating: "Blue Guard", l_lens_color: "שקוף", l_lens_diameter: "70",
  frame_supplier: "OptiFrame", frame_brand: "RayLite", frame_model: "Urban 210", frame_color: "שחור מט", frame_width: "52", frame_bridge: "18", frame_height: "41", frame_length: "140", frame_supplied_by: "החנות",
};

const contact = {
  ...common,
  supply_clinic_name: "תל אביב", guaranteed_date: "17/04/2026", delivery_date: "17/04/2026", deliverer_name: "מאיה לוי",
  r_lens_type: "יומית", r_model: "AquaSoft 1 Day", r_supplier: "VisionLab", r_material: "Silicone Hydrogel", r_color: "שקוף", r_quantity: "2",
  l_lens_type: "יומית", l_model: "AquaSoft 1 Day", l_supplier: "VisionLab", l_material: "Silicone Hydrogel", l_color: "שקוף", l_quantity: "2",
  r_bc: "8.5", r_oz: "0.00", r_diam: "14.2", r_sph: "‎+1.25‎", r_cyl: "‎-0.50‎", r_ax: "090", r_read_add: "‎+1.50‎",
  l_bc: "8.6", l_oz: "0.00", l_diam: "14.2", l_sph: "‎-1.00‎", l_cyl: "‎-0.25‎", l_ax: "080", l_read_add: "‎+1.50‎",
  cleaning_solution: "Clear Care", disinfection_solution: "Aosept Plus", rinsing_solution: "סליין סטרילי",
};

const outputs = [
  ["regular", renderRegularOrderPdfHtml(regular as never, "")],
  ["contact", renderContactOrderPdfHtml(contact as never, "")],
] as const;

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
for (const [kind, html] of outputs) {
  await writeFile(`tmp/pdfs/${kind}-order-app-preview.html`, html);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: `output/pdf/order-rtl-corrected/${kind}-order-app-preview.pdf`,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.close();
}
await browser.close();
