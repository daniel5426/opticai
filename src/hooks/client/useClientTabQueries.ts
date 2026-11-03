import { apiClient } from "@/lib/api-client"
import { authService } from "@/lib/auth/AuthService"
import { useClientHistoryClinic } from "./useCompanyClinicFilter"
import { QueryClient, QueryKey, useQuery } from "@tanstack/react-query"
import { getAppointmentsByClient } from "@/lib/db/appointments-db"
import { getClientById } from "@/lib/db/clients-db"
import { getExamsByClientId } from "@/lib/db/exams-db"
import { getFilesByClientId } from "@/lib/db/files-db"
import { getMedicalLogsByClientId } from "@/lib/db/medical-logs-db"
import { getClientOrdersContext, getOrdersByClientId } from "@/lib/db/orders-db"
import { getReferralsByClientId } from "@/lib/db/referral-db"
import { getAllUsers } from "@/lib/db/users-db"
import { normalizeClientForDraft } from "@/lib/client-details-editor"

export type ClientTabName =
  | "details"
  | "exams"
  | "medical"
  | "orders"
  | "referrals"
  | "appointments"
  | "files"

const clientPrefix = (clientId: number) => {
  const companyId = authService.getSession()?.user?.company_id
  return companyId ? ["client", clientId, companyId] as const : ["client", clientId] as const
}

export const clientQueryKeys = {
  client: (clientId: number) => [...clientPrefix(clientId)] as const,
  exams: (clientId: number, type?: string) => [...clientPrefix(clientId), "exams", type ?? "all"] as const,
  orders: (clientId: number) => [...clientPrefix(clientId), "orders"] as const,
  ordersContext: (clientId: number) => [...clientPrefix(clientId), "orders-context"] as const,
  medicalLogs: (clientId: number) => [...clientPrefix(clientId), "medical-logs"] as const,
  referrals: (clientId: number) => [...clientPrefix(clientId), "referrals"] as const,
  appointments: (clientId: number) => [...clientPrefix(clientId), "appointments"] as const,
  files: (clientId: number) => [...clientPrefix(clientId), "files"] as const,
  users: (clinicId?: number) => ["users", clinicId ?? "all"] as const,
}

const isValidClientId = (clientId: number) => Number.isFinite(clientId) && clientId > 0

export function useUsersQuery(clinicId?: number, enabled = true) {
  return useQuery({
    queryKey: clientQueryKeys.users(clinicId),
    queryFn: async () => { const response = await apiClient.getRecordStaff(); if (response.error) throw new Error(response.error); return response.data ?? [] },
    enabled,
  })
}

export function useClientExamsQuery(clientId: number, type: "exam" | "opticlens", enabled = true) {
  const clinicId = useClientHistoryClinic()
  return useQuery({
    queryKey: clientQueryKeys.exams(clientId, type),
    queryFn: () => getExamsByClientId(clientId, type),
    select: items => clinicId === undefined ? items : items.filter(item => item.clinic_id === clinicId),
    enabled: enabled && isValidClientId(clientId),
  })
}

export function useClientOrdersQuery(clientId: number, enabled = true) {
  const clinicId = useClientHistoryClinic()
  return useQuery({
    queryKey: clientQueryKeys.orders(clientId),
    queryFn: () => getOrdersByClientId(clientId),
    select: items => clinicId === undefined ? items : items.filter(item => item.clinic_id === clinicId),
    enabled: enabled && isValidClientId(clientId),
  })
}

export function useClientOrdersContextQuery(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientQueryKeys.ordersContext(clientId),
    queryFn: () => getClientOrdersContext(clientId),
    enabled: enabled && isValidClientId(clientId),
  })
}

export function useClientMedicalLogsQuery(clientId: number, enabled = true) {
  const clinicId = useClientHistoryClinic()
  return useQuery({
    queryKey: clientQueryKeys.medicalLogs(clientId),
    queryFn: () => getMedicalLogsByClientId(clientId),
    select: items => clinicId === undefined ? items : items.filter(item => item.clinic_id === clinicId),
    enabled: enabled && isValidClientId(clientId),
  })
}

