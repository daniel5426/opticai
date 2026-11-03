import { describe, expect, it } from "vitest"
import { resolveRecordClinicName } from "@/lib/record-clinic"

const currentClinic = { id: 2, name: "Clinic B" }
const resolve = (values: Partial<Parameters<typeof resolveRecordClinicName>[0]> = {}) =>
  resolveRecordClinicName({ clinicId: 1, clinics: [], currentClinic, ...values })

describe("record clinic attribution", () => {
  it("uses the name supplied with the record", () => {
    expect(resolve({ clinicName: "Clinic A", clinics: [{ id: 1, name: "Old name" }] })).toBe("Clinic A")
  })
  it("matches numeric IDs from older API responses", () => {
    expect(resolve({ clinicId: "1", clinics: [{ id: 1, name: "Clinic A" }] })).toBe("Clinic A")
  })
  it("uses the signed-in clinic name when its ID matches and lookup is unavailable", () => {
    expect(resolve({ clinicId: 2 })).toBe("Clinic B")
  })
  it("never attributes another clinic's exam to the current clinic", () => {
    expect(resolve()).toBeUndefined()
    expect(resolve({ clinicId: null })).toBeUndefined()
  })
  it("preserves legacy text only when the exam has no clinic ID", () => {
    expect(resolve({ clinicId: null, legacyName: "Legacy clinic" })).toBe("Legacy clinic")
    expect(resolve({ legacyName: "Conflicting old text" })).toBeUndefined()
  })
})
