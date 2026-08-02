import React, { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomModal } from "@/components/ui/custom-modal"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

type PruneJob = {
  id: string
  status: "queued" | "running" | "failed" | "completed"
  step: string
  progress: number
  error?: string | null
  warnings?: string[]
}

type PreviewData = {
  clinic_name?: string
  counts: Record<string, number>
  confirmation_token?: string
}

const PREVIEW_SECTIONS = ["people", "clinical", "commerce", "documents", "communications", "access"] as const

const SECTION_LABELS: Record<(typeof PREVIEW_SECTIONS)[number], string> = {
  people: "לקוחות ומשפחות",
  clinical: "מידע רפואי ותורים",
  commerce: "הזמנות וחיובים",
  documents: "קבצים ומסמכים",
  communications: "תקשורת וקמפיינים",
  access: "נתוני גישה ותפעול",
}

const SECTION_KEYS: Record<(typeof PREVIEW_SECTIONS)[number], string[]> = {
  people: ["clients", "families"],
  clinical: ["exams", "exam_instances", "appointments", "referrals", "referral_eyes", "medical_logs", "recent_visits", "prescription_index"],
  commerce: ["orders", "contact_lens_orders", "billings", "billing_payments", "order_line_items"],
  documents: ["files"],
  communications: ["campaigns", "campaign_executions", "chats", "chat_messages", "email_logs"],
  access: ["sessions", "work_shifts", "device_trusts", "source_links"],
}

const COUNT_LABELS: Record<string, string> = {
  clients: "לקוחות",
  families: "משפחות",
  exams: "בדיקות",
  exam_instances: "מופעי בדיקה",
  appointments: "תורים",
  referrals: "הפניות",
  referral_eyes: "עיני הפניה",
  medical_logs: "רשומות רפואיות",
  recent_visits: "ביקורים אחרונים",
  prescription_index: "אינדקס מרשמים",
  orders: "הזמנות",
  contact_lens_orders: "הזמנות עדשות מגע",
  billings: "חיובים",
  billing_payments: "תשלומים",
  order_line_items: "פריטי הזמנה",
  files: "קבצים",
  campaigns: "קמפיינים",
  campaign_executions: "הרצות קמפיין",
  chats: "שיחות",
  chat_messages: "הודעות",
  email_logs: "רשומות דואר",
  sessions: "הפעלות משתמש",
  work_shifts: "משמרות",
  device_trusts: "מכשירים מהימנים",
  source_links: "קישורי מקור ממיגרציה",
}

