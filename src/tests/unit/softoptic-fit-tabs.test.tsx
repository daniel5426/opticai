import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SoftOpticDetailsTab } from "@/components/exam/SoftOpticDetailsTab";
import { buildSoftopticFitTabs, defaultSoftopticTab } from "@/lib/softoptic-exam-tabs";

describe("SoftOptic contact lens fit tabs", () => {
  const cards = [
    { id: "fitting", type: "softoptic-details" },
    { id: "eye-test", type: "softoptic-details" },
    { id: "old-contact-lenses-1", type: "old-contact-lenses" },
    { id: "keratometer-1", type: "keratometer" },
    { id: "schirmer-test-1", type: "schirmer-test" },
    { id: "bio", type: "softoptic-details" },
    { id: "old-refraction-1", type: "old-refraction" },
    { id: "softoptic-cover-test-2", type: "softoptic-cover-test" },
  ];
  const tabs = buildSoftopticFitTabs(cards, (card) => (card.type === "old-refraction" ? ["1"] : undefined));
  const cardsOf = (key: string) => tabs.find((tab) => tab.key === key)?.cards.map((card) => card.id);

  test("shows all of OpticSoft's fit tabs in its order and opens on Fitting", () => {
    expect(tabs.map((tab) => tab.key)).toEqual(["subjective", "bioM", "rxCl1", "rxCl2", "fitting", "observation", "bino"]);
    expect(defaultSoftopticTab(tabs)).toBe("fitting");
  });

  test("puts each card on its tab and shares the eye test's ones", () => {
    expect(cardsOf("fitting")).toEqual(["fitting", "old-contact-lenses-1", "objective", "keratometer-1", "over-refraction"]);
    expect(cardsOf("subjective")).toEqual([
      "schirmer-test-1", "final-subjective", "addition", "keratometer-1", "uncorrected-va", "eye-test",
    ]);
    expect(cardsOf("bioM")).toEqual(["schirmer-test-1", "contact-lens-diameters", "bio", "eye-test"]);
    expect(cardsOf("rxCl1")).toEqual(["old-refraction-1"]);
    expect(cardsOf("rxCl2")).toEqual(["softoptic-cover-test-2"]);
  });

  test("draws empty sections for typing in, but nothing for a tab with none", () => {
    expect(tabs.find((tab) => tab.key === "observation")?.placeholders).toEqual(["sensation-vision-stability"]);
    const empty = buildSoftopticFitTabs([], () => undefined);
    expect(empty.find((tab) => tab.key === "rxCl1")?.cards).toEqual([]);
  });

  test("shows the fitting details with the wearing unit and long remarks", () => {
    render(
      <SoftOpticDetailsTab
        cardId="fitting"
        isEditing={false}
        onChange={() => {}}
        data={{ layout_instance_id: 0, wearing_duration: "4", wearing_unit: "weeks", fit_notes: "two lines\nof notes" }}
      />,
    );
    expect(screen.getByDisplayValue("4")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("weeks");
    expect(screen.getByDisplayValue(/two lines/).tagName).toBe("TEXTAREA");
  });
});
