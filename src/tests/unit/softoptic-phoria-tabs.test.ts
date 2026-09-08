import { describe, expect, test } from "vitest";
import {
  ensureLayoutDataForRows,
  getTabsForCard,
} from "@/lib/exam-ui-metadata";
import {
  matchTabbedFullDataType,
  resolveTabbedExamCardId,
} from "@/lib/exam-tabbed-card-ids";
import { reshapeSoftopticPhoriaGridExamData } from "@/lib/softoptic-phoria-tabs";
import type { CardRow } from "@/pages/exam-detail/types";

describe("softoptic phoria tabs", () => {
  test("reshapes legacy slot keys into one tabbed card", () => {
    const data = {
      "softoptic-cover-test-softoptic-cover-test-1": {
        fv_exo_phoria: 1,
        card_instance_id: "softoptic-cover-test-1",
      },
      "softoptic-cover-test-softoptic-cover-test-2": {
        fv_exo_phoria: 2,
        card_instance_id: "softoptic-cover-test-2",
      },
      "softoptic-cover-test-softoptic-cover-test-bino": {
        fv_exo_phoria: 9,
        card_instance_id: "softoptic-cover-test-bino",
      },
      "old-refraction-old-refraction-1-1": {
        r_glasses_type: "ביפוקל",
        card_id: "old-refraction-1",
        card_instance_id: "1",
      },
    };

    const reshaped = reshapeSoftopticPhoriaGridExamData(data).examData;

    expect(
      reshaped["softoptic-cover-test-softoptic-cover-test-1-1"],
    ).toMatchObject({
      fv_exo_phoria: 1,
      card_id: "softoptic-cover-test-1",
      card_instance_id: "1",
      r_glasses_type: "ביפוקל",
    });
    expect(
      reshaped["softoptic-cover-test-softoptic-cover-test-1-2"],
    ).toMatchObject({
      fv_exo_phoria: 2,
      card_instance_id: "2",
    });
    expect(
      reshaped["softoptic-cover-test-softoptic-cover-test-1"],
    ).toBeUndefined();
    expect(
      reshaped["softoptic-cover-test-softoptic-cover-test-bino"].fv_exo_phoria,
    ).toBe(9);
    expect(
      getTabsForCard(
        reshaped,
        "softoptic-cover-test",
        "softoptic-cover-test-1",
      ).map((tab) => tab.id),
    ).toEqual(["1", "2"]);
  });

  test("groups tab keys onto one All Data card and keeps bino separate", () => {
    const coverTab = {
      fv_exo_phoria: 1,
      card_id: "softoptic-cover-test-1",
      card_instance_id: "1",
    };
    const coverTabTwo = {
      fv_exo_phoria: 2,
      card_id: "softoptic-cover-test-1",
      card_instance_id: "2",
    };
    const bino = {
      fv_exo_phoria: 9,
      card_id: "softoptic-cover-test-bino",
      card_instance_id: "softoptic-cover-test-bino",
    };

    expect(
      matchTabbedFullDataType("softoptic-cover-test-softoptic-cover-test-1-1")
        ?.type,
    ).toBe("softoptic-cover-test");
    expect(
      resolveTabbedExamCardId(
        "softoptic-cover-test",
        "softoptic-cover-test-softoptic-cover-test-1-1",
        coverTab,
      ),
    ).toBe("softoptic-cover-test-1");
    expect(
      resolveTabbedExamCardId(
        "softoptic-cover-test",
        "softoptic-cover-test-softoptic-cover-test-1-2",
        coverTabTwo,
      ),
    ).toBe("softoptic-cover-test-1");
    expect(
      resolveTabbedExamCardId(
        "softoptic-cover-test",
        "softoptic-cover-test-softoptic-cover-test-bino",
        bino,
      ),
    ).toBe("softoptic-cover-test-bino");
  });

  test("loads reshaped tabs for an existing layout card", () => {
    const rows: CardRow[] = [
      {
        id: "row-1",
        cards: [{ id: "softoptic-cover-test-1", type: "softoptic-cover-test" }],
      },
    ];
    const normalized = ensureLayoutDataForRows(
      {
        "softoptic-cover-test-softoptic-cover-test-1": {
          fv_exo_phoria: 4,
          card_instance_id: "softoptic-cover-test-1",
        },
      },
      rows,
      42,
    );

    expect(
      normalized.examData["softoptic-cover-test-softoptic-cover-test-1-1"],
    ).toMatchObject({
      fv_exo_phoria: 4,
      card_instance_id: "1",
    });
    expect(
      getTabsForCard(
        normalized.examData,
        "softoptic-cover-test",
        "softoptic-cover-test-1",
      ),
    ).toEqual([expect.objectContaining({ id: "1", index: 0 })]);
  });

  test("copies resolved old refraction types onto last-migration cover and maddox tabs", () => {
    const reshaped = reshapeSoftopticPhoriaGridExamData({
      "softoptic-cover-test-softoptic-cover-test-1": {
        fv_exo_phoria: 1,
        card_instance_id: "softoptic-cover-test-1",
        r_glasses_type: "רחוק",
        l_glasses_type: "רחוק",
      },
      "softoptic-cover-test-softoptic-cover-test-2": {
        fv_exo_phoria: 2,
        card_instance_id: "softoptic-cover-test-2",
      },
      "softoptic-maddox-grid-softoptic-maddox-grid-1": {
        fv_exo_phoria: 3,
        card_instance_id: "softoptic-maddox-grid-1",
        r_glasses_type: "רחוק",
      },
      "old-refraction-extension-old-refraction-extension-1-1": {
        r_sph: 1,
        r_glasses_type: "רחוק",
        l_glasses_type: "רחוק",
        legacy_glasses_type: "ביפוקל",
        card_id: "old-refraction-extension-1",
        card_instance_id: "1",
      },
      "old-refraction-extension-old-refraction-extension-1-2": {
        r_sph: 2,
        r_glasses_type: "רחוק",
        legacy_glasses_type: "ראיה",
        card_id: "old-refraction-extension-1",
        card_instance_id: "2",
      },
    }).examData;

    expect(
      reshaped["softoptic-cover-test-softoptic-cover-test-1-1"],
    ).toMatchObject({
      r_glasses_type: "ביפוקל",
      l_glasses_type: "ביפוקל",
    });
    expect(
      reshaped["softoptic-cover-test-softoptic-cover-test-1-2"],
    ).toMatchObject({
      r_glasses_type: "ראיה",
    });
    expect(
      reshaped["softoptic-maddox-grid-softoptic-maddox-grid-1-1"],
    ).toMatchObject({
      r_glasses_type: "ביפוקל",
    });
    expect(
      getTabsForCard(
        reshaped,
        "softoptic-cover-test",
        "softoptic-cover-test-1",
      ).map((tab) => tab.type),
    ).toEqual(["ביפוקל", "ראיה"]);
  });

  test("does not stamp default far onto softoptic tabs during layout ensure", () => {
    const rows: CardRow[] = [
      {
        id: "row-1",
        cards: [
          { id: "softoptic-cover-test-1", type: "softoptic-cover-test" },
          {
            id: "old-refraction-extension-1",
            type: "old-refraction-extension",
          },
        ],
      },
    ];
    const normalized = ensureLayoutDataForRows(
      {
        "softoptic-cover-test-softoptic-cover-test-1": {
          fv_exo_phoria: 4,
          card_instance_id: "softoptic-cover-test-1",
          r_glasses_type: "רחוק",
          l_glasses_type: "רחוק",
        },
        "old-refraction-extension-old-refraction-extension-1-1": {
          r_sph: 1,
          r_glasses_type: "רחוק",
          legacy_glasses_type: "ראיה",
          card_id: "old-refraction-extension-1",
          card_instance_id: "1",
        },
      },
      rows,
      42,
    );

    expect(
      normalized.examData["softoptic-cover-test-softoptic-cover-test-1-1"],
    ).toMatchObject({
      r_glasses_type: "ראיה",
      l_glasses_type: "ראיה",
    });
    expect(
      getTabsForCard(
        normalized.examData,
        "softoptic-cover-test",
        "softoptic-cover-test-1",
      )[0].type,
    ).toBe("ראיה");
  });
});
