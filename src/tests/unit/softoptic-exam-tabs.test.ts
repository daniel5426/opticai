import { describe, expect, test } from "vitest";
import { buildSoftopticTabs, defaultSoftopticTab, oldRefTabId } from "@/lib/softoptic-exam-tabs";

// The cards the "בדיקה לדוגמא" SoftOptic exam (optic_exp_eyetests code 42936) imports into.
const cards = [
  { id: "1", type: "old-refraction-extension" },
  { id: "objective", type: "objective" },
  { id: "subjective", type: "subjective" },
  { id: "addition", type: "addition" },
  { id: "final-subjective", type: "final-subjective" },
  { id: "final-prescription", type: "final-prescription" },
  { id: "retinoscop", type: "retinoscop" },
  { id: "uncorrected-va", type: "uncorrected-va" },
  { id: "keratometer", type: "keratometer" },
  { id: "keratometer-full", type: "keratometer-full" },
  { id: "anamnesis", type: "anamnesis" },
  { id: "fusion-range", type: "fusion-range" },
  { id: "cover-test-v2", type: "cover-test-v2" },
  { id: "maddox-rod", type: "maddox-rod" },
  { id: "maddox-wing", type: "maddox-wing" },
  { id: "stereo-test", type: "stereo-test" },
  { id: "rg-balance", type: "rg-balance" },
  { id: "schirmer-test", type: "schirmer-test" },
  { id: "contact-lens-diameters", type: "contact-lens-diameters" },
  { id: "softoptic-cover-test-1", type: "softoptic-cover-test" },
  { id: "softoptic-maddox-grid-1", type: "softoptic-maddox-grid" },
];
const oldRefTabs = (card: { id: string; type: string }) => (card.type === "old-refraction-extension" ? ["1"] : undefined);
const typesOf = (tabs: ReturnType<typeof buildSoftopticTabs>, key: string) =>
  tabs.find((tab) => tab.key === key)?.cards.map((card) => card.type);

