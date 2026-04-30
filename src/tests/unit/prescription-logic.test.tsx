import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { usePrescriptionLogic } from "@/components/exam/shared/usePrescriptionLogic";
import { useAxisWarning } from "@/components/exam/shared/useAxisWarning";
import { FastInput } from "@/components/exam/shared/OptimizedInputs";

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ currentUser: { cyl_format: "minus" } }),
}));

interface RxData {
  r_sph: string;
  r_cyl: string;
  r_ax: string;
}

function TransposeHarness() {
  const [data, setData] = useState<RxData>({
    r_sph: "-30.00",
    r_cyl: "-1.00",
    r_ax: "90",
  });

  const { handleManualTranspose, hasPowerWarning } = usePrescriptionLogic(
    data,
    (field, value) => setData((current) => ({ ...current, [field]: value })),
    true,
    [{ eye: "R", sph: "r_sph", cyl: "r_cyl", ax: "r_ax" }]
  );

  return (
    <div>
      <FastInput
        aria-label="SPH"
        type="number"
        showPlus
        value={data.r_sph}
        onChange={(value) => setData((current) => ({ ...current, r_sph: value }))}
      />
      <FastInput
        aria-label="CYL"
        type="number"
        showPlus
        value={data.r_cyl}
        onChange={(value) => setData((current) => ({ ...current, r_cyl: value }))}
      />
      <button type="button" onClick={handleManualTranspose}>
        Transpose
      </button>
      <output aria-label="warning">{hasPowerWarning("R") ? "warning" : "ok"}</output>
    </div>
  );
}

function AxisWarningHarness() {
  const [data, setData] = useState<RxData>({
    r_sph: "0.00",
    r_cyl: "0",
    r_ax: "90",
  });

  const { fieldWarnings, handleAxisChange } = useAxisWarning(
    data,
    (field, value) => setData((current) => ({ ...current, [field]: value })),
    true
  );

  return (
    <div>
      <input
        aria-label="CYL"
        value={data.r_cyl}
        onChange={(event) => handleAxisChange("R", "cyl", event.target.value)}
      />
      <output aria-label="missing-cyl">
        {fieldWarnings.R.missingCyl ? "warning" : "ok"}
      </output>
    </div>
  );
}

function NoAutoTransposeHarness({ options }: { options?: { autoTransposeOnEdit?: boolean } }) {
  const [data, setData] = useState<RxData>({
    r_sph: "-20.00",
    r_cyl: "+20.00",
    r_ax: "90",
  });

  usePrescriptionLogic(
    data,
    (field, value) => setData((current) => ({ ...current, [field]: value })),
    true,
    [{ eye: "R", sph: "r_sph", cyl: "r_cyl", ax: "r_ax" }],
    options,
  );

  return <output aria-label="rx">{`${data.r_sph}/${data.r_cyl}/${data.r_ax}`}</output>;
}

describe("usePrescriptionLogic", () => {
  test("flushes pending edits before manual transpose", async () => {
    const user = userEvent.setup();
    render(<TransposeHarness />);

    fireEvent.input(screen.getByLabelText("CYL"), { target: { value: "-12.00" } });
    await user.click(screen.getByRole("button", { name: "Transpose" }));

    await waitFor(() => {
      expect(screen.getByLabelText("SPH")).toHaveValue("-42.00");
      expect(screen.getByLabelText("CYL")).toHaveValue("+12.00");
      expect(screen.getByLabelText("warning")).toHaveTextContent("warning");
    });
  });

  test("does not show missing cyl warning for zero cylinder", () => {
    render(<AxisWarningHarness />);

    expect(screen.getByLabelText("missing-cyl")).toHaveTextContent("ok");
  });

  test("does not automatically transpose on edit by default", async () => {
    render(<NoAutoTransposeHarness />);

    await waitFor(() => {
      expect(screen.getByLabelText("rx")).toHaveTextContent("-20.00/+20.00/90");
    });
  });

  test("can opt into automatic transpose on edit", async () => {
    render(<NoAutoTransposeHarness options={{ autoTransposeOnEdit: true }} />);

    await waitFor(() => {
      expect(screen.getByLabelText("rx")).toHaveTextContent("0.00/-20.00/180");
    });
  });
});
