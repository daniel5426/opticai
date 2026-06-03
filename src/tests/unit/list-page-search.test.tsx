import React from "react"
import { act, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useLatestTableSearchRequest } from "@/lib/list-page-search"

type GuardApi = ReturnType<typeof useLatestTableSearchRequest>

function GuardHarness({
  searchInput,
  onReady,
}: {
  searchInput: string
  onReady: (api: GuardApi) => void
}) {
  const api = useLatestTableSearchRequest(searchInput)
  onReady(api)
  return null
}

describe("useLatestTableSearchRequest", () => {
  it("rejects a response when the user typed a newer search before it returned", () => {
    let api: GuardApi | undefined

    render(<GuardHarness searchInput="dan" onReady={(nextApi) => { api = nextApi }} />)

    const canCommitDan = api!.startSearchRequest("dan")
    expect(canCommitDan()).toBe(true)

    act(() => {
      api!.updateLatestSearch("daniel")
    })

    expect(canCommitDan()).toBe(false)
    expect(api!.startSearchRequest("daniel")()).toBe(true)
  })

  it("rejects older requests even when the search text is unchanged", () => {
    let api: GuardApi | undefined

    render(<GuardHarness searchInput="john" onReady={(nextApi) => { api = nextApi }} />)

    const firstRequest = api!.startSearchRequest(" john ")
    const secondRequest = api!.startSearchRequest("john")

    expect(firstRequest()).toBe(false)
    expect(secondRequest()).toBe(true)
  })
})