export function ClinicDataPruneTab({ clinicId, clinicName }: { clinicId?: number; clinicName?: string }) {
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loadedSections, setLoadedSections] = useState<string[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [job, setJob] = useState<PruneJob | null>(null)
  const [confirmation, setConfirmation] = useState("")
  const [open, setOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const jobLocksClinic = Boolean(job && ["queued", "running", "failed"].includes(job.status))
  const modalLocked = jobLocksClinic || (actionLoading && !job)

  useEffect(() => {
    if (!clinicId) return
    let cancelled = false
    void apiClient.getActiveClinicDataPrune(clinicId).then(response => {
      if (cancelled || response.error || !response.data) return
      const activeJob = (response.data as { job?: PruneJob | null }).job
      if (activeJob) {
        setJob(activeJob)
        setOpen(true)
      }
    })
    return () => { cancelled = true }
  }, [clinicId])

  useEffect(() => {
    if (!clinicId || !job?.id || !["queued", "running"].includes(job.status)) return
    let cancelled = false
    const poll = async () => {
      const response = await apiClient.getClinicDataPrune(clinicId, job.id)
      if (cancelled || response.error || !response.data) return
      const nextJob = response.data as PruneJob
      setJob(nextJob)
      if (nextJob.status === "completed") toast.success("נתוני המרפאה נמחקו בהצלחה")
    }
    const timer = window.setInterval(() => { void poll() }, 1500)
    void poll()
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [clinicId, job?.id, job?.status])

  const loadPreview = async () => {
    if (!clinicId) return
    setOpen(true)
    setJob(null)
    setConfirmation("")
    setPreview({ counts: {} })
    setLoadedSections([])
    setPreviewError(null)
    setPreviewLoading(true)

    const results = await Promise.all(PREVIEW_SECTIONS.map(async section => {
      const response = await apiClient.previewClinicDataPrune(clinicId, section)
      if (response.error || !response.data) throw new Error(response.error || "לא ניתן לספור את הנתונים")
      const data = response.data as PreviewData
      setPreview(current => ({
        ...current,
        ...data,
        counts: { ...(current?.counts || {}), ...(data.counts || {}) },
      }))
      setLoadedSections(current => [...current, section])
      return data
    }).map(promise => promise.catch(error => error as Error)))

    const failures = results.filter(result => result instanceof Error) as Error[]
    if (failures.length) setPreviewError(failures[0].message)
    setPreviewLoading(false)
  }

  const start = async () => {
    if (!clinicId || !preview?.confirmation_token || confirmation !== clinicName) return
    setActionLoading(true)
    const response = await apiClient.startClinicDataPrune(clinicId, confirmation, preview.confirmation_token)
    if (response.error || !response.data) {
      const activeResponse = await apiClient.getActiveClinicDataPrune(clinicId)
      const activeJob = activeResponse.data && (activeResponse.data as { job?: PruneJob | null }).job
      if (activeJob) {
        setJob(activeJob)
        setActionLoading(false)
        return
      }
      setActionLoading(false)
      toast.error(response.error || "ניקוי המרפאה לא התחיל")
      return
    }
    setJob(response.data as PruneJob)
    setActionLoading(false)
  }

  const resume = async () => {
    if (!clinicId || !job?.id) return
    setActionLoading(true)
    const response = await apiClient.resumeClinicDataPrune(clinicId, job.id)
    setActionLoading(false)
    if (response.data) setJob(response.data as PruneJob)
    else toast.error(response.error || "לא ניתן להמשיך את הניקוי")
  }

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right text-destructive">
            <AlertTriangle className="h-5 w-5" />
            ניקוי מלא של נתוני המרפאה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-right">
          <p className="text-sm text-muted-foreground">
            הפעולה מוחקת לקוחות, בדיקות, הזמנות, תורים, מסמכים ומידע תפעולי. משתמשי המרפאה, ההגדרות ותבניות הבדיקות נשמרים. הפעלות המשתמשים מתנתקות מטעמי בטיחות.
          </p>
          <Button variant="destructive" onClick={loadPreview} disabled={!clinicId || previewLoading || jobLocksClinic}>
            <Trash2 className="ml-2 h-4 w-4" />
            הצג נתונים למחיקה
          </Button>
        </CardContent>
      </Card>

      <CustomModal
        isOpen={open}
        onClose={() => { if (!modalLocked) setOpen(false) }}
        title={job ? "ניקוי נתוני המרפאה" : "אישור מחיקת נתוני המרפאה"}
        subtitle={jobLocksClinic ? "המרפאה במצב תחזוקה" : undefined}
        width="max-w-2xl"
        dismissible={!modalLocked}
        showCloseButton={!modalLocked}
      >
        {job ? (
          <div className="space-y-4 text-right">
            {job.status === "completed" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                <p className="font-medium">ניקוי נתוני המרפאה הושלם</p>
                <Button onClick={() => setOpen(false)}>סגירה</Button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <span>{job.step}</span>
                    <span dir="ltr">{job.progress || 0}%</span>
                  </div>
                  <Progress value={job.progress || 0} />
                </div>
                <p className="text-sm text-muted-foreground">
                  אין לסגור חלון זה או לעבור לחלק אחר במרפאה עד לסיום הניקוי.
                </p>
                {job.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{job.error}</p>}
                {job.status === "failed" && (
                  <Button variant="outline" onClick={resume} disabled={actionLoading}>
                    {actionLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
                    המשך ניקוי
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-right">
            <p className="text-sm text-muted-foreground">
              הספירה מתעדכנת בזמן אמת. משתמשי המרפאה והגדרות המרפאה לא יימחקו.
            </p>
            <div className="max-h-[42vh] space-y-2 overflow-y-auto rounded-lg border p-3">
              {PREVIEW_SECTIONS.map(section => {
                const loaded = loadedSections.includes(section)
                const entries = Object.entries(preview?.counts || {}).filter(([key]) => SECTION_KEYS[section].includes(key))
                return (
                  <div key={section} className="rounded-md bg-muted/35 p-3">
                    <div className="flex items-center justify-between font-medium">
                      <span>{SECTION_LABELS[section]}</span>
                      {!loaded && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    {loaded && entries.map(([name, count]) => (
                      <div key={name} className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                        <span>{COUNT_LABELS[name] || name}</span>
                        <span dir="ltr">{Number(count).toLocaleString("he-IL")}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            {previewError && (
              <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <p>{previewError}</p>
                <Button size="sm" variant="outline" onClick={loadPreview}>נסה שוב</Button>
              </div>
            )}
            {!previewLoading && !previewError && (
              <>
                <p className="text-sm">
                  הפעולה בלתי הפיכה. יש להקליד את שם המרפאה בדיוק: <strong>{clinicName}</strong>
                </p>
                <Input
                  dir="rtl"
                  value={confirmation}
                  onChange={event => setConfirmation(event.target.value)}
                  placeholder={clinicName}
                  className="text-right"
                />
                <div className="flex justify-start gap-2">
                  <Button variant="destructive" onClick={start} disabled={actionLoading || confirmation !== clinicName}>
                    {actionLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    מחק את כל הנתונים
                  </Button>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={actionLoading}>ביטול</Button>
                </div>
              </>
            )}
          </div>
        )}
      </CustomModal>
    </div>
  )
}
