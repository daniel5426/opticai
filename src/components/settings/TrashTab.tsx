import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Clock3,
  Eye,
  FileQuestion,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomModal } from "@/components/ui/custom-modal"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppLocale } from "@/localization/use-app-locale"
import { apiClient } from "@/lib/api-client"
import type { Clinic, User } from "@/lib/db/schema-interface"
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels"
import type { TrashCounts, TrashEntityType, TrashItem } from "@/lib/trash"

const PAGE_SIZE = 25
export const TRASH_TAB_TYPES: TrashEntityType[] = [
  "client",
  "exam",
  "order",
  "contact_lens_order",
  "order_group",
  "referral",
  "medical_log",
  "appointment",
  "file",
]
type TrashTabValue = "all" | TrashEntityType

const TYPE_KEYS: Record<TrashEntityType, string> = {
  order_group: "orderGroupTitle",
  client: "trashTypeClient",
  order: "trashTypeOrder",
  contact_lens_order: "trashTypeContactLensOrder",
  exam: "trashTypeExam",
  referral: "trashTypeReferral",
  medical_log: "trashTypeMedicalNote",
  appointment: "trashTypeAppointment",
  file: "trashTypeFile",
}

const TAB_KEYS: Record<TrashEntityType, string> = {
  order_group: "trashCountOrderGroups",
  client: "trashCountClients",
  order: "trashCountOrders",
  contact_lens_order: "trashCountContactLensOrders",
  exam: "trashCountExams",
  referral: "trashCountReferrals",
  medical_log: "trashCountMedicalNotes",
  appointment: "trashCountAppointments",
  file: "trashCountFiles",
}

const COUNT_KEYS: Record<string, string> = {
  client: "trashCountClients",
  order: "trashCountOrders",
  contact_lens_order: "trashCountContactLensOrders",
  exam: "trashCountExams",
  exam_layout_instance: "trashCountExamCards",
  referral: "trashCountReferrals",
  referral_eye: "trashCountReferralEyes",
  medical_log: "trashCountMedicalNotes",
  appointment: "trashCountAppointments",
  file: "trashCountFiles",
  billing: "trashCountBillingRecords",
  billing_payment: "trashCountPayments",
  order_line_item: "trashCountOrderLines",
}

const PREVIEW_KEYS: Record<string, string> = {
  first_name: "trashPreviewFirstName",
  last_name: "trashPreviewLastName",
  phone_mobile: "trashPreviewPhone",
  email: "trashPreviewEmail",
  national_id: "trashPreviewIdNumber",
  order_date: "trashPreviewDate",
  type: "trashPreviewRecordType",
  r_model: "trashPreviewRightModel",
  l_model: "trashPreviewLeftModel",
  exam_date: "trashPreviewDate",
  test_name: "trashPreviewExamName",
  date: "trashPreviewDate",
  recipient: "trashPreviewRecipient",
  urgency_level: "trashPreviewUrgency",
  referral_notes: "trashPreviewNotes",
  log_date: "trashPreviewDate",
  log: "trashPreviewContent",
  time: "trashPreviewTime",
  exam_name: "trashPreviewExamName",
  note: "trashPreviewNotes",
  file_name: "trashPreviewFileName",
  original_file_name: "trashOriginalFileName",
  file_type: "trashFileType",
  file_size: "trashFileSize",
  upload_date: "date",
  notes: "trashPreviewNotes",
}

function recordPath(item: TrashItem): string | null {
  const clientId = item.client_id ?? (item.root_entity_type === "client" ? item.root_entity_id : null)
  if (item.root_entity_type === "client" && clientId) return `/clients/${clientId}`
  if (item.root_entity_type === "order_group" && clientId) return `/clients/${clientId}/orders/group-${item.root_entity_id}`
  if (item.root_entity_type === "order" && clientId) return `/clients/${clientId}/orders/${item.root_entity_id}`
  if (item.root_entity_type === "exam" && clientId) return `/clients/${clientId}/exams/${item.root_entity_id}`
  if (item.root_entity_type === "referral" && clientId) return `/clients/${clientId}/referrals/${item.root_entity_id}`
  if (item.root_entity_type === "appointment") return "/appointments"
  if (item.root_entity_type === "file") return "/files"
  if (clientId) return `/clients/${clientId}`
  return null
}

function daysUntil(value: string): number {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000))
}

