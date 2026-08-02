import { describe, expect, test } from "vitest";
import { parseLayoutData } from "@/pages/exam-detail/utils";
import { normalizeNpcExamData } from "@/lib/npc-compatibility";

describe("NPC compatibility", () => {
  test("upgrades legacy OPC layout cards at read time", () => {
    const parsed = parseLayoutData(
      JSON.stringify({
        rows: [{ id: "row-1", cards: [{ id: "opc-1", type: "opc" }] }],
        customWidths: {},
      }),
    );

    expect(parsed.rows[0].cards[0].type).toBe("npc");
  });

  test("upgrades legacy OPC data keys while preferring canonical NPC data", () => {
    expect(
      normalizeNpcExamData({
        opc: { npc_break: 4 },
        "opc-opc-1": { npc_recovery: 8 },
        npc: { npc_break: 6 },
      }),
    ).toEqual({
      npc: { npc_break: 6 },
      "npc-opc-1": { npc_recovery: 8 },
    });
  });
});
