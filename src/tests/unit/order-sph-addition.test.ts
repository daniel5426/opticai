import { expect, test } from "vitest";
import { sphAdditionFor, sphWithAddition, sphWithoutAddition } from "@/lib/addition-add-sources";

test("near glasses: SPH is the far SPH plus the reading addition, and the order records it", () => {
  const patch = sphWithAddition({ r_sph: -2, l_sph: "" }, "read", { r_ad: 1.5, l_ad: 1.75 })!;
  expect(patch).toMatchObject({ sph_add_type: "read", r_sph: "-0.5", r_sph_far: "-2", r_sph_add: "1.5", l_sph: "1.75", l_sph_far: "0" });
  expect(sphAdditionFor({ ...patch, r_sph: -0.5 }, "R")).toEqual({ type: "read", far: -2, add: 1.5, fromExam: false });
  expect(sphWithAddition({ r_sph: -2 }, "read", { r_ad: 1.5 }, true)).toMatchObject({ sph_add_source: "exam" });
});

test("an eye without an addition, or with a text SPH, keeps its SPH", () => {
  expect(sphWithAddition({ r_sph: -2 }, "int", {})).toBeNull();
  const patch = sphWithAddition({ r_sph: "PRO", l_sph: 1 }, "int", { r_ad: 1, l_ad: 1 })!;
  expect(patch.r_sph).toBeUndefined();
  expect(patch).toMatchObject({ l_sph: "2", sph_add_type: "int" });
});

test("a hand edit of SPH drops the indication, and far glasses get the far SPH back", () => {
  const record = { sph_add_type: "read", r_sph: -0.5, r_sph_far: "-2", r_sph_add: "1.5" };
  expect(sphAdditionFor({ ...record, r_sph: -0.25 }, "R")).toBeNull();
  expect(sphWithoutAddition(record)).toMatchObject({ r_sph: "-2", sph_add_type: "", r_sph_far: "" });
  expect(sphWithoutAddition({ r_sph: -2 })).toBeNull();
});

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrderFinalPrescriptionTab } from "@/components/orders/OrderFinalPrescriptionTab";
import "@/localization/i18n";

test("the order marks an SPH that took an addition, until it is edited by hand", () => {
  const data = { add_type: "read", sph_add_type: "read", r_sph: -0.5, r_sph_far: "-2", r_sph_add: "1.5", l_sph: -1 } as any;
  const view = (r_sph: number) =>
    React.createElement(TooltipProvider, null, React.createElement(OrderFinalPrescriptionTab, { finalPrescriptionData: { ...data, r_sph }, onFinalPrescriptionChange: () => {}, isEditing: false }));
  const { rerender } = render(view(-0.5));
  expect(screen.getAllByText("+ADD")).toHaveLength(1);
  rerender(view(-0.75));
  expect(screen.queryByText("+ADD")).toBeNull();
  cleanup();
});
