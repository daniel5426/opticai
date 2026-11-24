import React, { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test } from "vitest";
import i18n from "@/localization/i18n";
import { ReferralOldPrescription } from "@/components/ReferralOldPrescription";
import { copyToClipboard, pasteFromClipboard } from "@/lib/exam-clipboard";

const client = new QueryClient();
let current: any;
function Harness({ isEditing = true, clipboard = null }: { isEditing?: boolean; clipboard?: any }) {
  const [data, setData] = useState<any>({ r_sph: "-2", r_glasses_type: "רחוק" });
  current = data;
  return <QueryClientProvider client={client}><ReferralOldPrescription clientId={1} data={data} isEditing={isEditing} clipboardSourceType={clipboard} onCopied={() => {}}
    onChange={(changes) => setData((previous: any) => ({ ...previous, ...changes }))} /></QueryClientProvider>;
}
const tool = (icon: string) => document.querySelector<HTMLElement>(`[data-exam-toolbox] .lucide-${icon}`)!.closest("button")!;
beforeEach(() => i18n.changeLanguage("he"));
afterEach(() => { cleanup(); sessionStorage.clear(); });

test("the tools copy and clear the card", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<Harness />);
  await user.click(tool("copy"));
  expect(pasteFromClipboard()).toMatchObject({ type: "old-refraction", data: { r_sph: "-2" } });
  await user.click(tool("x"));
  expect(current).toMatchObject({ r_sph: "", r_glasses_type: "" });
});

test("pasting another card's prescription drops the earlier glasses type", async () => {
  copyToClipboard("compact-prescription", { r_sph: -5, l_sph: -4 } as any);
  render(<Harness clipboard="compact-prescription" />);
  await userEvent.setup({ pointerEventsCheck: 0 }).click(tool("clipboard-paste"));
  expect(current).toMatchObject({ r_sph: "-5", l_sph: "-4", r_glasses_type: "" });
});

test("there are no tools while the referral is not being edited", () => {
  render(<Harness isEditing={false} />);
  expect(document.querySelector("[data-exam-toolbox]")).toBeNull();
  expect(screen.queryByRole("button", { name: i18n.t("ordersHistoryButton") })).toBeNull();
});
