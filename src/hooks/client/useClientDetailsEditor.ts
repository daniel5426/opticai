import { useSaveController } from "@/hooks/shared/useSaveController"
import { stableSaveJson } from "@/lib/exam-workspace"
import { flushSync } from "react-dom"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getClientById, updateClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema-interface"
import {
  buildClientUpdatePayload,
  normalizeClientForDraft,
  shouldClearStatusForHealthFund,
} from "@/lib/client-details-editor"
import { clientQueryKeys } from "@/hooks/client/useClientTabQueries"

type ClientFieldValue = string | boolean | number | null

export function useClientDetailsEditor(clientId: number) {
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => clientQueryKeys.client(clientId), [clientId])
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
    retry: false,
  })

  const serverClient = clientQuery.data || null
  const controller = useSaveController({identity:clientId, dirty: isEditing && stableSaveJson(draftClient) !== stableSaveJson(serverClient)})

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
    if (stableSaveJson(draftClient) === stableSaveJson(serverClient)) return draftClient
    try {
      return await controller.run(async () => {
      const updated = await saveMutation.mutateAsync(payload)
      if (!updated) throw new Error("Client update failed")

      const normalized = normalizeClientForDraft(updated)
      queryClient.setQueryData(queryKey, normalized)
      flushSync(() => { setDraftClient(normalized); setIsEditing(true) })
      return normalized
      })
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
    isSaving: controller.isSaving,
    saveState: controller.state,
    startEdit,
    cancelEdit,
    updateDraftField,
    saveDraft,
    refetchClient: clientQuery.refetch,
  }
}
