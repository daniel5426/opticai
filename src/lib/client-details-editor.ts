import { Client } from "@/lib/db/schema-interface"

export const CLIENT_HEALTH_FUNDS: Record<string, string[]> = {
  "כללית": ["רגיל", "מושלם זהב", "מושלם פלטינום"],
  "מכבי": ["רגיל", "זהב", "שלי"],
  "מאוחדת": ["רגיל", "עדיף", "שיא"],
  "לאומית": ["רגיל", "כסף", "זהב"],
}

export const CLIENT_GENDER_OPTIONS = ["זכר", "נקבה", "אחר"]

const GENDER_VALUE_MAP: Record<string, string> = {
  male: "זכר",
  m: "זכר",
  female: "נקבה",
  f: "נקבה",
  other: "אחר",
}

const HEALTH_FUND_VALUE_MAP: Record<string, string> = {
  clalit: "כללית",
  "כללית": "כללית",
  maccabi: "מכבי",
  "מכבי": "מכבי",
  meuhedet: "מאוחדת",
  "מאוחדת": "מאוחדת",
  leumit: "לאומית",
  "לאומית": "לאומית",
}

export function getClientStatusOptions(healthFund?: string | null) {
  const normalizedHealthFund = normalizeHealthFund(healthFund)
  return normalizedHealthFund ? CLIENT_HEALTH_FUNDS[normalizedHealthFund] || [] : []
}

export function normalizeGender(value?: string | null) {
  return normalizeOptionValue(value, GENDER_VALUE_MAP, CLIENT_GENDER_OPTIONS)
}

export function normalizeHealthFund(value?: string | null) {
  return normalizeOptionValue(value, HEALTH_FUND_VALUE_MAP, Object.keys(CLIENT_HEALTH_FUNDS))
}

export function normalizeClientForDraft(client: Client): Client {
  return trimClientStrings({
    ...client,
    gender: normalizeGender(client.gender),
    health_fund: normalizeHealthFund(client.health_fund),
    status: normalizeFreeText(client.status),
  })
}

export function buildClientUpdatePayload(serverClient: Client, draftClient: Client): Client {
  return trimClientStrings({
    ...serverClient,
    ...draftClient,
    gender: normalizeGender(draftClient.gender),
    health_fund: normalizeHealthFund(draftClient.health_fund),
    status: normalizeFreeText(draftClient.status),
  })
}

export function shouldClearStatusForHealthFund(status: unknown, healthFund: unknown) {
  const normalizedStatus = normalizeFreeText(status)
  if (!normalizedStatus) return false
  return !getClientStatusOptions(String(healthFund || "")).includes(normalizedStatus)
}

function normalizeOptionValue(
  value: string | null | undefined,
  valueMap: Record<string, string>,
  allowedValues: string[]
) {
  const rawValue = normalizeFreeText(value)
  if (!rawValue) return ""
  if (allowedValues.includes(rawValue)) return rawValue
  return valueMap[rawValue.toLowerCase()] || rawValue
}

function normalizeFreeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function trimClientStrings(client: Client): Client {
  return Object.fromEntries(
    Object.entries(client).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ])
  ) as Client
}
