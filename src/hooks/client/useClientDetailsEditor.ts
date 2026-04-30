import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getClientById, updateClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema-interface"
import {
  buildClientUpdatePayload,
  normalizeClientForDraft,
  shouldClearStatusForHealthFund,
} from "@/lib/client-details-editor"

type ClientFieldValue = string | boolean | number | null

export function useClientDetailsEditor(clientId: number) {
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => ["client", clientId] as const, [clientId])
  const [draftClient, setDraftClient] = useState<Client | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const clientQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const client = await getClientById(clientId)
      if (!client) throw new Error("Client not found")
      return normalizeClientForDraft(client)
    },
    enabled: Number.isFinite(clientId) && clientId > 0,
  })

  const serverClient = clientQuery.data || null

  useEffect(() => {
    setDraftClient(null)
    setIsEditing(false)
  }, [clientId])

  useEffect(() => {
    if (!serverClient || isEditing) return
    setDraftClient(serverClient)
  }, [serverClient, isEditing])

  const saveMutation = useMutation({
    mutationFn: async (payload: Client) => updateClient(payload),
  })

  const startEdit = useCallback(() => {
    if (serverClient) setDraftClient(serverClient)
    setIsEditing(true)
  }, [serverClient])

  const cancelEdit = useCallback(() => {
    if (serverClient) setDraftClient(serverClient)
    setIsEditing(false)
  }, [serverClient])

  const updateDraftField = useCallback((name: string, value: ClientFieldValue) => {
    setDraftClient(prev => {
      if (!prev) return prev
      const processedValue = name === "family_id" && typeof value === "string"
        ? value === "" ? null : parseInt(value, 10)
        : value

      const next = { ...prev, [name]: processedValue }
      if (
        name === "health_fund" &&
        processedValue !== prev.health_fund &&
        shouldClearStatusForHealthFund(prev.status, processedValue)
      ) {
        next.status = ""
      }
      return next
    })
  }, [])

  const saveDraft = useCallback(async () => {
    if (!serverClient || !draftClient) return null

    const payload = buildClientUpdatePayload(serverClient, draftClient)
    try {
      const updated = await saveMutation.mutateAsync(payload)
      if (!updated) throw new Error("Client update failed")

      const normalized = normalizeClientForDraft(updated)
      queryClient.setQueryData(queryKey, normalized)
      setDraftClient(normalized)
      setIsEditing(false)
      return normalized
    } catch {
      setIsEditing(true)
      return null
    }
  }, [draftClient, queryClient, queryKey, saveMutation, serverClient])

  return {
    serverClient,
    draftClient,
    isEditing,
    isLoading: clientQuery.isLoading,
    isError: clientQuery.isError,
    isSaving: saveMutation.isPending,
    startEdit,
    cancelEdit,
    updateDraftField,
    saveDraft,
    refetchClient: clientQuery.refetch,
  }
}
