import { useEffect, useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { useAppLocale } from "@/localization/use-app-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import type { CatalogVariant, InventoryCategory } from "@/lib/inventory";

type ScanProps = {
  onScan: (code: string, signal: AbortSignal) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  description?: string;
  keepOpen?: boolean;
};

/** Keyboard-wedge USB/Bluetooth scanners: capture only inside an explicit scan dialog. */
export function BarcodeScanButton({ onScan, disabled, label, description, keepOpen = false }: ScanProps) {
  const { enabled } = useBarcodeScanner();
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [lastCode, setLastCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!enabled || disabled) {
      pending.current?.abort();
      pending.current = null;
      setOpen(false);
      setBusy(false);
    }
  }, [disabled, enabled]);

  const changeOpen = (next: boolean) => {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setCode("");
    setLastCode("");
    setError("");
    setOpen(next);
  };
  const scan = async () => {
    if (pending.current) return;
    const value = code.trim();
    if (!value || value.length > 256 || /[\x00-\x1f\x7f]/.test(value)) {
      setError(t("barcode.invalid"));
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      await onScan(value, controller.signal);
      if (!controller.signal.aborted) {
        if (keepOpen) { setCode(""); setLastCode(value); input.current?.focus(); }
        else changeOpen(false);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : t("barcode.lookupError"));
        input.current?.focus();
        input.current?.select();
      }
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  };
  if (!enabled) return null;
  const title = label || t("barcode.scan");
  return <>
    <Button type="button" size={label ? "sm" : "icon"} variant="outline" disabled={disabled} onClick={() => changeOpen(true)} aria-label={title} title={title}>
      <ScanBarcode aria-hidden="true" className="size-4" />{label && <span>{title}</span>}
    </Button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent dir={direction} className="sm:max-w-md" onKeyDown={event => event.stopPropagation()} onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }}>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{t("barcode.scanHint")} {description}</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="scanner-code">{t("barcode.code")}</Label>
          <Input ref={input} id="scanner-code" dir="ltr" autoComplete="off" value={code} readOnly={busy} maxLength={256}
            onChange={event => { setCode(event.target.value); setError(""); }}
            onKeyDown={event => {
              if (event.key === "Enter" || (event.key === "Tab" && code.trim() && !event.shiftKey)) {
                event.preventDefault(); event.stopPropagation(); void scan();
              }
            }} />
          {lastCode && <p role="status" className="text-sm text-muted-foreground">{t("barcode.scanned")} <bdi dir="ltr">{lastCode}</bdi></p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)}>{t("cancel")}</Button>
          <Button type="button" disabled={busy || !code.trim()} onClick={() => void scan()}>{t(busy ? "loading" : "barcode.use")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

export function ProductBarcodeScan({ clinicId, category, orderId, orderKind, stockableOnly, onSelect, ...props }: Omit<ScanProps, "onScan"> & {
  clinicId?: number;
  category?: InventoryCategory;
  orderId?: number;
  orderKind?: "regular" | "contact";
  stockableOnly?: boolean;
  onSelect: (variant: CatalogVariant) => void;
}) {
  const { t } = useTranslation();
  return <BarcodeScanButton {...props} disabled={props.disabled || !clinicId} onScan={async (code, signal) => {
    if (!clinicId) return;
    let response: Awaited<ReturnType<typeof apiClient.getInventoryVariants>>;
    try { response = await apiClient.getInventoryVariants(clinicId, { barcode: code, category, orderId, orderKind, stockableOnly }); }
    catch { throw new Error(t("barcode.lookupError")); }
    if (signal.aborted) return;
    if (response.error || !response.data) throw new Error(t("barcode.lookupError"));
    const matches = response.data.items.filter(item => item.barcode === code && !item.archived_at && !item.product.archived_at);
    if (!matches.length) throw new Error(t("barcode.notFound"));
    if (matches.length > 1) throw new Error(t("barcode.ambiguous"));
    onSelect(matches[0]);
  }} />;
}
