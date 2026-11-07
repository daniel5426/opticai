import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SoftOpticDetailsTab } from "@/components/exam/SoftOpticDetailsTab";
import { RefractionTabsHeader } from "@/components/exam/shared/RefractionTabsHeader";
import { buildSoftopticTabs, softopticGridSlotCardId } from "@/lib/softoptic-exam-tabs";

describe("SoftOptic exam data on its tabs", () => {
  test("gives each Old Ref grid tab its own card", () => {
    const value = { card_id: "softoptic-cover-test-1", card_instance_id: "2" };
    expect(softopticGridSlotCardId("softoptic-cover-test", value)).toBe("softoptic-cover-test-1-2");
    expect(softopticGridSlotCardId("softoptic-cover-test", { card_instance_id: "softoptic-cover-test-bino" })).toBeNull();
    expect(softopticGridSlotCardId("subjective", value)).toBeNull();

    const tabs = buildSoftopticTabs(
      [
        { id: "softoptic-cover-test-1-1", type: "softoptic-cover-test" },
        { id: "softoptic-cover-test-1-2", type: "softoptic-cover-test" },
        { id: "softoptic-maddox-grid-1-3", type: "softoptic-maddox-grid" },
      ],
      () => [],
    );
    const cardsOf = (key: string) => tabs.find((tab) => tab.key === key)?.cards.map((card) => card.id);
    expect(cardsOf("oldRef1")).toEqual(["softoptic-cover-test-1-1"]);
    expect(cardsOf("oldRef2")).toEqual(["softoptic-cover-test-1-2"]);
    expect(cardsOf("oldRef3")).toEqual(["softoptic-maddox-grid-1-3"]);
  });

  test("puts each details slot on its OpticSoft tab", () => {
    const tabs = buildSoftopticTabs(
      ["fundus", "bio", "old-ref-2", "final", "anamnesa"].map((id) => ({ id, type: "softoptic-details" })),
      () => [],
    );
    expect(tabs.map((tab) => [tab.key, tab.cards.map((card) => card.id)])).toEqual([
      ["anamnesa", ["anamnesa"]],
      ["oldRef2", ["old-ref-2"]],
      ["fundus", ["fundus"]],
      ["bioMicroscopy", ["bio"]],
      ["subjective", ["final"]],
    ]);
  });

  test("shows only the imported values while viewing", () => {
    render(
      <SoftOpticDetailsTab
        data={{ layout_instance_id: 1, r_macula: "12", l_macula: "21" }}
        cardId="fundus"
        onChange={() => {}}
        isEditing={false}
      />,
    );
    expect(screen.getByDisplayValue("12")).toBeTruthy();
    expect(screen.getByDisplayValue("21")).toBeTruthy();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });
});

describe("RefractionTabsHeader", () => {
  const props = {
    title: "Old Refraction E",
    tabCount: 3,
    activeTab: 0,
    tabTypes: ["ביפוקל", "רחוק", "רחוק"],
    isEditing: true,
    onTabChange: () => {},
    onAddTab: () => {},
  };

  test("shows only the title and type when each refraction has its own page tab", () => {
    render(<RefractionTabsHeader {...props} hideTabs tabLabel="ביפוקל" />);
    expect(screen.getByRole("heading").textContent).toBe("Old Refraction E · ביפוקל");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("keeps the inner tabs everywhere else", () => {
    render(<RefractionTabsHeader {...props} />);
    expect(screen.getByRole("heading").textContent).toBe("Old Refraction E");
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(4);
  });
});
