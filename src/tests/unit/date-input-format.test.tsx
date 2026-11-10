import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DateInput, formatTypedDate } from "@/components/ui/date";

describe("typing a date", () => {
  test("adds the slashes as digits are typed", () => {
    expect(["2", "23", "230", "2302", "23022", "230226", "23022026", "230220261"].map(formatTypedDate)).toEqual([
      "2", "23/", "23/0", "23/02/", "23/02/2", "23/02/26", "23/02/2026", "23/02/2026",
    ]);
  });

  test("keeps slashes the user types and pads a one-digit day or month", () => {
    expect(formatTypedDate("23/02/26")).toBe("23/02/26");
    expect(formatTypedDate("3/")).toBe("03/");
    expect(formatTypedDate("3/2/26")).toBe("03/02/26");
    expect(formatTypedDate("2026-02-23")).toBe("2026-02-23");
  });

  test("saves the typed date and lets a slash be deleted", () => {
    const onChange = vi.fn();
    render(<DateInput name="date_of_birth" value="" onChange={onChange} aria-label="date" />);
    const input = screen.getByLabelText("date") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "23" } });
    expect(input.value).toBe("23/");
    fireEvent.change(input, { target: { value: "23" } });
    expect(input.value).toBe("23");
    fireEvent.change(input, { target: { value: "230226" } });
    expect(input.value).toBe("23/02/26");
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith({ target: { name: "date_of_birth", value: "2026-02-23" } });
    expect(input.value).toBe("23/02/2026");
  });
});