export function useClientReferralsQuery(clientId: number, enabled = true) {
  const clinicId = useClientHistoryClinic()
  return useQuery({
    queryKey: clientQueryKeys.referrals(clientId),
    queryFn: () => getReferralsByClientId(clientId),
    select: items => clinicId === undefined ? items : items.filter(item => item.clinic_id === clinicId),
    enabled: enabled && isValidClientId(clientId),
  })
}

export function useClientAppointmentsQuery(clientId: number, enabled = true) {
  const clinicId = useClientHistoryClinic()
  return useQuery({
    queryKey: clientQueryKeys.appointments(clientId),
    queryFn: () => getAppointmentsByClient(clientId),
    select: items => clinicId === undefined ? items : items.filter(item => item.clinic_id === clinicId),
    enabled: enabled && isValidClientId(clientId),
  })
}

export function useClientFilesQuery(clientId: number, enabled = true) {
  const clinicId = useClientHistoryClinic()
  return useQuery({
    queryKey: clientQueryKeys.files(clientId),
    queryFn: () => getFilesByClientId(clientId),
    select: items => clinicId === undefined ? items : items.filter(item => item.clinic_id === clinicId),
    enabled: enabled && isValidClientId(clientId),
  })
}

export function removeQueryItemById<T extends { id?: number }>(items: T[] | undefined, id: number): T[] {
  return (items || []).filter((item) => item.id !== id)
}

export function replaceQueryItemById<T extends { id?: number }>(items: T[] | undefined, item: T): T[] {
  const current = items || []
  if (!item.id) return current
  return current.map((existing) => (existing.id === item.id ? item : existing))
}

export function upsertQueryItemById<T extends { id?: number }>(items: T[] | undefined, item: T): T[] {
  const current = items || []
  if (!item.id || !current.some((existing) => existing.id === item.id)) {
    return [item, ...current]
  }
  return replaceQueryItemById(current, item)
}

export function restoreQueryData<T>(queryClient: QueryClient, queryKey: QueryKey, previous: T | undefined) {
  queryClient.setQueryData(queryKey, previous)
}

export function prefetchClientTab(
  queryClient: QueryClient,
  clientId: number,
  tab: ClientTabName,
  clinicId?: number,
) {
  if (!isValidClientId(clientId)) return Promise.resolve()

  if (tab === "details") {
    return queryClient.prefetchQuery({
      queryKey: clientQueryKeys.client(clientId),
      queryFn: async () => {
        const client = await getClientById(clientId)
        if (!client) throw new Error("Client not found")
        return normalizeClientForDraft(client)
      },
    })
  }

  if (tab === "exams") {
    return queryClient.prefetchQuery({
      queryKey: clientQueryKeys.exams(clientId, "exam"),
      queryFn: () => getExamsByClientId(clientId, "exam"),
    })
  }

  if (tab === "medical") {
    return queryClient.prefetchQuery({
      queryKey: clientQueryKeys.medicalLogs(clientId),
      queryFn: () => getMedicalLogsByClientId(clientId),
    })
  }

  if (tab === "orders") {
    return Promise.all([
      queryClient.prefetchQuery({
        queryKey: clientQueryKeys.orders(clientId),
        queryFn: () => getOrdersByClientId(clientId),
      }),
      queryClient.prefetchQuery({
        queryKey: clientQueryKeys.ordersContext(clientId),
        queryFn: () => getClientOrdersContext(clientId),
      }),
      queryClient.prefetchQuery({
        queryKey: clientQueryKeys.users(clinicId),
        queryFn: async () => { const response = await apiClient.getRecordStaff(); if (response.error) throw new Error(response.error); return response.data ?? [] },
      }),
    ]).then(() => undefined)
  }

  if (tab === "referrals") {
    return queryClient.prefetchQuery({
      queryKey: clientQueryKeys.referrals(clientId),
      queryFn: () => getReferralsByClientId(clientId),
    })
  }

  if (tab === "appointments") {
    return queryClient.prefetchQuery({
      queryKey: clientQueryKeys.appointments(clientId),
      queryFn: () => getAppointmentsByClient(clientId),
    })
  }

  return queryClient.prefetchQuery({
    queryKey: clientQueryKeys.files(clientId),
    queryFn: () => getFilesByClientId(clientId),
  })
}
