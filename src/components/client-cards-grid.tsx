import * as React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { CalendarCheck, ChevronLeft, ChevronRight, IdCard, Phone, Trash2, UserPlus, Users } from "lucide-react"
import { Client } from "@/lib/db/schema-interface"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"
import { normalizeGender } from "@/lib/client-details-editor"
import { useAppLocale } from "@/localization/use-app-locale"
import { cn } from "@/utils/tailwind"
import { apiClient } from "@/lib/api-client"
import { formatIsoDate } from "@/lib/iso-date"

const AVATAR_TONES: Record<string, string> = {
  זכר: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  נקבה: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
}
const NEUTRAL_AVATAR_TONE = "bg-muted text-muted-foreground"

function getInitials(client: Client) {
  const initials = [client.first_name, client.last_name]
    .map((part) => part?.trim().charAt(0) ?? "")
    .join("")
  return initials || "?"
}

/** Latest exam date per client on the visible page, loaded after the cards so it never delays the list. */
function useLastExamDates(clientIds: number[]) {
  return useQuery({
    queryKey: ["clients", "last-exam-dates", clientIds],
    enabled: clientIds.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiClient.getClientsLastExamDates(clientIds)
      if (response.error) throw new Error(response.error)
      return response.data ?? {}
    },
  })
}

interface ClientCardsGridProps {
  clients: Client[]
  loading?: boolean
  emptyMessage: string
  showCreateCard?: boolean
  mergeMode?: boolean
  selectedMergeClientIds?: number[]
  onOpen: (client: Client) => void
  onDelete: (client: Client) => void
  fillHeight?: boolean
}

export function ClientCardsGrid({
  clients,
  loading = false,
  emptyMessage,
  showCreateCard = false,
  mergeMode = false,
  selectedMergeClientIds = [],
  onOpen,
  onDelete,
  fillHeight = false,
}: ClientCardsGridProps) {
  const { t } = useTranslation()
  const { direction } = useAppLocale()
  const GoIcon = direction === "rtl" ? ChevronLeft : ChevronRight
  const clientIds = React.useMemo(
    () => (loading ? [] : clients.map((client) => client.id).filter((id): id is number => Boolean(id))),
    [clients, loading],
  )
  const lastExamDates = useLastExamDates(clientIds)

  return (
    <div
      className={cn("overflow-y-auto overscroll-contain", fillHeight ? "h-full min-h-0" : "max-h-[70vh]")}
      style={{ scrollbarWidth: "none" }}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14.5rem,1fr))] gap-3 p-0.5">
        {showCreateCard && !mergeMode && (
          <GuardedRouterLink
            to="/clients/new"
            className="group border-border hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-ring flex min-h-[10.5rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-xl transition-transform group-hover:scale-105">
              <UserPlus className="size-5" />
            </span>
            <span className="text-sm font-semibold">{t("clientCardsNew")}</span>
          </GuardedRouterLink>
        )}

        {loading
          ? Array.from({ length: 11 }).map((_, index) => (
              <div key={index} className="bg-card flex min-h-[10.5rem] flex-col gap-3 rounded-2xl p-3.5 shadow-sm">
                <Skeleton className="size-11 rounded-xl" />
                <Skeleton className="mx-auto h-4 w-2/3" />
                <Skeleton className="mx-auto h-3 w-1/2" />
                <Skeleton className="mt-auto h-8 w-full rounded-lg" />
              </div>
            ))
          : clients.map((client) => {
              const name = [client.first_name, client.last_name].filter(Boolean).join(" ").trim()
              const selected = Boolean(client.id && selectedMergeClientIds.includes(client.id))
              const phone = client.phone_mobile?.trim()
              const nationalId = client.national_id?.trim()
              const lastExamDate = client.id ? lastExamDates.data?.[String(client.id)] : undefined
              return (
                <div
                  key={client.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(client)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onOpen(client)
                    }
                  }}
                  className={cn(
                    "group bg-card relative flex min-h-[10.5rem] cursor-pointer flex-col gap-1.5 rounded-2xl border border-transparent p-3.5 shadow-sm transition-all duration-200",
                    "hover:border-primary/20 hover:-translate-y-0.5 hover:shadow-md",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    selected && "border-primary/50 bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold",
                        AVATAR_TONES[normalizeGender(client.gender)] ?? NEUTRAL_AVATAR_TONE,
                      )}
                      aria-hidden
                      data-no-localize
                    >
                      {getInitials(client)}
                    </span>
                    <h3 className="line-clamp-2 min-w-0 flex-1 text-start text-[0.95rem] leading-snug font-bold" data-no-localize>
                      <bdi dir="auto">{name || t("clientCardsNoName")}</bdi>
                    </h3>
                    {mergeMode ? (
                      <Checkbox
                        checked={selected}
                        className="shrink-0 self-start"
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() => onOpen(client)}
                        aria-label={name}
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring grid size-7 shrink-0 place-items-center self-start rounded-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDelete(client)
                        }}
                        title={t("clientCardsDelete")}
                        aria-label={t("clientCardsDelete")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {nationalId && (
                    <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs" data-no-localize>
                      <IdCard className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate tabular-nums" dir="ltr">{nationalId}</span>
                    </p>
                  )}

                  <div className="flex pt-1">
                    {lastExamDates.isError ? null : lastExamDates.isPending ? (
                      <Skeleton className="h-6 w-28 rounded-full" />
                    ) : lastExamDate ? (
                      <span
                        className="bg-primary/8 text-primary inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold whitespace-nowrap"
                      >
                        <CalendarCheck className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">
                          {t("clientCardsLastExamOn")}
                          <bdi className="tabular-nums" dir="ltr">{formatIsoDate(lastExamDate)}</bdi>
                        </span>
                      </span>
                    ) : (
                      <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium">
                        <CalendarCheck className="size-3.5 shrink-0 opacity-60" aria-hidden />
                        {t("clientCardsNoExams")}
                      </span>
                    )}
                  </div>

                  {client.family_id && client.family_role ? (
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs" data-no-localize>
                      <Users className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{client.family_role}</span>
                    </p>
                  ) : null}

                  <div className="mt-auto flex items-center gap-2 pt-1.5">
                    <span className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium" data-no-localize>
                      <Phone className="text-primary size-3.5 shrink-0" aria-hidden />
                      {phone ? (
                        <span className="truncate tabular-nums" dir="ltr">{phone}</span>
                      ) : (
                        <span className="truncate">{t("clientCardsNoPhone")}</span>
                      )}
                    </span>
                    <span
                      className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary grid size-8 shrink-0 place-items-center rounded-lg transition-colors"
                      aria-hidden
                    >
                      <GoIcon className="size-4" />
                    </span>
                  </div>
                </div>
              )
            })}

        {!loading && clients.length === 0 && (
          <p className="text-muted-foreground col-span-full py-10 text-center text-sm">{emptyMessage}</p>
        )}
      </div>
    </div>
  )
}
