import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import i18n from "@/localization/i18n";
import { ExamOrderMenu } from "@/components/exam/ExamOrderMenu";
import { prescriptionAddSource, sphWithAddition } from "@/lib/addition-add-sources";

afterEach(cleanup);

async function openGlasses(props: Partial<React.ComponentProps<typeof ExamOrderMenu>> = {}) {
  await i18n.changeLanguage("he");
  const handlers = { onGlassesOrder: vi.fn(), onEmptyGlassesOrder: vi.fn(), onContactLensOrder: vi.fn() };
  render(<ExamOrderMenu additionTypes={["read", "mul"]} {...handlers} {...props} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button"));
  const trigger = await screen.findByRole("menuitem", { name: "משקפיים" });
  trigger.focus();
  await user.keyboard("{Enter}");
  await screen.findByRole("menuitem", { name: "הזמנה ריקה" });
  return { user, ...handlers };
}

test("lists every glasses type and marks the ones in the addition", async () => {
  await openGlasses();
  for (const name of ["רחוק", "ביניים", "ביפוקל", "משרדיות", "My Slow"])
    expect(screen.getByRole("menuitem", { name })).not.toHaveAttribute("data-in-addition");
  for (const name of [/^קרוב/, /^מולטיפוקל/])
    expect(screen.getByRole("menuitem", { name })).toHaveAttribute("data-in-addition");
});

test("shows every type, unmarked, for an exam with no addition", async () => {
  await openGlasses({ additionTypes: [] });
  expect(screen.getByRole("menuitem", { name: "קרוב" })).not.toHaveAttribute("data-in-addition");
});

test("opens an order of the chosen type, or an empty one", async () => {
  const first = await openGlasses();
  await first.user.click(screen.getByRole("menuitem", { name: "רחוק" }));
  expect(first.onGlassesOrder).toHaveBeenCalledWith("far");
  cleanup();
  const second = await openGlasses();
  await second.user.click(screen.getByRole("menuitem", { name: "הזמנה ריקה" }));
  expect(second.onEmptyGlassesOrder).toHaveBeenCalledOnce();
});

test("reading glasses with no addition take the prescription's own ADD", () => {
  const prescription = { r_sph: 1, l_sph: "-0.5", r_ad: "2.00" };
  expect(sphWithAddition(prescription, "read", prescriptionAddSource(prescription))).toMatchObject({ r_sph: "3", sph_add_type: "read" });
  expect(sphWithAddition({ r_sph: 1 }, "read", prescriptionAddSource({ r_sph: 1 }))).toBeNull();
});
