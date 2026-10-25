import React, { useEffect, useId } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider";
import { CanvasGradientEditor } from "@/components/canvas-gradient-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { setTheme } from "@/helpers/theme_helpers";
import { APPEARANCE_STYLES, COLOR_THEMES, isAppearanceStyle, isThemeMode } from "@/lib/appearance";
import { useAppLocale } from "@/localization/use-app-locale";
import { cn } from "@/lib/utils";

export function AppearanceTab({ persistMode = true }: { persistMode?: boolean }) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const id = useId();
  const { style, mode, palette, canvasElevation, setTheme: setLocalMode, setStyle, setPalette, setCanvasElevation, previewPalette } = useTheme();
  useEffect(() => () => previewPalette(null), [previewPalette]);

  return <div className="space-y-6 text-start" dir={direction} data-testid="appearance-settings">
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">{t("appearanceMenu")}</h2>
      <p className="text-sm text-muted-foreground">{t("appearanceSettingsDescription")}</p>
    </div>
    <Card>
      <CardHeader><CardTitle>{t("appearanceStyle")}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-style`}>{t("appearanceStyle")}</Label>
            <Select value={style} dir={direction} clearable={false} onValueChange={value => { if (isAppearanceStyle(value)) setStyle(value); }}>
              <SelectTrigger id={`${id}-style`} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(APPEARANCE_STYLES).map(([value, definition]) => <SelectItem key={value} value={value}>{t(definition.labelKey)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-mode`}>{t("appearanceMode")}</Label>
            <Select value={mode} dir={direction} clearable={false} onValueChange={value => { if (isThemeMode(value)) { if (persistMode) void setTheme(value); else setLocalMode(value); } }}>
              <SelectTrigger id={`${id}-mode`} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{(["light", "dark", "system"] as const).map(value => <SelectItem key={value} value={value}>{t(`appearance${value[0].toUpperCase()}${value.slice(1)}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div className="space-y-1">
            <Label htmlFor={`${id}-elevation`}>{t("appearanceRaisedSurfaces")}</Label>
            <p id={`${id}-elevation-description`} className="text-xs text-muted-foreground">{t("appearanceRaisedDescription")}</p>
          </div>
          <Switch id={`${id}-elevation`} aria-describedby={`${id}-elevation-description`} checked={canvasElevation === "lift"} onCheckedChange={checked => setCanvasElevation(checked ? "lift" : "flat")} />
        </div>
      </CardContent>
    </Card>
    {APPEARANCE_STYLES[style].supportsPalettes ? <Card>
      <CardHeader><CardTitle id={`${id}-palette`}>{t("appearancePalette")}</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-labelledby={`${id}-palette`} onPointerLeave={() => previewPalette(null)}>
          {Object.entries(COLOR_THEMES).map(([value, theme]) => <button key={value} type="button"
            aria-pressed={palette === value}
            className={cn("flex min-h-12 items-center gap-2 rounded-md border px-3 py-2 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", palette === value ? "border-primary bg-accent" : "border-border hover:bg-accent/50")}
            onClick={() => setPalette(value as keyof typeof COLOR_THEMES)}
            onPointerEnter={() => previewPalette(value as keyof typeof COLOR_THEMES)}
            onFocus={() => previewPalette(value as keyof typeof COLOR_THEMES)} onBlur={() => previewPalette(null)}>
            <span className="flex size-5 shrink-0 overflow-hidden rounded-full border" aria-hidden="true"><span className="w-1/2" style={{ backgroundColor: theme.primary }} /><span className="w-1/2" style={{ backgroundColor: theme.sidebar }} /></span>
            <span className="flex-1">{t(theme.labelKey)}</span>
            {palette === value ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          </button>)}
        </div>
      </CardContent>
    </Card> : null}
    <Card>
      <CardHeader className="gap-2"><CardTitle>{t("gradientEditor")}</CardTitle><p className="text-sm text-muted-foreground">{t("gradientDescription")}</p></CardHeader>
      <CardContent><CanvasGradientEditor inline /></CardContent>
    </Card>
  </div>;
}
