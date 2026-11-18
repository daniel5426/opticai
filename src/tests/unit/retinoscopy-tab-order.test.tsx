import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { RetinoscopTab } from "@/components/exam/RetinoscopTab";
import { RetinoscopDilationTab } from "@/components/exam/RetinoscopDilationTab";

afterEach(cleanup);

const stop = (name: string) => document.querySelector<HTMLInputElement>(`[data-tab-stop="${name}"]`)!;

function tabFrom(name: string, shiftKey = false) {
  stop(name).focus();
  fireEvent.keyDown(stop(name), { key: "Tab", shiftKey });
  return (document.activeElement as HTMLElement).dataset.tabStop;
}

test.each([
  ["retinoscopy", () => render(<RetinoscopTab retinoscopData={{ layout_instance_id: 1 } as any} onRetinoscopChange={vi.fn()} isEditing />)],
  ["dilation", () => render(<RetinoscopDilationTab retinoscopDilationData={{ layout_instance_id: 1 } as any} onRetinoscopDilationChange={vi.fn()} isEditing />)],
])("%s: Tab from AX goes to the left eye, then to the combined PD", (_, renderCard) => {
  renderCard();
  expect(tabFrom("r-ax")).toBe("l-sph");
  expect(tabFrom("l-ax")).toBe("c-pd_far");
  expect(tabFrom("c-pd_far", true)).toBe("l-ax");
  expect(tabFrom("l-sph", true)).toBe("r-ax");
});
