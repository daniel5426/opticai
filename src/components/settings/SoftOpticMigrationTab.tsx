import React, { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Database, FileArchive, FolderSearch, Pause, Play, RefreshCw, UploadCloud, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api-client"

type SoftOpticCandidate = {
  id: string
  kind: "dsn" | "db-file"
  label: string
  dsn?: string
  dbFile?: string
  logFile?: string
  documentPath?: string
  sizeBytes?: number
  modifiedAt?: string
  score: number
  recommended: boolean
  reasons: string[]
}

type WizardPhase =
  | "idle"
  | "scanning"
  | "selecting"
  | "exporting"
  | "ready"
  | "uploading"
  | "importing"
  | "paused"
  | "completed"
  | "failed"

const STEP_LABELS = [
  "איתור מסד נתונים",
  "בחירת מקור",
  "ייצוא נתונים",
  "סיכום",
  "העלאה",
  "בדיקת תקינות",
  "החלפת ייבוא קודם",
  "ייבוא",
  "סיום",
]

const SUMMARY_LABELS: Record<string, string> = {
  clients: "לקוחות",
  exams: "בדיקות",
  glasses_orders: "הזמנות משקפיים",
  contact_lens_orders: "הזמנות עדשות מגע",
  appointments: "תורים",
  notes: "רשומות",
  referrals: "הפניות",
  embedded_files: "קבצים מתוך המסד",
  external_documents: "מסמכים חיצוניים",
}

function formatBytes(value?: number) {
  if (!value) return "לא ידוע"
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(value / 1024))} KB`
}

interface SoftOpticMigrationTabProps {
  clinicId?: number
}

export function SoftOpticMigrationTab({ clinicId }: SoftOpticMigrationTabProps) {
  const [phase, setPhase] = useState<WizardPhase>("idle")
  const [progress, setProgress] = useState(0)
  const [stepText, setStepText] = useState("מוכן להתחלה")
  const [candidates, setCandidates] = useState<SoftOpticCandidate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [manualDbPath, setManualDbPath] = useState("")
  const [sqlAnywhereBin, setSqlAnywhereBin] = useState("")
  const [exportSummary, setExportSummary] = useState<Record<string, any> | null>(null)
  const [zipPath, setZipPath] = useState<string | null>(null)
  const [includeDocuments, setIncludeDocuments] = useState<boolean | null>(null)
  const [clientImportLimit, setClientImportLimit] = useState("")
  const [exportJobId, setExportJobId] = useState<string | null>(null)
  const [job, setJob] = useState<any>(null)
  const [uploadStatus, setUploadStatus] = useState<any>(null)
  const [uploadInFlight, setUploadInFlight] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportStorageKey = useMemo(
    () => clinicId ? `softoptic-export-job:${clinicId}` : null,
    [clinicId],
  )

  const selectedCandidate = useMemo(() => {
    if (selectedId === "manual" && manualDbPath.trim()) {
      return {
        id: "manual",
        kind: "db-file" as const,
        label: "מסד שנבחר ידנית",
        dbFile: manualDbPath.trim(),
        score: 0,
        recommended: false,
        reasons: ["בחירה ידנית"],
      }
    }
    return candidates.find(candidate => candidate.id === selectedId) || null
  }, [candidates, manualDbPath, selectedId])

  useEffect(() => {
    if (!clinicId || job?.id) return
    let cancelled = false
    apiClient.listSoftOpticImports(clinicId, true).then(response => {
      if (cancelled || !Array.isArray(response.data) || response.data.length === 0) return
      const activeJob = response.data[0] as any
      setJob(activeJob)
      setProgress(activeJob.progress || 0)
      setStepText(activeJob.step || "ממתין לעובד ייבוא")
      if (activeJob.status === "paused") {
        setPhase("paused")
      } else if (activeJob.status === "failed") {
        setPhase("failed")
        setError(activeJob.error || null)
      } else if (activeJob.status === "awaiting_upload") {
        setPhase("uploading")
        setStepText("העלאה הופסקה - ניתן לנסות שוב")
      } else if (["queued", "running"].includes(activeJob.status)) {
        setPhase("importing")
      }
    })
    return () => {
      cancelled = true
    }
  }, [clinicId, job?.id])

  useEffect(() => {
    if (!exportStorageKey || exportJobId) return
    const savedJobId = window.localStorage.getItem(exportStorageKey)
    if (savedJobId) setExportJobId(savedJobId)
  }, [exportJobId, exportStorageKey])

  useEffect(() => {
    if (!exportJobId || !window.electronAPI?.softOpticExportStatus) return
    let cancelled = false

    const applyStatus = (status: any) => {
      if (!status || cancelled) return
      if (status.candidate) {
        setCandidates(current => current.some(candidate => candidate.id === status.candidate.id) ? current : [status.candidate, ...current])
        setSelectedId(status.candidate.id)
      }
      if (typeof status.includeDocuments === "boolean") {
        setIncludeDocuments(status.includeDocuments)
      }
      setProgress(status.progress || 0)
      setStepText(status.step || "ייצוא נתונים")
      if (status.status === "completed") {
        setExportSummary(status.summary || {})
        setZipPath(status.zipPath || null)
        setPhase("ready")
      } else if (status.status === "failed") {
        setError(status.error || "הייצוא נכשל")
        setPhase("failed")
      } else {
        setPhase("exporting")
      }
    }

    const poll = async () => {
      const status = await window.electronAPI.softOpticExportStatus({ jobId: exportJobId })
      applyStatus(status)
      return status
    }

    poll()
    const interval = window.setInterval(async () => {
      const status = await poll()
      if (status?.status && status.status !== "running") {
        window.clearInterval(interval)
      }
    }, 1500)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [exportJobId])

  useEffect(() => {
    if (!job?.id || !window.electronAPI?.softOpticUploadStatus || phase !== "uploading") return
    let cancelled = false

    const applyUploadStatus = async () => {
      const status = await apiClient.getSoftOpticUploadStatus(job.id)
      if (!status || cancelled) return
      setUploadStatus(status)
      if (["preparing", "uploading", "finalizing"].includes(status.status)) {
        const uploadProgress = Number(status.progress || 0)
        setProgress(Math.max(60, Math.min(90, 60 + Math.round(uploadProgress * 0.3))))
        setStepText(status.status === "finalizing" ? "מסיים העלאה" : "מעלה קובץ")
      } else if (status.status === "failed") {
        setError(status.error || "העלאה נכשלה")
        setStepText("העלאה הופסקה - ניתן לנסות שוב")
      } else if (status.status === "completed") {
        setProgress(90)
        setStepText("העלאה הושלמה")
      }
    }

    applyUploadStatus()
    const interval = window.setInterval(applyUploadStatus, 750)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [job?.id, phase])

  useEffect(() => {
    if (!job?.id || !["importing", "paused"].includes(phase)) return
    const interval = window.setInterval(async () => {
      const response = await apiClient.getSoftOpticImport(job.id)
      if (response.data) {
        const nextJob = response.data as any
        setJob(nextJob)
        setProgress(nextJob.progress || 0)
        setStepText(nextJob.step || "ייבוא")
        if (nextJob.status === "completed") {
          setPhase("completed")
          toast.success("הייבוא הסתיים בהצלחה")
          window.clearInterval(interval)
        } else if (nextJob.status === "paused") {
          setPhase("paused")
          setStepText("מושהה")
        } else if (nextJob.status === "failed") {
          setPhase("failed")
          setError(nextJob.error || "הייבוא נכשל")
          toast.error(nextJob.error || "הייבוא נכשל")
          window.clearInterval(interval)
        } else {
          setPhase("importing")
        }
      }
    }, 1500)
    return () => window.clearInterval(interval)
  }, [job?.id, phase])

  const scan = async () => {
    setError(null)
    setPhase("scanning")
    setProgress(10)
    setStepText("איתור מסד נתונים")
    try {
      const result = await window.electronAPI.softOpticScan()
      if (!result.supported) {
        setError(result.error || "הייבוא זמין רק באפליקציית Windows")
        setPhase("failed")
        return
      }
      setCandidates(result.candidates || [])
      const recommended = result.candidates?.find((candidate: SoftOpticCandidate) => candidate.recommended)
      setSelectedId(recommended?.id || result.candidates?.[0]?.id || null)
      setProgress(25)
      setStepText("בחירת מקור")
      setPhase("selecting")
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "שגיאה בסריקה")
      setPhase("failed")
    }
  }

  const exportSelected = async () => {
    if (!selectedCandidate) {
      toast.error("יש לבחור מסד נתונים")
      return
    }
    if (includeDocuments === null) {
      toast.error("יש לבחור אם לייבא מסמכים")
      return
    }
    setError(null)
    setPhase("exporting")
    setProgress(35)
    setStepText("ייצוא נתונים")
    if (window.electronAPI.softOpticStartExport) {
      const started = await window.electronAPI.softOpticStartExport({
        clinicId,
        candidate: selectedCandidate,
        sqlAnywhereBin: sqlAnywhereBin.trim() || undefined,
        includeDocuments,
      })
      if (!started.success || !started.jobId) {
        setError(started.error || "הייצוא נכשל")
        setPhase("failed")
        return
      }
      setExportJobId(started.jobId)
      if (exportStorageKey) window.localStorage.setItem(exportStorageKey, started.jobId)
      return
    }
    const result = await window.electronAPI.softOpticExport({
      candidate: selectedCandidate,
      sqlAnywhereBin: sqlAnywhereBin.trim() || undefined,
      includeDocuments,
    })
    if (!result.success || !result.zipPath) {
      setError(result.error || "הייצוא נכשל")
      setPhase("failed")
      return
    }
    setExportSummary(result.summary || {})
    setZipPath(result.zipPath)
    setProgress(52)
    setStepText("סיכום")
    setPhase("ready")
  }

  const uploadAndImport = async () => {
    if (!clinicId || !zipPath || includeDocuments === null) return
    const reusableJob = job?.status === "awaiting_upload" ? job : null
    if (!reusableJob && !selectedCandidate) return
    const trimmedLimit = clientImportLimit.trim()
    const parsedLimit = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : null
    if (trimmedLimit && (!Number.isFinite(parsedLimit) || !parsedLimit || parsedLimit < 1)) {
      toast.error("יש להזין מגבלת לקוחות תקינה")
      return
    }
    setError(null)
    setUploadInFlight(true)
    setUploadStatus(null)
    setPhase("uploading")
    setProgress(60)
    setStepText("העלאה")
    try {
      let importJob = reusableJob
      if (!importJob) {
        const createResponse = await apiClient.createSoftOpticImport({
          clinicId,
          sourceMetadata: selectedCandidate!,
          exportSummary: exportSummary || {},
          includeDocuments,
          clientImportLimit: parsedLimit,
        })
        if (createResponse.error || !createResponse.data) {
          setError(createResponse.error || "יצירת פעולת הייבוא נכשלה")
          setPhase("failed")
          return
        }
        importJob = createResponse.data
        setJob(importJob)
      }
      const uploadResponse = await apiClient.uploadSoftOpticBundle(importJob.id, zipPath)
      if (uploadResponse.error || !(uploadResponse as any).success) {
        setError(uploadResponse.error || "העלאה נכשלה")
        setPhase("failed")
        setJob(importJob)
        return
      }
      const uploadedJob = (uploadResponse as any).data
      setJob(uploadedJob)
      setExportJobId(null)
      if (exportStorageKey) window.localStorage.removeItem(exportStorageKey)
      setPhase("importing")
      setProgress(uploadedJob?.progress || 65)
      setStepText(uploadedJob?.step || "ממתין לעובד ייבוא")
    } finally {
      setUploadInFlight(false)
    }
  }

  const pauseJob = async () => {
    if (!job?.id) return
    const response = await apiClient.pauseSoftOpticImport(job.id)
    if (response.data) {
      setJob(response.data)
      setPhase("paused")
      setStepText("מושהה")
    } else if (response.error) {
      toast.error(response.error)
    }
  }

  const resumeJob = async () => {
    if (!job?.id) return
    const response = await apiClient.resumeSoftOpticImport(job.id)
    if (response.data) {
      setJob(response.data)
      setPhase("importing")
      setStepText((response.data as any).step || "ממתין לעובד ייבוא")
    } else if (response.error) {
      toast.error(response.error)
    }
  }

  const cancelJob = async () => {
    if (!job?.id) return
    const response = await apiClient.cancelSoftOpticImport(job.id)
    if (response.data) {
      setJob(response.data)
      setPhase("failed")
      setStepText("בוטל")
    } else if (response.error) {
      toast.error(response.error)
    }
  }

  const reset = () => {
    setPhase("idle")
    setProgress(0)
    setStepText("מוכן להתחלה")
    setExportSummary(null)
    setZipPath(null)
    setIncludeDocuments(null)
    setClientImportLimit("")
    setExportJobId(null)
    setJob(null)
    setUploadStatus(null)
    setUploadInFlight(false)
    setError(null)
    if (exportStorageKey) window.localStorage.removeItem(exportStorageKey)
  }

  const busy = ["scanning", "exporting"].includes(phase) || uploadInFlight
  const canUpload = Boolean(
    clinicId &&
    zipPath &&
    includeDocuments !== null &&
    (selectedCandidate || job?.status === "awaiting_upload") &&
    (phase === "ready" || job?.status === "awaiting_upload"),
  )

  return (
    <div className="space-y-5" dir="rtl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="text-right">
              <CardTitle>ייבוא מאופטיק-סופט</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                העברת לקוחות, בדיקות, הזמנות, תורים ומסמכים למרפאה הנוכחית.
              </p>
            </div>
            <Database className="h-6 w-6 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{stepText}</span>
              <span dir="ltr">{progress}%</span>
            </div>
            <Progress value={progress} />
            {phase === "uploading" && uploadStatus?.totalBytes && (
              <p className="text-right text-xs text-muted-foreground" dir="ltr">
                {formatBytes(uploadStatus.transferredBytes)} / {formatBytes(uploadStatus.totalBytes)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 lg:grid-cols-9">
            {STEP_LABELS.map(label => (
              <div key={label} className="rounded-md border px-2 py-1 text-center text-[11px] text-muted-foreground">
                {label}
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={scan} disabled={busy || !clinicId}>
              <FolderSearch className="ml-2 h-4 w-4" />
              סרוק מחשב
            </Button>
            <Button variant="outline" onClick={exportSelected} disabled={busy || !selectedCandidate || includeDocuments === null}>
              <FileArchive className="ml-2 h-4 w-4" />
              ייצא נתונים
            </Button>
            <Button onClick={uploadAndImport} disabled={busy || !canUpload}>
              <UploadCloud className="ml-2 h-4 w-4" />
              {job?.status === "awaiting_upload" ? "נסה העלאה שוב" : "בדוק וייבא"}
            </Button>
            {job && phase === "importing" && (
              <Button variant="outline" onClick={pauseJob}>
                <Pause className="ml-2 h-4 w-4" />
                השהה
              </Button>
            )}
            {job && ["paused", "failed"].includes(phase) && (
              <Button variant="outline" onClick={resumeJob}>
                <Play className="ml-2 h-4 w-4" />
                המשך
              </Button>
            )}
            {job && ["uploading", "paused"].includes(phase) && (
              <Button variant="outline" onClick={cancelJob}>
                <XCircle className="ml-2 h-4 w-4" />
                בטל
              </Button>
            )}
            <Button variant="ghost" onClick={reset} disabled={busy}>
              <RefreshCw className="ml-2 h-4 w-4" />
              איפוס
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-right text-base">מקור הנתונים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {candidates.map(candidate => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setSelectedId(candidate.id)}
                className={`rounded-md border p-3 text-right transition-colors ${
                  selectedId === candidate.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{candidate.label}</span>
                      {candidate.recommended && <Badge>כנראה המסד הפעיל</Badge>}
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground" dir="ltr">
                      {candidate.dbFile || candidate.dsn}
                    </p>
                  </div>
                  <Database className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                  <span>גודל: {formatBytes(candidate.sizeBytes)}</span>
                  <span>עודכן: {candidate.modifiedAt ? new Date(candidate.modifiedAt).toLocaleString("he-IL") : "לא ידוע"}</span>
                  <span>מסמכים: {candidate.documentPath || "לא נמצא"}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="block text-right">מסד נתונים ידני</Label>
              <Input
                value={manualDbPath}
                onChange={event => {
                  setManualDbPath(event.target.value)
                  setSelectedId("manual")
                }}
                placeholder="C:\\RR\\Data\\RRDB.db"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label className="block text-right">תיקיית SQL Anywhere</Label>
              <Input
                value={sqlAnywhereBin}
                onChange={event => setSqlAnywhereBin(event.target.value)}
                placeholder="C:\\Program Files (x86)\\RRProg\\ASA\\Win32"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setIncludeDocuments(false)}
              className={`rounded-md border p-3 text-right ${includeDocuments === false ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
            >
              <div className="font-medium">ייבוא נתונים בלבד</div>
              <div className="mt-1 text-xs text-muted-foreground">לקוחות, בדיקות, הזמנות, תורים ורשומות ללא קבצים.</div>
            </button>
            <button
              type="button"
              onClick={() => setIncludeDocuments(true)}
              className={`rounded-md border p-3 text-right ${includeDocuments === true ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
            >
              <div className="font-medium">ייבוא נתונים + מסמכים מותאמים</div>
              <div className="mt-1 text-xs text-muted-foreground">רק מסמכים שניתן לשייך בוודאות ללקוח יועלו.</div>
            </button>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <Label className="block text-right">מגבלת לקוחות בשלב הייבוא</Label>
            <Input
              value={clientImportLimit}
              onChange={event => setClientImportLimit(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="ללא מגבלה"
              inputMode="numeric"
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      {exportSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-right text-base">סיכום שנמצא</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(SUMMARY_LABELS).map(([key, label]) => (
                <div key={key} className="rounded-md border p-3 text-right">
                  <div className="text-2xl font-semibold">{Number(exportSummary[key] || 0).toLocaleString("he-IL")}</div>
                  <div className="text-sm text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {job && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-end gap-2 text-right text-base">
              {phase === "completed" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              סטטוס ייבוא
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-right text-sm">
            <p>מזהה פעולה: <span dir="ltr">{job.id}</span></p>
            {job.warnings?.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                {job.warnings.slice(0, 5).map((warning: string) => <div key={warning}>{warning}</div>)}
              </div>
            )}
            {job.import_summary?.tracked_counts && (
              <div className="grid gap-2 md:grid-cols-3">
                {Object.entries(job.import_summary.tracked_counts).map(([key, value]) => (
                  <div key={key} className="rounded-md border px-3 py-2">
                    <span className="font-medium">{String(value)}</span>
                    <span className="mr-2 text-muted-foreground">{key}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
