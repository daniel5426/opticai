import { QueryClient, QueryKey } from "@tanstack/react-query"
import {
  Appointment,
  File,
  OpticalExam,
  Order,
  Referral,
} from "@/lib/db/schema-interface"
import { clientQueryKeys } from "@/hooks/client/useClientTabQueries"

type RowWithId = { id?: number }

const isValidClientId = (clientId: number) =>
  Number.isFinite(clientId) && clientId > 0

const dateTimeValue = (value: unknown) => {
  if (!value) return 0
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

const idValue = (item: RowWithId) => item.id ?? 0

function sortByDateDesc<T extends RowWithId>(
  items: T[],
  getDate: (item: T) => unknown,
) {
  return [...items].sort((a, b) => {
    const dateDiff = dateTimeValue(getDate(b)) - dateTimeValue(getDate(a))
    return dateDiff || idValue(b) - idValue(a)
  })
}

function upsertExistingListCache<T extends RowWithId>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  item: T,
  sort: (items: T[]) => T[],
) {
  if (!item.id) return
  const current = queryClient.getQueryData<T[]>(queryKey)
  if (!Array.isArray(current)) return

  const next = current.some((existing) => existing.id === item.id)
    ? current.map((existing) => (existing.id === item.id ? item : existing))
    : [item, ...current]

  queryClient.setQueryData<T[]>(queryKey, sort(next))
}

export function syncSavedClientOrder(queryClient: QueryClient, order: Order) {
  const clientId = Number(order.client_id)
  if (!isValidClientId(clientId)) return

  const ordersKey = clientQueryKeys.orders(clientId)
  upsertExistingListCache(queryClient, ordersKey, order, (items) =>
    sortByDateDesc(items, (item) => item.order_date),
  )

  void queryClient.invalidateQueries({ queryKey: ordersKey })
  void queryClient.invalidateQueries({
    queryKey: clientQueryKeys.ordersContext(clientId),
  })
}

export function syncSavedClientExam(
  queryClient: QueryClient,
  exam: OpticalExam,
  type: "exam" | "opticlens",
) {
  const clientId = Number(exam.client_id)
  if (!isValidClientId(clientId)) return

  const examsKey = clientQueryKeys.exams(clientId, type)
  upsertExistingListCache(queryClient, examsKey, exam, (items) =>
    sortByDateDesc(items, (item) => item.exam_date),
  )

  void queryClient.invalidateQueries({ queryKey: examsKey })
  void queryClient.invalidateQueries({
    queryKey: clientQueryKeys.ordersContext(clientId),
  })
}

export function syncSavedClientReferral(
  queryClient: QueryClient,
  referral: Referral,
) {
  const clientId = Number(referral.client_id)
  if (!isValidClientId(clientId)) return

  const referralsKey = clientQueryKeys.referrals(clientId)
  upsertExistingListCache(queryClient, referralsKey, referral, (items) =>
    sortByDateDesc(items, (item) => item.date),
  )

  void queryClient.invalidateQueries({ queryKey: referralsKey })
}

export function syncSavedClientAppointment(
  queryClient: QueryClient,
  appointment: Appointment,
) {
  const clientId = Number(appointment.client_id)
  if (!isValidClientId(clientId)) return

  const appointmentsKey = clientQueryKeys.appointments(clientId)
  upsertExistingListCache(queryClient, appointmentsKey, appointment, (items) =>
    sortByDateDesc(items, (item) =>
      `${item.date || ""}T${item.time || "00:00:00"}`,
    ),
  )

  void queryClient.invalidateQueries({ queryKey: appointmentsKey })
}

export function syncSavedClientFile(queryClient: QueryClient, file: File) {
  const clientId = Number(file.client_id)
  if (!isValidClientId(clientId)) return

  const filesKey = clientQueryKeys.files(clientId)
  upsertExistingListCache(queryClient, filesKey, file, (items) =>
    sortByDateDesc(items, (item) => item.upload_date),
  )

  void queryClient.invalidateQueries({ queryKey: filesKey })
}
