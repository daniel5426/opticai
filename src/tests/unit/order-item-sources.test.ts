import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/db/schema-interface";
import { orderItemFill, orderItemSummary } from "@/lib/order-item-sources";

const order = (order_data: Record<string, unknown>) => ({ id: 1, order_data }) as unknown as Order;

describe("order item sources", () => {
  it("fills a frame from the first lens/frame tab, dropping imported zero measurements", () => {
    const values = orderItemFill(order({ lens_frame_tabs: [{ frame: { manufacturer: "5048", color: "ירוק", supplier: "לופלין", width: 42, bridge: 0 } }] }), "frame");
    expect(values).toMatchObject({ manufacturer: "5048", color: "ירוק", width: "42", bridge: "", model: "" });
    expect(orderItemSummary(values, "frame")).toEqual(["5048 · ירוק", "42 · לופלין"]);
  });

  it("fills lenses per eye, taking older shared values for both", () => {
    const values = orderItemFill(order({ lens: { right_model: "Defender", left_model: "Defender", coating: "נגד שריטות" } }), "lenses");
    expect(values).toMatchObject({ right_model: "Defender", left_coating: "נגד שריטות", right_diameter: "" });
    expect(orderItemSummary(values, "lenses")).toEqual(["Defender · נגד שריטות"]);
  });

  it("shows each eye when contact lens details differ", () => {
    const values = orderItemFill(order({ "contact-lens-details": { r_lens_type: "חודשית", r_model: "Air", l_model: "Oasys" } }), "contact-details");
    expect(values).toMatchObject({ r_type: "חודשית", r_model: "Air", l_model: "Oasys", l_type: "" });
    expect(orderItemSummary(values, "contact-details")).toEqual(["R: חודשית · Air", "L: Oasys"]);
  });

  it("has nothing to fill from an order without the card", () => {
    expect(orderItemFill(order({ lens_frame_tabs: [{ frame: { order_id: 0 }, lens: {} }] }), "frame")).toBeNull();
    expect(orderItemFill(order({}), "lenses")).toBeNull();
  });
});
