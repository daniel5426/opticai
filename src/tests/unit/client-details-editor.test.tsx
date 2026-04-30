import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { ClientDetailsTab } from "@/components/client/ClientDetailsTab"
import { Client } from "@/lib/db/schema-interface"
import {
  buildClientUpdatePayload,
  normalizeClientForDraft,
  shouldClearStatusForHealthFund,
} from "@/lib/client-details-editor"

vi.mock("@/lib/db/family-db", () => ({
  getAllFamilies: vi.fn(() => Promise.resolve([{
    id: 42,
    name: "כהן",
    clients: [{ id: 7, first_name: "דנה", last_name: "כהן" }],
  }])),
  getFamilyById: vi.fn(() => Promise.resolve(null)),
  createFamily: vi.fn(),
  addClientToFamily: vi.fn(),
  removeClientFromFamily: vi.fn(),
}))

describe("client details editor helpers", () => {
  test("normalizes legacy loaded client values at the boundary", () => {
    const draft = normalizeClientForDraft({
      id: 1,
      gender: " female ",
      health_fund: " maccabi ",
      status: " זהב ",
    } as Client)

    expect(draft.gender).toBe("נקבה")
    expect(draft.health_fund).toBe("מכבי")
    expect(draft.status).toBe("זהב")
  })

  test("builds a cleaned full update payload from server data and draft edits", () => {
    const payload = buildClientUpdatePayload(
      {
        id: 1,
        first_name: " דנה ",
        last_name: " כהן ",
        email: " dana@example.com ",
        gender: "female",
        health_fund: "כללית",
        status: "רגיל",
      } as Client,
      {
        id: 1,
        first_name: " דניאל ",
        gender: " male ",
        health_fund: " clalit ",
        status: " מושלם זהב ",
      } as Client
    )

    expect(payload).toMatchObject({
      id: 1,
      first_name: "דניאל",
      last_name: "כהן",
      email: "dana@example.com",
      gender: "זכר",
      health_fund: "כללית",
      status: "מושלם זהב",
    })
  })

  test("only clears status when it is invalid for a manually changed health fund", () => {
    expect(shouldClearStatusForHealthFund("רגיל", "מכבי")).toBe(false)
    expect(shouldClearStatusForHealthFund("מושלם פלטינום", "מכבי")).toBe(true)
    expect(shouldClearStatusForHealthFund("", "מכבי")).toBe(false)
  })
})

describe("ClientDetailsTab select display", () => {
  test("renders loaded gender, health fund, and status from the controlled draft", async () => {
    const draft = {
      id: 1,
      first_name: "דנה",
      last_name: "כהן",
      gender: "נקבה",
      health_fund: "כללית",
      status: "מושלם זהב",
    } as Client

    render(
      <ClientDetailsTab
        draft={draft}
        isEditing={false}
        formRef={{ current: null }}
        onFieldChange={vi.fn()}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByText("נקבה").length).toBeGreaterThan(0)
      expect(screen.getAllByText("כללית").length).toBeGreaterThan(0)
      expect(screen.getAllByText("מושלם זהב").length).toBeGreaterThan(0)
    })
  })

  test("selecting a family emits a numeric family_id for new-client drafts", async () => {
    const onFieldChange = vi.fn()

    render(
      <ClientDetailsTab
        draft={{} as Client}
        isEditing={false}
        mode="new"
        formRef={{ current: null }}
        onFieldChange={onFieldChange}
      />
    )

    await userEvent.click(screen.getByRole("combobox", { name: "משפחה" }))
    expect(await screen.findByText("דנה כהן")).toBeInTheDocument()
    await userEvent.click(await screen.findByText("כהן"))

    expect(onFieldChange).toHaveBeenCalledWith("family_id", 42)
    expect(onFieldChange).toHaveBeenCalledWith("family_role", "אחר")
  })
})
