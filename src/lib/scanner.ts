import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { CatalogVariant } from './inventory';
export type ScanProvenance = { variant_id: number; source: string; scanned_at: number; fields: Record<string, unknown> };
export type ScanCommand = { id: string; device_id?: string; clinic_id?: number; request_id?: string; isCurrent?: () => boolean; barcode: string; variant_id?: number; variant?: CatalogVariant | null; source: string; status: string; created_at: number; lease: string; context: string; summary: { name?: string; category?: string; archived?: boolean } };
export type ScannerDevice = { id: string; name: string; clinic_id: number; online: boolean; recipient: string; lease: string; context: string; destination: string; secret?: string };
export type ScanTarget = { id: string; category?: string; kind: string; label: string; canApply: boolean; hasValue?: boolean; variantId?: number; apply: (variant: CatalogVariant, scan: ScanCommand) => void | Promise<void>; edit?: () => void; resolveCountVariant?: (variantId:number) => CatalogVariant | undefined };
const targets = new Map<string, ScanTarget & { element: React.RefObject<HTMLDivElement | null> }>();
const subscribers = new Set<() => void>();
let version = 0;
const changed = () => { version++; subscribers.forEach(fn => fn()); };
export function useScanTarget(target: ScanTarget) {
  const element = useRef<HTMLDivElement>(null);
  const current = useRef(target); current.current = target;
  useEffect(() => {
    targets.set(target.id, { ...current.current, element }); changed();
    return () => { targets.delete(target.id); changed(); };
  }, [target.id, target.canApply]);
  useEffect(() => { const entry = targets.get(target.id); if (entry) Object.assign(entry, current.current); }, [target]);
  return useCallback((node:HTMLDivElement|null)=>{element.current=node;queueMicrotask(changed);},[]);
}
export function visibleScanTargets() { return [...targets.values()].filter(t => t.element.current?.getClientRects().length); }
export function useScanTargetsVersion() { return useSyncExternalStore(fn => { subscribers.add(fn); return () => { subscribers.delete(fn); }; }, () => version); }
export function scanMetadata(data: any): Record<string, ScanProvenance> {
  try { return typeof data?._scan_provenance === 'string' ? JSON.parse(data._scan_provenance) : data?._scan_provenance || {}; } catch { return {}; }
}
export function scanned(data: any, slot: string) {
  const value = scanMetadata(data)[slot];
  return !!value && Object.entries(value.fields).every(([key, val]) => String(data[key] ?? '') === String(val ?? ''));
}
export function provenance(data: any, slot: string, fields: Record<string, unknown>, variant: CatalogVariant, scan: ScanCommand) {
  return JSON.stringify({ ...scanMetadata(data), [slot]: { variant_id: variant.id, source: scan.source, scanned_at: scan.created_at, fields } });
}
let runScan: ((input: { barcode?: string; variant_id?: number; source: 'reader' | 'history'; signal?: AbortSignal; onReady?: () => void }) => Promise<void>) | undefined;
export function setScanDispatcher(fn: typeof runScan) { runScan = fn; }
export async function dispatchBarcode(barcode: string, signal?: AbortSignal) { if (!runScan) return false; await runScan({ barcode, source: 'reader', ...(signal ? {signal} : {}) }); return true; }
export async function replayScan(variant_id: number, onReady?: () => void) {
  if (!runScan) throw new Error('scanner.offline');
  await runScan({ variant_id, source: 'history', ...(onReady ? {onReady} : {}) });
}
let requestChoice: ((title: string, choices: { label: string; value: string }[]) => Promise<string | null>) | undefined;
export function setScanChoice(fn: typeof requestChoice) { requestChoice = fn; }
export async function chooseScan(title: string, choices: {label: string; value: string}[]) { return requestChoice?.(title, choices) ?? null; }

/** Incremental SSE parser shared by the main app and the isolated phone bundle. */
export async function readScannerEvents(response: Response, signal: AbortSignal, receive: (event: string, value: any, id: string) => void) {
  if (!response.ok || !response.body) throw new Error('scanner.offline');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary+2);
        const lines = block.split('\n'); const data = lines.filter(x => x.startsWith('data:')).map(x => x.slice(5).trimStart()).join('\n');
        if (data) receive(lines.find(x => x.startsWith('event:'))?.slice(6).trim() || 'message', JSON.parse(data), lines.find(x => x.startsWith('id:'))?.slice(3).trim() || '');
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
