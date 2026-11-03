import { OpticPlusReferenceData } from "@/components/migration/OpticPlusReferenceData";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { OpticPlusCandidate } from "@/lib/opticplus-export";

type Phase = "idle" | "scanning" | "exporting" | "ready" | "uploading" | "importing" | "paused" | "completed" | "failed";
type ExportResult = { zipPath: string; summary: Record<string, any> };
const active = ["awaiting_upload", "queued", "running", "paused", "failed"];

export function OpticPlusMigrationTab({ clinicId }: { clinicId?: number }) {
  const { t, i18n } = useTranslation();
  const tr = (key: string, options?: Record<string, any>) => String(t(`opticplus.${key}`, options));
  const [phase, setPhase] = useState<Phase>("idle");
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [candidates, setCandidates] = useState<OpticPlusCandidate[]>([]);
  const [candidate, setCandidate] = useState<OpticPlusCandidate | null>(null);
  const [limit, setLimit] = useState("");
  const [selectedIds, setSelectedIds] = useState("");
  const [documents, setDocuments] = useState(true);
  const [exportId, setExportId] = useState<string | null>(null);
  const [exported, setExported] = useState<ExportResult | null>(null);
  const [job, setJob] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [previousId, setPreviousId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [rollback, setRollback] = useState<any>(null);
  const storageKey = `opticplus-export:${clinicId}`;
  const busy = requesting || ["scanning", "exporting", "uploading", "importing"].includes(phase);

  useEffect(() => {
    let cancelled = false;
    if (!clinicId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.exportId) { setExportId(saved.exportId); setPhase("exporting"); }
      if (saved?.exported) { setExported(saved.exported); setPhase("ready"); }
      if (saved?.candidate) setCandidate(saved.candidate);
    } catch { localStorage.removeItem(storageKey); }
    Promise.all([apiClient.getMigrationCapabilities(), apiClient.listMigrationImports(clinicId, "opticplus")])
      .then(([capability, imports]) => {
        if (cancelled) return;
        setEnabled(Boolean((capability.data as any)?.sources?.opticplus?.enabled));
        setChecked(true);
        if (imports.error || !Array.isArray(imports.data)) { setEnabled(false); setError("historyFailed"); return; }
        setHistory(imports.data);
        setPreviousId(imports.data.find((j: any) => j.status === "completed")?.id || "");
        const unfinished = imports.data.find((j: any) => active.includes(j.status));
        if (unfinished) {
          setJob(unfinished);
          setPhase(unfinished.status === "paused" ? "paused" : unfinished.status === "failed" ? "failed" : unfinished.status === "awaiting_upload" ? "ready" : "importing");
        }
      }).catch(() => { if (!cancelled) { setChecked(true); setError("historyFailed"); } });
    return () => { cancelled = true; };
  }, [clinicId, storageKey]);

  useEffect(() => {
    if (exportId || exported) localStorage.setItem(storageKey, JSON.stringify({ exportId, exported, candidate }));
  }, [exportId, exported, candidate, storageKey]);

  useEffect(() => {
    if (!exportId) return;
    let cancelled = false, pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await window.electronAPI?.migrationExportStatus({ jobId: exportId });
        if (cancelled) return;
        if (!result) { setError("exportFailed"); setPhase("failed"); setExportId(null); return; }
        if (result.status === "completed") {
          setExported({ zipPath: result.zipPath, summary: result.summary }); setExportId(null); setPhase("ready"); setProgress(0);
        } else if (result.status === "failed") { setError(result.error || "exportFailed"); setPhase("failed"); setExportId(null); }
      } catch { if (!cancelled) setError("exportFailed"); }
      finally { pending = false; }
    };
    void poll(); const timer = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [exportId]);

  useEffect(() => {
    if (!job?.id || !["queued", "running"].includes(job.status)) return;
    let cancelled = false, pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await apiClient.getMigrationImport(job.id);
        if (cancelled) return;
        if (response.error || !response.data) { setError("statusFailed"); return; }
        const next = response.data as any;
        setJob(next); setProgress(next.progress || 0);
        if (next.status === "completed") { setPhase("completed"); localStorage.removeItem(storageKey); }
        else if (next.status === "failed") { setPhase("failed"); setError("importFailed"); }
        else if (next.status === "paused") setPhase("paused");
      } catch { if (!cancelled) setError("statusFailed"); }
      finally { pending = false; }
    };
    void poll(); const timer = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [job?.id, job?.status, storageKey]);

  useEffect(() => {
    if (!job?.id || job.status !== "awaiting_upload") return;
    let cancelled = false, pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const status = await apiClient.getMigrationUploadStatus(job.id);
        if (cancelled || !status) return;
        if (["preparing", "uploading", "finalizing"].includes(status.status)) {
          setPhase("uploading"); setProgress(status.progress || 0);
        } else if (status.status === "completed") {
          const result = await apiClient.getMigrationImport(job.id);
          if (cancelled || result.error || !result.data) return;
          const next = result.data as any;
          setJob(next); setExported(null); localStorage.removeItem(storageKey);
          setPhase(next.status === "completed" ? "completed" : next.status === "failed" ? "failed" : next.status === "paused" ? "paused" : "importing");
        } else if (status.status === "failed") { setError("uploadFailed"); setPhase("failed"); }
      } catch { /* History/status polling still recovers the server job on reload. */ }
      finally { pending = false; }
    };
    void poll(); const timer = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [job?.id, job?.status, storageKey]);

  async function scan(kind?: "file" | "folder") {
    setError(null); setPhase("scanning"); setCandidate(null); setCandidates([]); setExported(null); localStorage.removeItem(storageKey);
    try {
      const electron = window.electronAPI;
      if (!electron?.migrationScan) throw new Error("windowsOnly");
      const inputPath = kind ? await electron.migrationSelectSource({ kind }) : undefined;
      if (kind && !inputPath) { setPhase("idle"); return; }
      const result = await electron.migrationScan({ sourceSystem: "opticplus", inputPath: inputPath || undefined });
      if (result.error || !result.supported) throw new Error(result.error || "windowsOnly");
      setCandidates(result.candidates);
      setCandidate(result.candidates.find((c: OpticPlusCandidate) => c.recommended) || null);
      if (!result.candidates.length) setError("noDatabase");
      setPhase("idle");
    } catch (e) { setError(e instanceof Error ? e.message : "scanFailed"); setPhase("failed"); }
  }

  async function prepare() {
    if (!candidate || !clinicId) return;
    if (limit && (!/^\d+$/.test(limit) || Number(limit) < 1 || !Number.isSafeInteger(Number(limit)))) { setError("invalidLimit"); return; }
    const ids = selectedIds.trim() ? selectedIds.split(',').map(value => Number(value.trim())) : undefined;
    if (ids && (limit || !ids.length || ids.some(id => !Number.isSafeInteger(id) || id < 1 || id > 2147483647) || new Set(ids).size !== ids.length)) {
      setError("invalidSelection"); return;
    }
    setPhase("exporting"); setError(null);
    try {
      const result = await window.electronAPI.migrationStartExport({ sourceSystem: "opticplus", clinicId, candidate,
        includeDocuments: documents, selectedClientIds: ids, clientImportLimit: limit ? Number(limit) : null });
      if (!result.success || !result.jobId) throw new Error(result.error || "exportFailed");
      setExportId(result.jobId);
    } catch (e) { setError(e instanceof Error ? e.message : "exportFailed"); setPhase("failed"); }
  }

  async function migrate() {
    if (!exported || !clinicId) return;
    setRequesting(true); setPhase("uploading"); setError(null);
    try {
      let target = job?.status === "awaiting_upload" ? job : null;
      if (!target) {
        const result = await apiClient.createMigrationImport({ clinicId, sourceSystem: "opticplus",
          sourceMetadata: { kind: "access-db", selected_client_ids: exported.summary.manifest.selected_client_ids }, exportSummary: exported.summary, includeDocuments: documents,
          clientImportLimit: exported.summary.manifest.client_limit, bundleFormatVersion: 2,
          sourceFingerprint: exported.summary.sourceFingerprint, previousImportJobId: previousId || null });
        if (result.error || !result.data) throw new Error("importFailed");
        target = result.data; setJob(target);
      }
      const result = await apiClient.uploadMigrationBundle(target.id, exported.zipPath);
      if (result.error || !(result as any).success) throw new Error("uploadFailed");
      setJob((result as any).data); setPhase("importing"); setExported(null); localStorage.removeItem(storageKey);
    } catch (e) { setError(e instanceof Error ? e.message : "importFailed"); setPhase("failed"); }
    finally { setRequesting(false); }
  }

  async function control(action: "pause" | "resume" | "cancel") {
    if (!job || requesting) return;
    setRequesting(true); setError(null);
    try {
      const result = action === "pause" ? await apiClient.pauseMigrationImport(job.id) : action === "resume" ?
        await apiClient.resumeMigrationImport(job.id) : await apiClient.cancelMigrationImport(job.id);
      if (result.error || !result.data) throw new Error("controlFailed");
      const next = result.data as any; setJob(next);
      setPhase(next.status === "cancelled" ? "idle" : next.status === "paused" ? "paused" : "importing");
      if (next.status === "cancelled") { setJob(null); setExported(null); localStorage.removeItem(storageKey); }
    } catch { setError("controlFailed"); }
    finally { setRequesting(false); }
  }

  async function download(id: string, archive = false) {
    try {
      const result = archive ? await apiClient.getMigrationSourceArchiveDownload(id) : await apiClient.getMigrationReportDownload(id);
      const url = (result.data as any)?.url;
      if (result.error || typeof url !== "string" || !url.startsWith("https://")) throw new Error();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch { setError("downloadFailed"); }
  }

  async function previewRollback(id: string) {
    setRequesting(true); setRollback(null);
    try {
      const result = await apiClient.getMigrationRollbackPreview(id);
      if (result.error || !result.data) throw new Error();
      setRollback(result.data);
    } catch { setError("controlFailed"); }
    finally { setRequesting(false); }
  }

  const errorKey = error?.replace(/^opticplus\./, "");
  const localizedError = errorKey === "invalidSelection" ? t("opticplusCards.invalidSelection") : errorKey && i18n.exists(`opticplus.${errorKey}`) ? tr(errorKey) : tr("operationFailed");
  const completedImports = history.filter(j => j.status === "completed");
  const hasJob = Boolean(job && active.includes(job.status));
  const warningCount = Object.entries(job?.import_summary?.counts || {}).reduce((sum, [key, value]) =>
    sum + (key.startsWith("warning:") ? Number(value) : 0), 0);
  return <Card dir={i18n.dir()}>
    <CardHeader><CardTitle>{tr("title")}</CardTitle><p className="text-start text-sm text-muted-foreground">{tr("description")}</p></CardHeader>
    <CardContent className="space-y-4">
      {!checked ? <p role="status">{tr("checking")}</p> : !enabled ? <p role="status">{tr("notEnabled")}</p> : null}
      {error && <p role="alert" className="text-destructive">{localizedError}</p>}
      <p role="status">{tr(`phase.${phase}`)}</p>
      {busy && <Progress value={phase === "importing" ? progress : undefined} />}
      {!hasJob && <>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => scan()} disabled={busy || !enabled || !clinicId}>{tr("scan")}</Button>
          <Button variant="outline" onClick={() => scan("file")} disabled={busy || !enabled || !clinicId}>{tr("chooseFile")}</Button>
          <Button variant="outline" onClick={() => scan("folder")} disabled={busy || !enabled || !clinicId}>{tr("chooseFolder")}</Button>
        </div>
        {candidates.length > 0 && <fieldset className="space-y-2"><legend>{tr("selectDatabase")}</legend>
          {candidates.map(c => <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-start">
            <input type="radio" name="opticplus-source" checked={candidate?.id === c.id} onChange={() => setCandidate(c)} disabled={busy || Boolean(exported)} />
            <span className="min-w-0"><span className="block break-all" dir="ltr">{c.dbFile}</span>
              <span>{tr("customerCount", { count: c.clients })}{c.recommended ? ` · ${tr("recommended")}` : ""}</span>
            </span></label>)}
        </fieldset>}
        <div className="space-y-2"><Label htmlFor="opticplus-limit">{tr("limit")}</Label>
          <Input id="opticplus-limit" inputMode="numeric" dir="ltr" value={limit} onChange={e => setLimit(e.target.value)} disabled={busy || Boolean(exported)} />
        </div>
        <div className="space-y-2"><Label htmlFor="opticplus-selection">{t("opticplusCards.selectedIds")}</Label>
          <Input id="opticplus-selection" dir="ltr" value={selectedIds} onChange={e => setSelectedIds(e.target.value)} disabled={busy || Boolean(exported)} />
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={documents} onChange={e => setDocuments(e.target.checked)} disabled={busy || Boolean(exported)} />{tr("documents")}</label>
        {completedImports.length > 0 && <div className="space-y-2"><Label htmlFor="opticplus-previous">{tr("previous")}</Label>
          <select id="opticplus-previous" className="w-full rounded-md border bg-field p-2" value={previousId} onChange={e => setPreviousId(e.target.value)} disabled={busy}>
            {completedImports.map(j => <option key={j.id} value={j.id}>{j.id}</option>)}
          </select><p className="text-sm text-muted-foreground">{tr("editProtection")}</p></div>}
        <Button onClick={prepare} disabled={!candidate || busy || !enabled || Boolean(exported)}>{tr("prepare")}</Button>
      </>}
      {exported && <div className="space-y-3 rounded-md border p-3">
        <p>{tr("review", { clients: exported.summary.clients, exams: exported.summary.exams, orders: exported.summary.orders })}</p>
        <p className="text-sm text-muted-foreground">{tr("archiveScope")}</p>
        <p className="text-sm text-muted-foreground">{tr("coverageNotice")}</p>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr><th className="text-start">{tr("table")}</th><th className="text-start">{tr("rows")}</th><th className="text-start">{tr("disposition")}</th></tr></thead>
          <tbody>{Object.entries(exported.summary.coverage || {}).map(([name, item]: [string, any]) => <tr key={name}><td dir="ltr">{name}</td><td>{item.rows}</td><td>{tr(`coverage.${item.disposition}`)}</td></tr>)}</tbody>
        </table></div>
        <Button onClick={migrate} disabled={busy || !enabled || (hasJob && job.status !== "awaiting_upload")}>{tr("start")}</Button>
      </div>}
      {warningCount > 0 && <p role="status" className="text-sm">{tr("warnings", { count: warningCount })}</p>}
      {job && <div className="flex flex-wrap gap-2">
        {["queued", "running"].includes(job.status) && <Button variant="outline" onClick={() => control("pause")} disabled={requesting}>{tr("pause")}</Button>}
        {["paused", "failed"].includes(job.status) && <Button onClick={() => control("resume")} disabled={requesting || !job.bundle_uploaded}>{tr("resume")}</Button>}
        {["awaiting_upload", "queued", "paused", "failed"].includes(job.status) && !job.checkpoint?.writes_started && <Button variant="outline" onClick={() => control("cancel")} disabled={requesting}>{tr("cancel")}</Button>}
        {job.import_summary?.report?.available && <Button variant="outline" onClick={() => download(job.id)}>{tr("report")}</Button>}
        {job.validation_summary?.manifest?.source_archive?.complete && <Button variant="outline" onClick={() => download(job.id, true)}>{tr("archive")}</Button>}
        {["paused", "failed", "completed"].includes(job.status) && <Button variant="outline" onClick={() => previewRollback(job.id)} disabled={requesting}>{tr("rollbackPreview")}</Button>}
      </div>}
      {rollback && <p role="status" className="text-sm">{tr("rollbackResult", { reviewable: rollback.counts?.reviewable || 0, retained: rollback.counts?.retained || 0 })}</p>}
      {job?.import_summary?.coverage && <div className="overflow-x-auto"><table className="w-full text-start text-sm">
        <thead><tr><th className="text-start">{tr("table")}</th><th className="text-start">{tr("rows")}</th><th className="text-start">{tr("disposition")}</th></tr></thead>
        <tbody>{Object.entries(job.import_summary.coverage).map(([name, item]: [string, any]) => <tr key={name}>
          <td dir="ltr">{name}</td><td>{item.rows}</td><td>{tr(`coverage.${item.disposition}`)}</td></tr>)}</tbody>
      </table></div>}
      {previousId && <OpticPlusReferenceData jobId={previousId} />}
      {completedImports.length > 0 && <div className="space-y-2"><h3 className="font-medium">{tr("history")}</h3>
        {completedImports.map(j => <div key={j.id} className="flex flex-wrap items-center gap-2"><span dir="ltr">{j.id}</span>
          {j.import_summary?.report?.available && <Button variant="outline" onClick={() => download(j.id)}>{tr("report")}</Button>}
          {j.validation_summary?.manifest?.source_archive?.complete && <Button variant="outline" onClick={() => download(j.id, true)}>{tr("archive")}</Button>}
          <Button variant="outline" onClick={() => previewRollback(j.id)} disabled={requesting}>{tr("rollbackPreview")}</Button>
        </div>)}
      </div>}
    </CardContent>
  </Card>;
}