describe("SoftOptic exam tabs", () => {
  test("lists only the OpticSoft tabs that have data, in OpticSoft's order", () => {
    const tabs = buildSoftopticTabs(cards, oldRefTabs);
    expect(tabs.map((tab) => tab.key)).toEqual([
      "objective", "anamnesa", "oldRef1", "summary", "bioMicroscopy", "bino", "subjective", "more",
    ]);
    expect(defaultSoftopticTab(tabs)).toBe("summary");
  });

  test("places each card where OpticSoft shows it, sharing cards across tabs", () => {
    const tabs = buildSoftopticTabs(cards, oldRefTabs);
    expect(typesOf(tabs, "objective")).toEqual([
      "keratometer-full", "keratometer", "retinoscop", "retinoscop-dilation", "objective", "corneal-topography", "uncorrected-va",
    ]);
    expect(typesOf(tabs, "anamnesa")).toEqual(["uncorrected-va", "anamnesis"]);
    expect(typesOf(tabs, "oldRef1")).toEqual(["old-refraction-extension", "softoptic-cover-test", "softoptic-maddox-grid"]);
    expect(typesOf(tabs, "summary")).toEqual(["old-refraction-extension", "final-subjective", "addition", "keratometer", "uncorrected-va"]);
    expect(typesOf(tabs, "bioMicroscopy")).toEqual(["schirmer-test", "contact-lens-diameters"]);
    expect(typesOf(tabs, "bino")).toEqual(["cover-test-v2", "maddox-wing", "stereo-test", "maddox-rod", "fusion-range"]);
    expect(typesOf(tabs, "subjective")).toEqual(["subjective", "final-subjective", "addition", "rg-balance", "uncorrected-va"]);
    // The same card object is reused, so editing it in one tab edits it everywhere.
    const summaryAddition = tabs.find((tab) => tab.key === "summary")!.cards.find((card) => card.type === "addition");
    const subjectiveAddition = tabs.find((tab) => tab.key === "subjective")!.cards.find((card) => card.type === "addition");
    expect(summaryAddition).toBe(subjectiveAddition);
  });

  test("completes Objective with OpticSoft's empty sections, keyed by type so their edits are stored", () => {
    const objective = buildSoftopticTabs(cards, oldRefTabs).find((tab) => tab.key === "objective")!;
    expect(objective.placeholders).toEqual(["retinoscop-dilation", "corneal-topography"]);
    expect(objective.cards.find((card) => card.type === "corneal-topography")).toEqual({ id: "corneal-topography", type: "corneal-topography" });
    // Imported data replaces the placeholder.
    const withMap = buildSoftopticTabs([...cards, { id: "corneal-topography-1", type: "corneal-topography" }], oldRefTabs);
    expect(withMap.find((tab) => tab.key === "objective")!.placeholders).toEqual(["retinoscop-dilation"]);
    // Placeholders alone never make a tab appear.
    expect(buildSoftopticTabs([{ id: "anamnesis", type: "anamnesis" }], () => undefined).map((tab) => tab.key)).toEqual(["anamnesa"]);
  });

  test("Bino uses OpticSoft's cover-test grid and its Ocular Mot. and R/G sections", () => {
    const tabs = buildSoftopticTabs(
      [
        ...cards,
        { id: "softoptic-cover-test-bino", type: "softoptic-cover-test" },
        { id: "softoptic-ocular-mot-1", type: "softoptic-ocular-mot" },
        { id: "softoptic-rg-1", type: "softoptic-rg" },
      ],
      oldRefTabs,
    );
    expect(typesOf(tabs, "bino")).toEqual([
      "softoptic-cover-test", "maddox-wing", "stereo-test", "maddox-rod", "softoptic-ocular-mot", "softoptic-rg", "fusion-range",
    ]);
    // The simpler copy of the same cover test is replaced, not moved to "more".
    expect(typesOf(tabs, "more")).toEqual(["final-prescription"]);
    // The Bino grid never shows as an old refraction's cover test.
    expect(tabs.find((tab) => tab.key === "oldRef1")!.cards.map((card) => card.id)).not.toContain("softoptic-cover-test-bino");
  });

  test("keeps cards no OpticSoft tab covers in a trailing tab", () => {
    expect(typesOf(buildSoftopticTabs(cards, oldRefTabs), "more")).toEqual(["final-prescription"]);
  });

  test("shows an Old Ref tab per old refraction, with that refraction's cover test and Maddox", () => {
    const tabs = buildSoftopticTabs(
      [
        { id: "1", type: "old-refraction-extension" },
        { id: "softoptic-cover-test-1", type: "softoptic-cover-test" },
        { id: "softoptic-cover-test-3", type: "softoptic-cover-test" },
      ],
      () => ["1", "3"],
    );
    expect(tabs.map((tab) => [tab.key, tab.oldRef])).toEqual([["oldRef3", 3], ["oldRef1", 1], ["summary", undefined]]);
    expect(tabs[0].cards.map((card) => card.id)).toEqual(["1", "softoptic-cover-test-3"]);
  });

  test("finds the old refraction behind each Old Ref tab", () => {
    expect(oldRefTabId(["1", "3"], 2)).toBeUndefined();
    expect(oldRefTabId(["1", "3"], 3)).toBe("3");
    // Older imports kept only the order of their old refractions.
    expect(oldRefTabId(["old-refraction-extension-1"], 1)).toBe("old-refraction-extension-1");
    expect(oldRefTabId(["old-refraction-extension-1"], 2)).toBeUndefined();
    expect(oldRefTabId(undefined, 1)).toBeUndefined();
  });

  test("returns no tabs for an exam without cards", () => {
    expect(buildSoftopticTabs([], () => undefined)).toEqual([]);
    expect(defaultSoftopticTab([])).toBeNull();
  });
});
