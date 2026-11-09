import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function BarcodeScannerPreferences() {
  const { t } = useTranslation();
  const { enabled, setEnabled } = useBarcodeScanner();
  const [failed, setFailed] = useState(false);
  return <Card>
    <CardHeader><CardTitle>{t("barcode.settings")}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <Button variant="outline" onClick={() => window.dispatchEvent(new Event("prysm:scan-history"))}>{t("scanner.connect")}</Button>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="barcode-scanner-enabled">{t("barcode.enable")}</Label>
        <Switch id="barcode-scanner-enabled" checked={enabled} onCheckedChange={value => {
          try { setEnabled(value); setFailed(false); } catch { setFailed(true); }
        }} />
      </div>
      <p className="text-sm text-muted-foreground">{t("barcode.preferenceHint")}</p>
      {failed && <p role="alert" className="text-sm text-destructive">{t("barcode.preferenceError")}</p>}
    </CardContent>
  </Card>;
}
