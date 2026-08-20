import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MaddoxRodTab } from "@/components/exam/MaddoxRodTab"
import { MaddoxWingTab } from "@/components/exam/MaddoxWingTab"
import { RGBalanceTab } from "@/components/exam/RGBalanceTab"
import { StereoTestTab } from "@/components/exam/StereoTestTab"
import { FusionRangeTab } from "@/components/exam/FusionRangeTab"
import { FastSelect } from "@/components/exam/shared/OptimizedInputs"
import { ToggleTextNumberInput } from "@/components/exam/shared/ToggleTextNumberInput"
import { NotesCard } from "@/components/ui/notes-card"
import { ExamGridLayout } from "@/components/exam/ExamGridLayout"
import { ContactLensExamTab } from "@/components/exam/ContactLensExamTab"
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs"

import i18n from "@/localization/i18n"

describe("SoftOptic card compatibility", () => {
  test("renders Maddox v2 directions in full and upgrades legacy values", async () => {
    await i18n.changeLanguage("he")
    const { rerender } = render(
      <MaddoxRodTab
        maddoxRodData={{ layout_instance_id: 1, schema_version: 2, with_horizontal_prism: 2, with_horizontal_direction: "EXO" }}
        onMaddoxRodChange={vi.fn()}
        isEditing={false}
      />,
    )
    expect(screen.getByDisplayValue("2")).toBeInTheDocument()
    expect(screen.getByText("EXO")).toBeInTheDocument()
    expect(screen.getByText("עם תיקון")).toBeInTheDocument()

    rerender(
      <MaddoxRodTab
        maddoxRodData={{ layout_instance_id: 1, c_r_h: 3, with_vertical_direction: "R" } as any}
        onMaddoxRodChange={vi.fn()}
        isEditing={false}
      />,
    )
    expect(screen.getByDisplayValue("3")).toBeInTheDocument()
    expect(screen.getByText("R/L")).toBeInTheDocument()
  })

  test("renders the SoftOptic R/G balance and Maddox Wing cards", async () => {
    await i18n.changeLanguage("en")
    render(
      <>
        <RGBalanceTab
          rgBalanceData={{
            layout_instance_id: 1,
            r_green: 232.32,
            r_equal: 323.23,
            r_red: 345.45,
            l_green: 445.45,
            l_equal: 676.76,
            l_red: 767.67,
          }}
          onRGBalanceChange={vi.fn()}
          isEditing={false}
        />
        <MaddoxWingTab
          maddoxWingData={{
            layout_instance_id: 1,
            exo_phoria: 2,
            eso_phoria: 3,
            hyper_phoria: 4,
            hyper_eye: "R",
            near_vision: true,
          }}
          onMaddoxWingChange={vi.fn()}
          isEditing={false}
        />
      </>,
    )
    expect(screen.getByText("R/G")).toBeInTheDocument()
    expect(screen.getByDisplayValue("232.32")).toBeInTheDocument()
    expect(screen.getByDisplayValue("767.67")).toBeInTheDocument()
    expect(screen.getByText("Maddox wing")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2")).toBeInTheDocument()
    expect(screen.getByDisplayValue("4")).toBeInTheDocument()
    expect(screen.getAllByText("R").length).toBeGreaterThan(0)
    expect(screen.getByText("NV")).toBeInTheDocument()
  })

  test("renders independent Stereo scores with fixed denominators", () => {
    render(
      <StereoTestTab
        stereoTestData={{ layout_instance_id: 1, fly_result: true, circle_9_score: 4, circle_3_score: 1 }}
        onStereoTestChange={vi.fn()}
        isEditing={false}
      />,
    )
    expect(screen.getByText("/ 9")).toBeInTheDocument()
    expect(screen.getByText("/ 3")).toBeInTheDocument()
    expect(screen.getByDisplayValue("4")).toBeInTheDocument()
    expect(screen.getByDisplayValue("1")).toBeInTheDocument()
  })

  test("shows unsupported imported values without adding arbitrary choices", () => {
    const { container } = render(
      <>
        <FastSelect value="SIDEWAYS" options={["IN", "OUT"]} allowImportedValue disabled />
        <ToggleTextNumberInput value="LegacySph" textOptions={["Plano"]} disabled />
      </>,
    )
    expect(screen.getByText("SIDEWAYS (I)")).toBeInTheDocument()
    expect(container.querySelector('input[value="LegacySph (I)"]')).toBeInTheDocument()
  })

  test("allows imported text to be replaced but not recreated", () => {
    const onChange = vi.fn()
    const { container } = render(
      <ToggleTextNumberInput
        value="legacy-only"
        textOptions={["Plano", "Balance"]}
        onChange={onChange}
      />,
    )
    const input = container.querySelector("input") as HTMLInputElement

    fireEvent.input(input, { target: { value: "another legacy value" } })
    inputSyncManager.flush()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.input(input, { target: { value: "-1.25" } })
    inputSyncManager.flush()
    expect(onChange).toHaveBeenCalledWith("-1.25")
  })

  test("dual-reads legacy SPH aliases as supported presets", () => {
    const { container } = render(
      <ToggleTextNumberInput
        value="Ambliyopya"
        textOptions={["Amblyopia"]}
        textDisplayAliases={{ Ambliyopya: "Amblyopia" }}
        disabled
      />,
    )

    expect(container.querySelector('input[value="Amblyopia"]')).toBeInTheDocument()
    expect(container.textContent).not.toContain("(I)")
  })

  test("renders Contact Lens Exam with VA and J columns and no BC2", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ContactLensExamTab
          contactLensExamData={{
            layout_instance_id: 1,
            r_va: "6/6-2",
            comb_j: "J2",
            l_j: "J3",
          }}
          onContactLensExamChange={vi.fn()}
          isEditing={false}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText("VA")).toBeInTheDocument()
    expect(screen.getByText("J")).toBeInTheDocument()
    expect(screen.queryByText("BC2")).not.toBeInTheDocument()
  })

  test("keeps Base Out below Base In", () => {
    render(<FusionRangeTab fusionRangeData={{}} onFusionRangeChange={vi.fn()} isEditing={false} />)
    const baseIn = screen.getByText("Base In")
    const baseOut = screen.getByText("Base Out")
    expect(baseIn.compareDocumentPosition(baseOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test("stretches Notes to the full height of its grid row", () => {
    const { container } = render(
      <ExamGridLayout
        items={[
          { id: "notes-1", type: "notes", x: 0, y: 0, w: 6 },
          { id: "subjective-1", type: "subjective", x: 6, y: 0, w: 12 },
        ]}
        renderItem={(item) => item.type === "notes" ? (
          <div className="h-full">
            <NotesCard title="Notes" value="" onChange={vi.fn()} />
          </div>
        ) : <div className="h-80" />}
      />,
    )
    expect(container.querySelector(".self-stretch.h-full")).toBeInTheDocument()
    expect(screen.getByText("Notes").closest("[data-slot='card']")).toHaveClass("h-full")
  })
})
