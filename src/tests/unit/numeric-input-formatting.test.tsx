import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";
import { FastInput, inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import { ToggleTextNumberInput } from "@/components/exam/shared/ToggleTextNumberInput";
import i18n from "@/localization/i18n";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("dir");
});

describe.each(["he", "en", "fr"])("numeric display in %s", (locale) => {
  const dir = locale === "he" ? "rtl" : "ltr";
  beforeEach(async () => {
    document.documentElement.dir = dir;
    await i18n.changeLanguage(locale);
  });

  it("formats loaded values in view and edit modes without emitting changes", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <div dir={dir}>
        <FastInput value="1" type="number" step="0.25" showPlus disabled onChange={onChange} />
      </div>,
    );
    expect(screen.getByRole("textbox")).toHaveValue("+1.00");
    expect(screen.getByRole("textbox")).toHaveAttribute("dir", "ltr");

    rerender(
      <div dir={dir}>
        <FastInput value="-2.5" type="number" step="0.25" showPlus onChange={onChange} />
      </div>,
    );
    expect(screen.getByRole("textbox")).toHaveValue("-2.50");
    act(() => inputSyncManager.flush());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("formats asynchronously loaded values and preserves partial typing", () => {
    const { rerender } = render(<FastInput value="" type="number" step="0.25" showPlus />);
    rerender(<FastInput value="0" type="number" step="0.25" showPlus />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("0.00");
    act(() => input.focus());
    fireEvent.input(input, { target: { value: "1." } });
    rerender(<FastInput value="1" type="number" step="0.25" showPlus />);
    expect(input).toHaveValue("1.");
    act(() => input.blur());
    expect(input).toHaveValue("+1.00");
  });

  it("keeps formatting after save and reopening raw numeric data", () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <FastInput value="1" type="number" step="0.25" showPlus onChange={onChange} />,
    );
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    fireEvent.input(input, { target: { value: "2.5" } });
    act(() => input.blur());
    act(() => inputSyncManager.flush());
    expect(input).toHaveValue("+2.50");
    expect(Number(onChange.mock.lastCall?.[0])).toBe(2.5);
    unmount();
    render(<FastInput value="2.5" type="number" step="0.25" showPlus disabled />);
    expect(screen.getByRole("textbox")).toHaveValue("+2.50");
  });
});

it("formats shared Input defaults and preserves text presets and integer fields", () => {
  render(
    <>
      <Input type="number" defaultValue={3} step="0.01" />
      <Input type="number" value={90} step="1" />
      <ToggleTextNumberInput value="Balance" textOptions={["Balance"]} numericProps={{ step: "0.25", showPlus: true }} disabled />
      <ToggleTextNumberInput value="1" textOptions={["Balance"]} numericProps={{ step: "0.25", showPlus: true }} disabled />
    </>,
  );
  expect(screen.getByDisplayValue("3.00")).toBeInTheDocument();
  expect(screen.getByDisplayValue("90")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Balance")).toBeInTheDocument();
  expect(screen.getByDisplayValue("+1.00")).toBeInTheDocument();
});
