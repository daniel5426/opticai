import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { KeratometerTab } from "@/components/exam/KeratometerTab";
import { KeratometerContactLensTab } from "@/components/exam/KeratometerContactLensTab";
import { KeratometerExam, KeratometerContactLens } from "@/lib/db/schema-interface";

function KeratometerHarness() {
  const [data, setData] = useState<KeratometerExam>({
    layout_instance_id: 1,
    r_k1: 7.8,
    r_k2: 7.9,
  });

  return (
    <KeratometerTab
      keratometerData={data}
      isEditing={true}
      onKeratometerChange={(field, value) => {
        setData((current) => ({ ...current, [field]: value }));
      }}
    />
  );
}

function KeratometerContactLensHarness() {
  const [data, setData] = useState<KeratometerContactLens>({
    layout_instance_id: 1,
    r_rh: 7.8,
    r_rv: 7.9,
  });

  return (
    <KeratometerContactLensTab
      keratometerContactLensData={data}
      isEditing={true}
      onKeratometerContactLensChange={(field, value) => {
        setData((current) => ({ ...current, [field]: value }));
      }}
    />
  );
}

describe("keratometer unit toggles", () => {
  test("flushes pending K value edits before converting to D", async () => {
    const user = userEvent.setup();
    const { container } = render(<KeratometerHarness />);
    const inputs = container.querySelectorAll("input");

    fireEvent.input(inputs[0], { target: { value: "8.60" } });
    await user.click(screen.getByRole("tab", { name: "D" }));

    await waitFor(() => {
      expect(inputs[0]).toHaveValue("39.25");
    });
  });

  test("shows stored diopters in D and never rewrites values when toggling units", async () => {
    const user = userEvent.setup();
    const changes: Array<[string, string]> = [];
    const { container } = render(
      <KeratometerTab
        keratometerData={{ layout_instance_id: 1, r_k1: 7.39, r_k1_d: 45.61, l_k1: 7.8 }}
        isEditing={false}
        onKeratometerChange={(field, value) => changes.push([field, value])}
      />
    );
    const inputs = container.querySelectorAll("input");
    expect(inputs[0]).toHaveValue("7.39");

    await user.click(screen.getByRole("tab", { name: "D" }));
    expect(inputs[0]).toHaveValue("45.61");
    // No stored diopters for L K1: shown converted from mm.
    expect(inputs[3]).toHaveValue("43.25");

    await user.click(screen.getByRole("tab", { name: "mm" }));
    expect(inputs[0]).toHaveValue("7.39");
    expect(changes).toEqual([]);
  });

  test("flushes pending contact lens radius edits before converting to D", async () => {
    const user = userEvent.setup();
    const { container } = render(<KeratometerContactLensHarness />);
    const inputs = container.querySelectorAll("input");

    fireEvent.input(inputs[0], { target: { value: "8.60" } });
    await user.click(screen.getByRole("tab", { name: "D" }));

    await waitFor(() => {
      expect(inputs[0]).toHaveValue("39.25");
    });
  });
});
