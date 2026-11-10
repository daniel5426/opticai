import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Input } from "@/components/ui/input";

afterEach(cleanup);

const stepUp = (props: React.ComponentProps<typeof Input>) => {
  render(<Input type="number" step="0.25" showPlus aria-label="field" {...props} />);
  const up = screen.getByRole("textbox", { name: "field" }).parentElement!.querySelectorAll("button")[0];
  fireEvent.mouseDown(up);
  fireEvent.mouseUp(up);
  return (screen.getByRole("textbox", { name: "field" }) as HTMLInputElement).value;
};

describe("empty number field arrows", () => {
  test("start at 0 when the range reaches it, like SPH", () => {
    expect(stepUp({ min: -30, max: 25 })).toBe("0.00");
  });
  test("start at the minimum when the range is above 0, like PD", () => {
    expect(stepUp({ min: 40, max: 80 })).toBe("+40.00");
  });
  test("start at the maximum when the range is below 0", () => {
    expect(stepUp({ min: -10, max: -2 })).toBe("-2.00");
  });
});