export function TrashTab({
  currentClinic,
  currentUser,
}: {
  currentClinic: Clinic | null
  currentUser: User | null
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { locale, direction } = useAppLocale()
  const [items, setItems] = useState<TrashItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<TrashTabValue>("all")
  const [tabCounts, setTabCounts] = useState<TrashCounts>({})
  const [deletedBy, setDeletedBy] = useState("")
  const [deletedFrom, setDeletedFrom] = useState("")
  const [deletedTo, setDeletedTo] = useState("")
  const [selectedClinicId, setSelectedClinicId] = useState(currentClinic?.id ?? 0)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<TrashItem | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null)

  const isCeo = isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    setSelectedClinicId(currentClinic?.id ?? 0)
  }, [currentClinic?.id])

  useEffect(() => {
    let cancelled = false
    const loadOptions = async () => {
      const clinicId = selectedClinicId || currentClinic?.id
      const [clinicResponse, usersResponse] = await Promise.all([
        isCeo && currentUser?.company_id ? apiClient.getClinicsByCompany(currentUser.company_id) : Promise.resolve(null),
        clinicId ? apiClient.getUsersByClinic(clinicId) : Promise.resolve(null),
      ])
      if (cancelled) return
      if (clinicResponse?.data) setClinics(clinicResponse.data)
      if (usersResponse?.data) setUsers(usersResponse.data)
    }
    void loadOptions()
    return () => { cancelled = true }
  }, [currentClinic?.id, currentUser?.company_id, isCeo, selectedClinicId])

  const loadTrash = useCallback(async () => {
    if (!selectedClinicId) return
    setLoading(true)
    const filters = {
      clinicId: selectedClinicId,
      deletedByUserId: deletedBy ? Number(deletedBy) : undefined,
      deletedFrom: deletedFrom || undefined,
      deletedTo: deletedTo || undefined,
      search: search.trim() || undefined,
    }
    const [response, countsResponse] = await Promise.all([
      apiClient.getTrash({
        ...filters,
        entityType: activeTab === "all" ? undefined : activeTab,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      apiClient.getTrashCounts(filters),
    ])
    if (response.error || !response.data) {
      toast.error(t("trashLoadFailed"))
    } else {
      setItems(response.data.items)
      setTotal(response.data.total)
    }
    if (countsResponse.data) setTabCounts(countsResponse.data)
    setLoading(false)
  }, [activeTab, deletedBy, deletedFrom, deletedTo, page, search, selectedClinicId, t])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTrash() }, 250)
    return () => window.clearTimeout(timer)
  }, [loadTrash])

  useEffect(() => {
    setPage(1)
  }, [activeTab, deletedBy, deletedFrom, deletedTo, search, selectedClinicId])

  const formatDate = useCallback((value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value)), [locale])

  const openPreview = async (item: TrashItem) => {
    setSelected(item)
    setPreviewLoading(true)
    const response = await apiClient.getTrashItem(item.id)
    if (response.data) setSelected(response.data)
    else toast.error(t("trashPreviewFailed"))
    setPreviewLoading(false)
  }

  const restore = async (item: TrashItem) => {
    setActionLoading(true)
    const response = await apiClient.restoreTrashItem(item.id)
    setActionLoading(false)
    if (response.error || !response.data) {
      toast.error(response.error || t("trashRestoreFailed"))
      return
    }
    const path = recordPath(item)
    void queryClient.invalidateQueries()
    toast.success(t("trashRestored"), path ? {
      action: { label: t("trashOpenRecord"), onClick: () => { window.location.href = path } },
    } : undefined)
    setSelected(null)
    await loadTrash()
  }

  const purge = async (item: TrashItem) => {
    setActionLoading(true)
    const response = await apiClient.permanentlyDeleteTrashItem(item.id)
    setActionLoading(false)
    if (response.error) {
      toast.error(response.error || t("trashPurgeFailed"))
      return
    }
    toast.success(t("trashPurgeQueued"))
    setPurgeTarget(null)
    setSelected(null)
    await loadTrash()
  }

  const retry = async (item: TrashItem) => {
    setActionLoading(true)
    const response = await apiClient.retryTrashItem(item.id)
    setActionLoading(false)
    if (response.error) toast.error(response.error)
    else {
      toast.success(t("trashRetryStarted"))
      await openPreview(item)
    }
  }

  const previewFile = async (fileId: number) => {
    if (!selected) return
    const response = await apiClient.getTrashFilePreview(selected.id, fileId)
    if (!response.data?.url) toast.error(response.error || t("trashFilePreviewFailed"))
    else window.open(response.data.url, "_blank", "noopener,noreferrer")
  }

  const counts = useMemo(
    () => Object.entries(selected?.included_counts ?? {}).filter(([, count]) => count > 0),
    [selected?.included_counts],
  )
  const allCount = Object.values(tabCounts).reduce((sum, value) => sum + (value ?? 0), 0)

  const hasFailedJobs = selected?.jobs?.some(job => job.status === "failed")
  const fileMembers = selected?.members?.filter(member => member.type === "file") ?? []

  return (
    <Card className="gap-4 py-5" dir={direction}>
      <CardHeader className="gap-1 px-5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trash2 className="size-5 text-muted-foreground" aria-hidden="true" />
          {t("trashTitle")}
        </CardTitle>
        <CardDescription>{t("trashDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as TrashTabValue)} dir={direction}>
          <TabsList className="no-scrollbar w-full justify-start overflow-x-auto" aria-label={t("trashFilterType")}>
            {(["all", ...TRASH_TAB_TYPES] as TrashTabValue[]).map(type => (
              <TabsTrigger key={type} value={type} className="flex-none whitespace-nowrap px-3">
                {type === "all" ? t("trashTabAll") : t(TAB_KEYS[type])}
                <span className="text-xs tabular-nums text-muted-foreground">{type === "all" ? allCount : tabCounts[type] ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t("trashSearchPlaceholder")}
              aria-label={t("trashSearchPlaceholder")}
              className="ps-9"
            />
          </div>
          <div className={isCeo && clinics.length > 1 ? "grid grid-cols-2 gap-2 lg:grid-cols-4" : "grid grid-cols-1 gap-2 sm:grid-cols-3"}>
            <Select value={deletedBy} onValueChange={setDeletedBy}>
              <SelectTrigger aria-label={t("trashFilterDeletedBy")}><SelectValue placeholder={t("trashAllUsers")} /></SelectTrigger>
              <SelectContent>
                {users.map(user => user.id ? <SelectItem key={user.id} value={String(user.id)}>{user.full_name || user.username}</SelectItem> : null)}
              </SelectContent>
            </Select>
            <Input type="date" value={deletedFrom} onChange={event => setDeletedFrom(event.target.value)} aria-label={t("trashDeletedFrom")} title={t("trashDeletedFrom")} />
            <Input type="date" value={deletedTo} onChange={event => setDeletedTo(event.target.value)} aria-label={t("trashDeletedTo")} title={t("trashDeletedTo")} />
            {isCeo && clinics.length > 1 && (
              <Select value={String(selectedClinicId)} onValueChange={value => setSelectedClinicId(Number(value))} clearable={false}>
                <SelectTrigger aria-label={t("trashClinic")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {clinics.map(clinic => clinic.id ? <SelectItem key={clinic.id} value={String(clinic.id)}>{clinic.name || clinic.clinic_name}</SelectItem> : null)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <Table
          containerClassName="min-h-72"
          emptyState={!loading && items.length === 0 ? (
            <div className="flex flex-col items-center gap-2">
              <FileQuestion className="size-8 opacity-50" aria-hidden="true" />
              <span>{activeTab === "all" ? t("trashEmpty") : t("trashEmptyForType", { type: t(TAB_KEYS[activeTab]) })}</span>
            </div>
          ) : undefined}
        >
          <TableHeader>
            <TableRow>
              <TableHead>{t("trashItem")}</TableHead>
              <TableHead>{t("trashDeletedAt")}</TableHead>
              <TableHead>{t("trashAutoPurge")}</TableHead>
              <TableHead className="w-px"><span className="sr-only">{t("trashActions")}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="h-56 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-label={t("loading")} /></TableCell></TableRow>
            ) : items.map(item => (
              <TableRow key={item.id} className="cursor-pointer" tabIndex={0} onClick={() => void openPreview(item)} onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openPreview(item) }
              }}>
                <TableCell className="max-w-64">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{item.display_label}</span>
                    {activeTab === "all" && <Badge variant="outline" className="shrink-0">{t(TYPE_KEYS[item.root_entity_type])}</Badge>}
                  </div>
                  {item.root_entity_type !== "client" && item.client_label && (
                    <div className="truncate text-xs text-muted-foreground">{item.client_label}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div>{formatDate(item.deleted_at)}</div>
                  <div className="text-xs text-muted-foreground">{item.deleted_by || t("trashUnknownUser")}</div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={formatDate(item.expires_at)}>
                    <Clock3 className="size-3.5" aria-hidden="true" />{t("trashDaysLeft", { count: daysUntil(item.expires_at) })}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={event => { event.stopPropagation(); void restore(item) }} disabled={actionLoading || item.status !== "trashed"}>
                      <RotateCcw className="size-4" aria-hidden="true" />{t("trashRestore")}
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={t("trashPreview")} onClick={event => { event.stopPropagation(); void openPreview(item) }}>
                      <Eye className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-col items-center justify-between gap-2 text-sm sm:flex-row">
          <span className="text-muted-foreground">{t("trashPagination", { page, totalPages, total })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>{t("trashPrevious")}</Button>
            <Button size="sm" variant="outline" disabled={loading || page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>{t("trashNext")}</Button>
          </div>
        </div>
      </CardContent>

      <CustomModal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={t("trashPreview")} subtitle={selected?.display_label} direction={direction} width="max-w-2xl">
        {previewLoading ? <Loader2 className="mx-auto my-10 size-6 animate-spin text-muted-foreground" /> : selected ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-4">
              <div><span className="block text-muted-foreground">{t("trashType")}</span><strong>{t(TYPE_KEYS[selected.root_entity_type])}</strong></div>
              <div><span className="block text-muted-foreground">{t("trashDeletedBy")}</span><strong>{selected.deleted_by || t("trashUnknownUser")}</strong></div>
              <div><span className="block text-muted-foreground">{t("trashDeletedAt")}</span><strong>{formatDate(selected.deleted_at)}</strong></div>
              <div><span className="block text-muted-foreground">{t("trashExpiresAt")}</span><strong>{formatDate(selected.expires_at)}</strong></div>
            </div>
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("trashIncludedRecords")}</h3>
              <div className="flex flex-wrap gap-2">
                {counts.map(([key, count]) => <Badge key={key} variant="secondary">{t(COUNT_KEYS[key] || "trashCountRecords")}: {count}</Badge>)}
              </div>
            </section>
            {selected.preview && Object.keys(selected.preview).length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">{t("trashRecordPreview")}</h3>
                <dl className="grid grid-cols-1 gap-x-5 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
                  {Object.entries(selected.preview).map(([key, value]) => (
                    <div key={key} className="min-w-0">
                      <dt className="text-muted-foreground">{t(PREVIEW_KEYS[key] || "trashValue")}</dt>
                      <dd className="break-words font-medium" dir={key === "national_id" ? "ltr" : direction}>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {(selected.warnings.length > 0 || selected.jobs?.some(job => job.status !== "completed")) && (
              <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-amber-600" />{t("trashWarnings")}</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {selected.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{t(`trashWarning_${warning.code}`, { defaultValue: warning.code })}</li>)}
                  {selected.jobs?.filter(job => job.status !== "completed").map(job => <li key={job.id}>{t(`trashJob_${job.type}`, { defaultValue: job.type })}: {t(`trashStatus_${job.status}`, { defaultValue: job.status })}</li>)}
                </ul>
              </section>
            )}
            {fileMembers.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">{t("trashFiles")}</h3>
                <div className="flex flex-wrap gap-2">
                  {fileMembers.map(file => <Button key={file.id} variant="outline" size="sm" onClick={() => void previewFile(file.id)}><Eye className="size-4" />{t("trashFilePreview")} #{file.id}</Button>)}
                </div>
              </section>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              {hasFailedJobs && <Button variant="outline" onClick={() => void retry(selected)} disabled={actionLoading}><RefreshCw className="size-4" />{t("trashRetry")}</Button>}
              {isCeo && <Button variant="destructive" onClick={() => setPurgeTarget(selected)} disabled={actionLoading || selected.status !== "trashed"}><Trash2 className="size-4" />{t("trashPermanentDelete")}</Button>}
              <Button onClick={() => void restore(selected)} disabled={actionLoading || selected.status !== "trashed"}>{actionLoading ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}{t("trashRestore")}</Button>
            </div>
          </div>
        ) : null}
      </CustomModal>

      <CustomModal
        isOpen={Boolean(purgeTarget)}
        onClose={() => setPurgeTarget(null)}
        title={t("trashPermanentDeleteTitle")}
        description={t("trashPermanentDeleteDescription", { count: Object.values(purgeTarget?.included_counts ?? {}).reduce((sum, value) => sum + value, 0) })}
        direction={direction}
        onConfirm={() => purgeTarget && void purge(purgeTarget)}
        confirmText={t("trashPermanentDelete")}
        cancelText={t("cancel")}
        isLoading={actionLoading}
      />
    </Card>
  )
}
