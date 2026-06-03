import React from "react"
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ClientsTable } from "@/components/clients-table"
import { Client } from "@/lib/db/schema-interface"

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

const clients: Client[] = [
  {
    id: 1,
    clinic_id: 1,
    first_name: "John",
    last_name: "Smith",
    national_id: "123",
    phone_mobile: "050",
    email: "john@example.test",
  } as Client,
]

describe("server-filtered tables", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("keeps backend-returned rows when serverFiltered is enabled", () => {
    render(
      <ClientsTable
        data={clients}
        searchQuery="John Smith"
        onSearchChange={vi.fn()}
        serverFiltered={true}
      />,
    )

    expect(screen.getByText("John")).toBeInTheDocument()
    expect(screen.getByText("Smith")).toBeInTheDocument()
  })

  it("keeps local filtering behavior when serverFiltered is disabled", () => {
    render(
      <ClientsTable
        data={clients}
        searchQuery="John Smith"
        onSearchChange={vi.fn()}
      />,
    )

    expect(screen.queryByText("John")).not.toBeInTheDocument()
  })
})
