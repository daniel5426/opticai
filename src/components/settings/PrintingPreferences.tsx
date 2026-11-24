import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  isDirectPrintingEnabled,
  setDirectPrintingEnabled,
  supportsDirectPrinting,
} from "@/lib/pdf-exporter";
import { useAppLocale } from "@/localization/use-app-locale";

export function PrintingPreferences() {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const id = useId();
  const [enabled, setEnabled] = useState(isDirectPrintingEnabled);
  const [saveFailed, setSaveFailed] = useState(false);

  if (!supportsDirectPrinting()) return null;

  const save = (checked: boolean) => {
    try {
      setDirectPrintingEnabled(checked);
      setEnabled(checked);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  };

  return (
    <Card dir={direction} className="text-start">
      <CardHeader>
        <CardTitle>{t("printing.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor={id} className="block">{t("printing.direct")}</Label>
            <p id={`${id}-description`} className="text-sm text-muted-foreground">
              {t("printing.description")}
            </p>
          </div>
          <Switch id={id} aria-describedby={`${id}-description`} checked={enabled} onCheckedChange={save} />
        </div>
        {saveFailed && <p role="alert" className="mt-2 text-sm text-destructive">{t("printing.saveFailed")}</p>}
      </CardContent>
    </Card>
  );
}
